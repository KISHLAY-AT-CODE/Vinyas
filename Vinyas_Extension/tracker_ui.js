function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

window.injectFloatingTrackerWidget = function (syncId, apiUrl, pdfUrl, exists, assignmentData, clickHistory, customAssignmentTypes) {
    const existing = document.getElementById('vinyas-tracker-widget-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-tracker-widget-host';
    host.style.cssText = `position:fixed;inset:0;z-index:2147483647;pointer-events:none;`;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    const logoUrl = chrome.runtime.getURL('favicon.ico');

    // Local State
    let isTrackerMode = exists;
    let questionCount = assignmentData?.questionCount || 0;
    let questionStates = assignmentData?.questionStates || {};
    let questionRemarks = assignmentData?.questionRemarks || {};
    let selectedQNum = null;
    let assignmentName = assignmentData?.name || (clickHistory.length > 0 ? clickHistory[0].assignmentName : document.title.replace(/\.pdf$/i, '').trim() || 'Assignment');
    let assignmentChapter = assignmentData?.chapterName || (clickHistory.length > 0 ? clickHistory[0].chapterName : '');
    let assignmentSubject = assignmentData?.subjectName || (clickHistory.length > 0 ? clickHistory[0].subjectName : '');
    let assignmentType = assignmentData?.type || 'DPP';
    let initialAssignmentName = assignmentName;
    let initialAssignmentType = assignmentType;
    let isLoadingSyllabus = true;
    let isSaving = false;
    let isSyncing = false;
    let saveTimer = null;

    let isDraggingQ = false;
    let isDraggingInfo = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let isDirty = false;
    let lastLeft = `${window.innerWidth / 2 - 300}px`;
    let lastTop = `16px`;
    let infoLeft = `${window.innerWidth / 2 - 275}px`;
    let infoTop = `80px`;
    let showQuestionPill = exists;
    let showInfoPill = !exists;
    let isMenuOpen = false;
    let isCustomTypeModalOpen = false;

    // Syllabus for Initialization Dropdowns
    let subjectsList = [];
    let selectedSubjectIdx = 0;
    let selectedChapterIdx = 0;
    let newSubjectName = '';
    let newChapterName = assignmentChapter;
    let showNewSubjectInput = false;
    let showNewChapterInput = false;

    const autoMatchChapter = (subjects) => {
        const searchTitle = assignmentChapter.toLowerCase().trim();
        if (!searchTitle) return;

        for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
            const sub = subjects[sIdx];
            if (sub.chapters) {
                for (let cIdx = 0; cIdx < sub.chapters.length; cIdx++) {
                    const chap = sub.chapters[cIdx];
                    if (chap.name.toLowerCase().trim() === searchTitle) {
                        selectedSubjectIdx = sIdx;
                        selectedChapterIdx = cIdx;
                        showNewSubjectInput = false;
                        showNewChapterInput = false;
                        return;
                    }
                }
            }
        }

        for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
            const sub = subjects[sIdx];
            if (sub.chapters) {
                for (let cIdx = 0; cIdx < sub.chapters.length; cIdx++) {
                    const chap = sub.chapters[cIdx];
                    if (chap.name.toLowerCase().includes(searchTitle) || searchTitle.includes(chap.name.toLowerCase())) {
                        selectedSubjectIdx = sIdx;
                        selectedChapterIdx = cIdx;
                        showNewSubjectInput = false;
                        showNewChapterInput = false;
                        return;
                    }
                }
            }
        }

        if (subjects.length > 0) {
            selectedSubjectIdx = 0;
            selectedChapterIdx = -1;
            showNewChapterInput = true;
        } else {
            selectedSubjectIdx = -1;
            selectedChapterIdx = -1;
            showNewSubjectInput = true;
            showNewChapterInput = true;
        }
    };

    chrome.runtime.sendMessage({
        action: "fetchSyllabus",
        data: { syncId, apiUrl }
    }, (res) => {
        isLoadingSyllabus = false;
        if (res && res.success && res.data) {
            let rawData = res.data.data;
            // Unwrap serialized syllabus format { isRaw: true, data: [...] }
            if (rawData && !Array.isArray(rawData) && rawData.isRaw && Array.isArray(rawData.data)) {
                rawData = rawData.data;
            }
            subjectsList = Array.isArray(rawData) ? rawData : [];
            autoMatchChapter(subjectsList);
        }
        render();
    });



    const autoSaveProgress = (callback) => {
        if (!isTrackerMode || isSaving) return;
        isSaving = true;
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        render();

        // Safety timeout to prevent stuck loading indicator if the connection is slow or fails
        const safetyTimeout = setTimeout(() => {
            if (isSaving) {
                console.warn("[Vinyas Tracker] Save operation timed out. Resetting loader.");
                isSaving = false;
                render();
            }
        }, 5000);

        try {
            // Trim remarks before sending to avoid storing trailing/leading whitespace in DB
            const cleanRemarks = {};
            for (const q in questionRemarks) {
                const val = questionRemarks[q] ? questionRemarks[q].trim() : '';
                if (val) {
                    cleanRemarks[q] = val;
                }
            }

            chrome.runtime.sendMessage({
                action: "syncAssignmentProgress",
                data: { syncId, apiUrl, url: pdfUrl, questionCount, questionStates, questionRemarks: cleanRemarks }
            }, (res) => {
                clearTimeout(safetyTimeout);
                isSaving = false;
                if (chrome.runtime.lastError) {
                    console.warn("[Vinyas Tracker] Message error:", chrome.runtime.lastError.message);
                }
                if (res && res.success) {
                    console.log("[Vinyas Tracker] Progress autosaved.");
                    isDirty = false;
                }
                if (callback) callback(res && res.success);
                render();
            });
        } catch (e) {
            console.error("[Vinyas Tracker] Autosave failed synchronously:", e);
            clearTimeout(safetyTimeout);
            isSaving = false;
            render();
        }
    };

    const triggerSave = (autoSave) => {
        isDirty = true;
        render();
        if (autoSave) {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                autoSaveProgress();
            }, 1500);
        }
    };

    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = 'Are you sure you have unsaved changes?';
            return e.returnValue;
        }
    });

    const getStats = () => {
        let completed = 0; let difficult = 0; let later = 0;
        for (let q = 1; q <= questionCount; q++) {
            const state = questionStates[q];
            if (state === 'completed') completed++;
            else if (state === 'difficult') difficult++;
            else if (state === 'later') later++;
        }
        const compPct = questionCount > 0 ? Math.round((completed / questionCount) * 100) : 0;
        return { completed, difficult, later, compPct };
    };



    const render = () => {
        // Save current focus and cursor selection context before redrawing the DOM
        let activeId = null;
        let selectionStart = 0;
        let selectionEnd = 0;
        
        const activeEl = shadow.activeElement;
        if (activeEl) {
            activeId = activeEl.id;
            if (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') {
                selectionStart = activeEl.selectionStart;
                selectionEnd = activeEl.selectionEnd;
            }
        }

        const stats = getStats();
        const hasMetaChanges = exists && (
            assignmentName.trim() !== initialAssignmentName.trim() ||
            assignmentType !== initialAssignmentType
        );
        const css = `
            * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .pill-container {
                position: absolute;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 24px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.08);
                pointer-events: all;
                color: #f8fafc;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transition: height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .question-pill {
                width: 640px;
                z-index: 2147483645;
            }
            .info-pill {
                z-index: 2147483644;
                width: max-content;
                min-width: 620px;
                max-width: 90vw;
            }
            .top-row {
                display: flex;
                align-items: center;
                height: 60px;
                padding: 0 16px;
                gap: 12px;
            }
            .drag-handle { cursor: grab; color: #64748b; display: flex; align-items: center; padding: 4px; }
            .drag-handle:active { cursor: grabbing; color: #94a3b8; }
            .logo-img { width: 24px; height: 24px; border-radius: 6px; }
            .divider { width: 1px; height: 24px; background: rgba(255, 255, 255, 0.1); }
            
            .input-field {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #f1f5f9;
                font-size: 13px;
                font-weight: 600;
                padding: 8px 12px;
                outline: none;
                transition: all 0.2s ease-in-out;
                height: 38px;
            }
            .input-field:focus {
                border-color: #3b82f6;
                background: rgba(15, 23, 42, 0.9);
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            select.input-field {
                appearance: none;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 10px center;
                background-repeat: no-repeat;
                background-size: 16px;
                padding-right: 32px;
            }
            
            .chapter-input { width: 200px; cursor: pointer; }
            .name-input { width: 180px; }
            .type-select { width: 110px; cursor: pointer; }
            .qcount-input { width: 60px; text-align: center; }
            
            .btn {
                padding: 8px 16px; border: none; border-radius: 10px; font-size: 13px;
                font-weight: 700; cursor: pointer; transition: all 0.2s;
                display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                height: 38px;
                flex-shrink: 0;
            }
            .btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; box-shadow: 0 2px 10px rgba(59,130,246,0.3); }
            .btn-primary:hover { box-shadow: 0 4px 15px rgba(59,130,246,0.4); transform: translateY(-1px); }
            .btn-success { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 2px 10px rgba(16,185,129,0.3); }
            .btn-ghost { background: rgba(255,255,255,0.05); color: #cbd5e1; display:flex; align-items:center; justify-content:center; }
            .btn-ghost:hover { background: rgba(255,255,255,0.1); color: #fff; }
            
            .questions-scroll { flex: 1; display: flex; align-items: center; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent; }
            .questions-scroll::-webkit-scrollbar { height: 4px; }
            .questions-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
            
            .q-btn {
                flex-shrink: 0; width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
                background: rgba(0,0,0,0.3); color: #94a3b8; font-size: 11px; font-weight: 800; cursor: pointer; transition: all 0.15s; position: relative;
            }
            .q-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
            .q-btn.active { box-shadow: inset 0 0 0 2px #fff; }
            .q-state-completed { background: #059669; color: #fff; border-color: #047857; }
            .q-state-difficult { background: #e11d48; color: #fff; border-color: #be123c; }
            .q-state-later { background: #d97706; color: #fff; border-color: #b45309; }
            
            .remark-dot { position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #3b82f6; border-radius: 50%; border: 1px solid #0f172a; }
            .dirty-dot { position: absolute; top: 4px; right: 4px; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; box-shadow: 0 0 6px #f59e0b; }
            .untracked-msg { font-size: 12px; font-weight: 700; color: #94a3b8; margin-left: 10px; }
            .pill-label { font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-left: 8px; }
            
            .stats-badge { font-size: 10px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.15); padding: 4px 8px; border-radius: 12px; margin-left: auto; }
            
            .remarks-row { display: flex; align-items: center; padding: 12px 16px; background: rgba(0,0,0,0.3); border-top: 1px solid rgba(255,255,255,0.05); gap: 12px; }
            .remarks-label { font-size: 11px; font-weight: 700; color: #94a3b8; white-space: nowrap; }
            .remarks-input { flex: 1; height: 36px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #e2e8f0; font-size: 12px; padding: 8px 12px; outline: none; }
            
            .spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }
            .loading-text {
                font-size: 11px;
                font-weight: 700;
                color: #94a3b8;
                letter-spacing: 0.5px;
                text-transform: uppercase;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Overlays */
            .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.8); backdrop-filter: blur(8px); z-index: 2147483646; display: flex; align-items: center; justify-content: center; padding: 20px; pointer-events: all; }
            .modal-card { background: #0f172a; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; width: 100%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; }
            .modal-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); }
            .modal-title { font-size: 14px; font-weight: 800; color: white; }
            .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
            .modal-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; background: rgba(0,0,0,0.2); }
            
            .tab-row { display: flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 12px; }
            .tab-btn { flex: 1; padding: 8px; border: none; background: transparent; color: #64748b; font-size: 11px; font-weight: 700; border-radius: 8px; cursor: pointer; }
            .tab-btn.active { background: rgba(255,255,255,0.1); color: white; }
            
            .form-group { display: flex; flex-direction: column; gap: 6px; }
            .form-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
            .form-select { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; color: white; font-size: 13px; outline: none; cursor: pointer; }
            .form-select option { background: #0f172a; }
            
            .markdown-area { width: 100%; height: 250px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: #e2e8f0; font-size: 12px; padding: 12px; outline: none; resize: none; font-family: monospace; }
            
            /* Circular Launcher styles */
            .launcher-container {
                position: fixed;
                right: 24px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2147483647;
                pointer-events: all;
            }
            .trigger-btn {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6, #10b981);
                border: 2px solid rgba(255, 255, 255, 0.15);
                box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                z-index: 10;
                padding: 0;
                outline: none;
            }
            .trigger-btn:hover {
                transform: scale(1.08);
                box-shadow: 0 0 25px rgba(59, 130, 246, 0.6);
            }
            .launcher-container.active .trigger-btn {
                transform: rotate(135deg) scale(0.9);
                background: linear-gradient(135deg, #ef4444, #f59e0b);
                box-shadow: 0 0 25px rgba(239, 68, 68, 0.5);
            }
            .trigger-logo {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                object-fit: cover;
                transition: all 0.3s;
            }
            .launcher-container.active .trigger-logo {
                filter: brightness(0) invert(1);
            }
            .action-btn {
                position: absolute;
                width: 42px;
                height: 42px;
                border-radius: 50%;
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 8px 16px rgba(0,0,0,0.3);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                z-index: 1;
                opacity: 0;
                pointer-events: none;
                transform: translate(0, 0) scale(0.5);
                padding: 0;
                outline: none;
                color: #cbd5e1;
            }
            .action-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: #3b82f6;
                transform: scale(1.1);
                color: #fff;
            }
            .action-btn.active {
                border-color: #10b981;
                background: rgba(16, 185, 129, 0.15);
                box-shadow: 0 0 10px rgba(16, 185, 129, 0.2);
                color: #10b981;
            }
            .action-btn .icon {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .launcher-container.active .action-btn {
                opacity: 1;
                pointer-events: all;
            }
            .launcher-container.active .action-btn:nth-child(1) { transform: translate(-65px, -65px) scale(1); }
            .launcher-container.active .action-btn:nth-child(2) { transform: translate(-95px, 0px) scale(1); }
            .launcher-container.active .action-btn:nth-child(3) { transform: translate(-65px, 65px) scale(1); }
            .launcher-container.active .action-btn:nth-child(4) { transform: translate(0px, 65px) scale(1); }
        `;

        let customOptionsHTML = '';
        customAssignmentTypes.forEach(t => {
            customOptionsHTML += `<option value="${escapeHTML(t)}" ${assignmentType === t ? 'selected' : ''}>${escapeHTML(t)}</option>`;
        });

        let questionsHTML = '';
        for (let q = 1; q <= questionCount; q++) {
            const state = questionStates[q] || 'none';
            const hasRemark = !!questionRemarks[q];
            let stateCls = ''; let text = `Q${q}`;
            if (state === 'completed') { stateCls = 'q-state-completed'; text = `✓`; }
            else if (state === 'difficult') { stateCls = 'q-state-difficult'; text = `!`; }
            else if (state === 'later') { stateCls = 'q-state-later'; text = `⌛`; }
            questionsHTML += `<button class="q-btn ${stateCls} ${selectedQNum === q ? 'active' : ''}" data-q="${q}" title="Question ${q}">
                ${text}
                ${hasRemark ? '<div class="remark-dot"></div>' : ''}
            </button>`;
        }

        let subjectOptionsHTML = '';
        subjectsList.forEach((sub, idx) => {
            subjectOptionsHTML += `<option value="${idx}" ${selectedSubjectIdx === idx ? 'selected' : ''}>${escapeHTML(sub.name)}</option>`;
        });
        subjectOptionsHTML += `<option value="-1" ${selectedSubjectIdx === -1 ? 'selected' : ''}>+ New Subject</option>`;

        let chapterOptionsHTML = '';
        if (selectedSubjectIdx !== -1 && subjectsList[selectedSubjectIdx]) {
            const chapters = subjectsList[selectedSubjectIdx].chapters || [];
            chapters.forEach((chap, idx) => {
                chapterOptionsHTML += `<option value="${idx}" ${selectedChapterIdx === idx ? 'selected' : ''}>${escapeHTML(chap.name)}</option>`;
            });
        }
        chapterOptionsHTML += `<option value="-1" ${selectedChapterIdx === -1 ? 'selected' : ''}>+ New Chapter</option>`;

        shadow.innerHTML = `
        <style>${css}</style>
        
        <!-- Floating Circular Launcher Menu -->
        <div class="launcher-container ${isMenuOpen ? 'active' : ''}">
            <button class="action-btn q-toggle ${showQuestionPill ? 'active' : ''}" id="menu-btn-questions" title="Toggle Question Tracker">
                <span class="icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-list-todo"><rect x="3" y="5" width="6" height="6" rx="1"/><path d="M13 7h8"/><rect x="3" y="13" width="6" height="6" rx="1"/><path d="M13 15h8"/></svg>
                </span>
            </button>
            <button class="action-btn info-toggle ${showInfoPill ? 'active' : ''}" id="menu-btn-info" title="Toggle Assignment Info">
                <span class="icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                </span>
            </button>
            <button class="action-btn dashboard-link" id="menu-btn-dashboard" title="Open Vinyas Dashboard">
                <span class="icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-dashboard"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="10" rx="1"/><rect width="7" height="5" x="3" y="14" rx="1"/></svg>
                </span>
            </button>
            <button class="action-btn close-widget" id="menu-btn-close" title="Remove Widget from Page">
                <span class="icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </span>
            </button>
            
            <button class="trigger-btn" id="menu-trigger" title="Vinyas Menu">
                <img class="trigger-logo" src="${logoUrl}" alt="V">
            </button>
        </div>

        <!-- Question Tracker Pill -->
        ${showQuestionPill ? `
            <div class="pill-container question-pill" style="left: ${lastLeft}; top: ${lastTop};">
                ${isDirty ? '<div class="dirty-dot" title="Unsaved Changes..."></div>' : ''}
                <div class="top-row">
                    <div class="drag-handle" id="drag-handle-q" title="Drag Widget">
                        <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
                            <circle cx="3" cy="3" r="1.2"/><circle cx="3" cy="9" r="1.2"/><circle cx="3" cy="15" r="1.2"/>
                            <circle cx="9" cy="3" r="1.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>
                        </svg>
                    </div>
                    
                    ${!isTrackerMode ? `
                        <div class="untracked-msg">Tracker not initialized. Enable in Info panel.</div>
                    ` : questionCount === 0 ? `
                        <span class="pill-label">Questions:</span>
                        <input type="number" class="input-field qcount-input" id="input-qcount" value="10" min="1" ${isSaving ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''} />
                        <button class="btn btn-primary" id="btn-add-q" ${isSaving ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                            ${isSaving ? '...' : 'Add Qs'}
                        </button>
                    ` : `
                        <div class="questions-scroll" id="questions-container">
                            ${questionsHTML}
                        </div>
                        <button class="btn btn-ghost" id="btn-add-more-q" title="Add 5 More Questions" style="padding: 6px;" ${isSaving ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                            ${isSaving ? '...' : '+'}
                        </button>
                        <div class="divider"></div>
                        <button class="btn btn-primary" id="btn-force-save" title="Save Progress" style="padding: 8px;" ${isSaving ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                            ${isSaving ? '...' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path><path d="M7 3v4a1 1 0 0 0 1 1h7"></path></svg>'}
                        </button>
                        <div class="stats-badge">${stats.compPct}%</div>
                    `}
                </div>
                ${selectedQNum ? `
                    <div class="remarks-row">
                        <div class="remarks-label">Remark for Q${selectedQNum}</div>
                        <input type="text" class="remarks-input" id="remark-text" value="${escapeHTML(questionRemarks[selectedQNum] || '')}" placeholder="Add a note... e.g. Silly mistake with signs." />
                        <button class="btn btn-ghost" id="btn-close-remark" style="padding: 8px;">✕</button>
                    </div>
                ` : ''}
            </div>
        ` : ''}

        <!-- Assignment Info / Renaming Pill -->
        ${showInfoPill ? `
            <div class="pill-container info-pill" style="left: ${infoLeft}; top: ${infoTop};">
                <div class="top-row">
                    <div class="drag-handle" id="drag-handle-info" title="Drag Widget">
                        <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
                            <circle cx="3" cy="3" r="1.2"/><circle cx="3" cy="9" r="1.2"/><circle cx="3" cy="15" r="1.2"/>
                            <circle cx="9" cy="3" r="1.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>
                        </svg>
                    </div>
                    
                    ${!isTrackerMode ? (
                    isLoadingSyllabus ? `
                            <div style="display:flex; align-items:center; gap:10px; padding-left:12px; height: 38px; flex: 1;">
                                <div class="spinner"></div>
                                <span class="loading-text">Loading syllabus & chapters...</span>
                            </div>
                        ` : `
                            <!-- Subject Selection -->
                            <select class="input-field" id="init-subject-select" style="width: 170px;" title="Select Subject" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                                ${subjectOptionsHTML}
                            </select>
                            <!-- Chapter Selection -->
                            <select class="input-field" id="init-chapter-select" style="width: 170px;" title="Select Chapter" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                                ${chapterOptionsHTML}
                            </select>
                            <input type="text" class="input-field name-input" id="input-name" value="${escapeHTML(assignmentName)}" placeholder="Assignment" title="Assignment Name" style="width: 160px;" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''} />
                            <select class="input-field type-select" id="input-type" title="Assignment Type" style="width: 100px;" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                                <option value="DPP" ${assignmentType === 'DPP' ? 'selected' : ''}>DPP</option>
                                <option value="Module" ${assignmentType === 'Module' ? 'selected' : ''}>Module</option>
                                <option value="Test" ${assignmentType === 'Test' ? 'selected' : ''}>Test</option>
                                <option value="Notes" ${assignmentType === 'Notes' ? 'selected' : ''}>Notes</option>
                                ${customOptionsHTML}
                                <option value="Custom">+ Custom</option>
                            </select>
                            <button class="btn btn-primary" id="btn-sync" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>${isSyncing ? '...' : (exists ? 'Initialize Again' : 'Initialize Tracker')}</button>
                        `
                ) : `
                        <button class="btn btn-ghost" id="btn-link-resolve" title="Modify Chapter Link" style="padding:8px;" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        </button>
                        <input type="text" class="input-field chapter-input" id="input-chapter" value="${escapeHTML(assignmentChapter)}" placeholder="Chapter Name" title="Chapter Name" readonly style="width: 200px; ${isSyncing ? 'pointer-events:none; opacity:0.7;' : ''}" />
                        <input type="text" class="input-field name-input" id="input-name" value="${escapeHTML(assignmentName)}" placeholder="Assignment" title="Assignment Name" style="width: 180px;" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''} />
                        <select class="input-field type-select" id="input-type" title="Assignment Type" style="width: 110px;" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>
                            <option value="DPP" ${assignmentType === 'DPP' ? 'selected' : ''}>DPP</option>
                            <option value="Module" ${assignmentType === 'Module' ? 'selected' : ''}>Module</option>
                            <option value="Test" ${assignmentType === 'Test' ? 'selected' : ''}>Test</option>
                            <option value="Notes" ${assignmentType === 'Notes' ? 'selected' : ''}>Notes</option>
                            ${customOptionsHTML}
                            <option value="Custom">+ Custom</option>
                        </select>
                        ${hasMetaChanges ? `
                            <button class="btn btn-primary" id="btn-sync" ${isSyncing ? 'disabled style="pointer-events:none; opacity:0.7;"' : ''}>${isSyncing ? '...' : 'Initialize Again'}</button>
                        ` : ''}
                    `}
                </div>
                
                <!-- New creation inputs inside the Pill if customizing -->
                ${!isTrackerMode && (showNewSubjectInput || showNewChapterInput) ? `
                    <div class="creation-row" style="display: flex; gap: 8px; padding: 0 16px 12px 36px; background: rgba(0,0,0,0.15); border-top: 1px solid rgba(255,255,255,0.05); align-items: center; width: 100%;">
                        ${showNewSubjectInput ? `
                            <div style="flex: 1;">
                                <input type="text" class="input-field" id="input-new-subject" value="${escapeHTML(newSubjectName)}" placeholder="New Subject Name" style="width: 100%;" />
                            </div>
                        ` : ''}
                        ${showNewChapterInput ? `
                            <div style="flex: 1;">
                                <input type="text" class="input-field" id="input-new-chapter" value="${escapeHTML(newChapterName)}" placeholder="New Chapter Name" style="width: 100%;" />
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        ` : ''}

        <!-- Custom Type Overlay -->
        ${isCustomTypeModalOpen ? `
            <div class="overlay" id="custom-type-overlay">
                <div class="modal-card">
                    <div class="modal-header"><div class="modal-title">New Custom Type</div></div>
                    <div class="modal-body">
                        <input type="text" class="input-field" id="input-new-type" placeholder="e.g. CTQ" style="font-size:14px; padding:12px;" />
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" id="btn-cancel-type" style="flex:1">Cancel</button>
                        <button class="btn btn-primary" id="btn-save-type" style="flex:1">Save</button>
                    </div>
                </div>
            </div>
        ` : ''}


        `;

        bindEvents();

        // Restore focus and cursor selection range to avoid unfocusing during inputs
        if (activeId) {
            const newActiveEl = shadow.getElementById(activeId);
            if (newActiveEl) {
                newActiveEl.focus();
                if (newActiveEl.tagName === 'INPUT' || newActiveEl.tagName === 'TEXTAREA') {
                    newActiveEl.selectionStart = selectionStart;
                    newActiveEl.selectionEnd = selectionEnd;
                }
            }
        }
    };

    const bindEvents = () => {
        // Stop keyboard/clipboard event propagation on all inputs/textareas to prevent host page handlers from blocking spaces, copy-paste, etc.
        shadow.querySelectorAll('input, textarea, select').forEach(el => {
            ['keydown', 'keyup', 'keypress', 'copy', 'cut', 'paste'].forEach(type => {
                el.addEventListener(type, (e) => {
                    e.stopPropagation();
                });
            });
        });

        // Drag logic for Question Pill
        const handleQ = shadow.getElementById('drag-handle-q');
        if (handleQ) {
            handleQ.addEventListener('mousedown', (e) => {
                isDraggingQ = true;
                const pill = shadow.querySelector('.question-pill');
                if (pill) {
                    const rect = pill.getBoundingClientRect();
                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }
                document.addEventListener('mousemove', onMouseMoveQ);
                document.addEventListener('mouseup', onMouseUpQ);
            });
        }
        const onMouseMoveQ = (e) => {
            if (!isDraggingQ) return;
            const pill = shadow.querySelector('.question-pill');
            if (pill) {
                lastLeft = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - pill.offsetWidth)) + 'px';
                lastTop = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - pill.offsetHeight)) + 'px';
                pill.style.left = lastLeft;
                pill.style.top = lastTop;
            }
        };
        const onMouseUpQ = () => {
            isDraggingQ = false;
            document.removeEventListener('mousemove', onMouseMoveQ);
            document.removeEventListener('mouseup', onMouseUpQ);
            render();
        };

        // Drag logic for Info Pill
        const handleInfo = shadow.getElementById('drag-handle-info');
        if (handleInfo) {
            handleInfo.addEventListener('mousedown', (e) => {
                isDraggingInfo = true;
                const pill = shadow.querySelector('.info-pill');
                if (pill) {
                    const rect = pill.getBoundingClientRect();
                    dragOffsetX = e.clientX - rect.left;
                    dragOffsetY = e.clientY - rect.top;
                }
                document.addEventListener('mousemove', onMouseMoveInfo);
                document.addEventListener('mouseup', onMouseUpInfo);
            });
        }
        const onMouseMoveInfo = (e) => {
            if (!isDraggingInfo) return;
            const pill = shadow.querySelector('.info-pill');
            if (pill) {
                infoLeft = Math.max(0, Math.min(e.clientX - dragOffsetX, window.innerWidth - pill.offsetWidth)) + 'px';
                infoTop = Math.max(0, Math.min(e.clientY - dragOffsetY, window.innerHeight - pill.offsetHeight)) + 'px';
                pill.style.left = infoLeft;
                pill.style.top = infoTop;
            }
        };
        const onMouseUpInfo = () => {
            isDraggingInfo = false;
            document.removeEventListener('mousemove', onMouseMoveInfo);
            document.removeEventListener('mouseup', onMouseUpInfo);
            render();
        };

        // Circular Launcher interactions
        shadow.getElementById('menu-trigger')?.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            render();
        });
        shadow.getElementById('menu-btn-questions')?.addEventListener('click', () => {
            showQuestionPill = !showQuestionPill;
            render();
        });
        shadow.getElementById('menu-btn-info')?.addEventListener('click', () => {
            showInfoPill = !showInfoPill;
            render();
        });
        shadow.getElementById('menu-btn-dashboard')?.addEventListener('click', () => {
            window.open(apiUrl, '_blank');
        });
        shadow.getElementById('menu-btn-close')?.addEventListener('click', () => {
            // Remove the widget from DOM immediately for instantaneous user feedback
            const h = document.getElementById('vinyas-tracker-widget-host');
            if (h) h.remove();

            // Try to persist the user preference
            try {
                chrome.storage.local.set({ widgetHiddenByUser: true });
            } catch (err) {
                console.warn("[Vinyas Tracker] Storage sync failed (probably context invalidated):", err);
            }
        });

        // Name edits
        shadow.getElementById('input-name')?.addEventListener('input', (e) => {
            assignmentName = e.target.value;
            triggerSave();
        });

        // Resolve Chapter Button
        shadow.getElementById('btn-link-resolve')?.addEventListener('click', () => {
            isTrackerMode = false;
            autoMatchChapter(subjectsList);
            render();
        });
        shadow.getElementById('input-chapter')?.addEventListener('click', () => {
            isTrackerMode = false;
            autoMatchChapter(subjectsList);
            render();
        });

        // Dropdown Selection Changes
        shadow.getElementById('init-subject-select')?.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            selectedSubjectIdx = val;
            if (val === -1) {
                selectedChapterIdx = -1;
                showNewSubjectInput = true;
                showNewChapterInput = true;
            } else {
                showNewSubjectInput = false;
                const chaps = subjectsList[val]?.chapters || [];
                if (chaps.length > 0) {
                    selectedChapterIdx = 0;
                    showNewChapterInput = false;
                } else {
                    selectedChapterIdx = -1;
                    showNewChapterInput = true;
                }
            }
            render();
        });

        shadow.getElementById('init-chapter-select')?.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            selectedChapterIdx = val;
            showNewChapterInput = (val === -1);
            render();
        });

        shadow.getElementById('input-new-subject')?.addEventListener('input', (e) => {
            newSubjectName = e.target.value;
        });

        shadow.getElementById('input-new-chapter')?.addEventListener('input', (e) => {
            newChapterName = e.target.value;
        });

        // Initialize or Update Tracker Link
        shadow.getElementById('btn-sync')?.addEventListener('click', () => {
            if (isSyncing) return;

            const nameInput = shadow.getElementById('input-name');
            if (nameInput) {
                assignmentName = nameInput.value.trim() || 'New Assignment';
            }
            const typeInput = shadow.getElementById('input-type');
            if (typeInput && typeInput.value !== 'Custom') {
                assignmentType = typeInput.value;
            }

            let targetSubject = '';
            let targetChapter = '';

            if (isTrackerMode) {
                targetChapter = assignmentChapter;
                targetSubject = assignmentSubject;
                if (!targetSubject) {
                    const searchTitle = assignmentChapter.toLowerCase().trim();
                    for (const sub of subjectsList) {
                        if (sub.chapters && sub.chapters.some(c => c.name.toLowerCase().trim() === searchTitle)) {
                            targetSubject = sub.name;
                            break;
                        }
                    }
                }
                if (!targetSubject) {
                    targetSubject = subjectsList[selectedSubjectIdx]?.name || '';
                }
            } else {
                if (selectedSubjectIdx === -1) {
                    targetSubject = newSubjectName.trim();
                    targetChapter = newChapterName.trim();
                } else {
                    targetSubject = subjectsList[selectedSubjectIdx]?.name || '';
                    if (selectedChapterIdx === -1) {
                        targetChapter = newChapterName.trim();
                    } else {
                        targetChapter = (subjectsList[selectedSubjectIdx]?.chapters || [])[selectedChapterIdx]?.name || '';
                    }
                }
            }

            if (!targetSubject || !targetChapter) {
                alert("Please select or enter both Subject and Chapter names.");
                return;
            }

            isSyncing = true;
            render();

            const syncTimeout = setTimeout(() => {
                if (isSyncing) {
                    console.warn("[Vinyas Tracker] Sync operation timed out.");
                    isSyncing = false;
                    render();
                }
            }, 8000);

            try {
                chrome.runtime.sendMessage({
                    action: "addAssignment",
                    data: { syncId, apiUrl, subjectName: targetSubject, chapterName: targetChapter, assignmentName: assignmentName, assignmentType, url: pdfUrl }
                }, (res) => {
                    clearTimeout(syncTimeout);
                    isSyncing = false;
                    if (chrome.runtime.lastError) {
                        console.warn("[Vinyas Tracker] Message error:", chrome.runtime.lastError.message);
                    }
                    if (res && res.success) {
                        assignmentChapter = targetChapter; // Update local view representation
                        assignmentSubject = targetSubject; // Update local view representation

                        // Update local assignmentData to match the new values so hasMetaChanges resets
                        if (!assignmentData) assignmentData = {};
                        assignmentData.name = assignmentName;
                        assignmentData.type = assignmentType;
                        assignmentData.chapterName = targetChapter;
                        assignmentData.subjectName = targetSubject;
                        initialAssignmentName = assignmentName;
                        initialAssignmentType = assignmentType;
                        exists = true;

                        isTrackerMode = true;
                        showQuestionPill = true;
                        showInfoPill = false;
                        render();
                    } else {
                        alert("Failed to initialize/link tracker.");
                        render();
                    }
                });
            } catch (e) {
                clearTimeout(syncTimeout);
                console.error("[Vinyas Tracker] Sync failed:", e);
                isSyncing = false;
                render();
            }
        });

        // Add Questions Handlers
        shadow.getElementById('btn-add-q')?.addEventListener('click', () => {
            const count = parseInt(shadow.getElementById('input-qcount')?.value) || 10;
            questionCount = count;
            triggerSave(true);
        });

        shadow.getElementById('btn-add-more-q')?.addEventListener('click', () => {
            questionCount += 5;
            triggerSave(true);
        });

        shadow.getElementById('btn-force-save')?.addEventListener('click', () => {
            autoSaveProgress();
        });



        // Assignment Type Handlers
        shadow.getElementById('input-type')?.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'Custom') {
                isCustomTypeModalOpen = true;
                render();
            } else {
                assignmentType = val;
                triggerSave();
            }
        });

        shadow.getElementById('btn-cancel-type')?.addEventListener('click', () => {
            isCustomTypeModalOpen = false;
            render();
        });

        shadow.getElementById('btn-save-type')?.addEventListener('click', () => {
            const val = shadow.getElementById('input-new-type')?.value.trim();
            if (val) {
                assignmentType = val;
                if (!customAssignmentTypes.includes(val)) {
                    customAssignmentTypes.push(val);
                }
            }
            isCustomTypeModalOpen = false;
            triggerSave(true);
        });

        // Question Buttons
        shadow.querySelectorAll('.q-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const qNum = parseInt(e.currentTarget.getAttribute('data-q'));
                if (selectedQNum === qNum) {
                    const current = questionStates[qNum] || 'none';
                    let next = 'completed';
                    if (current === 'completed') next = 'difficult';
                    else if (current === 'difficult') next = 'later';
                    else if (current === 'later') next = 'none';

                    if (next === 'none') delete questionStates[qNum];
                    else questionStates[qNum] = next;
                    triggerSave();
                } else {
                    selectedQNum = qNum;
                    render();
                }
            });
        });

        // Remarks Input
        const remarkInput = shadow.getElementById('remark-text');
        if (remarkInput) {
            remarkInput.addEventListener('input', (e) => {
                const text = e.target.value;
                if (text) questionRemarks[selectedQNum] = text;
                else delete questionRemarks[selectedQNum];
                triggerSave();
            });
            remarkInput.addEventListener('blur', (e) => {
                const text = e.target.value.trim();
                if (text) questionRemarks[selectedQNum] = text;
                else delete questionRemarks[selectedQNum];
                triggerSave(true);
            });
        }

        shadow.getElementById('btn-close-remark')?.addEventListener('click', () => {
            selectedQNum = null;
            render();
        });
    };

    render();
};
