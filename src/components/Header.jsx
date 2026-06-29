import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { YogiLogo } from '../data/constants';
import { useToast } from './ToastContext';
import { VINYAS_APP_VERSION, VINYAS_EXTENSION_VERSION } from '../data/version';
import { logEvent, getLocalLogs, clearLocalLogs } from '../services/logger';
import { aesEncrypt } from '../services/crypto';

const redactSyncId = (id) => {
    if (localStorage.getItem('bypassRedaction') === 'true') return id;
    return id ? `${id.slice(0, 4)}...${id.slice(-4)}` : 'OFFLINE';
};

const redactObject = (obj) => {
    if (localStorage.getItem('bypassRedaction') === 'true') return obj;
    if (!obj || typeof obj !== 'object') return obj;
    try {
        const cloned = JSON.parse(JSON.stringify(obj));
        const sensitiveKeys = ['password', 'key', 'secret', 'token', 'auth', 'apikey', 'credential'];
        const recurse = (item) => {
            if (!item || typeof item !== 'object') return;
            for (const key in item) {
                const lowerKey = key.toLowerCase();
                if (lowerKey === 'syncid' && typeof item[key] === 'string') {
                    item[key] = redactSyncId(item[key]);
                } else if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
                    if (typeof item[key] === 'string') {
                        item[key] = '[REDACTED]';
                    } else if (typeof item[key] === 'object' && item[key] !== null) {
                        item[key] = '[REDACTED OBJECT]';
                    }
                } else {
                    recurse(item[key]);
                }
            }
        };
        recurse(cloned);
        return cloned;
    } catch (e) {
        return obj;
    }
};

const getLogSummary = (log) => {
    if (log.isRemote) {
        if (log.type === 'DPP_SCORE') {
            return `DPP: "${log.details.title}" Submitted - Score: ${log.details.score || 'N/A'}, Acc: ${log.details.accuracy}%`;
        }
        if (log.type === 'VIDEO_PROGRESS') {
            return `Video: "${log.details.title}" - Status: ${log.details.event.toUpperCase()} at ${log.details.currentTime}s`;
        }
        if (log.type === 'STUDY_GOALS') {
            return `Study Goal Detected: "${log.details.title}" for subject "${log.details.subject}"`;
        }
        return `Extension Event: ${JSON.stringify(log.details)}`;
    } else {
        if (log.type === 'AI_REQUEST') {
            const preview = log.details.prompt ? log.details.prompt.substring(0, 100) : 'Generating content';
            return `AI Prompt Sent: "${preview}..." [sys instruction set]`;
        }
        if (log.type === 'AI_RESPONSE') {
            return `AI Response Received Successfully: [JSON payload response, size: ${JSON.stringify(log.details.response || '').length} bytes]`;
        }
        if (log.type === 'AI_EMPTY_RESPONSE') {
            return `AI Empty/Schema Response: Empty output or JSON schema structure received. Triggering client-side retry...`;
        }
        if (log.type === 'AI_WARNING') {
            return `AI Warning: ${log.details.message || 'Key switch triggered'} (Key Index: ${log.details.keyIndex})`;
        }
        if (log.type === 'AI_ERROR') {
            return `AI Error: ${log.details.error || log.details.message || 'Exhaustion'}`;
        }
        if (log.type === 'AI_CANCELLED') {
            return `AI Operation Cancelled: ${log.details.message}`;
        }
        if (log.type === 'DB_LOAD') {
            return `DB Load: Reading profile details for user sync identifier: ${redactSyncId(log.details.syncId)}`;
        }
        if (log.type === 'DB_LOAD_SUCCESS') {
            return `DB Load Success: Synced ${log.details.subjectsCount} subjects and ${log.details.chaptersCount} chapters`;
        }
        if (log.type === 'DB_LOAD_ERROR') {
            return `DB Load Failed: ${log.details.error}`;
        }
        if (log.type === 'DB_SAVE') {
            return `DB Save: Dispatching state save request payload (debounced)`;
        }
        if (log.type === 'DB_SAVE_SUCCESS') {
            return `DB Save Success: Profile changes successfully pushed to MongoDB`;
        }
        if (log.type === 'DB_SAVE_ERROR') {
            return `DB Save Failed: ${log.details.error}`;
        }
        if (log.type === 'CH_UPDATE') {
            return `Chapter Edit: "${log.details.chapter}" (${log.details.subject}) -> updated ${log.details.field} to "${log.details.value}"`;
        }
        if (log.type === 'CH_SECTION_UPDATE') {
            return `Chapter Progress: "${log.details.chapter}" (${log.details.subject}) -> ${log.details.section}.${log.details.field} set to ${log.details.value}%`;
        }
        if (log.type === 'CH_ADD') {
            return `Chapter Added: "${log.details.chapter}" added under subject "${log.details.subject}"`;
        }
        if (log.type === 'CH_DELETE') {
            return `Chapter Deleted: "${log.details.chapter}" removed from subject "${log.details.subject}"`;
        }
        if (log.type === 'RESOLVE_ADD_CHAPTER') {
            return `Resolve Match: Added new chapter "${log.details.chapter}" to link extension event ${log.details.activityId}`;
        }
        if (log.type === 'RESOLVE_LINK_CHAPTER') {
            return `Resolve Match: Linked extension activity ${log.details.activityId} with existing chapter "${log.details.chapter}"`;
        }
        if (log.type === 'COHORT_INIT') {
            return `Cohort Initialize: Switched exam cohort to "${log.details.cohort}" with subjects: ${log.details.subjects?.join(', ')}`;
        }
        if (log.type === 'COHORT_SUBJECTS_DISCOVER_START') {
            return `AI Cohort Scan: Prompting AI to identify curriculum subjects for "${log.details.cohort}"`;
        }
        if (log.type === 'COHORT_SUBJECTS_DISCOVER_SUCCESS') {
            return `AI Cohort Scan: Successfully discovered subjects: ${log.details.subjects?.join(', ')}`;
        }
        if (log.type === 'COHORT_SUBJECTS_DISCOVER_ERROR') {
            return `AI Cohort Scan Failed: ${log.details.error}`;
        }
        if (log.type === 'COHORT_SETUP_COMPLETE') {
            return `Cohort Configured: "${log.details.cohort}" initialized. Processed ${log.details.filesCount} syllabus planners`;
        }
        if (log.type === 'PLANNER_UPLOAD_SUCCESS') {
            return `Planner Processed: Extracted syllabus planner for subject "${log.details.subject}" in ${log.details.mode} mode (${log.details.chaptersCount} chapters)`;
        }
        if (log.type === 'PLANNER_UPLOAD_ERROR') {
            return `Planner Error: Failed to extract planner for subject "${log.details.subject}" - ${log.details.error}`;
        }
        if (log.type === 'ROUTINE_TOGGLE') {
            return `Routine Check: Goal "${log.details.title}" state toggled to ${log.details.done ? 'COMPLETED' : 'INCOMPLETE'}`;
        }
        if (log.type === 'ROUTINE_DELETE') {
            return `Routine Delete: Removed routine goal "${log.details.title}" from list`;
        }
        return log.details.message || `Local Action: ${log.type}`;
    }
};

