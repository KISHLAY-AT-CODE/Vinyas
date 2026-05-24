// This file will not be in production: no use for security check, for developer only
import React, { useState, useMemo, useEffect } from 'react';

const getISTISOString = (date = new Date()) => {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + tzOffset);
    return istDate.toISOString().replace('Z', '+05:30');
};

const FALLBACK_ACHIEVEMENTS = [
    { id: 'syllabus_starter', title: 'Syllabus Starter', description: 'Began progress on your syllabus by completing some part of a chapter or DPP.', icon: '🚀', unlocked: false },
    { id: 'first_strike', title: 'First Strike', description: 'Logged your first mock test or practice log in the planner.', icon: '🎯', unlocked: false },
    { id: 'mock_master', title: 'Mock Master', description: 'Logged 5 or more mock tests or practice logs.', icon: '🏆', unlocked: false },
    { id: 'night_owl', title: 'Night Owl', description: 'Studied late at night between 12 AM and 4 AM IST.', icon: '🦉', unlocked: false },
    { id: 'early_bird', title: 'Early Bird', description: 'Studied early in the morning between 5 AM and 8 AM IST.', icon: '🌅', unlocked: false },
    { id: 'dpp_sniper', title: 'DPP Sniper', description: 'Achieved 100% completion on at least 3 DPPs.', icon: '🎯', unlocked: false },
    { id: 'module_conqueror', title: 'Module Conqueror', description: 'Achieved 100% completion on any interactive chapter module tracker.', icon: '👑', unlocked: false },
    { id: 'perfect_accuracy', title: 'Perfect Accuracy', description: 'Achieved 90%+ accuracy on any module or DPP.', icon: '🔥', unlocked: false },
    { id: 'consistent_scholar', title: 'Consistent Scholar', description: 'Completed 5 or more daily routines or plans.', icon: '📅', unlocked: false },
    { id: 'dpp_killer', title: 'DPP Killer', description: 'Submitted 3 DPPs or modules with above 85% accuracy in a single day.', icon: '💀', unlocked: false },
    { id: 'are_you_procrastinating', title: 'Are you procrastinating?', description: 'Fewer than 2 DPP or module uploads logged by 11 PM today.', icon: '🛌', unlocked: false },
    { id: 'sleeping_beauty', title: 'Sleeping Beauty', description: "Sleeping a bit much aren't you?", icon: '😴', unlocked: false },
    { id: 'dead_man_walking', title: 'Dead Man Walking', description: 'Submitted 2 consecutive DPPs with less than 60% accuracy.', icon: '🧟', unlocked: false }
];

