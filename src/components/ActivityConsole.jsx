import React, { useState, useEffect, useMemo } from 'react';
import { logEvent, getLocalLogs, clearLocalLogs } from '../services/logger';
import { useToast } from './ToastContext';
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


const ActivityConsole = ({ isOpen, onClose, syncId, activities = [], isPolling, pollActivities, lastFetchTime, requestConfirm }) => {
    const { showToast } = useToast();
    const [localLogs, setLocalLogs] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('today'); // 'today' | 'week' | 'month' | 'custom' | 'all'
    const [selectedCustomDate, setSelectedCustomDate] = useState('2026-05-22');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSeverity, setSelectedSeverity] = useState('all'); // 'all' | 'info' | 'success' | 'warning' | 'error'
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [copiedLogId, setCopiedLogId] = useState(null);

    // Initial load and custom event subscription for real-time streaming
    useEffect(() => {
        if (!isOpen) return;
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
        
        // Refresh local logs when browser window gets focus
        const handleFocus = () => setLocalLogs(getLocalLogs());
        window.addEventListener('focus', handleFocus);

        if (pollActivities) {
            pollActivities();
        }

        return () => {
            window.removeEventListener('vinyas-new-log', handleNewLog);
            window.removeEventListener('focus', handleFocus);
        };
    }, [isOpen, pollActivities]);

    // Hardcoded System Time Anchor: May 22, 2026
    const refDate = useMemo(() => new Date('2026-05-22T11:27:50+05:30'), []);

    // Merge server activities (Chrome extension) and local app/AI logs
    const allLogs = useMemo(() => {
        const merged = [
            ...activities.map(act => {
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

        // Sort descending (newest first)
        return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [activities, localLogs]);

    // Apply active filters (period, severity, search query)
    const filteredLogs = useMemo(() => {
        return allLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            if (isNaN(logDate.getTime())) return true;

            // 1. Period Filtering (anchor reference: May 22, 2026)
            if (selectedPeriod === 'today') {
                if (logDate.toDateString() !== refDate.toDateString()) return false;
            } else if (selectedPeriod === 'week') {
                const diffTime = refDate.getTime() - logDate.getTime();
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays < 0 || diffDays > 7) return false;
            } else if (selectedPeriod === 'month') {
                if (logDate.getMonth() !== refDate.getMonth() || logDate.getFullYear() !== refDate.getFullYear()) return false;
            } else if (selectedPeriod === 'custom') {
                if (selectedCustomDate) {
                    const target = new Date(selectedCustomDate);
                    if (logDate.toDateString() !== target.toDateString()) return false;
                }
            }

            // 2. Severity Filtering
            if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;

            // 3. Search Query Parsing
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase();
                const typeMatch = log.type?.toLowerCase().includes(q);
                const sourceMatch = (log.isRemote ? 'extension' : 'app').includes(q);
                const detailsMatch = JSON.stringify(log.details).toLowerCase().includes(q);
                if (!typeMatch && !sourceMatch && !detailsMatch) return false;
            }

            return true;
        });
    }, [allLogs, selectedPeriod, selectedCustomDate, selectedSeverity, searchQuery, refDate]);

    // Compute category counts for current filtered view
    const stats = useMemo(() => {
        let success = 0, info = 0, warning = 0, error = 0;
        filteredLogs.forEach(log => {
            if (log.severity === 'success') success++;
            else if (log.severity === 'warning') warning++;
            else if (log.severity === 'error') error++;
            else info++;
        });
        return { total: filteredLogs.length, success, info, warning, error };
    }, [filteredLogs]);

    const handleCopyPayload = (e, log) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(redactObject(log.details), null, 2));
        setCopiedLogId(log.id);
        setTimeout(() => setCopiedLogId(null), 2000);
    };

    const handleClearLogs = () => {
        requestConfirm(
            "Clear Local Logs",
            "Are you sure you want to clear all local application & AI logs? Extension activities from the database will not be affected.",
            () => {
                clearLocalLogs();
                setLocalLogs([]);
            }
        );
    };

    const handleCreateSnapshot = () => {
        try {
            const timeStr = refDate.toLocaleTimeString();
            const dateStr = refDate.toLocaleDateString();
            
            // 1. Separate client and developer logs
            const devLogTypes = [
                'AI_REQUEST', 'AI_RESPONSE', 'AI_EMPTY_RESPONSE', 'AI_WARNING', 
                'AI_ERROR', 'AI_CANCELLED', 'DB_LOAD', 'DB_LOAD_SUCCESS', 
                'DB_LOAD_ERROR', 'DB_SAVE', 'DB_SAVE_SUCCESS', 'DB_SAVE_ERROR',
                'COHORT_SUBJECTS_DISCOVER_START', 'COHORT_SUBJECTS_DISCOVER_SUCCESS', 
                'COHORT_SUBJECTS_DISCOVER_ERROR', 'PLANNER_UPLOAD_ERROR'
            ];
            const clientLogs = filteredLogs.filter(log => !devLogTypes.includes(log.type));

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

            // 2. Generate Client Activity Section
            let doc = `# Vinyas Project Diagnostic Log Snapshot\n`;
            doc += `**Generated**: ${dateStr} ${timeStr} (IST)\n`;
            doc += `**System Reference Date**: 2026-05-22\n`;
            doc += `**User Sync Identifier**: ${redactSyncId(syncId)}\n`;
            doc += `**Active UI Filters**: Period: ${selectedPeriod.toUpperCase()} | Severity: ${selectedSeverity.toUpperCase()} | Search Query: "${searchQuery || 'None'}"\n\n`;
            
            doc += `> [!IMPORTANT]\n`;
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
                    const logTime = new Date(log.timestamp).toLocaleTimeString();
                    const logDate = new Date(log.timestamp).toLocaleDateString();
                    doc += `### [${idx + 1}] ${logDate} ${logTime} | ${log.isRemote ? 'EXTENSION_EVENT' : 'LOCAL_APP_EVENT'} | ${log.type} | [${log.severity.toUpperCase()}]\n`;
                    doc += `* **Event Description**: ${getLogSummary(log)}\n`;
                    doc += `* **Payload Details**:\n`;
                    doc += `\`\`\`json\n${JSON.stringify(redactObject(log.details), null, 2)}\n\`\`\`\n\n`;
                });
            }

            // Trigger download for Client Snapshot (.md)
            const blob = new Blob([doc], { type: 'text/markdown;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `vinyas_logs_snapshot_${new Date().toISOString().slice(0,10)}.md`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log("[Logger] Client diagnostic snapshot generated and downloaded.");
            showToast("Diagnostic snapshot generated and downloaded.", "success");
        } catch (error) {
            console.error("Failed to generate log snapshot", error);
            showToast("Failed to generate diagnostic snapshot: " + error.message, "error");
        }
    };

    const [isSendingTelemetry, setIsSendingTelemetry] = useState(false);

    const handleSendToDev = async () => {
        try {
            setIsSendingTelemetry(true);
            const timeStr = refDate.toLocaleTimeString();
            const dateStr = refDate.toLocaleDateString();

            const devLogTypes = [
                'AI_REQUEST', 'AI_RESPONSE', 'AI_EMPTY_RESPONSE', 'AI_WARNING', 
                'AI_ERROR', 'AI_CANCELLED', 'DB_LOAD', 'DB_LOAD_SUCCESS', 
                'DB_LOAD_ERROR', 'DB_SAVE', 'DB_SAVE_SUCCESS', 'DB_SAVE_ERROR',
                'COHORT_SUBJECTS_DISCOVER_START', 'COHORT_SUBJECTS_DISCOVER_SUCCESS', 
                'COHORT_SUBJECTS_DISCOVER_ERROR', 'PLANNER_UPLOAD_ERROR'
            ];
            const devLogs = filteredLogs.filter(log => devLogTypes.includes(log.type) || log.severity === 'error');

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

            // Generate Developer System Telemetry Snapshot
            let devDoc = `# Vinyas Developer System Telemetry Snapshot\n`;
            devDoc += `**Generated**: ${dateStr} ${timeStr} (IST)\n`;
            devDoc += `**System Reference Date**: 2026-05-22\n`;
            devDoc += `**User Sync Identifier**: ${redactSyncId(syncId)}\n`;
            devDoc += `**Active UI Filters**: Period: ${selectedPeriod.toUpperCase()} | Severity: ${selectedSeverity.toUpperCase()} | Search Query: "${searchQuery || 'None'}"\n\n`;

            devDoc += `> [!IMPORTANT]\n`;
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
                    const logTime = new Date(log.timestamp).toLocaleTimeString();
                    const logDate = new Date(log.timestamp).toLocaleDateString();
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

    const toggleExpand = (logId) => {
        setExpandedLogId(expandedLogId === logId ? null : logId);
    };

    // Human-readable summary compiler for short terminal displays
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
            // Local app logs
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

    if (!isOpen) return null;

    return (
        <div className="min-h-screen bg-[#060a13] flex flex-col font-mono text-slate-300 antialiased selection:bg-blue-500/30 selection:text-white">
            
            {/* Retro scanline effect */}
            <div className="pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] opacity-30"></div>
            
            {/* Terminal Header */}
            <div className="bg-slate-950 p-4 border-b border-slate-800/80 flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 z-20 shadow-xl gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800/60 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-850 hover:border-slate-700 hover:scale-105 transition-all"
                        title="Back to Dashboard"
                    >
                        <i className="ph-bold ph-arrow-left text-lg"></i>
                    </button>
                    
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] animate-pulse">
                        <i className="ph-bold ph-terminal-window text-blue-400 text-xl"></i>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            <h2 className="text-base font-black text-slate-100 uppercase tracking-widest">
                                vinyas-core-terminal
                            </h2>
                        </div>
                        <p className="text-[10px] text-slate-500">
                            SYNC_ID: <span className="text-slate-400 font-bold">{redactSyncId(syncId)}</span> | STATUS: {isPolling ? 'POLLING...' : 'STABLE'}
                        </p>
                    </div>
                </div>

                {/* System Header Info */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-right hidden md:block">
                        <p className="text-xs text-slate-400 font-black">SYSTEM DATE: 2026-05-22</p>
                        <p className="text-[10px] text-slate-600">CLIENT TIME: 11:27:50 IST</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={pollActivities}
                            disabled={isPolling}
                            className="px-4 py-2 bg-blue-600/90 hover:bg-blue-500 text-white border border-blue-500/40 rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(37,99,235,0.25)] active:scale-95"
                        >
                            <i className={`ph-bold ph-arrows-clockwise ${isPolling ? 'animate-spin' : ''}`}></i>
                            {isPolling ? 'Syncing...' : 'Sync Extension'}
                        </button>
                        <button 
                            onClick={handleCreateSnapshot}
                            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-2"
                            title="Download Diagnostic Snapshot for Chatbot Review"
                        >
                            <i className="ph-bold ph-camera"></i>
                            Snapshot
                        </button>
                        <button 
                            onClick={handleSendToDev}
                            disabled={isSendingTelemetry}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-650 to-purple-600 hover:from-indigo-600 hover:to-purple-500 text-white border border-indigo-500/45 hover:border-indigo-400 rounded-lg text-xs font-bold disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                            title="AES-GCM Encrypt and upload Developer Telemetry to database"
                        >
                            <i className={`ph-bold ${isSendingTelemetry ? 'ph-arrows-clockwise animate-spin' : 'ph-paper-plane-tilt'}`}></i>
                            {isSendingTelemetry ? 'Sending...' : 'Send to Dev'}
                        </button>
                        <button 
                            onClick={handleClearLogs}
                            className="px-4 py-2 bg-slate-900 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-900/50 rounded-lg text-xs font-bold transition-all active:scale-95"
                            title="Clear local application logs"
                        >
                            <i className="ph-bold ph-trash"></i>
                        </button>
                    </div>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 overflow-hidden">
                
                {/* Control Panel / Sidebar */}
                <div className="bg-slate-950/80 border-b lg:border-b-0 lg:border-r border-slate-900 p-5 flex flex-col gap-6 lg:h-[calc(100vh-73px)] lg:overflow-y-auto">
                    
                    {/* Retro System ASCII Banner */}
                    <div className="text-[7px] text-slate-600 leading-none select-none font-bold hidden lg:block opacity-60">
                        <pre>
{` _  _ _ _  _ _  _ ____ ____ 
 |  | | |\ |  \/  |__| [__  
  \/  | | \| _/\_ |  | ___] 
============================`}
                        </pre>
                        <p className="mt-2 text-[9px] text-slate-700 tracking-wider">SECURE KERNEL LOGGER ACTIVE</p>
                    </div>

                    {/* Filter Period Box */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                            <i className="ph-bold ph-calendar-blank mr-1"></i> Time Period Filter
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                            {[
                                { id: 'today', label: 'Today (May 22)' },
                                { id: 'week', label: 'This Week' },
                                { id: 'month', label: 'This Month' },
                                { id: 'all', label: 'All Logged' },
                                { id: 'custom', label: 'Specific Date...' }
                            ].map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPeriod(p.id)}
                                    className={`px-3 py-2 text-left rounded-lg text-xs font-bold transition-all border ${
                                        selectedPeriod === p.id 
                                            ? 'bg-blue-950/40 text-blue-400 border-blue-800/80 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                                            : 'bg-slate-900/50 text-slate-400 border-slate-800/60 hover:text-slate-200 hover:bg-slate-850'
                                    }`}
                                >
                                    <span className="flex items-center justify-between">
                                        {p.label}
                                        {selectedPeriod === p.id && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {selectedPeriod === 'custom' && (
                            <div className="mt-2 animate-fadeIn">
                                <input 
                                    type="date" 
                                    value={selectedCustomDate}
                                    onChange={(e) => setSelectedCustomDate(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-blue-500/50"
                                />
                                <span className="text-[9px] text-slate-600 mt-1 block">Comparing matching calendar date</span>
                            </div>
                        )}
                    </div>

                    {/* Filter Severity */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                            <i className="ph-bold ph-funnel mr-1"></i> Severity Filter
                        </label>
                        <div className="flex flex-wrap lg:flex-col gap-2">
                            {[
                                { id: 'all', label: 'All Severities', color: 'text-slate-400' },
                                { id: 'success', label: 'Success', color: 'text-emerald-400', icon: 'ph-check-circle' },
                                { id: 'info', label: 'Information', color: 'text-blue-400', icon: 'ph-info' },
                                { id: 'warning', label: 'Warnings', color: 'text-amber-400', icon: 'ph-warning' },
                                { id: 'error', label: 'Errors', color: 'text-rose-400', icon: 'ph-x-circle' }
                            ].map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedSeverity(s.id)}
                                    className={`px-3 py-2 text-left rounded-lg text-xs font-bold transition-all border flex items-center gap-2 ${
                                        selectedSeverity === s.id 
                                            ? 'bg-slate-900 text-slate-100 border-slate-700 shadow-inner' 
                                            : 'bg-transparent text-slate-500 border-transparent hover:text-slate-350'
                                    }`}
                                >
                                    {s.icon && <i className={`ph-bold ${s.icon} ${s.color}`}></i>}
                                    <span className={selectedSeverity === s.id ? s.color : ''}>{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Console Stats Panel */}
                    <div className="mt-auto bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 space-y-3 shadow-inner">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-slate-450 border-b border-slate-800/80 pb-2">
                            <i className="ph-bold ph-chart-bar mr-1"></i> Console Stats
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 text-xs">
                            <div className="flex justify-between items-center text-slate-400">
                                <span>Total Signals:</span>
                                <span className="font-bold text-slate-200">{stats.total}</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-400">
                                <span>Success:</span>
                                <span className="font-bold">{stats.success}</span>
                            </div>
                            <div className="flex justify-between items-center text-blue-400">
                                <span>Info:</span>
                                <span className="font-bold">{stats.info}</span>
                            </div>
                            <div className="flex justify-between items-center text-amber-400">
                                <span>Warnings:</span>
                                <span className="font-bold">{stats.warning}</span>
                            </div>
                            <div className="flex justify-between items-center text-rose-400">
                                <span>Errors:</span>
                                <span className="font-bold">{stats.error}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Terminal Console Output */}
                <div className="lg:col-span-3 flex flex-col lg:h-[calc(100vh-73px)] bg-[#070b13]">
                    
                    {/* Log Filter/Search Bar */}
                    <div className="p-4 border-b border-slate-900/80 bg-slate-950/40 flex items-center gap-3">
                        <div className="relative flex-1">
                            <i className="ph-bold ph-magnifying-glass absolute left-3.5 top-3 text-slate-500 text-sm"></i>
                            <input
                                type="text"
                                placeholder="Search terminal logs (e.g. 'gemini', 'db', 'electrostatics')..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#090e1a] border border-slate-800/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-250 focus:outline-none focus:border-blue-500/50 placeholder:text-slate-650 transition-all font-mono"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-350"
                                >
                                    <i className="ph-bold ph-x-circle"></i>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Console Live Feed */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 font-mono text-xs">
                        
                        {/* Terminal Welcome lines */}
                        <div className="text-[10px] text-slate-600 mb-4 select-none opacity-80 leading-relaxed border-b border-slate-900 pb-3">
                            <p>&gt; initializing logger interface client connection...</p>
                            <p>&gt; load local log limit: 500 records maximum. oldest truncated automatically.</p>
                            <p>&gt; listening to vinyas event channel: local app + chrome extension activities merged.</p>
                            <p>&gt; display filter: [period={selectedPeriod.toUpperCase()}], [level={selectedSeverity.toUpperCase()}]</p>
                        </div>

                        {filteredLogs.length === 0 ? (
                            <div className="h-[45vh] flex flex-col items-center justify-center text-slate-600 opacity-60">
                                <i className="ph-bold ph-broadcast text-4xl mb-3 text-slate-700 animate-pulse"></i>
                                <p className="text-[11px] uppercase tracking-wider font-bold">No logs match active filters</p>
                                <p className="text-[10px] mt-1 text-center max-w-xs">Perform an action in the app, sync the extension, or modify filter selections to capture system records.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredLogs.map((log) => {
                                    const isExpanded = expandedLogId === log.id;
                                    const isCopied = copiedLogId === log.id;
                                    
                                    // Custom colors mapping based on severity
                                    const severityStyles = {
                                        info: 'border-l-[3px] border-blue-500 bg-blue-950/5 text-slate-300 hover:bg-blue-950/10',
                                        success: 'border-l-[3px] border-emerald-500 bg-emerald-950/5 text-slate-300 hover:bg-emerald-950/10',
                                        warning: 'border-l-[3px] border-amber-500 bg-amber-950/5 text-slate-350 hover:bg-amber-950/10',
                                        error: 'border-l-[3px] border-rose-600 bg-rose-950/5 text-rose-100 hover:bg-rose-950/10'
                                    };

                                    const tagColors = {
                                        info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                        success: 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20',
                                        warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                                        error: 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                    };

                                    const logTimeStr = new Date(log.timestamp).toLocaleTimeString();
                                    const logDateStr = new Date(log.timestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric'});

                                    return (
                                        <div 
                                            key={log.id} 
                                            onClick={() => toggleExpand(log.id)}
                                            className={`rounded-lg border border-slate-900 p-3.5 transition-all cursor-pointer flex flex-col gap-2 group ${severityStyles[log.severity] || severityStyles.info}`}
                                        >
                                            {/* Log Summary Header Row */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    
                                                    {/* Source Badge */}
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${log.isRemote ? 'bg-purple-950/20 text-purple-400 border-purple-900/30' : 'bg-slate-900 text-slate-400 border-slate-800'}`}>
                                                        {log.isRemote ? 'EXT' : 'APP'}
                                                    </span>

                                                    {/* Severity Tag */}
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border tracking-wide uppercase ${tagColors[log.severity]}`}>
                                                        {log.type}
                                                    </span>

                                                    {/* Human readable text */}
                                                    <span className="text-xs font-semibold text-slate-250 select-text break-all sm:break-normal">
                                                        {getLogSummary(log)}
                                                    </span>
                                                </div>

                                                {/* Timestamp & Collapse Icon */}
                                                <div className="flex items-center justify-between sm:justify-end gap-3 text-[10px] text-slate-500 shrink-0">
                                                    <span>{logDateStr} {logTimeStr}</span>
                                                    <i className={`ph-bold text-slate-400 group-hover:text-white transition-transform ${isExpanded ? 'ph-caret-up rotate-180' : 'ph-caret-down'}`}></i>
                                                </div>
                                            </div>

                                            {/* Expanded Payload Viewer */}
                                            {isExpanded && (
                                                <div 
                                                    onClick={(e) => e.stopPropagation()} // Prevent collapse toggling when clicking code body
                                                    className="mt-3 bg-[#04060b] border border-slate-850 rounded-lg overflow-hidden animate-slideDown"
                                                >
                                                    {/* Header controls for code block */}
                                                    <div className="bg-slate-950 px-3 py-1.5 border-b border-slate-850 flex justify-between items-center text-[10px] text-slate-500 font-bold select-none">
                                                        <span>RECORD_PAYLOAD (JSON)</span>
                                                        <button 
                                                            onClick={(e) => handleCopyPayload(e, log)}
                                                            className="flex items-center gap-1 hover:text-white px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 transition-colors border border-slate-800"
                                                        >
                                                            <i className={`ph-bold ${isCopied ? 'ph-check text-emerald-400' : 'ph-copy'}`}></i>
                                                            {isCopied ? 'Copied' : 'Copy'}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Code content */}
                                                    <pre className="p-4 text-[11px] overflow-x-auto text-slate-400 max-h-[300px] leading-relaxed selection:bg-blue-500/20 scrollbar-custom select-text">
                                                        <code>{JSON.stringify(redactObject(log.details), null, 2)}</code>
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                    </div>

                    {/* Live Streaming footer indicator */}
                    <div className="p-3 border-t border-slate-900 bg-slate-950/65 flex justify-between items-center text-[9px] text-slate-500 select-none">
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Live Console Feed Active
                        </span>
                        <span>vinyas-kernel-logger</span>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default ActivityConsole;