const Header = ({ 
    themeSettings,
    customBgImage,
    userName, 
    syncId, 
    targetDate, 
    setTargetDate, 
    daysLeft, 
    cohort, 
    openCohortSetup, 
    onOpenProfile,
    onOpenTheme,
    onExportData, 
    onImportData, 
    onLogout, 
    onDeleteAccount, 
    onNavigateToExtension, 
    onOpenBackupSettings, 
    onOpenChangeLog, 
    onSaveTargetDate, 
    showExtensionWarning,
    searchQuery,
    setSearchQuery,
    isSearchFocused,
    setIsSearchFocused,
    searchResults,
    handleInlineSearchSelect,
    activities = [],
    isPollingActivities = false,
    pollActivities,
    requestConfirm,
    onOpenBugReport,
    onOpenSuggestFeature,
    onUpdateThemeSettings,
    isSidebarVisible,
    onToggleSidebar,
    onNavigateToVinyasLived
}) => {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [showSyncId, setShowSyncId] = React.useState(false);
    
    // Spotlight Keyboard search selection state
    const [selectedSearchIdx, setSelectedSearchIdx] = React.useState(0);

    // Reset selection when search result list updates
    React.useEffect(() => {
        setSelectedSearchIdx(0);
    }, [searchResults]);
    
    // Bug Diagnostic states and refs
    const bugMenuRef = React.useRef(null);
    const [isBugMenuOpen, setIsBugMenuOpen] = React.useState(false);
    const [isSendingTelemetry, setIsSendingTelemetry] = React.useState(false);
    const [localLogs, setLocalLogs] = React.useState([]);

    // 1. Reactive log streaming when diagnostics menu is open
    React.useEffect(() => {
        if (!isBugMenuOpen) return;
        setLocalLogs(getLocalLogs());

        const handleNewLog = (e) => {
            if (e.detail === null) {
                setLocalLogs([]);
            } else {
                setLocalLogs(prev => {
                    const exists = prev.some(l => l.id === e.detail.id);
                    if (exists) return prev;
                    return [e.detail, ...prev].slice(0, 500);
                });
            }
        };

        window.addEventListener('vinyas-new-log', handleNewLog);
        return () => window.removeEventListener('vinyas-new-log', handleNewLog);
    }, [isBugMenuOpen]);

    // 2. Merge server activities and local app/AI logs
    const allLogs = React.useMemo(() => {
        const merged = [
            ...(activities || []).map(act => {
                let severity = 'info';
                if (act.type === 'DPP_SCORE') {
                    severity = act.details.accuracy >= 80 ? 'success' : act.details.accuracy >= 50 ? 'info' : 'warning';
                } else if (act.type === 'VIDEO_PROGRESS') {
                    severity = 'info';
                } else if (act.type === 'STUDY_GOALS') {
                    severity = 'success';
                }
                
                return {
                    id: act.id || `remote_${act.timestamp}_${Math.random()}`,
                    timestamp: act.timestamp,
                    type: act.type,
                    details: act.details,
                    severity,
                    isRemote: true
                };
            }),
            ...localLogs.map(log => ({
                ...log,
                isRemote: false
            }))
        ];

        return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [activities, localLogs]);

    const devLogTypes = [
        'AI_REQUEST', 'AI_RESPONSE', 'AI_EMPTY_RESPONSE', 'AI_WARNING', 
        'AI_ERROR', 'AI_CANCELLED', 'DB_LOAD', 'DB_LOAD_SUCCESS', 
        'DB_LOAD_ERROR', 'DB_SAVE', 'DB_SAVE_SUCCESS', 'DB_SAVE_ERROR',
        'COHORT_SUBJECTS_DISCOVER_START', 'COHORT_SUBJECTS_DISCOVER_SUCCESS', 
        'COHORT_SUBJECTS_DISCOVER_ERROR', 'PLANNER_UPLOAD_ERROR'
    ];

    // 3. Helper to download Client Diagnostic Snapshot
    const handleCreateSnapshot = () => {
        try {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
            const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
            
            const clientLogs = allLogs.filter(log => !devLogTypes.includes(log.type));

            const getStatsForGroup = (logsList) => {
                let success = 0, info = 0, warning = 0, error = 0;
                logsList.forEach(log => {
                    if (log.severity === 'success') success++;
                    else if (log.severity === 'warning') warning++;
                    else if (log.severity === 'error') error++;
                    else info++;
                });
                return { total: logsList.length, success, info, warning, error };
            };

            const clientGroupStats = getStatsForGroup(clientLogs);
            const refDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            let doc = `# Vinyas Project Diagnostic Log Snapshot\n`;
            doc += `**Generated**: ${dateStr} ${timeStr} (IST)\n`;
            doc += `**System Reference Date**: ${refDateStr}\n`;
            doc += `**User Sync Identifier**: ${redactSyncId(syncId)}\n`;
            doc += `**Active UI Filters**: Period: ALL | Severity: ALL | Search Query: "None"\n\n`;
            
            doc += `> [font-black]\n`;
            doc += `> ## 🤖 SYSTEM PROMPT FOR CHATBOX CLIENT PARSING & ANALYSIS\n`;
            doc += `> Please parse the student's study logs and metadata below to generate a highly visual, detailed academic coaching and system functioning report. Follow these instructions:\n`;
            doc += `>\n`;
            doc += `> ### 1. STRUCTURAL & NON-TECHNICAL REQUIREMENTS\n`;
            doc += `> - Organize the report clearly with distinct visual headings, tables, bullet points, and status icons.\n`;
            doc += `> - Keep the tone encouraging, positive, and focused on student empowerment.\n`;
            doc += `> - **Academic Analysis & App Functioning**: Explain the student's academic progress and the overall functioning of the app in a user-friendly, non-technical way (e.g., how the Chrome extension's activity logger syncs with local curriculum planners, the utility of the Pomodoro timer, or cohort setup). Do NOT display or reference sensitive technical details (such as API keys, server endpoints, or internal data schema designs).\n`;
            doc += `>\n`;
            doc += `> ### 2. DETAILED SECTIONS\n`;
            doc += `> - **Overview of Student Activity**: Summarize study actions (chapters updated, routines checked/toggled, video progress watched, DPP assignments submitted).\n`;
            doc += `> - **Academic Performance & App Flow**: Evaluate DPP scores, video watching habits, and cohort progress in plain, non-technical terms.\n`;
            doc += `> - **Curriculum Progress Tracker**: Detail any syllabus chapter additions, deletions, or updates.\n`;
            doc += `> - **Actionable Coaching Advice & Client Suggestions**: Suggest targeted study habits. Additionally, scan the client logs for any errors or warnings the client can solve themselves:\n`;
            doc += `>   - *Database Load/Save Warnings/Errors*: Suggest verifying internet connection or ensuring a valid User Sync Identifier is configured.\n`;
            doc += `>   - *Planner Upload/Parsing Errors*: Suggest double-checking that the uploaded file format is valid and not corrupted.\n`;
            doc += `>   - *Extension Sync Issues*: Suggest verifying that the browser extension is active and connected.\n`;
            doc += `>   List these user-solvable issues and their direct resolution suggestions clearly for the user.\n`;
            doc += `>\n`;
            doc += `> ### 3. SEPARATION OF CONCERNS\n`;
            doc += `> - Note that developer-side technical system logs (API load balancing/rotations, MongoDB backend connections, model fallbacks) are kept separate and encrypted. Focus strictly on these client-facing logs and client-solvable problems.\n\n`;
            
            doc += `---\n\n`;
            doc += `## 1. Project Context Metadata (Client-Side)\n`;
            doc += `- **Project Name**: Vinyas (Curriculum & Study Progress Tracker)\n`;
            doc += `- **Chrome Extension Sync**: Listens to student activities on education platforms (DPP submission, score, video duration, and study routines) and dynamically links/maps them to the local curriculum syllabus chapters. Ask user to resolve matches when chapters are ambiguous.\n\n`;
            
            doc += `---\n\n`;
            doc += `## 2. Console Summary Statistics (Client-Side)\n`;
            doc += `- **Total Client Logs**: ${clientGroupStats.total}\n`;
            doc += `- **Success Signals**: ${clientGroupStats.success}\n`;
            doc += `- **Information Logs**: ${clientGroupStats.info}\n`;
            doc += `- **Warning Signals**: ${clientGroupStats.warning}\n`;
            doc += `- **Error Logs**: ${clientGroupStats.error}\n\n`;
            
            doc += `---\n\n`;
            doc += `## 3. Compiled Client Activities & Payloads\n\n`;
            
            if (clientLogs.length === 0) {
                doc += `*No client logs matched active filters at snapshot time.*\n`;
            } else {
                clientLogs.forEach((log, idx) => {
                    const logTime = new Date(log.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                    const logDate = new Date(log.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                    doc += `### [${idx + 1}] ${logDate} ${logTime} | ${log.isRemote ? 'EXTENSION_EVENT' : 'LOCAL_APP_EVENT'} | ${log.type} | [${log.severity.toUpperCase()}]\n`;
                    doc += `* **Event Description**: ${getLogSummary(log)}\n`;
                    doc += `* **Payload Details**:\n`;
                    doc += `\`\`\`json\n${JSON.stringify(redactObject(log.details), null, 2)}\n\`\`\`\n\n`;
                });
            }

            const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `vinyas_logs_snapshot_${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })}.md`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast("Diagnostic snapshot generated and downloaded.", "success");
        } catch (error) {
            console.error("Failed to generate log snapshot", error);
            showToast("Failed to generate diagnostic snapshot: " + error.message, "error");
        }
    };

    // 4. Helper to encrypt and dispatch Developer System Telemetry
    const handleSendToDev = async () => {
        try {
            setIsSendingTelemetry(true);
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
            const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

            const devLogs = allLogs.filter(log => devLogTypes.includes(log.type) || log.severity === 'error');

            const getStatsForGroup = (logsList) => {
                let success = 0, info = 0, warning = 0, error = 0;
                logsList.forEach(log => {
                    if (log.severity === 'success') success++;
                    else if (log.severity === 'warning') warning++;
                    else if (log.severity === 'error') error++;
                    else info++;
                });
                return { total: logsList.length, success, info, warning, error };
            };

            const devGroupStats = getStatsForGroup(devLogs);
            const refDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

            let devDoc = `# Vinyas Developer System Telemetry Snapshot\n`;
            devDoc += `**Generated**: ${dateStr} ${timeStr} (IST)\n`;
            devDoc += `**System Reference Date**: ${refDateStr}\n`;
            devDoc += `**User Sync Identifier**: ${redactSyncId(syncId)}\n`;
            devDoc += `**Active UI Filters**: Period: ALL | Severity: ALL | Search Query: "None"\n\n`;

            devDoc += `> [font-black]\n`;
            devDoc += `> ## 🤖 SYSTEM PROMPT FOR CHATBOX DEVELOPER PARSING & ANALYSIS\n`;
            devDoc += `> Please parse the system telemetry logs and metadata below to generate a highly detailed technical diagnostics report. Follow these instructions:\n`;
            devDoc += `>\n`;
            devDoc += `> ### 1. STRUCTURAL REQUIREMENTS\n`;
            devDoc += `> - Organize the report with clear headings, tables, code blocks, and system health status icons (🟢, 🟡, 🔴).\n`;
            devDoc += `> - Keep the tone highly technical, descriptive, and diagnostic.\n`;
            devDoc += `>\n`;
            devDoc += `> ### 2. DETAILED SECTIONS\n`;
            devDoc += `> - **API Operations & Load Balancing**: Analyze all \`AI_REQUEST\`, \`AI_RESPONSE\`, \`AI_WARNING\`, and \`AI_ERROR\` telemetry. Evaluate:\n`;
            devDoc += `>   - API key index distribution (how rotation cycles through up to 20 keys).\n`;
            devDoc += `>   - Gemini request/response status and response size.\n`;
            devDoc += `>   - Fallbacks to Cerebras or Groq.\n`;
            devDoc += `>   - Client-side retries caused by empty or schema-only responses.\n`;
            devDoc += `> - **Database Sync Status**: Summarize MongoDB reads (\`DB_LOAD\`) and writes (\`DB_SAVE\`). Report any failures or latency.\n`;
            devDoc += `> - **Chrome Extension Sync Integration**: Report linked or matched chapters and custom matches resolved.\n`;
            devDoc += `> - **Diagnostics & Error Root-Cause Analysis**: For any error logs (e.g., \`AI_ERROR\`, \`DB_LOAD_ERROR\`, \`DB_SAVE_ERROR\`) or warnings (\`AI_WARNING\`), provide a technical description, payload details, and suggested engineering fixes.\n\n`;
            
            devDoc += `---\n\n`;
            devDoc += `## 1. Project Context Metadata (Developer-Side)\n`;
            devDoc += `- **Project Name**: Vinyas (Curriculum & Study Progress Tracker)\n`;
            devDoc += `- **Frontend Architecture**: React 18, LocalStorage events log, exponential retry backoff, Activity Console logger.\n`;
            devDoc += `- **Backend Integration**: Serverless proxy endpoint at \`/api/gemini\`.\n`;
            devDoc += `  - **Gemini Load Balancing & Rotation**: Cycles dynamically across up to 20 API keys starting at a randomized index.\n`;
            devDoc += `  - **Cerebras Fallback**: Model \`gpt-oss-120b\` (invoked for fallback when Gemini keys are exhausted).\n`;
            devDoc += `  - **Groq Fallback**: Model \`llama-3.3-70b-versatile\` (auto-detects keys prefixed with \`gsk_\` or falling back after Cerebras failure).\n`;
            devDoc += `- **Database Layer**: MongoDB syncing client-side states (subjects, chapters status, log tracking, routines).\n\n`;
            
            devDoc += `---\n\n`;
            devDoc += `## 2. Console Summary Statistics (Developer-Side)\n`;
            devDoc += `- **Total Developer Logs**: ${devGroupStats.total}\n`;
            devDoc += `- **Success Signals**: ${devGroupStats.success}\n`;
            devDoc += `- **Information Logs**: ${devGroupStats.info}\n`;
            devDoc += `- **Warning Signals**: ${devGroupStats.warning}\n`;
            devDoc += `- **Error Logs**: ${devGroupStats.error}\n\n`;
            
            devDoc += `---\n\n`;
            devDoc += `## 3. Compiled Developer Telemetry Logs & Payloads\n\n`;
            
            if (devLogs.length === 0) {
                devDoc += `*No developer logs matched active filters at snapshot time.*\n`;
            } else {
                devLogs.forEach((log, idx) => {
                    const logTime = new Date(log.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                    const logDate = new Date(log.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
                    devDoc += `### [${idx + 1}] ${logDate} ${logTime} | ${log.isRemote ? 'EXTENSION_EVENT' : 'LOCAL_APP_EVENT'} | ${log.type} | [${log.severity.toUpperCase()}]\n`;
                    devDoc += `* **Event Description**: ${getLogSummary(log)}\n`;
                    devDoc += `* **Payload Details**:\n`;
                    devDoc += `\`\`\`json\n${JSON.stringify(redactObject(log.details), null, 2)}\n\`\`\`\n\n`;
                });
            }

            if (!syncId) {
                showToast("Telemetry cancelled: A Device Sync ID is required to dispatch diagnostics.", "error");
                return;
            }
            if (!syncId.startsWith('vny_sec_')) {
                showToast("Telemetry cancelled: A cryptographically secure Device Sync ID is required to dispatch diagnostics.", "warning");
                return;
            }

            logEvent('TELEMETRY_ENCRYPT', { message: 'Performing secure AES-256-GCM telemetry encryption...' });
            const encryptedBundle = await aesEncrypt(syncId, devDoc);
            const serializedPayload = JSON.stringify(encryptedBundle);

            const response = await fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    syncId,
                    encryptedTelemetry: serializedPayload
                })
            });

            if (response.ok) {
                showToast("Telemetry successfully dispatched to developer diagnostics queue.", "success");
            } else {
                throw new Error("API returned status " + response.status);
            }
        } catch (error) {
            console.error("Failed to send developer telemetry", error);
            showToast("Failed to dispatch developer telemetry: " + error.message, "error");
        } finally {
            setIsSendingTelemetry(false);
        }
    };


    const [datePopupOpen, setDatePopupOpen] = React.useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(() => {
        return localStorage.getItem('vinyas_header_collapsed') === 'true';
    });
    const dropdownRef = React.useRef(null);
    const searchRef = React.useRef(null);
    const datePopupRef = React.useRef(null);
    const datePopupBtnRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    const [localDate, setLocalDate] = React.useState(targetDate || '');
    const [isSaving, setIsSaving] = React.useState(false);

    const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState('');
    const [showAndroidSyncModal, setShowAndroidSyncModal] = React.useState(false);

    React.useEffect(() => {
        if (syncId && showAndroidSyncModal) {
            QRCode.toDataURL(syncId, { width: 300, margin: 2 })
                .then(url => setQrCodeDataUrl(url))
                .catch(err => console.error("Failed to generate QR code", err));
        }
    }, [syncId, showAndroidSyncModal]);

    React.useEffect(() => {
        setLocalDate(targetDate || '');
    }, [targetDate]);

    const headerRef = React.useRef(null);

    React.useLayoutEffect(() => {
        if (!headerRef.current) return;
        const updateHeight = () => {
            const rect = headerRef.current.getBoundingClientRect();
            document.documentElement.style.setProperty('--navbar-height', `${rect.height}px`);
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        
        const observer = new ResizeObserver(updateHeight);
        observer.observe(headerRef.current);

        return () => {
            window.removeEventListener('resize', updateHeight);
            observer.disconnect();
        };
    }, [isHeaderCollapsed, showExtensionWarning]);

    const toggleHeaderCollapse = () => {
        const newState = !isHeaderCollapsed;
        setIsHeaderCollapsed(newState);
        localStorage.setItem('vinyas_header_collapsed', String(newState));
    };

    const handleDateSave = async () => {
        if (!localDate) return;
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (onSaveTargetDate) {
                await onSaveTargetDate(localDate);
            } else {
                setTargetDate(localDate);
            }
            showToast("Target date updated and synced!", "success");
            setDatePopupOpen(false);
        } catch (err) {
            showToast("Failed to save target date: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setSettingsOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
            if (datePopupRef.current && !datePopupRef.current.contains(event.target)) {
                if (!datePopupBtnRef.current || !datePopupBtnRef.current.contains(event.target)) {
                    setDatePopupOpen(false);
                }
            }
            if (bugMenuRef.current && !bugMenuRef.current.contains(event.target)) {
                setIsBugMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsSearchFocused]);

    React.useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key && event.key.toLowerCase() === 's') {
                if (event.ctrlKey || event.altKey || event.metaKey) {
                    return;
                }
                const activeEl = document.activeElement;
                if (
                    activeEl && (
                        activeEl.tagName === 'INPUT' || 
                        activeEl.tagName === 'TEXTAREA' || 
                        activeEl.isContentEditable
                    )
                ) {
                    return;
                }
                if (searchInputRef.current) {
                    event.preventDefault();
                    setIsSearchFocused(true);
                    searchInputRef.current.focus();
                }
            } else if (event.key && event.key.toLowerCase() === 'r') {
                if (event.ctrlKey || event.altKey || event.metaKey) {
                    return;
                }
                const activeEl = document.activeElement;
                if (
                    activeEl && (
                        activeEl.tagName === 'INPUT' || 
                        activeEl.tagName === 'TEXTAREA' || 
                        activeEl.isContentEditable
                    )
                ) {
                    return;
                }
                event.preventDefault();
                pollActivities && pollActivities();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [setIsSearchFocused, pollActivities]);

    const handleFileImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result);
                if (onImportData) {
                    onImportData(json);
                }
            } catch (err) {
                showToast("Failed to parse JSON backup file: " + err.message, "error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <header 
            ref={headerRef} 
            className={`dynamic-glass-header text-white px-4 shadow-2xl mb-0 sticky top-0 z-40 transition-all duration-300 ${isHeaderCollapsed ? 'py-2.5' : 'py-5'}`}
        >
            {/* Ambient background glow container */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px]"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px]"></div>
            </div>
            
            {/* Brand Border Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-600 via-red-500 to-blue-600 opacity-60"></div>

            {/* Red Extension Alert Banner */}
            {showExtensionWarning && (
                <div className={`max-w-7xl mx-auto bg-rose-950/65 border border-rose-900/60 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 relative z-50 transition-all duration-300 overflow-hidden ${
                    isHeaderCollapsed ? 'max-h-0 opacity-0 mb-0 p-0 border-transparent pointer-events-none' : 'max-h-[200px] opacity-100 mb-3 p-4'
                }`}>
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 flex-shrink-0 animate-pulse">
                            <i className="ph-bold ph-warning text-lg"></i>
                        </span>
                        <div>
                            <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider">
                                Vinyas Tracker Extension Action Required
                            </h4>
                            <p className="text-[11px] font-semibold text-slate-300 mt-0.5 leading-relaxed">
                                Missing or outdated extension detected (required: v{VINYAS_EXTENSION_VERSION}). Please download and load the updated extension in your browser.
                            </p>
                        </div>
                    </div>
                    <a
                        href="/Vinyas_Extension.zip"
                        download="Vinyas_Extension.zip"
                        className="bg-rose-600 hover:bg-rose-500 border border-rose-500/30 text-white text-[11px] font-black px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-rose-950/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                        title="Download Extension ZIP file"
                    >
                        <i className="ph-bold ph-download-simple text-sm"></i>
                        <span>Download Extension v{VINYAS_EXTENSION_VERSION}</span>
                    </a>
                </div>
            )}
            
            <div className="w-full flex items-center justify-between gap-4 sm:gap-6 relative z-10">
                {/* LEFT SIDE: Brand Logo, name & version (no box) */}
                <div className={`flex items-center transition-all duration-300 shrink-0 ${isHeaderCollapsed ? 'gap-3' : 'gap-5'}`}>
                    <div 
                        className="relative group shrink-0 select-none cursor-pointer"
                        onClick={onToggleSidebar}
                        title={isSidebarVisible ? "Hide Sidebar Dock" : "Show Sidebar Dock"}
                    >
                        <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full blur-md opacity-35 group-hover:opacity-60 transition-opacity duration-300"></div>
                        <YogiLogo className={`relative z-10 transition-all duration-300 group-hover:rotate-12 group-hover:scale-[1.06] active:scale-95 ${isHeaderCollapsed ? 'w-10 h-10' : 'w-14 h-14'}`} />
                    </div>

                    <div className="flex items-center min-w-0">
                        {/* Expanded Brand text & version stack */}
                        <div className={`flex flex-col justify-center transition-all duration-300 ${
                            isHeaderCollapsed ? 'max-w-0 opacity-0 pointer-events-none overflow-hidden' : 'max-w-[200px] opacity-100 overflow-visible'
                        }`}>
                            <div className="flex items-center gap-3 mb-1.5">
                                <h1 
                                    className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 via-red-500 via-pink-500 via-blue-500 to-yellow-400 bg-clip-text text-transparent leading-none"
                                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                                >
                                    Vinyas
                                </h1>

                                {/* Red Glowing Bug Trigger Button */}
                                <div className="relative" ref={bugMenuRef}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsBugMenuOpen(!isBugMenuOpen);
                                        }}
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 relative border ${
                                            isBugMenuOpen 
                                                ? 'bg-rose-500/25 border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-110' 
                                                : 'bg-rose-950/20 hover:bg-rose-900/35 border-rose-900/50 text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.15)] hover:scale-105 active:scale-95'
                                        }`}
                                        title="Diagnostics & Dev Tools"
                                    >
                                        <i className={`ph-bold text-[17px] transition-transform duration-500 ${
                                            isBugMenuOpen ? 'ph-butterfly rotate-180 text-rose-300' : 'ph-bug'
                                        }`}></i>
                                    </button>
                                    
                                    {/* Glassy Diagnostics Dropdown */}
                                    {isBugMenuOpen && (
                                        <div className="absolute left-0 mt-2 w-52 bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] p-2 z-50 animate-pop-in flex flex-col gap-1.5">
                                            <div className="text-[10px] text-rose-400 font-bold uppercase tracking-wider px-2.5 py-1.5 border-b border-slate-900 flex items-center gap-1.5">
                                                <i className="ph-bold ph-bug"></i>
                                                Vinyas Diagnostics
                                            </div>
                                            
                                            {/* Snapshot */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCreateSnapshot();
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center gap-2"
                                            >
                                                <i className="ph-bold ph-camera text-slate-400"></i>
                                                <span>Snapshot</span>
                                            </button>

                                            {/* Send to Dev */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSendToDev();
                                                }}
                                                disabled={isSendingTelemetry}
                                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-colors flex items-center justify-between disabled:opacity-50"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <i className={`ph-bold ${isSendingTelemetry ? 'ph-arrows-clockwise animate-spin text-purple-400' : 'ph-paper-plane-tilt text-slate-400'}`}></i>
                                                    <span>Send to Dev</span>
                                                </span>
                                                {isSendingTelemetry && (
                                                    <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-black">
                                                        SENDING
                                                    </span>
                                                )}
                                            </button>

                                            {/* Suggest Feature */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenSuggestFeature && onOpenSuggestFeature();
                                                    setIsBugMenuOpen(false);
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-950/20 border border-transparent hover:border-amber-900/30 transition-all flex items-center gap-2"
                                            >
                                                <i className="ph-bold ph-lightbulb text-amber-500"></i>
                                                <span>Suggest Feature</span>
                                            </button>

                                            {/* Report Bug */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenBugReport && onOpenBugReport();
                                                    setIsBugMenuOpen(false);
                                                }}
                                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all flex items-center gap-2"
                                            >
                                                <i className="ph-bold ph-warning-circle text-rose-500"></i>
                                                <span>Report Bug</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)] whitespace-nowrap">
                                    v{VINYAS_APP_VERSION || '1.2.1'}
                                </span>
                                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] whitespace-nowrap">
                                    ext v{VINYAS_EXTENSION_VERSION || '1.2.1'}
                                </span>
                            </div>
                        </div>

                        {/* Collapsed username at left corner next to logo */}
                        <span className={`text-sm sm:text-base font-black bg-gradient-to-r from-orange-400 via-red-500 to-yellow-400 bg-clip-text text-transparent tracking-tight truncate transition-all duration-300 overflow-hidden ${
                            isHeaderCollapsed ? 'max-w-[150px] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'
                        } shrink-0`}>
                            {userName || 'User'}
                        </span>
                    </div>
                </div>

                {/* GREETINGS & SETTINGS PILL */}
                {/* Divider */}
                <div className={`h-8 bg-slate-600/60 shrink-0 transition-all duration-300 ${
                    isHeaderCollapsed ? 'w-0 opacity-0 mx-0' : 'w-px opacity-100 mx-3 sm:mx-5'
                }`}></div>

                {/* Greetings stack and settings icon in glassy look */}
                <div className={`bg-slate-900/40 backdrop-blur-md border rounded-2xl flex items-center shadow-[0_0_20px_rgba(249,115,22,0.12)] hover:shadow-[0_0_25px_rgba(249,115,22,0.18)] transition-all duration-300 shrink-0 ${
                    isHeaderCollapsed 
                        ? 'max-w-0 opacity-0 pointer-events-none px-0 py-0 gap-0 border-transparent overflow-hidden h-0' 
                        : 'max-w-[400px] opacity-100 border-white/20 px-4 h-14 gap-4'
                }`}>
                    <div className="flex items-center gap-1.5 text-base sm:text-lg tracking-wide whitespace-nowrap min-w-0">
                        <span className="font-semibold text-slate-400 shrink-0">Greetings</span>
                        <span className="font-black bg-gradient-to-r from-orange-400 via-red-500 to-yellow-400 bg-clip-text text-transparent truncate max-w-[80px] sm:max-w-[150px] md:max-w-none">
                            {userName || 'User'}
                        </span>
                    </div>

                    {/* Separation Line */}
                    <div className="w-px h-6 bg-slate-600/60"></div>

                    {/* Refresh Button */}
                    <button 
                        onClick={() => pollActivities && pollActivities()}
                        disabled={isPollingActivities}
                        className="w-10 h-10 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/80 hover:border-orange-500/35 rounded-xl flex items-center justify-center text-slate-300 hover:text-orange-400 shadow transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        title="Refresh, press R"
                    >
                        <i className={`ph-bold ph-arrows-clockwise text-lg ${isPollingActivities ? 'animate-spin text-orange-400' : ''}`}></i>
                    </button>

                    {/* Vinyas Lived Journey Button */}
                    <button 
                        onClick={onNavigateToVinyasLived}
                        className="w-10 h-10 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/80 hover:border-orange-500/35 rounded-xl flex items-center justify-center text-slate-300 hover:text-orange-400 shadow transition-all active:scale-95 cursor-pointer hover:shadow-[0_0_15px_rgba(249,115,22,0.25)] group"
                        title="Vinyas Journey & Chronicles"
                    >
                        <i className="ph-bold ph-compass text-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12 text-orange-400"></i>
                    </button>

                    {/* Settings Dropdown right beside greetings */}
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setSettingsOpen(!settingsOpen)}
                            className="w-10 h-10 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/80 hover:border-orange-500/35 rounded-xl flex items-center justify-center text-slate-300 hover:text-orange-400 shadow transition-all active:scale-95 cursor-pointer"
                            title="Open Settings"
                        >
                            <i className={`ph-bold ph-gear text-lg transition-transform duration-500 ${settingsOpen ? 'rotate-90 text-orange-400' : ''}`}></i>
                        </button>
                        
                        {settingsOpen && (
                            <div className="absolute left-0 mt-2 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-pop-in flex flex-col gap-1">
                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-3 py-1.5 border-b border-slate-800">
                                    System Settings
                                </div>
                                
                                {/* Relocated Sync ID Section */}
                                <div className="p-2 border-b border-slate-800 flex flex-col gap-1.5 bg-slate-900/40 rounded-lg m-1">
                                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1">
                                        <span>Sync ID</span>
                                        <button 
                                            onClick={() => setShowSyncId(!showSyncId)}
                                            className="text-orange-400 hover:text-orange-300 font-black cursor-pointer"
                                        >
                                            {showSyncId ? "Hide" : "Show"}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-md">
                                        <span className="font-mono text-[10px] text-orange-400 font-bold flex-1 truncate select-all">
                                            {showSyncId ? syncId : '••••••••••••••••'}
                                        </span>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(syncId);
                                                showToast("Sync ID copied to clipboard!", "success");
                                            }}
                                            className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-orange-400 border border-slate-800 transition-all flex items-center justify-center cursor-pointer"
                                            title="Copy Sync ID"
                                        >
                                            <i className="ph-bold ph-copy text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onOpenProfile();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-orange-400 hover:text-orange-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-user-circle text-sm text-orange-500"></i>
                                    <span>Profile Settings</span>
                                </button>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onOpenTheme();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-paint-brush-broad text-sm text-emerald-500"></i>
                                    <span>Customize Theme</span>
                                </button>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        openCohortSetup();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-orange-400 hover:text-orange-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-books text-sm text-orange-500"></i>
                                    <span>Syllabus: {cohort || 'BITSAT'}</span>
                                </button>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onNavigateToExtension();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-puzzle-piece text-sm text-emerald-500"></i>
                                    <span>Extension & Tutorials</span>
                                </button>

                                <div className="h-px bg-slate-800 my-1"></div>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onExportData();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-download-simple text-sm text-slate-400"></i>
                                    <span>Export Backup (JSON)</span>
                                </button>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-upload-simple text-sm text-slate-400"></i>
                                    <span>Import Backup (JSON)</span>
                                </button>

                                <div className="h-px bg-slate-800 my-1"></div>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onOpenBackupSettings();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-envelope-simple text-sm text-slate-400"></i>
                                    <span>Backup Settings</span>
                                </button>

                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onOpenChangeLog();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-newspaper text-sm text-slate-400"></i>
                                    <span>Change Logs</span>
                                </button>
                                
                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onLogout();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                >
                                    <i className="ph-bold ph-sign-out text-sm text-slate-400"></i>
                                    <span>Logout Session</span>
                                </button>
                                
                                <button 
                                    onClick={() => {
                                        setSettingsOpen(false);
                                        onDeleteAccount();
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 flex items-center gap-2.5 transition-all cursor-pointer border border-transparent hover:border-rose-900/30"
                                >
                                    <i className="ph-bold ph-trash text-sm text-rose-500"></i>
                                    <span>Delete Account</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* CENTRAL SEARCH BAR: Spans dynamically over available middle space */}
                <div className={`relative transition-all duration-300 ${isSearchFocused ? 'flex-1 min-w-[150px] mx-2' : 'mx-2 md:flex-1 md:min-w-[150px]'}`} ref={searchRef}>
                    <div 
                        onClick={() => {
                            if (!isSearchFocused) {
                                setIsSearchFocused(true);
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }
                        }}
                        className={`flex items-center bg-slate-900/60 border ${
                            isSearchFocused 
                                ? 'border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.15)]' 
                                : 'border-slate-800'
                        } px-4 rounded-xl cursor-pointer transition-all duration-300 justify-center ${
                            isHeaderCollapsed ? 'h-12' : 'h-14'
                        }`}
                    >
                        <i className={`ph-bold ph-magnifying-glass text-base ${isSearchFocused ? 'text-orange-400' : 'text-slate-400'} shrink-0`}></i>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search chapters..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onKeyDown={(e) => {
                                if (searchResults.length === 0) return;
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSelectedSearchIdx(prev => (prev + 1) % searchResults.length);
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSelectedSearchIdx(prev => (prev - 1 + searchResults.length) % searchResults.length);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const selected = searchResults[selectedSearchIdx];
                                    if (selected) {
                                        handleInlineSearchSelect(selected.sIdx, selected.cIdx);
                                        setIsSearchFocused(false);
                                    }
                                } else if (e.key === 'Escape') {
                                    setIsSearchFocused(false);
                                }
                            }}
                            className={`bg-transparent text-slate-200 outline-none placeholder-slate-500 text-sm font-semibold transition-all duration-300 ${isSearchFocused ? 'w-full ml-2.5 opacity-100' : 'w-0 md:w-full md:ml-2.5 overflow-hidden opacity-0 md:opacity-100'}`}
                        />
                        {isSearchFocused && searchQuery && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery('');
                                }} 
                                className="text-slate-400 hover:text-slate-300 ml-1.5 cursor-pointer shrink-0"
                            >
                                <i className="ph-fill ph-x-circle text-base"></i>
                            </button>
                        )}
                    </div>
                    {isSearchFocused && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden modal-animate max-h-60 overflow-y-auto">
                            {searchResults.map((res, i) => {
                                const isSelected = i === selectedSearchIdx;
                                return (
                                    <div 
                                        key={i} 
                                        onMouseDown={() => {
                                            handleInlineSearchSelect(res.sIdx, res.cIdx);
                                            setIsSearchFocused(false);
                                        }} 
                                        onMouseEnter={() => setSelectedSearchIdx(i)}
                                        className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between border-b border-slate-800 last:border-0 transition-colors ${
                                            isSelected ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/40 text-slate-300'
                                        }`}
                                    >
                                        <span className="font-semibold text-xs">{res.name}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-black text-white ${res.color}`}>{res.subject}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE: Countdown and Hidden Input */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Countdown Widget */}
                    <div className={`bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl flex items-center shadow-xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300 ${
                        isHeaderCollapsed ? 'px-4 gap-3 h-12' : 'px-6 gap-4 h-14'
                    }`}>
                        <div className="flex flex-col items-end justify-center shrink-0">
                            <span className={`font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent leading-none transition-all duration-300 ${isHeaderCollapsed ? 'text-2xl' : 'text-3xl'}`}>{daysLeft}</span>
                            <span className={`text-[9px] uppercase font-bold text-slate-500 tracking-wider transition-all duration-300 overflow-hidden ${
                                isHeaderCollapsed ? 'max-h-0 opacity-0 mt-0' : 'max-h-4 opacity-100 mt-0.5'
                            }`}>days left</span>
                        </div>
                        
                        <div className={`h-8 bg-slate-800 transition-all duration-300 ${
                            isHeaderCollapsed ? 'w-0 opacity-0' : 'w-px opacity-100'
                        }`}></div>
                        
                        <div className={`relative flex items-center justify-center transition-all duration-300 overflow-hidden ${
                            isHeaderCollapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[48px] opacity-100'
                        }`}>
                            <button 
                                type="button"
                                ref={datePopupBtnRef}
                                onClick={() => setDatePopupOpen(!datePopupOpen)}
                                className="w-10 h-10 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/60 hover:border-orange-500/35 text-slate-300 hover:text-orange-400 rounded-xl flex items-center justify-center shadow-inner transition-all duration-300 active:scale-95 cursor-pointer relative"
                                title="Change Target Date"
                            >
                                <i className="ph-bold ph-calendar-blank text-lg"></i>
                            </button>
                        </div>
                    </div>

                    {/* Android Vinyas Sathi Sync QR Button */}
                    {syncId && (
                        <button
                            type="button"
                            onClick={() => setShowAndroidSyncModal(true)}
                            className={`px-3.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-black transition-all duration-300 active:scale-95 cursor-pointer shadow-md shrink-0 ${
                                isHeaderCollapsed ? 'h-12' : 'h-14'
                            } bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-emerald-400 hover:text-emerald-350 hover:border-emerald-700/80`}
                            title="Sync Vinyas Sathi App"
                        >
                            <i className="ph-bold ph-android-logo text-lg"></i>
                        </button>
                    )}

                    {/* Performance Optimization Mode Toggle Switch */}
                    <button
                        type="button"
                        onClick={() => {
                            const newMode = !themeSettings.performanceMode;
                            onUpdateThemeSettings({ performanceMode: newMode });
                            showToast(newMode ? "Integrated Graphics / Performance Mode Enabled!" : "Normal Mode Enabled!", "info");
                        }}
                        className={`px-3.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-black transition-all duration-300 active:scale-95 cursor-pointer shadow-md shrink-0 ${
                            isHeaderCollapsed ? 'h-12' : 'h-14'
                        } ${
                            themeSettings.performanceMode
                                ? 'bg-orange-500/25 border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.25)] hover:bg-orange-500/30'
                                : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800 text-slate-400 hover:text-slate-350 hover:border-slate-700/80'
                        }`}
                        title={themeSettings.performanceMode ? "Disable Performance Mode (Return to Normal Graphics)" : "Enable Performance Mode (Bypass blurs & optimize for Integrated Graphics)"}
                    >
                        <i className={`ph-bold text-sm ${themeSettings.performanceMode ? 'ph-cpu animate-pulse' : 'ph-gauge'}`}></i>
                        <span className={isHeaderCollapsed ? "hidden sm:inline" : "inline"}>
                            {themeSettings.performanceMode ? "Optimized" : "Normal"}
                        </span>
                    </button>

                    {/* Hidden file input for import */}
                    <input 
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        onChange={handleFileImport}
                        className="hidden"
                    />

                    {/* Collapse/Expand Toggle Button: Always visible at the absolute rightmost edge */}
                    <button 
                        onClick={toggleHeaderCollapse}
                        className={`rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-orange-400 flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer shrink-0 ${
                            isHeaderCollapsed ? 'w-12 h-12' : 'w-14 h-14'
                        }`}
                        title={isHeaderCollapsed ? "Expand Header" : "Collapse Header"}
                    >
                        <i className={`ph-bold ${isHeaderCollapsed ? 'ph-caret-down' : 'ph-caret-up'} text-base`}></i>
                    </button>
                </div>
            </div>

            {/* Target Date Picker Modal Overlay */}
            {datePopupOpen && createPortal(
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDatePopupOpen(false)}>
                    <div 
                        ref={datePopupRef}
                        className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-pop-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <i className="ph-bold ph-calendar-blank text-orange-400"></i> Set Target Date
                            </h3>
                            <button 
                                onClick={() => setDatePopupOpen(false)}
                                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-805 text-slate-455 hover:text-white flex items-center justify-center border border-slate-800 transition-colors cursor-pointer"
                            >
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <input 
                                type="date" 
                                value={localDate} 
                                onChange={e => setLocalDate(e.target.value)} 
                                className="bg-slate-900 border border-slate-800 text-slate-200 text-sm font-semibold outline-none rounded-xl p-3 w-full focus:border-orange-500/50 transition-all" 
                            />
                            <button 
                                onClick={handleDateSave}
                                disabled={isSaving}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 border border-orange-500/30 text-white text-xs font-black py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                {isSaving ? 'Saving...' : 'Save Date'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Android Sync Modal */}
            {showAndroidSyncModal && createPortal(
                <div 
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" 
                    onClick={() => setShowAndroidSyncModal(false)}
                >
                    <div 
                        className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm overflow-hidden animate-pop-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <i className="ph-bold ph-android-logo text-emerald-400 text-base"></i>
                                Vinyas Sathi Sync
                            </h3>
                            <button 
                                onClick={() => setShowAndroidSyncModal(false)}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <i className="ph-bold ph-x text-base"></i>
                            </button>
                        </div>

                        <p className="text-xs text-slate-400 mb-4 leading-relaxed text-center">
                            Scan this QR code with Vinyas Sathi on your phone to automatically link your syllabus trackers, test logs, and achievements.
                        </p>

                        <div className="flex justify-center items-center my-4 bg-white p-3 rounded-2xl w-[220px] h-[220px] mx-auto shadow-inner">
                            {qrCodeDataUrl ? (
                                <img 
                                    src={qrCodeDataUrl} 
                                    className="w-[200px] h-[200px]" 
                                    alt="Sync QR Code" 
                                />
                            ) : (
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800">
                            <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 flex flex-col items-center gap-1.5">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Your Sync ID</span>
                                <span className="text-xs font-mono font-bold text-slate-300 select-all">{syncId}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowAndroidSyncModal(false)}
                            className="mt-5 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all duration-300 active:scale-95 cursor-pointer text-center"
                        >
                            Done
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </header>
    );
};

export default Header;