const DevToolsOverlay = ({ syncId, allAchievements, setActiveAchievement, pollActivities, setRetryTrigger, data, requestConfirm, email, onSendTestBackupMail }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [bypassRedaction, setBypassRedaction] = useState(() => localStorage.getItem('bypassRedaction') === 'true');
    
    // Activity Form States
    const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);
    const [quizType, setQuizType] = useState('DPP');
    const [customTitle, setCustomTitle] = useState('');
    const [accuracy, setAccuracy] = useState(90);
    const [completion, setCompletion] = useState(100);
    const [isReattempt, setIsReattempt] = useState(false);

    // Email simulation states
    const [testEmail, setTestEmail] = useState(email || '');
    const [sendingWeekendSim, setSendingWeekendSim] = useState(false);
    const [sendingTestSim, setSendingTestSim] = useState(false);

    useEffect(() => {
        if (email) setTestEmail(email);
    }, [email]);

    const handleSendEmailSim = async (isTest) => {
        if (!syncId) {
            showStatus('error', 'Sync ID must be active to send backup!');
            return;
        }
        if (!testEmail || !testEmail.trim()) {
            showStatus('error', 'Please enter a target email address!');
            return;
        }

        try {
            if (isTest) {
                setSendingTestSim(true);
            } else {
                setSendingWeekendSim(true);
            }
            await onSendTestBackupMail(testEmail.trim(), isTest);
            showStatus('success', isTest ? 'Test verification email dispatched!' : 'Weekend layout email dispatched!');
        } catch (err) {
            showStatus('error', err.message || 'Failed to send backup mail');
        } finally {
            if (isTest) {
                setSendingTestSim(false);
            } else {
                setSendingWeekendSim(false);
            }
        }
    };
    
    // Status Feedbacks
    const [actionStatus, setActionStatus] = useState({ type: '', message: '' });

    // Build flat chapters list from syllabus data
    const chaptersList = useMemo(() => {
        const list = [];
        if (data && Array.isArray(data)) {
            data.forEach((sub, sIdx) => {
                if (sub.chapters && Array.isArray(sub.chapters)) {
                    sub.chapters.forEach((ch, cIdx) => {
                        list.push({ sIdx, cIdx, subject: sub.name, name: ch.name });
                    });
                }
            });
        }
        return list;
    }, [data]);

    // Pre-populate custom title when chapter or type changes
    useEffect(() => {
        if (chaptersList.length > 0 && chaptersList[selectedChapterIdx]) {
            const ch = chaptersList[selectedChapterIdx];
            if (quizType === 'MODULE') {
                setCustomTitle(`Module - ${ch.name}`);
            } else {
                setCustomTitle(`${ch.name} : DPP 01 MCQ Quiz`);
            }
        }
    }, [selectedChapterIdx, quizType, chaptersList]);

    const showStatus = (type, message) => {
        setActionStatus({ type, message });
        setTimeout(() => {
            setActionStatus({ type: '', message: '' });
        }, 4000);
    };

    // Toggle Obfuscation
    const handleToggleBypass = (e) => {
        const val = e.target.checked;
        setBypassRedaction(val);
        localStorage.setItem('bypassRedaction', val ? 'true' : 'false');
        showStatus('success', `Redaction bypass ${val ? 'enabled' : 'disabled'}!`);
    };

    // Submit Simulation Activity
    const handlePushSimulatedActivity = async (e) => {
        e.preventDefault();
        if (!syncId) {
            showStatus('error', 'Sync ID must be active to push activity!');
            return;
        }

        const ch = chaptersList[selectedChapterIdx];
        if (!ch) {
            showStatus('error', 'Select a valid chapter!');
            return;
        }

        try {
            const uniqueId = 'test_' + (quizType === 'MODULE' ? 'module_' : 'dpp_') + Date.now();
            const title = quizType === 'MODULE' ? `Module - ${ch.name}` : customTitle;
            const encodedCh = encodeURIComponent(ch.name);
            const url = quizType === 'MODULE'
                ? `https://study.physicswallah.live/module?chapterTitle=${encodedCh}&id=${Date.now()}${isReattempt ? '&type=Reattempt' : ''}`
                : `https://study.physicswallah.live/dpp/quiz?id=${Date.now()}&chapterTitle=${encodedCh}${isReattempt ? '&type=Reattempt' : ''}`;

            const dummyActivity = {
                syncId: syncId,
                type: 'DPP_SCORE',
                timestamp: getISTISOString(),
                details: {
                    title: title,
                    quizType: quizType, // "DPP" or "MODULE"
                    accuracy: Number(accuracy),
                    completion: Number(completion),
                    score: `${Math.round(accuracy / 10)}/10`,
                    correct: Math.round(accuracy / 10),
                    incorrect: 10 - Math.round(accuracy / 10),
                    timeTaken: '12m 45s',
                    url: url
                }
            };

            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dummyActivity)
            });

            if (response.ok) {
                const resData = await response.json();
                showStatus('success', resData.reattempt ? 'Simulated Reattempt Sync Successful!' : 'Simulated Activity Submited Successfully!');
                if (pollActivities) await pollActivities();
                if (setRetryTrigger) setRetryTrigger(prev => prev + 1);
            } else {
                const errData = await response.json();
                showStatus('error', errData.error || 'Server error pushing simulation');
            }
        } catch (err) {
            showStatus('error', 'Failed to connect to simulation API');
            console.error(err);
        }
    };

    // Nuke Database records
    const handleNukeActivities = async () => {
        if (!syncId) {
            showStatus('error', 'No active Sync ID to nuke!');
            return;
        }

        requestConfirm(
            "Nuke Database Records",
            "Are you sure you want to delete all synced activities and reset chapter progress? This operates on live database!",
            async () => {
                try {
                    const response = await fetch(`/api/activity?syncId=${encodeURIComponent(syncId)}&fullDelete=true`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        showStatus('success', 'Database cleared successfully!');
                        if (pollActivities) await pollActivities();
                        if (setRetryTrigger) setRetryTrigger(prev => prev + 1);
                    } else {
                        showStatus('error', 'Failed to clear activities database');
                    }
                } catch (err) {
                    showStatus('error', 'API connection error during nuke');
                    console.error(err);
                }
            }
        );
    };

    // Trigger Random Achievement Toast
    const handleTriggerRandomAchievement = () => {
        const list = allAchievements && allAchievements.length > 0 ? allAchievements : FALLBACK_ACHIEVEMENTS;
        const target = list[Math.floor(Math.random() * list.length)];
        if (target && setActiveAchievement) {
            setActiveAchievement({
                ...target,
                key: Date.now()
            });
            showStatus('success', `Toast triggered: "${target.title}"`);
        }
    };

    // Trigger Specific Achievement Toast
    const handleTriggerSpecificAchievement = (ach) => {
        if (ach && setActiveAchievement) {
            setActiveAchievement({
                ...ach,
                key: Date.now()
            });
            showStatus('success', `Toast triggered: "${ach.title}"`);
        }
    };



    return (
        <>
            {/* Collapsed Wrench Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 left-6 z-[100] bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white w-14 h-14 rounded-full shadow-[0_4px_25px_rgba(20,184,166,0.4)] border border-teal-400/30 transition-all flex items-center justify-center group hover:scale-105 active:scale-95"
                title="Open Developer Testing Tools"
            >
                <i className="ph-bold ph-wrench text-2xl group-hover:rotate-45 transition-transform duration-300"></i>
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-teal-500"></span>
                </span>
            </button>

            {/* Slider Drawer Overlay Panel */}
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
                    <div
                        className="w-96 max-w-full h-full bg-slate-950/95 border-l border-slate-800 shadow-2xl flex flex-col backdrop-blur-md overflow-hidden animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                            <div>
                                <h3 className="text-base font-black text-slate-100 flex items-center gap-2">
                                    <i className="ph-fill ph-wrench text-teal-400"></i> DevTools Console
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">Local sandbox activity simulation</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                            >
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>

                        {/* Status Popup/Alert */}
                        {actionStatus.message && (
                            <div className={`px-6 py-3 text-xs font-bold text-center border-b animate-in slide-in-from-top duration-200 ${
                                actionStatus.type === 'success' 
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                                <i className={`ph-bold ${actionStatus.type === 'success' ? 'ph-check-circle' : 'ph-warning-octagon'} mr-1.5`}></i>
                                {actionStatus.message}
                            </div>
                        )}

                        {/* Drawer Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            
                            {/* Obfuscation & Redaction */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="ph-bold ph-eye-slash text-indigo-400 text-sm"></i> Diagnostics Redaction
                                </h4>
                                <label className="flex items-center gap-3 cursor-pointer group text-xs text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={bypassRedaction}
                                        onChange={handleToggleBypass}
                                        className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                    />
                                    <span className="font-semibold group-hover:text-white transition-colors">
                                        Bypass sensitive data obfuscation
                                    </span>
                                </label>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium pl-7">
                                    Reveals raw unredacted Sync IDs and database models inside the Live Activity Console logs.
                                </p>
                            </div>

                            {/* Simulated DPP Activity Simulator */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="ph-bold ph-plus-circle text-teal-400 text-sm"></i> Simulate DPP/Module Sync
                                </h4>
                                
                                <form onSubmit={handlePushSimulatedActivity} className="space-y-3">
                                    {/* Chapter selection */}
                                    {chaptersList.length > 0 ? (
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Select Chapter</label>
                                            <select
                                                value={selectedChapterIdx}
                                                onChange={(e) => setSelectedChapterIdx(Number(e.target.value))}
                                                className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-teal-500/50"
                                            >
                                                {chaptersList.map((ch, idx) => (
                                                    <option key={idx} value={idx}>
                                                        [{ch.subject.slice(0, 4).toUpperCase()}] {ch.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-rose-400 font-medium">No chapters loaded. Is syllabus data available?</div>
                                    )}

                                    {/* Quiz Type Selector */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Activity Type</label>
                                            <select
                                                value={quizType}
                                                onChange={(e) => setQuizType(e.target.value)}
                                                className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-teal-500/50 font-bold"
                                            >
                                                <option value="DPP">📝 DPP Quiz</option>
                                                <option value="MODULE">👑 Chapter Module</option>
                                            </select>
                                        </div>
                                        
                                        {/* Reattempt Checkbox */}
                                        <div className="flex flex-col justify-end">
                                            <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-slate-400 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl hover:text-white hover:border-slate-700 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={isReattempt}
                                                    onChange={(e) => setIsReattempt(e.target.checked)}
                                                    className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                                />
                                                Reattempt
                                            </label>
                                        </div>
                                    </div>

                                    {/* Custom Title Field */}
                                    {quizType === 'DPP' && (
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider font-mono">Custom Title</label>
                                            <input
                                                type="text"
                                                value={customTitle}
                                                onChange={(e) => setCustomTitle(e.target.value)}
                                                placeholder="Custom DPP Title"
                                                className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-teal-500/50"
                                            />
                                        </div>
                                    )}

                                    {/* Completion Slider */}
                                    <div>
                                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                                            <span>Completion</span>
                                            <span className="text-teal-400 font-mono font-bold">{completion}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={completion}
                                            onChange={(e) => setCompletion(e.target.value)}
                                            className="w-full accent-teal-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                                        />
                                    </div>

                                    {/* Accuracy Slider */}
                                    <div>
                                        <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                                            <span>Accuracy</span>
                                            <span className="text-teal-400 font-mono font-bold">{accuracy}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            value={accuracy}
                                            onChange={(e) => setAccuracy(e.target.value)}
                                            className="w-full accent-teal-500 h-1 bg-slate-950 rounded-lg cursor-pointer"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className="w-full py-2.5 mt-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-black text-xs rounded-xl shadow-lg shadow-teal-950/20 transition-all flex items-center justify-center gap-1.5 border border-teal-500/20"
                                    >
                                        <i className="ph-bold ph-paper-plane-tilt text-sm"></i> Push Simulated Activity
                                    </button>
                                </form>
                            </div>



                            {/* Email Service Sandbox */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="ph-bold ph-envelope text-indigo-400 text-sm"></i> Email Service Sandbox
                                </h4>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">Recipient Email</label>
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        placeholder="e.g. yourname@example.com"
                                        className="w-full text-xs bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500/50 font-semibold"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleSendEmailSim(true)}
                                        disabled={sendingTestSim || sendingWeekendSim}
                                        className="py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-350 hover:text-white font-bold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                        <i className={`ph-bold ${sendingTestSim ? 'ph-spinner-gap animate-spin text-indigo-400' : 'ph-paper-plane-tilt'}`}></i>
                                        <span>Test Connection</span>
                                    </button>
                                    <button
                                        onClick={() => handleSendEmailSim(false)}
                                        disabled={sendingTestSim || sendingWeekendSim}
                                        className="py-2.5 bg-gradient-to-r from-indigo-650 to-purple-650 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-[11px] rounded-xl shadow-lg transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                                    >
                                        <i className={`ph-bold ${sendingWeekendSim ? 'ph-spinner-gap animate-spin text-white' : 'ph-calendar-star'}`}></i>
                                        <span>Simulate Weekend</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                    Sends actual encrypted backups using your SMTP integration. "Simulate Weekend" renders the exact layout sent automatically on Saturday/Sunday.
                                </p>
                            </div>

                            {/* Achievements Toast Spawner */}
                            <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <i className="ph-bold ph-medal text-yellow-500 text-sm"></i> Toast Notifications
                                    </h4>
                                    <button
                                        onClick={handleTriggerRandomAchievement}
                                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded text-[10px] font-bold transition-all"
                                    >
                                        🎲 Random Toast
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 font-semibold leading-normal">
                                    Click any achievement below to immediately trigger a visual toast spawner:
                                </p>
                                
                                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    {(allAchievements && allAchievements.length > 0 ? allAchievements : FALLBACK_ACHIEVEMENTS).map((ach) => (
                                        <button
                                            key={ach.id}
                                            onClick={() => handleTriggerSpecificAchievement(ach)}
                                            className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-yellow-500/40 text-left rounded-xl transition-all flex items-center gap-2 group"
                                            title={ach.description}
                                        >
                                            <span className="text-lg group-hover:scale-110 transition-transform">{ach.icon}</span>
                                            <span className="text-[10px] font-bold text-slate-300 group-hover:text-slate-100 truncate flex-1 leading-tight">{ach.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Database Operations */}
                            <div className="bg-rose-950/10 rounded-2xl border border-rose-900/20 p-4 space-y-3">
                                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="ph-bold ph-trash-simple text-sm"></i> Danger Zone
                                </h4>
                                <p className="text-[10px] text-slate-500 leading-normal font-medium">
                                    Clears all database logs for current active sync ID. This can be used to reset testing dashboard states.
                                </p>
                                <button
                                    onClick={handleNukeActivities}
                                    className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/30 text-rose-400 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5"
                                >
                                    <i className="ph-bold ph-skull text-sm"></i> Nuke Sync ID Activities
                                </button>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/30 text-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                            Vinyas SyncID: <span className="font-mono text-slate-400 font-bold">{syncId || 'None'}</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DevToolsOverlay;
