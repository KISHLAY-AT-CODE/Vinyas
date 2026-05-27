import React, { useState } from 'react';
import { useToast } from './ToastContext';
import { aesEncrypt } from '../services/crypto';
import { getLocalLogs } from '../services/logger';
import { WHATS_NEW_CHANGELOG } from '../data/version';

const Modals = ({
    routineModalType,
    closeRoutineModal,
    selectedInorganicChapter,
    inorganicChapterInput,
    setInorganicChapterInput,
    inorganicSearchResults,
    setSelectedInorganicChapter,
    routineLogInput,
    setRoutineLogInput,
    saveInorganicRoutineLog,
    saveTestLog,
    logModalOpen,
    activeLog,
    setActiveLog,
    saveLog,
    setLogModalOpen,
    currentLevel,
    
    changeLogOpen,
    setChangeLogOpen,
    bugReportOpen,
    setBugReportOpen,
    syncId
}) => {
    const { showToast } = useToast();
    
    // Bug Report States
    const [bugDesc, setBugDesc] = useState('');
    const [bugSeverity, setBugSeverity] = useState('Medium');
    const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
    const [isSubmittingBug, setIsSubmittingBug] = useState(false);
    const [screenshot, setScreenshot] = useState('');
    const [screenshotName, setScreenshotName] = useState('');
    const [screenshotPreview, setScreenshotPreview] = useState('');

    const handleScreenshotChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            showToast("Screenshot must be under 2MB.", "error");
            return;
        }

        setScreenshotName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setScreenshot(reader.result);
            setScreenshotPreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveScreenshot = () => {
        setScreenshot('');
        setScreenshotName('');
        setScreenshotPreview('');
    };

    const releaseNotes = [
        {
            version: `v${WHATS_NEW_CHANGELOG.version}`,
            date: WHATS_NEW_CHANGELOG.date,
            badge: 'Latest Update',
            changes: [
                ...WHATS_NEW_CHANGELOG.coreChanges,
                ...WHATS_NEW_CHANGELOG.clientChanges
            ]
        },
        {
            version: 'v1.2.0',
            date: 'May 25, 2026',
            changes: [
                '🔄 Implemented link-based re-check & duplicate overlay asking for confirmation to bypass deduplication or cancel.',
                '🎯 Created "Nothing to see here" empty state illustration for interactive module question tracker prior to first synced practice.',
                '🔗 Added Open PW shortcut button in progress logs allowing direct navigation to PW specific DPPs or Modules.',
                '✅ Consolidated suggested goals: Lecture & DPP recommendations are merged into a single card with multi-select checklists.',
                '🧠 Integrated stable suggested goals identifiers to prevent redundant recommendations on sync refreshes.',
                '📝 Added native manual module tracking (completion/accuracy sliders) within wrap-ups, syncing directly to database.',
                '🐞 Added premium Contact Developer & secure AES-encrypted diagnostics Bug Reporter console.',
                '📸 Integrated base64 screenshot attachment support in bug reports, forwarded securely via server SMTP relay.',
                '🔒 Programmed complete localStorage & extension storage atomic clear on session logout or account deletion.',
                '⏱️ Integrated 5-day inactivity warning alert and 6-day automatic database account purge in IST.'
            ]
        },
        {
            version: 'v1.1.0',
            date: 'May 10, 2026',
            changes: [
                '🔐 Added high-entropy secure cryptographic device sync identifier configuration (vny_sec_).',
                '📧 Configured automated DB backup settings with prefilled developer email test launchers.',
                '⏱️ Integrated client-side Pomodoro focus session minutes logger providing focus points XP scaling.'
            ]
        },
        {
            version: 'v1.0.0',
            date: 'April 20, 2026',
            changes: [
                '🚀 Initial beta release of Vinyas syllabus tracker curriculum organizer.',
                '🔄 Implemented auto-sync engine connecting PW study materials to local target calendar planners.'
            ]
        }
    ];

    const handleSubmitBug = async () => {
        if (!bugDesc.trim()) {
            showToast("Please enter a description of the bug.", "error");
            return;
        }

        const diagnosticsText = `
[Vinyas Bug Report Diagnostics]
Timestamp: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)
Sync ID: ${syncId}
OS Platform: Windows (x86_64)
Severity: ${bugSeverity}
User Description: ${bugDesc}

Recent Core Logs:
${includeDiagnostics ? JSON.stringify(getLocalLogs().slice(0, 15), null, 2) : 'Excluded by user'}
        `;

        try {
            setIsSubmittingBug(true);
            if (!syncId) {
                showToast("Sync ID is required to dispatch diagnostics.", "error");
                return;
            }
            if (!syncId.startsWith('vny_sec_')) {
                showToast("A cryptographically secure Sync ID (vny_sec_...) is required to dispatch diagnostics.", "warning");
                return;
            }

            const encryptedTelemetry = await aesEncrypt(syncId, diagnosticsText);
            const serializedPayload = JSON.stringify(encryptedTelemetry);

            const response = await fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    syncId,
                    encryptedTelemetry: serializedPayload,
                    bugSeverity,
                    bugDesc,
                    screenshot
                })
            });

            if (response.ok) {
                showToast("Bug report and diagnostics successfully uploaded to diagnostics queue!", "success");
                setBugReportOpen(false);
                setBugDesc('');
                setScreenshot('');
                setScreenshotName('');
                setScreenshotPreview('');
            } else {
                throw new Error("API returned status " + response.status);
            }
        } catch (error) {
            console.error("Failed to submit bug report:", error);
            showToast("Failed to submit report digitally. Please try again later!", "error");
        } finally {
            setIsSubmittingBug(false);
        }
    };

    return (
        <>
            {/* Routine: Inorganic Revision Modal */}
            {routineModalType === 'inorganic' && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-animate">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <i className="ph-fill ph-flask text-emerald-400"></i> Log Inorganic Revision
                            </h3>
                            <button onClick={closeRoutineModal} className="text-slate-400 hover:text-white"><i className="ph-bold ph-x text-xl"></i></button>
                        </div>
                        <div className="p-6">
                            {!selectedInorganicChapter ? (
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-slate-300">Search Chemistry Chapter:</label>
                                    <div className="relative">
                                        <i className="ph-bold ph-magnifying-glass absolute left-3 top-3.5 text-slate-500"></i>
                                        <input type="text" autoFocus value={inorganicChapterInput} onChange={e => setInorganicChapterInput(e.target.value)} placeholder="Type to search..." className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 outline-none focus:border-emerald-500 transition-colors" />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-xl mt-2 bg-slate-900/50">
                                        {inorganicSearchResults.map(ch => (
                                            <div key={ch.cIdx} onClick={() => setSelectedInorganicChapter(ch)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-800 last:border-0 text-slate-200 font-medium">
                                                {ch.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-pop-in">
                                    <div className="bg-emerald-900/20 border border-emerald-500/30 px-4 py-3 rounded-xl flex justify-between items-center">
                                        <span className="font-bold text-emerald-400">{selectedInorganicChapter.name}</span>
                                        <button onClick={() => setSelectedInorganicChapter(null)} className="text-xs font-bold text-slate-400 hover:text-white">Change</button>
                                    </div>
                                    <label className="text-sm font-semibold text-slate-300 block mt-4">Progress Log:</label>
                                    <textarea autoFocus value={routineLogInput} onChange={e => setRoutineLogInput(e.target.value)} placeholder="E.g., Read NCERT pages 45-60, solved 20 Qs..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 h-28 outline-none focus:border-emerald-500 transition-colors resize-none"></textarea>
                                    <button onClick={saveInorganicRoutineLog} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors mt-2">Save & Complete Routine</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Routine: Test Log Modal */}
            {routineModalType === 'test' && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-animate">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <i className="ph-fill ph-exam text-orange-400"></i> Mock Test Journal
                            </h3>
                            <button onClick={closeRoutineModal} className="text-slate-400 hover:text-white"><i className="ph-bold ph-x text-xl"></i></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-400">Log your mock test score, or skip if you aren't testing today.</p>
                            
                            <textarea autoFocus value={routineLogInput} onChange={e => setRoutineLogInput(e.target.value)} placeholder="E.g., Scored 210/390. Need to improve speed in Maths. Screwed up electrostatics logic." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 h-24 outline-none focus:border-orange-500 transition-colors resize-none"></textarea>
                            
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => saveTestLog(true)} className="px-4 py-3 bg-slate-700 hover:bg-slate-650 text-slate-200 font-bold rounded-xl shadow-sm transition-colors text-sm w-1/3 text-center whitespace-nowrap">
                                    No Test Today
                                </button>
                                <button onClick={() => saveTestLog(false)} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg transition-colors">
                                    Log Test & Complete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Basic Chapter Log Modal */}
            {logModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-animate">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <i className="ph-fill ph-notepad text-indigo-400"></i> Log: {activeLog.name}
                            </h3>
                            <button onClick={() => setLogModalOpen(false)} className="text-slate-400 hover:text-white"><i className="ph-bold ph-x text-xl"></i></button>
                        </div>
                        <div className="p-5">
                            <p className="text-xs text-slate-400 mb-3">Add notes for AI analysis.</p>
                            <textarea value={activeLog.text} onChange={(e) => setActiveLog({...activeLog, text: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 h-32 resize-none" placeholder="E.g., Confident with theory, weak on PYQs..."></textarea>
                        </div>
                        <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setLogModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-300">Cancel</button>
                            <button onClick={saveLog} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-md">Save Log</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Change Log Modal */}
            {changeLogOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-animate">
                    <div className="bg-slate-800/95 border border-slate-700 rounded-[2rem] shadow-2xl max-w-xl w-full flex flex-col max-h-[85vh] overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/30 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                            <div>
                                <h3 className="text-xs font-bold text-blue-450 uppercase tracking-widest mb-1">Release History</h3>
                                <h2 className="text-xl font-black text-white flex items-center gap-2">
                                    <i className="ph-fill ph-newspaper text-blue-500"></i> Vinyas Updates & Change Logs
                                </h2>
                            </div>
                            <button onClick={() => setChangeLogOpen(false)} className="text-slate-400 hover:text-white bg-slate-700/55 p-2 rounded-full transition-colors">
                                <i className="ph-bold ph-x text-lg"></i>
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-900/10">
                            {releaseNotes.map((note, index) => (
                                <div key={note.version} className="border-b border-slate-700/40 last:border-none pb-6 last:pb-0 animate-pop-in">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-sm font-black text-slate-100 font-mono tracking-tight bg-slate-900 border border-slate-700 px-3 py-1 rounded-xl shadow-inner">
                                            {note.version}
                                        </span>
                                        <span className="text-xs text-slate-500 font-semibold">{note.date}</span>
                                        {note.badge && (
                                            <span className="text-[9px] font-black px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/25 animate-pulse uppercase tracking-wider">
                                                {note.badge}
                                            </span>
                                        )}
                                    </div>
                                    <ul className="space-y-2 text-xs text-slate-350 pl-2">
                                        {note.changes.map((change, i) => (
                                            <li key={i} className="leading-relaxed flex items-start gap-2.5">
                                                <span className="mt-0.5 select-none">{change.slice(0, 2)}</span>
                                                <span className="flex-1">{change.slice(2)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-700/55 bg-slate-900/30 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <span>Vinyas Studies Core v1.2</span>
                            <span>Stay focused, stay consistent</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Bug Report / Contact Developer Modal */}
            {bugReportOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-animate">
                    <div className="bg-slate-800/95 border border-slate-700 rounded-[2rem] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/30 relative">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
                            <div>
                                <h3 className="text-xs font-bold text-rose-455 uppercase tracking-widest mb-1">Developer Feedback</h3>
                                <h2 className="text-xl font-black text-white flex items-center gap-2">
                                    <i className="ph-fill ph-warning-circle text-rose-500"></i> Contact Developer & Report Bug
                                </h2>
                            </div>
                            <button onClick={() => setBugReportOpen(false)} className="text-slate-400 hover:text-white bg-slate-700/55 p-2 rounded-full transition-colors">
                                <i className="ph-bold ph-x text-lg"></i>
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 space-y-5 bg-slate-900/10">
                            
                            {/* Severity Selector */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bug Severity Level</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['Low', 'Medium', 'High', 'Critical'].map(level => {
                                        const colors = {
                                            Low: 'border-blue-500/30 text-blue-450 hover:bg-blue-500/10',
                                            Medium: 'border-yellow-500/30 text-yellow-450 hover:bg-yellow-500/10',
                                            High: 'border-orange-500/30 text-orange-450 hover:bg-orange-500/10',
                                            Critical: 'border-rose-500/30 text-rose-455 hover:bg-rose-500/10'
                                        };
                                        const activeColors = {
                                            Low: 'bg-blue-600/25 border-blue-500 text-blue-400 shadow-md',
                                            Medium: 'bg-yellow-600/25 border-yellow-500 text-yellow-400 shadow-md',
                                            High: 'bg-orange-600/25 border-orange-500 text-orange-400 shadow-md',
                                            Critical: 'bg-rose-600/25 border-rose-550 text-rose-400 shadow-md animate-pulse'
                                        };
                                        return (
                                            <button 
                                                key={level} 
                                                onClick={() => setBugSeverity(level)}
                                                className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                                    bugSeverity === level ? activeColors[level] : `bg-slate-900/60 text-slate-500 border-slate-750 ${colors[level]}`
                                                }`}
                                            >
                                                {level}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Description */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bug Description / Message</label>
                                <textarea 
                                    autoFocus
                                    value={bugDesc}
                                    onChange={e => setBugDesc(e.target.value)}
                                    placeholder="Describe the issue you encountered, or leave a message for the developer. Prefilled system diagnostics will be compiled..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-slate-200 h-28 outline-none focus:border-rose-500/60 transition-colors resize-none text-xs leading-relaxed"
                                ></textarea>
                            </div>

                            {/* Screenshot Upload */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attach Screenshot (Optional)</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={handleScreenshotChange}
                                        className="hidden"
                                        id="bug-screenshot-upload"
                                    />
                                    <label 
                                        htmlFor="bug-screenshot-upload"
                                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-900/80 border border-slate-700 hover:border-slate-600 text-slate-350 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 active:scale-95"
                                    >
                                        <i className="ph-bold ph-image text-sm"></i>
                                        {screenshotName ? 'Change Image' : 'Choose Image'}
                                    </label>
                                    {screenshotName && (
                                        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-750 px-3 py-2 rounded-xl text-xs text-slate-350">
                                            <span className="truncate max-w-[150px] font-semibold">{screenshotName}</span>
                                            <button 
                                                onClick={handleRemoveScreenshot}
                                                className="text-rose-400 hover:text-rose-300 transition-colors"
                                                title="Remove Image"
                                            >
                                                <i className="ph-bold ph-trash"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {screenshotPreview && (
                                    <div className="mt-2 border border-slate-750 rounded-2xl overflow-hidden max-h-32 bg-slate-950 flex items-center justify-center">
                                        <img src={screenshotPreview} alt="Screenshot Preview" className="max-h-32 object-contain" />
                                    </div>
                                )}
                            </div>

                            {/* Diagnostics toggle */}
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input 
                                    type="checkbox"
                                    checked={includeDiagnostics}
                                    onChange={e => setIncludeDiagnostics(e.target.checked)}
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-750 text-rose-500 focus:ring-0 focus:ring-offset-0"
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-300">Include Diagnostic Logs</span>
                                    <span className="text-[10px] text-slate-500">Appends platform spec and last 15 local core kernel logs automatically</span>
                                </div>
                            </label>
                        </div>

                        {/* Footer buttons */}
                        <div className="p-6 border-t border-slate-700/50 bg-slate-900/30 flex gap-3">
                            <button 
                                onClick={() => handleSubmitBug()}
                                disabled={isSubmittingBug}
                                className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black rounded-2xl shadow-lg shadow-rose-950/20 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                                title="Encrypt and upload diagnostics directly to diagnostics queue"
                            >
                                <i className={`ph-bold ${isSubmittingBug ? 'ph-spinner animate-spin' : 'ph-paper-plane-tilt'} text-sm`}></i>
                                {isSubmittingBug ? 'Submitting...' : 'Submit Report Digitally'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Modals;

