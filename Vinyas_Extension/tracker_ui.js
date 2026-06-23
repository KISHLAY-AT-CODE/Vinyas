function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const ICON_CLOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const ICON_PLAY = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const ICON_PAUSE = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>`;
const ICON_SAVE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`;
const ICON_CHART = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bar-chart-2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
const ICON_SETTINGS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const ICON_DASHBOARD = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-layout-dashboard"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="10" rx="1"/><rect width="7" height="5" x="3" y="14" rx="1"/></svg>`;
const ICON_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

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
    let isSubmittingAnalysis = false; // Separate flag just for the Finalize & Submit button UI state
    let isSyncing = false;
    let saveTimer = null;
    let isDirty = false;

    // View toggles
    let isInfoModalOpen = false;
    let isSelfAnalysisOpen = false;
    let isQuestionsExpanded = false;
    let isSaveConfirmOpen = false;
    let isCustomTypeModalOpen = false;

    let selfAnalysis = assignmentData?.selfAnalysis || {
        topicName: '',
        correctCount: 0,
        incorrectCount: 0,
        targetDuration: 0,
        completedDuration: 0,
        blunder: '',
        resolution: '',
        isSubmitted: false
    };
    if (!selfAnalysis.topicName) {
        selfAnalysis.topicName = `${assignmentName} - ${assignmentType}`;
    }
    let elapsedTimeSec = selfAnalysis?.elapsedTimeSec || 0;
    let isTimerRunning = questionCount > 0 && !selfAnalysis?.isSubmitted;
    let timerInterval = null;
    let lastAutoSaveTime = elapsedTimeSec;

    // If correctCount/incorrectCount are not filled yet, calculate them once initially
    if (!selfAnalysis.isSubmitted && selfAnalysis.correctCount === 0 && selfAnalysis.incorrectCount === 0) {
        let correct = 0;
        let incorrect = 0;
        for (let q = 1; q <= questionCount; q++) {
            const state = questionStates[q];
            if (state === 'completed') correct++;
            else if (state === 'difficult' || state === 'later') incorrect++;
        }
        selfAnalysis.correctCount = correct;
        selfAnalysis.incorrectCount = incorrect;
    }

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const p = (num) => String(num).padStart(2, '0');
        return hrs > 0 ? `${p(hrs)}:${p(mins)}:${p(secs)}` : `${p(mins)}:${p(secs)}`;
    };

    const startTimer = () => {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (isTimerRunning && !selfAnalysis.isSubmitted) {
                elapsedTimeSec++;
                selfAnalysis.elapsedTimeSec = elapsedTimeSec;
                selfAnalysis.completedDuration = Math.round(elapsedTimeSec / 60);
                updateTimerDOM();

                // Periodic autosave every 30 seconds of active ticking
                if (elapsedTimeSec - lastAutoSaveTime >= 30) {
                    lastAutoSaveTime = elapsedTimeSec;
                    autoSaveProgress();
                }
            }
        }, 1000);
    };

    const stopTimer = () => {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    };

    const updateTimerDOM = () => {
        const timerLabel = shadow.getElementById('timer-val-label');
        if (timerLabel) {
            timerLabel.textContent = formatTime(elapsedTimeSec);
        }
    };

    // Auto-start timer if running
    if (isTimerRunning && !selfAnalysis.isSubmitted) {
        startTimer();
    }

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
            if (rawData && !Array.isArray(rawData) && rawData.isRaw && Array.isArray(rawData.data)) {
                rawData = rawData.data;
            }
            subjectsList = Array.isArray(rawData) ? rawData : [];
            autoMatchChapter(subjectsList);
        }
        render();
    });

    const autoSaveProgress = (callback, force = false) => {
        if (!isTrackerMode || (isSaving && !force)) {
            if (callback) callback(false, 'Save already in progress or tracker not initialized');
            return;
        }
        isSaving = true;
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveTimer = null;
        }
        // NOTE: Do NOT call render() here. Calling render() before sendMessage destroys the
        // current DOM (including the submit button and all event listeners), which orphans the
        // callback and causes the "Submitting..." stuck state. Button loading state is managed
        // inline by the caller instead.

        const safetyTimeout = setTimeout(() => {
            if (isSaving) {
                console.warn("[Vinyas Tracker] Save operation timed out. Resetting loader.");
                isSaving = false;
                // Call the callback with failure so the caller can restore button state
                if (callback) {
                    callback(false, 'Request timed out. Please try again.');
                    render();
                }
            }
        }, 8000);

        try {
            const cleanRemarks = {};
            for (const q in questionRemarks) {
                const val = questionRemarks[q] ? questionRemarks[q].trim() : '';
                if (val) {
                    cleanRemarks[q] = val;
                }
            }

            selfAnalysis.elapsedTimeSec = elapsedTimeSec;
            selfAnalysis.completedDuration = Math.round(elapsedTimeSec / 60);

            chrome.runtime.sendMessage({
                action: "syncAssignmentProgress",
                data: { syncId, apiUrl, url: pdfUrl, questionCount, questionStates, questionRemarks: cleanRemarks, selfAnalysis }
            }, (res) => {
                clearTimeout(safetyTimeout);
                isSaving = false;
                if (chrome.runtime.lastError) {
                    console.warn("[Vinyas Tracker] Message error:", chrome.runtime.lastError.message);
                    if (callback) {
                        callback(false, chrome.runtime.lastError.message);
                        render();
                    }
                    return;
                }
                if (res && res.success) {
                    console.log("[Vinyas Tracker] Progress autosaved.");
                    isDirty = false;
                    // Update dirty dot in-place without full re-render
                    const dot = shadow.getElementById('widget-dirty-dot');
                    if (dot) dot.style.display = 'none';
                } else {
                    const errMsg = res ? res.error : "Unknown error";
                    console.error("[Vinyas Tracker] Assignment progress sync failed:", errMsg);
                    setTimeout(() => {
                        throw new Error(`[Vinyas Tracker Sync Failure] ${errMsg}`);
                    }, 0);
                }
                if (callback) {
                    callback(res && res.success, res && res.error);
                    render(); // Only re-render AFTER callback has run (e.g. after isSubmitted/isSelfAnalysisOpen updated)
                }
            });
        } catch (e) {
            console.error("[Vinyas Tracker] Autosave failed synchronously:", e);
            clearTimeout(safetyTimeout);
            isSaving = false;
            if (callback) {
                callback(false, e.message || 'Unknown sync error');
                render();
            }
        }
    };

    const triggerSave = (autoSave, shouldRender = true) => {
        isDirty = true;
        if (shouldRender) {
            render();
        } else {
            const dot = shadow.getElementById('widget-dirty-dot');
            if (dot) dot.style.display = 'block';
        }
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

    const showToast = (message, type = 'info') => {
        let container = shadow.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            container.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:2147483647; pointer-events:none; display:flex; flex-direction:column; align-items:center; gap:8px;`;
            shadow.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = 'ℹ️';
        if (type === 'success') icon = '✓';
        else if (type === 'error') icon = '❌';
        toast.innerHTML = `<span style="font-size: 15px;">${icon}</span> <span>${escapeHTML(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 3000);
    };

    const render = () => {
        // Save current focus context before redrawing DOM
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

        let customOptionsHTML = '';
        customAssignmentTypes.forEach(t => {
            customOptionsHTML += `<option value="${escapeHTML(t)}" ${assignmentType === t ? 'selected' : ''}>${escapeHTML(t)}</option>`;
        });

        // Group questions into rows of 12
        const itemsPerRow = 12;
        const totalRows = Math.ceil(questionCount / itemsPerRow);
        let activeRowIdx = 0;
        if (selectedQNum) {
            activeRowIdx = Math.floor((selectedQNum - 1) / itemsPerRow);
        }

        let rowsHTML = '';
        for (let r = 0; r < totalRows; r++) {
            const isRowActive = (r === activeRowIdx);
            // Hide other rows unless expanded
            const rowStyle = (isQuestionsExpanded || isRowActive) ? 'display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;' : 'display: none;';
            
            let rowQuestionsHTML = '';
            const startQ = r * itemsPerRow + 1;
            const endQ = Math.min(questionCount, (r + 1) * itemsPerRow);
            for (let q = startQ; q <= endQ; q++) {
                const state = questionStates[q] || 'none';
                const hasRemark = !!questionRemarks[q];
                let stateCls = ''; let text = `Q${q}`;
                if (state === 'completed') { stateCls = 'q-state-completed'; text = `✓`; }
                else if (state === 'difficult') { stateCls = 'q-state-difficult'; text = `!`; }
                else if (state === 'later') { stateCls = 'q-state-later'; text = `⌛`; }
                rowQuestionsHTML += `
                    <button class="q-btn ${stateCls} ${selectedQNum === q ? 'active' : ''}" data-q="${q}" title="Question ${q}">
                        ${text}
                        ${hasRemark ? '<div class="remark-dot"></div>' : ''}
                    </button>
                `;
            }
            rowsHTML += `<div class="q-row-container" style="${rowStyle}">${rowQuestionsHTML}</div>`;
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

        const css = `
            * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            
            /* Glassmorphic elements */
            .glass-pill {
                background: rgba(15, 23, 42, 0.85);
                backdrop-filter: blur(20px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.05);
                color: #f8fafc;
                pointer-events: all;
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .timer-pill-dist {
                position: fixed;
                top: 12px;
                right: 24px;
                display: flex;
                align-items: center;
                padding: 8px 16px;
                gap: 10px;
                z-index: 2147483645;
                height: 38px;
            }

            .actions-pill-dist {
                position: fixed;
                bottom: 24px;
                right: 24px;
                display: flex;
                align-items: center;
                padding: 8px 16px;
                gap: 10px;
                z-index: 2147483645;
                border-radius: 24px;
                height: 48px;
            }

            .questions-pill-dist {
                position: fixed;
                top: 12px;
                left: 24px;
                width: auto;
                max-width: 600px;
                display: flex;
                flex-direction: column;
                padding: 6px 12px;
                z-index: 2147483645;
                border-radius: 16px;
            }

            .remarks-pill-dist {
                position: fixed;
                bottom: 24px;
                left: 24px;
                width: 350px;
                display: flex;
                align-items: center;
                padding: 8px 12px;
                gap: 8px;
                z-index: 2147483645;
                border-radius: 16px;
            }

            .btn-icon {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #cbd5e1;
                cursor: pointer;
                transition: all 0.2s;
                outline: none;
            }
            .btn-icon:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
                transform: translateY(-1px);
            }
            .btn-icon:active {
                transform: scale(0.95);
            }

            .q-btn {
                width: 28px;
                height: 28px;
                border-radius: 6px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(0, 0, 0, 0.3);
                color: #94a3b8;
                font-size: 10px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.15s;
                position: relative;
                outline: none;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .q-btn:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }
            .q-btn.active {
                box-shadow: inset 0 0 0 2px #fff;
            }
            .q-state-completed { background: #059669; color: #fff; border-color: #047857; }
            .q-state-difficult { background: #e11d48; color: #fff; border-color: #be123c; }
            .q-state-later { background: #d97706; color: #fff; border-color: #b45309; }

            .remark-dot {
                position: absolute;
                top: -2px;
                right: -2px;
                width: 8px;
                height: 8px;
                background: #3b82f6;
                border-radius: 50%;
                border: 1px solid #0f172a;
            }

            .dirty-dot {
                position: absolute;
                width: 8px;
                height: 8px;
                background: #f59e0b;
                border-radius: 50%;
                box-shadow: 0 0 6px #f59e0b;
            }

            .remarks-input {
                flex: 1;
                height: 28px;
                background: rgba(0, 0, 0, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                color: #e2e8f0;
                font-size: 11px;
                padding: 0 8px;
                outline: none;
            }

            /* Overlays & Modals */
            .overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.7);
                backdrop-filter: blur(10px);
                z-index: 2147483646;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                pointer-events: all;
                animation: fade-in 0.25s ease-out;
            }

            .modal-card {
                background: #0f172a;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 24px;
                width: 100%;
                max-width: 440px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
                overflow: hidden;
                color: #f8fafc;
                animation: scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
            }

            .modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                background: rgba(255, 255, 255, 0.02);
            }

            .modal-title {
                font-size: 14px;
                font-weight: 800;
                color: white;
            }

            .modal-body {
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 14px;
            }

            .modal-footer {
                padding: 16px 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.05);
                display: flex;
                gap: 10px;
                background: rgba(0, 0, 0, 0.2);
            }

            /* Inputs & Fields */
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .form-label {
                font-size: 10px;
                font-weight: 800;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

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

            .form-select {
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #f1f5f9;
                font-size: 13px;
                font-weight: 600;
                padding: 8px 12px;
                outline: none;
                cursor: pointer;
                height: 38px;
                appearance: none;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 10px center;
                background-repeat: no-repeat;
                background-size: 16px;
                padding-right: 32px;
            }
            .form-select option {
                background: #0f172a;
            }

            .markdown-area {
                width: 100%;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                color: #e2e8f0;
                font-size: 12px;
                padding: 10px;
                outline: none;
                resize: none;
                font-family: monospace;
            }
            .markdown-area:focus {
                border-color: #3b82f6;
                background: rgba(15, 23, 42, 0.9);
            }

            /* Buttons */
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                height: 38px;
            }

            .btn-primary {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
                color: white;
                box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);
            }
            .btn-primary:hover {
                box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
                transform: translateY(-1px);
            }
            .btn-success {
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3);
            }
            .btn-success:hover {
                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
                transform: translateY(-1px);
            }
            .btn-ghost {
                background: rgba(255, 255, 255, 0.05);
                color: #cbd5e1;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .btn-ghost:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
            }

            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            .loading-text {
                font-size: 12px;
                font-weight: 700;
                color: #94a3b8;
            }

            /* Toast notifications */
            .toast-container {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 2147483647;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            .toast {
                padding: 12px 24px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 700;
                color: #fff;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1);
                animation: toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                pointer-events: all;
            }
            .toast.success {
                background: rgba(16, 185, 129, 0.9);
                border-color: rgba(16, 185, 129, 0.2);
            }
            .toast.error {
                background: rgba(239, 68, 68, 0.9);
                border-color: rgba(239, 68, 68, 0.2);
            }
            .toast.info {
                background: rgba(59, 130, 246, 0.9);
                border-color: rgba(59, 130, 246, 0.2);
            }
            .toast.fade-out {
                animation: toast-out 0.3s ease forwards;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes scale-in {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            @keyframes toast-in {
                from { transform: translateY(-20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            @keyframes toast-out {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(-20px); opacity: 0; }
            }
        `;

        let shadowHTML = `<style>${css}</style>`;

        if (isTrackerMode) {
            // Render 1: Timer Pill (Top-Right)
            shadowHTML += `
                <div class="glass-pill timer-pill-dist" title="Assignment Timer">
                    <span style="display:flex; align-items:center; color:#3b82f6;">${ICON_CLOCK}</span>
                    <span id="timer-val-label" style="font-family: monospace; font-weight: 800; font-size: 13px; letter-spacing:0.5px;">${formatTime(elapsedTimeSec)}</span>
                    <button id="btn-timer-toggle-dist" style="background: none; border: none; cursor: pointer; color: ${isTimerRunning ? '#ef4444' : '#10b981'}; display: flex; align-items: center; justify-content: center; outline: none; padding: 2px;">
                        ${isTimerRunning ? ICON_PAUSE : ICON_PLAY}
                    </button>
                </div>
            `;

            // Render 2: Actions Pill (Bottom-Right)
            shadowHTML += `
                <div class="glass-pill actions-pill-dist">
                    <div class="dirty-dot" id="widget-dirty-dot" style="top: 6px; right: 6px; display: ${isDirty ? 'block' : 'none'};" title="Unsaved changes..."></div>
                    <span style="font-size: 11px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 4px 8px; border-radius: 12px;" title="Completion Stats">${stats.compPct}%</span>
                    
                    <button class="btn-icon" id="btn-save-dist" title="Save / Finalize Progress">${ICON_SAVE}</button>
                    <button class="btn-icon" id="btn-analysis-dist" title="Self Analysis Sheet">${ICON_CHART}</button>
                    <button class="btn-icon" id="btn-info-dist" title="Edit Metadata">${ICON_SETTINGS}</button>
                    <button class="btn-icon" id="btn-dashboard-dist" title="Open Vinyas Dashboard">${ICON_DASHBOARD}</button>
                    <button class="btn-icon" id="btn-close-dist" style="color: #ef4444;" title="Remove Widget">${ICON_CLOSE}</button>
                </div>
            `;

            // Render 3: Questions Pill (Top-Left)
            if (questionCount === 0) {
                shadowHTML += `
                    <div class="glass-pill questions-pill-dist" style="flex-direction: row; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 800; color: #94a3b8;">Questions:</span>
                        <input type="number" class="input-field" id="input-qcount" value="10" min="1" style="width: 50px; height: 28px; text-align: center; padding: 4px; font-size:11px;" />
                        <button class="btn btn-primary" id="btn-add-q" style="height: 28px; padding: 0 10px; font-size: 11px;">Add Qs</button>
                    </div>
                `;
            } else {
                shadowHTML += `
                    <div class="glass-pill questions-pill-dist">
                        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px; margin-bottom: 4px; gap: 8px;">
                            <span style="font-size: 9px; font-weight: 850; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
                                Questions (Row ${activeRowIdx + 1}/${totalRows})
                            </span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <button id="btn-add-more-q" style="background: none; border: none; color: #10b981; cursor: pointer; font-weight: 800; font-size: 14px; display: flex; align-items: center; outline: none; padding: 2px;" title="Add 5 More Questions">+</button>
                                ${totalRows > 1 ? `
                                    <button id="btn-toggle-expand-qs" style="background: none; border: none; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none; padding: 2px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: ${isQuestionsExpanded ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s;">
                                            <path d="m6 9 6 6 6-6"/>
                                        </svg>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                        
                        ${rowsHTML}
                    </div>
                `;
            }

            // Render 4: Remarks Pill (Bottom-Left) - Slim remarks bar shown ONLY if a question is selected
            if (selectedQNum) {
                shadowHTML += `
                    <div class="glass-pill remarks-pill-dist">
                        <span style="font-size: 11px; font-weight: 800; color: #3b82f6; white-space: nowrap;">Q${selectedQNum} Remark:</span>
                        <input type="text" class="remarks-input" id="remark-text" value="${escapeHTML(questionRemarks[selectedQNum] || '')}" placeholder="Add a note..." />
                        <button id="btn-close-remark" style="background: none; border: none; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center; outline: none; padding: 2px;">
                            ${ICON_CLOSE}
                        </button>
                    </div>
                `;
            }
        }

        // --- Center Overlays ---

        // 1. Initialization / Metadata editing modal overlay
        if (!isTrackerMode || isInfoModalOpen) {
            shadowHTML += `
                <div class="overlay" id="metadata-overlay">
                    <div class="modal-card">
                        <div class="modal-header">
                            <div class="modal-title">
                                ${!isTrackerMode ? 'Initialize Vinyas Tracker' : 'Edit Assignment Metadata'}
                            </div>
                        </div>
                        <div class="modal-body">
                            ${isLoadingSyllabus ? `
                                <div style="display:flex; align-items:center; gap:10px; justify-content:center; padding: 20px;">
                                    <div class="spinner"></div>
                                    <span class="loading-text">Loading syllabus...</span>
                                </div>
                            ` : `
                                <div class="form-group">
                                    <label class="form-label">Subject</label>
                                    <select class="form-select" id="init-subject-select" ${isSyncing ? 'disabled' : ''}>
                                        ${subjectOptionsHTML}
                                    </select>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Chapter</label>
                                    <select class="form-select" id="init-chapter-select" ${isSyncing ? 'disabled' : ''}>
                                        ${chapterOptionsHTML}
                                    </select>
                                </div>

                                ${(showNewSubjectInput || showNewChapterInput) ? `
                                    <div class="form-group" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; display: flex; flex-direction: column; gap: 8px;">
                                        ${showNewSubjectInput ? `
                                            <div>
                                                <label class="form-label">New Subject Name</label>
                                                <input type="text" class="input-field" id="input-new-subject" value="${escapeHTML(newSubjectName)}" placeholder="e.g. Physics" style="width: 100%;" />
                                            </div>
                                        ` : ''}
                                        ${showNewChapterInput ? `
                                            <div>
                                                <label class="form-label">New Chapter Name</label>
                                                <input type="text" class="input-field" id="input-new-chapter" value="${escapeHTML(newChapterName)}" placeholder="e.g. Kinematics" style="width: 100%;" />
                                            </div>
                                        ` : ''}
                                    </div>
                                ` : ''}

                                <div class="form-group">
                                    <label class="form-label">Assignment Name</label>
                                    <input type="text" class="input-field" id="input-name" value="${escapeHTML(assignmentName)}" placeholder="Assignment Name" style="width: 100%;" ${isSyncing ? 'disabled' : ''} />
                                </div>

                                <div class="form-group">
                                    <label class="form-label">Assignment Type</label>
                                    <select class="form-select" id="input-type" style="width: 100%;" ${isSyncing ? 'disabled' : ''}>
                                        <option value="DPP" ${assignmentType === 'DPP' ? 'selected' : ''}>DPP</option>
                                        <option value="Module" ${assignmentType === 'Module' ? 'selected' : ''}>Module</option>
                                        <option value="Test" ${assignmentType === 'Test' ? 'selected' : ''}>Test</option>
                                        <option value="Notes" ${assignmentType === 'Notes' ? 'selected' : ''}>Notes</option>
                                        ${customOptionsHTML}
                                        <option value="Custom">+ Custom</option>
                                    </select>
                                </div>
                            `}
                        </div>
                        <div class="modal-footer">
                            ${(isTrackerMode && isInfoModalOpen) ? `
                                <button class="btn btn-ghost" id="btn-cancel-info" style="flex: 1;">Cancel</button>
                            ` : ''}
                            <button class="btn btn-primary" id="btn-sync" style="flex: 1;" ${isSyncing || isLoadingSyllabus ? 'disabled style="opacity:0.7;"' : ''}>
                                ${isSyncing ? 'Linking...' : (exists ? 'Update Link' : 'Initialize')}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 2. Self-Analysis Modal Overlay
        if (isSelfAnalysisOpen) {
            shadowHTML += `
                <div class="overlay" id="self-analysis-overlay">
                    <div class="modal-card" style="max-width: 480px;">
                        <div class="modal-header">
                            <div class="modal-title">Assignment Self-Analysis</div>
                        </div>
                        <div class="modal-body" style="max-height: 65vh; overflow-y: auto; padding-right: 8px;">
                            ${selfAnalysis.isSubmitted ? `
                                <div style="display: flex; flex-direction: column; gap: 14px;">
                                    <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(16, 185, 129, 0.1)); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 12px; text-align: center;">
                                        <div style="font-size: 10px; font-weight: 800; color: #10b981; text-transform: uppercase;">Finalized Assessment Report</div>
                                        <div style="font-size: 13px; font-weight: 800; color: #fff; margin-top: 4px;">${escapeHTML(selfAnalysis.topicName)}</div>
                                    </div>
                                    
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
                                            <span style="color: #94a3b8; font-size: 10px;">Total Questions:</span>
                                            <div style="font-weight: 800; color: #fff; font-size: 13px; margin-top: 2px;">${questionCount}</div>
                                        </div>
                                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
                                            <span style="color: #94a3b8; font-size: 10px;">Time Spent:</span>
                                            <div style="font-weight: 800; color: #10b981; font-size: 13px; margin-top: 2px;">${formatTime(elapsedTimeSec)}</div>
                                        </div>
                                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
                                            <span style="color: #94a3b8; font-size: 10px;">Correct Count:</span>
                                            <div style="font-weight: 800; color: #10b981; font-size: 13px; margin-top: 2px;">${selfAnalysis.correctCount}</div>
                                        </div>
                                        <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 8px;">
                                            <span style="color: #94a3b8; font-size: 10px;">Incorrect Count:</span>
                                            <div style="font-weight: 800; color: #ef4444; font-size: 13px; margin-top: 2px;">${selfAnalysis.incorrectCount}</div>
                                        </div>
                                    </div>

                                    <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; font-size: 11px;">
                                        <span style="color: #94a3b8; font-size: 10px; font-weight: 800;">Target Duration (mins):</span>
                                        <div style="color: #fff; font-size: 12px; font-weight: 700; margin-top: 2px;">${selfAnalysis.targetDuration}</div>
                                    </div>

                                    <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); padding: 10px; border-radius: 8px; font-size: 11px;">
                                        <span style="color: #f87171; font-weight: 800; font-size: 10px;">My Blunders:</span>
                                        <div style="color: #e2e8f0; font-size: 12px; font-style: italic; margin-top: 4px; white-space: pre-wrap;">${escapeHTML(selfAnalysis.blunder || "No blunders recorded")}</div>
                                    </div>

                                    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 8px; font-size: 11px;">
                                        <span style="color: #34d399; font-weight: 800; font-size: 10px;">My Resolutions:</span>
                                        <div style="color: #e2e8f0; font-size: 12px; font-style: italic; margin-top: 4px; white-space: pre-wrap;">${escapeHTML(selfAnalysis.resolution || "No resolutions recorded")}</div>
                                    </div>
                                </div>
                            ` : `
                                <div style="display: flex; flex-direction: column; gap: 12px;">
                                    <div class="form-group">
                                        <label class="form-label">Topic Name</label>
                                        <input type="text" class="input-field" id="analysis-topic-name" value="${escapeHTML(selfAnalysis.topicName || '')}" style="width:100%;" />
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                        <div class="form-group">
                                            <label class="form-label">Correct Count</label>
                                            <input type="number" class="input-field" id="analysis-correct-count" value="${selfAnalysis.correctCount}" min="0" style="width:100%;" />
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">Incorrect Count</label>
                                            <input type="number" class="input-field" id="analysis-incorrect-count" value="${selfAnalysis.incorrectCount}" min="0" style="width:100%;" />
                                        </div>
                                    </div>

                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                        <div class="form-group">
                                            <label class="form-label">Target (mins)</label>
                                            <input type="number" class="input-field" id="analysis-target-duration" value="${selfAnalysis.targetDuration}" min="0" style="width:100%;" />
                                        </div>
                                        <div class="form-group">
                                            <label class="form-label">Completed Duration</label>
                                            <div class="input-field" style="display:flex; align-items:center; opacity:0.8; background:rgba(0,0,0,0.2);">${formatTime(elapsedTimeSec)}</div>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">My Blunders</label>
                                        <textarea class="markdown-area" id="analysis-blunder" placeholder="Identify mistakes (e.g. silly mistakes, sign errors)..." style="height: 60px;">${escapeHTML(selfAnalysis.blunder || '')}</textarea>
                                    </div>

                                    <div class="form-group">
                                        <label class="form-label">My Resolutions</label>
                                        <textarea class="markdown-area" id="analysis-resolution" placeholder="Resolutions for next time..." style="height: 60px;">${escapeHTML(selfAnalysis.resolution || '')}</textarea>
                                    </div>
                                </div>
                            `}
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-ghost" id="btn-close-analysis" style="flex: 1;">Close</button>
                            ${selfAnalysis.isSubmitted ? `
                                <button class="btn btn-ghost" id="btn-edit-report-dist" style="flex: 1; border-color: #3b82f6; color: #3b82f6;">Edit Report</button>
                            ` : `
                                <button class="btn btn-primary" id="btn-submit-analysis" style="flex: 1; ${isSubmittingAnalysis ? 'opacity:0.7;' : ''}" ${isSubmittingAnalysis ? 'disabled' : ''}>
                                    ${isSubmittingAnalysis ? 'Submitting...' : 'Finalize &amp; Submit'}
                                </button>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }

        // 3. Save Confirm Overlay
        if (isSaveConfirmOpen) {
            shadowHTML += `
                <div class="overlay" id="save-confirm-overlay">
                    <div class="modal-card">
                        <div class="modal-header">
                            <div class="modal-title">Save Assignment Progress</div>
                        </div>
                        <div class="modal-body" style="font-size: 12px; color: #cbd5e1; line-height: 1.5; display: flex; flex-direction: column; gap: 12px;">
                            <p>Would you like to just auto-save your current progress (to resume later) or finalize this assessment to compile your self-analysis report?</p>
                        </div>
                        <div class="modal-footer" style="display: flex; flex-direction: column; gap: 8px;">
                            <button class="btn btn-primary" id="btn-confirm-autosave" style="width: 100%;">
                                Save Progress & Pause Timer
                            </button>
                            <button class="btn btn-success" id="btn-confirm-finalize" style="width: 100%;">
                                Finalize & Submit Assessment
                            </button>
                            <button class="btn btn-ghost" id="btn-confirm-cancel" style="width: 100%;">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        // 4. Custom Type Overlay
        if (isCustomTypeModalOpen) {
            shadowHTML += `
                <div class="overlay" id="custom-type-overlay">
                    <div class="modal-card" style="max-width: 320px;">
                        <div class="modal-header">
                            <div class="modal-title">New Custom Type</div>
                        </div>
                        <div class="modal-body">
                            <input type="text" class="input-field" id="input-new-type" placeholder="e.g. CTQ" style="font-size:14px; padding:12px; width: 100%;" />
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-ghost" id="btn-cancel-type" style="flex:1">Cancel</button>
                            <button class="btn btn-primary" id="btn-save-type" style="flex:1">Save</button>
                        </div>
                    </div>
                </div>
            `;
        }

        shadow.innerHTML = shadowHTML;
        bindEvents();

        // Restore focus and cursor selection range
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
        // Prevent keypress event leaking from widget inputs/textareas to host PDF page controls
        shadow.querySelectorAll('input, textarea, select').forEach(el => {
            ['keydown', 'keyup', 'keypress', 'copy', 'cut', 'paste'].forEach(type => {
                el.addEventListener(type, (e) => {
                    e.stopPropagation();
                });
            });
        });

        // 1. Timer corner toggle
        shadow.getElementById('btn-timer-toggle-dist')?.addEventListener('click', () => {
            isTimerRunning = !isTimerRunning;
            if (isTimerRunning) {
                if (selfAnalysis.isSubmitted) {
                    selfAnalysis.isSubmitted = false;
                }
                startTimer();
            } else {
                stopTimer();
            }
            autoSaveProgress(); // Sync timer state immediately
            render();
        });

        // 2. Actions corner triggers
        shadow.getElementById('btn-save-dist')?.addEventListener('click', () => {
            isSaveConfirmOpen = true;
            if (isTimerRunning) {
                isTimerRunning = false;
                stopTimer();
                autoSaveProgress();
            }
            render();
        });
        shadow.getElementById('btn-analysis-dist')?.addEventListener('click', () => {
            isSelfAnalysisOpen = true;
            if (isTimerRunning) {
                isTimerRunning = false;
                stopTimer();
                autoSaveProgress();
            }
            render();
        });
        shadow.getElementById('btn-info-dist')?.addEventListener('click', () => {
            isInfoModalOpen = true;
            render();
        });
        shadow.getElementById('btn-dashboard-dist')?.addEventListener('click', () => {
            window.open(apiUrl, '_blank');
        });
        shadow.getElementById('btn-close-dist')?.addEventListener('click', () => {
            stopTimer();
            const h = document.getElementById('vinyas-tracker-widget-host');
            if (h) h.remove();
            try {
                chrome.storage.local.set({ widgetHiddenByUser: true });
            } catch (err) {
                console.warn("[Vinyas Tracker] Storage sync failed:", err);
            }
        });

        // 3. Questions expand chevron and add handlers
        shadow.getElementById('btn-toggle-expand-qs')?.addEventListener('click', () => {
            isQuestionsExpanded = !isQuestionsExpanded;
            render();
        });
        shadow.getElementById('btn-add-q')?.addEventListener('click', () => {
            const count = parseInt(shadow.getElementById('input-qcount')?.value) || 10;
            questionCount = count;
            isTimerRunning = true;
            startTimer();

            // Compute counts once
            let correct = 0;
            let incorrect = 0;
            for (let q = 1; q <= questionCount; q++) {
                const state = questionStates[q];
                if (state === 'completed') correct++;
                else if (state === 'difficult' || state === 'later') incorrect++;
            }
            selfAnalysis.correctCount = correct;
            selfAnalysis.incorrectCount = incorrect;

            triggerSave(true);
        });
        shadow.getElementById('btn-add-more-q')?.addEventListener('click', () => {
            const input = prompt("How many questions would you like to add?", "5");
            if (input === null) return;
            const count = parseInt(input.trim());
            if (!isNaN(count) && count > 0) {
                questionCount += count;
                triggerSave(true);
            } else {
                showToast("Please enter a valid positive number.", "error");
            }
        });

        // Question Buttons clicks
        shadow.querySelectorAll('.q-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (selfAnalysis.isSubmitted) {
                    selfAnalysis.isSubmitted = false;
                    autoSaveProgress();
                }

                const qNum = parseInt(btn.getAttribute('data-q'));
                if (selectedQNum === qNum) {
                    const current = questionStates[qNum] || 'none';
                    let next = 'completed';
                    if (current === 'completed') next = 'difficult';
                    else if (current === 'difficult') next = 'later';
                    else if (current === 'later') next = 'none';

                    if (next === 'none') delete questionStates[qNum];
                    else questionStates[qNum] = next;

                    // Recalculate stats only here on question clicks
                    let correct = 0;
                    let incorrect = 0;
                    for (let q = 1; q <= questionCount; q++) {
                        const state = questionStates[q];
                        if (state === 'completed') correct++;
                        else if (state === 'difficult' || state === 'later') incorrect++;
                    }
                    selfAnalysis.correctCount = correct;
                    selfAnalysis.incorrectCount = incorrect;

                    triggerSave();
                } else {
                    selectedQNum = qNum;
                    render();
                }
            });
        });

        // Question Remark input
        const remarkInput = shadow.getElementById('remark-text');
        if (remarkInput) {
            remarkInput.addEventListener('input', (e) => {
                if (selfAnalysis.isSubmitted) {
                    selfAnalysis.isSubmitted = false;
                    autoSaveProgress();
                }
                const text = e.target.value;
                if (text) questionRemarks[selectedQNum] = text;
                else delete questionRemarks[selectedQNum];
                triggerSave(false, false);
            });
            remarkInput.addEventListener('blur', (e) => {
                if (selfAnalysis.isSubmitted) {
                    selfAnalysis.isSubmitted = false;
                    autoSaveProgress();
                }
                const text = e.target.value.trim();
                if (text) questionRemarks[selectedQNum] = text;
                else delete questionRemarks[selectedQNum];
                triggerSave(true, false);
            });
        }
        shadow.getElementById('btn-close-remark')?.addEventListener('click', () => {
            selectedQNum = null;
            render();
        });

        // Metadata Edit Panel triggers
        shadow.getElementById('btn-cancel-info')?.addEventListener('click', () => {
            isInfoModalOpen = false;
            render();
        });
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
        shadow.getElementById('input-name')?.addEventListener('input', (e) => {
            assignmentName = e.target.value;
            triggerSave(true, false);
        });
        shadow.getElementById('input-name')?.addEventListener('blur', (e) => {
            assignmentName = e.target.value.trim();
            triggerSave(true, false);
        });
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

        // Custom Type actions
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

        // Initialize / Link sync
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
                showToast("Please select or enter both Subject and Chapter names.", "error");
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
                        assignmentChapter = targetChapter;
                        assignmentSubject = targetSubject;

                        if (!assignmentData) assignmentData = {};
                        assignmentData.name = assignmentName;
                        assignmentData.type = assignmentType;
                        assignmentData.chapterName = targetChapter;
                        assignmentData.subjectName = targetSubject;
                        initialAssignmentName = assignmentName;
                        initialAssignmentType = assignmentType;
                        exists = true;

                        isTrackerMode = true;
                        isInfoModalOpen = false;
                        showToast("Tracker linked successfully!", "success");
                        render();
                    } else {
                        const errMsg = res ? res.error : "Unknown error";
                        console.error("[Vinyas Tracker] Link tracker failed:", errMsg);
                        showToast(res && res.error ? `Failed to link: ${res.error}` : "Failed to initialize/link tracker.", "error");
                        render();
                        setTimeout(() => {
                            throw new Error(`[Vinyas Tracker Link Failure] ${errMsg}`);
                        }, 0);
                    }
                });
            } catch (e) {
                clearTimeout(syncTimeout);
                console.error("[Vinyas Tracker] Sync failed:", e);
                isSyncing = false;
                render();
            }
        });

        // 4. Save Confirm button handlers
        shadow.getElementById('btn-confirm-cancel')?.addEventListener('click', () => {
            isSaveConfirmOpen = false;
            render();
        });
        shadow.getElementById('btn-confirm-autosave')?.addEventListener('click', () => {
            isSaveConfirmOpen = false;
            isTimerRunning = false;
            stopTimer();
            render(); // Close the overlay immediately — the save happens in background
            autoSaveProgress((success, err) => {
                if (success) {
                    showToast("Progress Auto-Saved! (Timer Paused)", "success");
                } else {
                    showToast(err ? `Failed to save: ${err}` : "Failed to save progress.", "error");
                }
                // render() is called by autoSaveProgress after this callback (to update dirty dot etc.)
            });
        });
        shadow.getElementById('btn-confirm-finalize')?.addEventListener('click', () => {
            isSaveConfirmOpen = false;

            const isSelfAnalysisFilled = selfAnalysis.blunder.trim() !== '' && selfAnalysis.resolution.trim() !== '';
            if (!isSelfAnalysisFilled) {
                isSelfAnalysisOpen = true;
                render();
                showToast("Please fill in your Self-Analysis (Blunders & Resolutions) first.", "info");
                return;
            }

            isTimerRunning = false;
            stopTimer();

            let correct = 0;
            let incorrect = 0;
            for (let q = 1; q <= questionCount; q++) {
                const state = questionStates[q];
                if (state === 'completed') correct++;
                else if (state === 'difficult' || state === 'later') incorrect++;
            }

            if (!selfAnalysis.attempts) {
                selfAnalysis.attempts = [];
            }
            const prevAttemptsTime = selfAnalysis.attempts.reduce((sum, att) => sum + (att.elapsedTimeSec || 0), 0);
            const additionalTime = Math.max(0, elapsedTimeSec - prevAttemptsTime);
            const newAttempt = {
                attemptNumber: selfAnalysis.attempts.length + 1,
                elapsedTimeSec: additionalTime,
                formattedTime: formatTime(additionalTime),
                timestamp: new Date().toISOString(),
                correctCount: correct,
                incorrectCount: incorrect
            };
            selfAnalysis.attempts.push(newAttempt);

            selfAnalysis.correctCount = correct;
            selfAnalysis.incorrectCount = incorrect;
            selfAnalysis.elapsedTimeSec = elapsedTimeSec;
            selfAnalysis.completedDuration = Math.round(elapsedTimeSec / 60);
            selfAnalysis.isSubmitted = true;

            autoSaveProgress((success, err) => {
                if (success) {
                    showToast("🎉 Assessment Finalized and Sync'd!", "success");
                    isSelfAnalysisOpen = false;
                } else {
                    selfAnalysis.attempts.pop();
                    selfAnalysis.isSubmitted = false;
                    showToast(err ? `Failed to finalize: ${err}` : "Failed to finalize assessment.", "error");
                }
                // render() is handled by autoSaveProgress after this callback
            }, true);
        });

        // 5. Self-Analysis Modal triggers & inputs
        shadow.getElementById('btn-close-analysis')?.addEventListener('click', () => {
            isSelfAnalysisOpen = false;
            render();
        });
        shadow.getElementById('btn-edit-report-dist')?.addEventListener('click', () => {
            selfAnalysis.isSubmitted = false;
            isDirty = true;
            autoSaveProgress();
            render();
        });

        // Realtime edits mapping inside self-analysis fields
        shadow.getElementById('analysis-topic-name')?.addEventListener('input', (e) => {
            selfAnalysis.topicName = e.target.value;
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-topic-name')?.addEventListener('blur', (e) => {
            selfAnalysis.topicName = e.target.value.trim();
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-correct-count')?.addEventListener('input', (e) => {
            selfAnalysis.correctCount = Math.max(0, parseInt(e.target.value) || 0);
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-correct-count')?.addEventListener('blur', (e) => {
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-incorrect-count')?.addEventListener('input', (e) => {
            selfAnalysis.incorrectCount = Math.max(0, parseInt(e.target.value) || 0);
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-incorrect-count')?.addEventListener('blur', (e) => {
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-target-duration')?.addEventListener('input', (e) => {
            selfAnalysis.targetDuration = Math.max(0, parseInt(e.target.value) || 0);
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-target-duration')?.addEventListener('blur', (e) => {
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-blunder')?.addEventListener('input', (e) => {
            selfAnalysis.blunder = e.target.value;
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-blunder')?.addEventListener('blur', (e) => {
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-resolution')?.addEventListener('input', (e) => {
            selfAnalysis.resolution = e.target.value;
            triggerSave(true, false);
        });
        shadow.getElementById('analysis-resolution')?.addEventListener('blur', (e) => {
            triggerSave(true, false);
        });

        shadow.getElementById('btn-submit-analysis')?.addEventListener('click', () => {
            // Guard: prevent double-submission
            if (isSubmittingAnalysis || isSaving) return;

            const correctVal = parseInt(shadow.getElementById('analysis-correct-count')?.value) || 0;
            const incorrectVal = parseInt(shadow.getElementById('analysis-incorrect-count')?.value) || 0;
            if (correctVal + incorrectVal > questionCount) {
                showToast("Correct + Incorrect questions cannot exceed Total Questions!", "error");
                return;
            }

            isTimerRunning = false;
            stopTimer();

            // Read all form values from the live DOM BEFORE any state changes
            selfAnalysis.topicName = shadow.getElementById('analysis-topic-name')?.value.trim() || '';
            selfAnalysis.correctCount = correctVal;
            selfAnalysis.incorrectCount = incorrectVal;
            selfAnalysis.targetDuration = parseInt(shadow.getElementById('analysis-target-duration')?.value) || 0;
            selfAnalysis.blunder = shadow.getElementById('analysis-blunder')?.value || '';
            selfAnalysis.resolution = shadow.getElementById('analysis-resolution')?.value || '';

            if (!selfAnalysis.attempts) {
                selfAnalysis.attempts = [];
            }
            const prevAttemptsTime = selfAnalysis.attempts.reduce((sum, att) => sum + (att.elapsedTimeSec || 0), 0);
            const additionalTime = Math.max(0, elapsedTimeSec - prevAttemptsTime);
            const newAttempt = {
                attemptNumber: selfAnalysis.attempts.length + 1,
                elapsedTimeSec: additionalTime,
                formattedTime: formatTime(additionalTime),
                timestamp: new Date().toISOString(),
                correctCount: selfAnalysis.correctCount,
                incorrectCount: selfAnalysis.incorrectCount
            };
            selfAnalysis.attempts.push(newAttempt);
            selfAnalysis.isSubmitted = true;

            // Show loading state on button INLINE without calling render() - avoids destroying the DOM
            isSubmittingAnalysis = true;
            const submitBtn = shadow.getElementById('btn-submit-analysis');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
                submitBtn.style.opacity = '0.7';
            }

            autoSaveProgress((success, err) => {
                isSubmittingAnalysis = false;
                if (success) {
                    showToast("🎉 Assessment Finalized and Sync'd!", "success");
                    isSelfAnalysisOpen = false;
                } else {
                    selfAnalysis.attempts.pop();
                    selfAnalysis.isSubmitted = false;
                    showToast(err ? `Failed to finalize: ${err}` : "Failed to finalize assessment.", "error");
                }
                // render() is called by autoSaveProgress after this callback returns
            }, true);
        });
    };

    render();
};
