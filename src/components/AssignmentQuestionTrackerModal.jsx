import React, { useState, useEffect, useMemo, useRef } from 'react';

const truncateWords = (str, maxWords = 8) => {
    if (!str) return '';
    const words = str.split(/\s+/);
    if (words.length <= maxWords) return str;
    return words.slice(0, maxWords).join(' ') + '...';
};

const AssignmentQuestionTrackerModal = ({
    isOpen,
    onClose,
    subjectName,
    chapterName: initialChapter,
    assignmentName: initialName,
    assignmentUrl,
    assignmentType: initialType = 'DPP',
    allCustomTypes = [],
    data = [],
    questionCount: initialCount = 0,
    questionStates: initialStates = {},
    questionRemarks: initialRemarks = {},
    selfAnalysis: initialSelfAnalysis = {},
    onSaveProgress,
    onResolveAssignment,
    flushSave,
    showToast,
    requestConfirm
}) => {
    // Progress state
    const [questionCount, setQuestionCount] = useState(0);
    const [localProgress, setLocalProgress] = useState({});
    const [localRemarks, setLocalRemarks] = useState({});
    
    // Metadata state
    const [chapterName, setChapterName] = useState('');
    const [assignmentName, setAssignmentName] = useState('');
    const [assignmentType, setAssignmentType] = useState('DPP');
    const [isCustomTypeModalOpen, setIsCustomTypeModalOpen] = useState(false);
    const [newCustomType, setNewCustomType] = useState('');

    // Resolve Mismatch State
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [resolveSubjectIdx, setResolveSubjectIdx] = useState(0);
    const [resolveSubjectMode, setResolveSubjectMode] = useState('existing'); // 'existing' or 'new'
    const [resolveNewSubjectName, setResolveNewSubjectName] = useState('');
    const [resolveChapterMode, setResolveChapterMode] = useState('existing'); // 'existing' or 'new'
    const [resolveChapterIdx, setResolveChapterIdx] = useState(0);
    const [resolveNewChapterName, setResolveNewChapterName] = useState('');
    
    // UI state
    const [selectedQNum, setSelectedQNum] = useState(null);
    const [addCount, setAddCount] = useState(10);
    const [remarksTab, setRemarksTab] = useState('visual'); // 'visual' or 'markdown'
    const scrollContainerRef = useRef(null);

    // Save state
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Markdown Modal State
    const [isMarkdownModalOpen, setIsMarkdownModalOpen] = useState(false);
    const [compiledMarkdown, setCompiledMarkdown] = useState('');

    // --- New States for Self-Analysis ---
    const [activeModalTab, setActiveModalTab] = useState('tracker'); // 'tracker' or 'analysis'
    const [selfAnalysis, setSelfAnalysis] = useState({
        topicName: '',
        correctCount: 0,
        incorrectCount: 0,
        targetDuration: 0,
        completedDuration: 0,
        blunder: '',
        resolution: '',
        isSubmitted: false
    });
    const [elapsedTimeSec, setElapsedTimeSec] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setQuestionCount(initialCount || 0);
            setLocalProgress(initialStates || {});
            setLocalRemarks(initialRemarks || {});
            setChapterName(initialChapter || '');
            setAssignmentName(initialName || '');
            setAssignmentType(initialType || 'DPP');
            setSelectedQNum(null);
            setIsResolveModalOpen(false);
            setResolveSubjectIdx(0);
            setResolveSubjectMode('existing');
            setResolveChapterMode('existing');
            setResolveChapterIdx(0);
            setResolveNewSubjectName('');
            setResolveNewChapterName(initialChapter || '');
            setRemarksTab('visual');
            setIsDirty(false);
            setIsSaving(false);
            setIsInitialLoad(true);

            // New states reset
            setActiveModalTab(initialSelfAnalysis?.isSubmitted ? 'analysis' : 'tracker');
            setIsSaveConfirmOpen(false);
            
            // Prefill/Restore selfAnalysis
            const defaults = {
                topicName: initialSelfAnalysis?.topicName || `${initialName || ''} - ${initialType || 'DPP'}`,
                correctCount: initialSelfAnalysis?.correctCount !== undefined ? initialSelfAnalysis.correctCount : 0,
                incorrectCount: initialSelfAnalysis?.incorrectCount !== undefined ? initialSelfAnalysis.incorrectCount : 0,
                targetDuration: initialSelfAnalysis?.targetDuration !== undefined ? initialSelfAnalysis.targetDuration : 0,
                completedDuration: initialSelfAnalysis?.completedDuration !== undefined ? initialSelfAnalysis.completedDuration : 0,
                blunder: initialSelfAnalysis?.blunder || '',
                resolution: initialSelfAnalysis?.resolution || '',
                isSubmitted: !!initialSelfAnalysis?.isSubmitted
            };

            if (!initialSelfAnalysis?.isSubmitted) {
                let completedCount = 0;
                let incorrectCountVal = 0;
                for (let q = 1; q <= (initialCount || 0); q++) {
                    const qState = (initialStates || {})[q];
                    if (qState === 'completed') {
                        completedCount++;
                    } else if (qState === 'difficult' || qState === 'later') {
                        incorrectCountVal++;
                    }
                }
                defaults.correctCount = completedCount;
                defaults.incorrectCount = incorrectCountVal;
            }

            setSelfAnalysis(defaults);
            const restoredTime = initialSelfAnalysis?.elapsedTimeSec || 0;
            setElapsedTimeSec(restoredTime);
            setIsTimerRunning(false); // Read-only dashboard viewer, timer should not run
        }
    }, [isOpen, initialCount, initialStates, initialRemarks, initialChapter, initialName, initialType, initialSelfAnalysis, subjectName]);

    const stats = useMemo(() => {
        let completed = 0; let difficult = 0; let later = 0;
        for (let q = 1; q <= questionCount; q++) {
            const state = localProgress[q];
            if (state === 'completed') completed++;
            else if (state === 'difficult') difficult++;
            else if (state === 'later') later++;
        }
        const calculatedComp = questionCount > 0 ? Math.round((completed / questionCount) * 100) : 0;
        return { completed, difficult, later, calculatedComp };
    }, [localProgress, questionCount]);

    const handleAddQuestions = (count) => {
        setQuestionCount(prev => prev + count);
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
            }
        }, 50);
    };

    const handleToggleQuestion = (qNum) => {
        if (selectedQNum === qNum) {
            const currentState = localProgress[qNum] || 'none';
            let next = 'completed';
            if (currentState === 'completed') next = 'difficult';
            else if (currentState === 'difficult') next = 'later';
            else if (currentState === 'later') next = 'none';
            
            setLocalProgress(prev => {
                const updated = { ...prev };
                if (next === 'none') delete updated[qNum];
                else updated[qNum] = next;
                return updated;
            });
        } else {
            setSelectedQNum(qNum);
        }
    };

    const handleSaveMetaAndProgress = (extraPayload = {}) => {
        if (onSaveProgress) {
            onSaveProgress({
                questionCount,
                questionStates: localProgress,
                questionRemarks: localRemarks,
                assignmentName: assignmentName.trim(),
                assignmentType,
                selfAnalysis: {
                    ...selfAnalysis,
                    elapsedTimeSec,
                    completedDuration: Math.round(elapsedTimeSec / 60),
                    ...extraPayload
                }
            });
        }
    };

    const handleSaveWorkflow = async ({ finalize }) => {
        setIsSaving(true);
        setIsTimerRunning(false); // Pause timer on save
        
        let attempts = selfAnalysis.attempts ? [...selfAnalysis.attempts] : [];
        if (finalize) {
            const prevAttemptsTime = attempts.reduce((sum, att) => sum + (att.elapsedTimeSec || 0), 0);
            const additionalTime = Math.max(0, elapsedTimeSec - prevAttemptsTime);
            const newAttempt = {
                attemptNumber: attempts.length + 1,
                elapsedTimeSec: additionalTime,
                formattedTime: formatTime(additionalTime),
                timestamp: new Date().toISOString(),
                correctCount: selfAnalysis.correctCount,
                incorrectCount: selfAnalysis.incorrectCount
            };
            attempts.push(newAttempt);
        }

        const finalSelfAnalysis = {
            ...selfAnalysis,
            attempts,
            elapsedTimeSec,
            completedDuration: Math.round(elapsedTimeSec / 60),
            isSubmitted: finalize ? true : selfAnalysis.isSubmitted
        };

        try {
            if (onSaveProgress) {
                onSaveProgress({
                    questionCount,
                    questionStates: localProgress,
                    questionRemarks: localRemarks,
                    assignmentName: assignmentName.trim(),
                    assignmentType,
                    selfAnalysis: finalSelfAnalysis
                });
            }
            await new Promise(r => setTimeout(r, 50));
            if (flushSave) {
                await flushSave();
            }
            setIsDirty(false);
            if (showToast) {
                showToast(
                    finalize 
                        ? "🎉 Assessment Finalized & Submitted!" 
                        : "✅ Progress Auto-Saved (Timer Paused)", 
                    "success"
                );
            }
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            if (showToast) showToast("❌ Failed to save progress", "error");
        } finally {
            setIsSaving(false);
        }
    };

    // Track unsaved changes for discard warning
    useEffect(() => {
        if (!isOpen) return;
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }
        setIsDirty(true);
    }, [
        questionCount, 
        localProgress, 
        localRemarks, 
        assignmentName, 
        assignmentType, 
        chapterName, 
        isOpen, 
        isInitialLoad,
        selfAnalysis.topicName,
        selfAnalysis.correctCount,
        selfAnalysis.incorrectCount,
        selfAnalysis.targetDuration,
        selfAnalysis.blunder,
        selfAnalysis.resolution
    ]);

    // Unsaved Changes warning (Browser close)
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Keyboard arrow keys navigation for sliding through questions
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen || questionCount === 0) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                if (selectedQNum === null) {
                    setSelectedQNum(1);
                } else if (selectedQNum > 1) {
                    setSelectedQNum(selectedQNum - 1);
                }
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                if (selectedQNum === null) {
                    setSelectedQNum(1);
                } else if (selectedQNum < questionCount) {
                    setSelectedQNum(selectedQNum + 1);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, questionCount, selectedQNum]);

    // Timer Effect
    useEffect(() => {
        let interval = null;
        if (isOpen && isTimerRunning && !selfAnalysis.isSubmitted) {
            interval = setInterval(() => {
                setElapsedTimeSec(prev => prev + 1);
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isOpen, isTimerRunning, selfAnalysis.isSubmitted]);

    const formatTime = (totalSeconds) => {
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        const p = (num) => String(num).padStart(2, '0');
        return hrs > 0 ? `${p(hrs)}:${p(mins)}:${p(secs)}` : `${p(mins)}:${p(secs)}`;
    };

    const handleDiscardAndClose = () => {
        if (isDirty) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                return;
            }
        }
        setIsTimerRunning(false);
        onClose();
    };

    const handleCompileMarkdown = () => {
        let md = `## Remarks for ${assignmentName} (${chapterName})\n\n`;
        let hasRemarks = false;
        for (let q = 1; q <= questionCount; q++) {
            if (localRemarks[q]) {
                hasRemarks = true;
                const state = localProgress[q] || 'Unmarked';
                const stateText = state === 'completed' ? '✓ Completed' : state === 'difficult' ? '! Difficult' : state === 'later' ? '⌛ Later' : 'Unmarked';
                md += `### Question ${q} (${stateText})\n${localRemarks[q]}\n\n`;
            }
        }
        if (!hasRemarks) md += "No remarks added yet.";
        setCompiledMarkdown(md);
        setIsMarkdownModalOpen(true);
    };

    const handleTypeChange = (e) => {
        const val = e.target.value;
        if (val === 'Custom') {
            setIsCustomTypeModalOpen(true);
        } else {
            setAssignmentType(val);
        }
    };

    const saveCustomType = () => {
        const val = newCustomType.trim();
        if (val) {
            setAssignmentType(val);
        }
        setIsCustomTypeModalOpen(false);
        setNewCustomType('');
    };

    const handleResolveSubmit = () => {
        let targetSub = '';
        let targetChap = '';
        let createSub = false;
        let createChap = false;

        if (resolveSubjectMode === 'new') {
            targetSub = resolveNewSubjectName.trim();
            createSub = true;
        } else {
            targetSub = data[resolveSubjectIdx]?.name || '';
        }

        if (resolveChapterMode === 'new' || resolveSubjectMode === 'new') {
            targetChap = resolveNewChapterName.trim();
            createChap = true;
        } else {
            targetChap = data[resolveSubjectIdx]?.chapters[resolveChapterIdx]?.name || '';
        }

        if (!targetSub || !targetChap) {
            if (showToast) showToast("Please provide valid subject and chapter names.", "error");
            return;
        }

        if (onResolveAssignment) {
            onResolveAssignment(targetSub, targetChap, createSub, createChap);
        }
    };

    const getQuestionStateBadge = (state) => {
        if (state === 'completed') {
            return (
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    ✓ Completed
                </span>
            );
        }
        if (state === 'difficult') {
            return (
                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    ! Difficult
                </span>
            );
        }
        if (state === 'later') {
            return (
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    ⌛ Later
                </span>
            );
        }
        return (
            <span className="bg-slate-750 border border-slate-700 text-slate-400 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md flex items-center gap-1">
                To Do
            </span>
        );
    };

    if (!isOpen) return null;

    const baseCustomTypes = ['DPP', 'Module', 'Test', 'Notes'];
    const activeCustomTypes = Array.from(new Set([...allCustomTypes, assignmentType])).filter(t => t && !baseCustomTypes.includes(t));

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] w-full max-w-5xl h-[92vh] flex flex-col backdrop-blur-xl relative text-slate-100">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden flex-shrink-0">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Interactive Assignment Tracker</span>
                            <span className="bg-slate-700 border border-slate-600 text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                {subjectName}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight flex items-center gap-2" title={`${chapterName} (${assignmentName})`}>
                            <i className="ph-fill ph-notebook text-blue-500"></i>
                            {truncateWords(chapterName, 8)} <span className="text-slate-400 font-semibold text-lg">({truncateWords(assignmentName, 5)})</span>
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleDiscardAndClose} 
                            className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2.5 rounded-full transition-colors"
                            title="Close Tracker"
                        >
                            <i className="ph-bold ph-x text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Tab Switcher & Pausable Timer */}
                <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-900/60 px-6 py-2.5 border-b border-slate-700 gap-3 flex-shrink-0">
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                            onClick={() => setActiveModalTab('tracker')}
                            className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                                activeModalTab === 'tracker' 
                                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                            }`}
                        >
                            <i className="ph-bold ph-grid-nine text-sm"></i>
                            <span>Question Tracker</span>
                        </button>
                        <button 
                            onClick={() => setActiveModalTab('analysis')}
                            className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 relative ${
                                activeModalTab === 'analysis' 
                                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                            }`}
                        >
                            <i className="ph-bold ph-chart-bar text-sm"></i>
                            <span>Self Analysis</span>
                            {selfAnalysis.isSubmitted ? (
                                <span className="w-2 h-2 bg-emerald-500 rounded-full" title="Self Analysis Completed"></span>
                            ) : (
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" title="Self Analysis In Progress"></span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Main Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/25">
                    
                    {activeModalTab === 'tracker' ? (
                        <>
                            {/* Read-Only Banner CTA */}
                            {!selfAnalysis.isSubmitted && (
                                <div className="bg-gradient-to-r from-orange-600/25 via-amber-500/10 to-transparent border border-orange-500/30 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg animate-fade-in">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-center flex-shrink-0 text-orange-400 text-lg">
                                            💡
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-orange-400 uppercase tracking-wider">Tracking In Progress</h4>
                                            <p className="text-[11px] text-slate-350 leading-relaxed mt-1 max-w-xl">
                                                Active tracking, timer logs, and self-analysis reporting run inside the Chrome Extension. Open this assignment URL in your PW batch to launch the floating widget.
                                            </p>
                                        </div>
                                    </div>
                                    <a 
                                        href={assignmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full md:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-650 hover:from-orange-500 hover:to-red-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <i className="ph-bold ph-arrow-square-out text-sm"></i>
                                        Open Assignment PDF
                                    </a>
                                </div>
                            )}

                            {/* Sub-Header: Settings & Legend (Read-Only) */}
                            <div className="p-5 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4 shadow-lg">
                                {/* Settings Controls */}
                                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto text-xs font-bold text-slate-300">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name:</span>
                                        <input 
                                            type="text" 
                                            value={assignmentName} 
                                            onChange={e => {
                                                setAssignmentName(e.target.value);
                                                setIsDirty(true);
                                            }} 
                                            className="bg-slate-900 border border-slate-750 text-slate-200 px-3 py-1.5 rounded-xl outline-none focus:border-blue-500/50 font-bold text-xs max-w-[160px]" 
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type:</span>
                                        <select 
                                            value={assignmentType} 
                                            onChange={e => {
                                                handleTypeChange(e);
                                                setIsDirty(true);
                                            }}
                                            className="bg-slate-900 border border-slate-750 text-slate-200 px-3 py-1.5 rounded-xl outline-none focus:border-blue-500/50 font-bold text-xs uppercase cursor-pointer"
                                        >
                                            <option value="DPP">DPP</option>
                                            <option value="Module">Module</option>
                                            <option value="Test">Test</option>
                                            <option value="Notes">Notes</option>
                                            {activeCustomTypes.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                            <option value="Custom">+ Custom</option>
                                        </select>
                                    </div>

                                    <span className="text-[10px] font-extrabold text-slate-400 bg-slate-900 border border-slate-750 px-2.5 py-1.5 rounded-xl">
                                        Dashboard View
                                    </span>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 bg-emerald-600 border border-emerald-500 rounded-lg flex items-center justify-center text-[10px] text-white">✓</span>
                                        <span>Completed</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 bg-rose-600 border border-rose-500 rounded-lg flex items-center justify-center text-[10px] text-white">!</span>
                                        <span>Difficult</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 bg-amber-600 border border-amber-500 rounded-lg flex items-center justify-center text-[10px] text-white">⌛</span>
                                        <span>Solve Later</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 bg-slate-900 border border-slate-700 rounded-lg"></span>
                                        <span>To Do</span>
                                    </div>
                                </div>
                            </div>

                            {/* Progress Overview Panel */}
                            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-5 shadow-lg">
                                
                                {/* Completion Progress Card */}
                                <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between h-full min-h-[120px]">
                                    <div className="flex justify-between items-baseline">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completion Progress</span>
                                            <span className="text-[9px] text-slate-500 font-medium">Assignment questions done</span>
                                        </div>
                                        <span className="text-sm font-black text-blue-400">{stats.calculatedComp}%</span>
                                    </div>
                                    <div className="my-3">
                                        <div className="bg-slate-950 border border-slate-700/80 rounded-full h-3 overflow-hidden relative">
                                            <div 
                                                className="bg-gradient-to-r from-blue-600 to-indigo-650 h-full rounded-full transition-all duration-500 ease-out" 
                                                style={{ width: `${stats.calculatedComp}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                        <span>Status</span>
                                        <span>{stats.completed} / {questionCount} Done</span>
                                    </div>
                                </div>

                                {/* Active Timer Card (Read-Only) */}
                                <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between h-full min-h-[120px] relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                <i className="ph-bold ph-stopwatch text-blue-400"></i> Active Timer
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-medium">Solving duration</span>
                                        </div>
                                        <span className="text-[9px] font-extrabold uppercase bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded">
                                            {selfAnalysis.isSubmitted ? 'Locked' : 'Extension'}
                                        </span>
                                    </div>
                                    
                                    <div className="my-2.5 flex items-baseline justify-between">
                                        <span className="text-lg font-mono font-black text-slate-100 tracking-wider">
                                            {formatTime(elapsedTimeSec)}
                                        </span>
                                        {selfAnalysis.targetDuration > 0 && (
                                            <span className="text-[10px] font-bold text-slate-400">
                                                / {selfAnalysis.targetDuration} mins
                                            </span>
                                        )}
                                    </div>

                                    <div className="w-full py-1.5 bg-slate-800/40 border border-slate-700/50 text-slate-500 text-center text-[10px] font-bold rounded-lg select-none">
                                        {selfAnalysis.isSubmitted ? 'Assessment Finalized' : 'Timer Managed In Widget'}
                                    </div>
                                </div>

                                {/* Remarks Card */}
                                <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between h-full min-h-[120px]">
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remarks Summary</span>
                                            <span className="text-[9px] text-slate-500 font-medium">Review compiled feedback</span>
                                        </div>
                                        <span className="text-sm font-black text-blue-400">
                                            {Object.keys(localRemarks).filter(q => localRemarks[q]).length} Notes
                                        </span>
                                    </div>
                                    
                                    <div className="my-2.5 text-[10px] text-slate-400 font-semibold truncate">
                                        {Object.keys(localRemarks).filter(q => localRemarks[q]).length > 0 
                                            ? 'Feedback recorded on questions.'
                                            : 'No remarks written yet.'
                                        }
                                    </div>

                                    <button 
                                        onClick={handleCompileMarkdown}
                                        className="w-full py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-[10px] rounded-lg border border-slate-700 transition-colors flex items-center justify-center gap-1 active:scale-[0.98]"
                                    >
                                        <i className="ph-bold ph-notebook"></i>
                                        <span>View Remarks Summary</span>
                                    </button>
                                </div>
                            </div>

                            {/* Questions Grid (Read-Only) */}
                            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-md flex flex-col gap-6">
                                <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
                                    <div>
                                        <h3 className="font-black text-slate-200 text-sm uppercase tracking-wider">Assignment Questions</h3>
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">Click a question to view remarks summary. Status cannot be modified from dashboard.</p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-300 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-700">
                                        {stats.completed} / {questionCount} Completed
                                    </span>
                                </div>
                                
                                {questionCount === 0 ? (
                                    <div className="text-center py-10 space-y-4">
                                        <span className="text-4xl">📭</span>
                                        <h4 className="text-sm font-bold text-slate-350">No Questions Initialized</h4>
                                        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                                            This assignment has not been initialized. Open the PDF URL to start tracking and solve it in the Vinyas Extension.
                                        </p>
                                        
                                        <a 
                                            href={assignmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-red-650 hover:from-orange-500 hover:to-red-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md inline-flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <i className="ph-bold ph-arrow-square-out text-sm"></i>
                                            Open Assignment PDF
                                        </a>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Grid of Question buttons */}
                                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-3">
                                            {Array.from({ length: questionCount }, (_, idx) => {
                                                const qNum = idx + 1;
                                                const state = localProgress[qNum] || 'none';
                                                const hasRemark = !!localRemarks[qNum];
                                                
                                                let btnClass = "bg-slate-900/40 hover:bg-slate-700 text-slate-400 border-slate-700 hover:border-slate-600";
                                                let displayIcon = `Q${qNum}`;
                                                
                                                if (state === 'completed') { 
                                                    btnClass = "bg-emerald-600 text-white border-emerald-500"; 
                                                    displayIcon = `✓ ${qNum}`; 
                                                }
                                                else if (state === 'difficult') { 
                                                    btnClass = "bg-rose-600 text-white border-rose-500"; 
                                                    displayIcon = `! ${qNum}`; 
                                                }
                                                else if (state === 'later') { 
                                                    btnClass = "bg-amber-600 text-white border-amber-500"; 
                                                    displayIcon = `⌛ ${qNum}`; 
                                                }
                                                
                                                if (selectedQNum === qNum) {
                                                    btnClass += " ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-105";
                                                }

                                                return (
                                                    <button 
                                                        key={qNum}
                                                        onClick={() => setSelectedQNum(qNum === selectedQNum ? null : qNum)}
                                                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all duration-100 flex items-center justify-center relative select-none ${btnClass}`}
                                                        title={`Q${qNum} (${state})`}
                                                    >
                                                        {displayIcon}
                                                        {hasRemark && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full"></span>}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Display selected question remark if any */}
                                        {selectedQNum && localRemarks[selectedQNum] && (
                                            <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl animate-fade-in">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold text-white">Q{selectedQNum} Remark:</span>
                                                    <span className="text-[10px] font-black uppercase text-blue-400">Recorded Note</span>
                                                </div>
                                                <p className="text-xs italic text-slate-300 font-semibold">{localRemarks[selectedQNum]}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        !selfAnalysis.isSubmitted ? (
                            /* INTERACTIVE SELF-ANALYSIS EDIT FORM */
                            <div className="space-y-6 animate-fade-in pb-8">
                                {/* Top Colorful Header Card */}
                                <div className="bg-gradient-to-r from-blue-600 via-indigo-650 to-purple-600 rounded-3xl p-6 text-center shadow-xl relative overflow-hidden border border-white/10 flex flex-col justify-center items-center">
                                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none"></div>
                                    <div className="bg-black/35 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-200 mb-2 border border-blue-400/25">
                                        Self-Analysis Dashboard
                                    </div>
                                    <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-1 filter drop-shadow">Self Analysis</h1>
                                    <p className="text-sm font-semibold text-slate-100/90 tracking-wide mt-1 max-w-xl truncate">
                                        Fill in parameters to compile your review sheet.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Parameters Column */}
                                    <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-lg space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-list-numbers text-indigo-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Performance Parameters</h4>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Topic Name</label>
                                                <input 
                                                    type="text" 
                                                    value={selfAnalysis.topicName}
                                                    onChange={e => setSelfAnalysis(prev => ({ ...prev, topicName: e.target.value }))}
                                                    placeholder="Topic Name"
                                                    className="w-full bg-black/35 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Correct (+3)</label>
                                                    <input 
                                                        type="number" 
                                                        min={0}
                                                        max={questionCount}
                                                        value={selfAnalysis.correctCount}
                                                        onChange={e => setSelfAnalysis(prev => ({ ...prev, correctCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                        className="w-full bg-black/35 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1.5">Incorrect (-1)</label>
                                                    <input 
                                                        type="number" 
                                                        min={0}
                                                        max={questionCount}
                                                        value={selfAnalysis.incorrectCount}
                                                        onChange={e => setSelfAnalysis(prev => ({ ...prev, incorrectCount: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                        className="w-full bg-black/35 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Target (mins)</label>
                                                    <input 
                                                        type="number" 
                                                        min={0}
                                                        value={selfAnalysis.targetDuration}
                                                        onChange={e => setSelfAnalysis(prev => ({ ...prev, targetDuration: Math.max(0, parseInt(e.target.value) || 0) }))}
                                                        className="w-full bg-black/35 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Completed Time</label>
                                                    <div className="w-full bg-black/20 border border-slate-700/50 rounded-xl px-3 py-2 text-xs font-black text-slate-400">
                                                        {formatTime(elapsedTimeSec)}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-700/30 space-y-1.5 text-[11px] text-slate-400 font-bold">
                                                <div className="flex justify-between">
                                                    <span>Max Score Possible:</span>
                                                    <span className="text-white">{questionCount * 3}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Obtained Score:</span>
                                                    <span className="text-blue-400">{selfAnalysis.correctCount * 3 - selfAnalysis.incorrectCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Qualitative Column */}
                                    <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-lg space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-shield-check text-emerald-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Qualitative Review</h4>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-rose-450 uppercase tracking-wider mb-1.5">5. My Blunders</label>
                                                <textarea 
                                                    value={selfAnalysis.blunder}
                                                    onChange={e => setSelfAnalysis(prev => ({ ...prev, blunder: e.target.value }))}
                                                    placeholder="Silly mistakes, sign errors, skipped reading carefully..."
                                                    className="w-full h-24 bg-black/35 border border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-200 outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">6. My Resolutions</label>
                                                <textarea 
                                                    value={selfAnalysis.resolution}
                                                    onChange={e => setSelfAnalysis(prev => ({ ...prev, resolution: e.target.value }))}
                                                    placeholder="Double check formulas, write units explicitly, read question twice..."
                                                    className="w-full h-24 bg-black/35 border border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-200 outline-none focus:border-blue-500/50 resize-none custom-scrollbar"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Attempt History (if exists) */}
                                {selfAnalysis.attempts && selfAnalysis.attempts.length > 0 && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-lg space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-list text-blue-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Attempt History</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs font-bold">
                                                <thead>
                                                    <tr className="border-b border-slate-700 text-slate-500 uppercase tracking-wider text-[10px]">
                                                        <th className="py-2">Attempt</th>
                                                        <th className="py-2">Time Spent</th>
                                                        <th className="py-2">Score</th>
                                                        <th className="py-2">Accuracy</th>
                                                        <th className="py-2">Date & Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-750 text-slate-350">
                                                    {selfAnalysis.attempts.map((att) => {
                                                        const score = (att.correctCount || 0) * 3 - (att.incorrectCount || 0);
                                                        const maxScore = questionCount * 3;
                                                        const totalTracked = (att.correctCount || 0) + (att.incorrectCount || 0);
                                                        const accuracy = totalTracked > 0 ? Math.round(((att.correctCount || 0) / totalTracked) * 100) : 0;
                                                        const date = att.timestamp ? new Date(att.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
                                                        return (
                                                            <tr key={att.attemptNumber} className="hover:bg-slate-900/20">
                                                                <td className="py-2.5 text-white">Attempt #{att.attemptNumber}</td>
                                                                <td className="py-2.5 text-emerald-450">{att.formattedTime || formatTime(att.elapsedTimeSec || 0)}</td>
                                                                <td className="py-2.5 text-blue-400">{score} <span className="text-slate-500 font-normal">/ {maxScore}</span></td>
                                                                <td className="py-2.5 text-amber-400">{accuracy}%</td>
                                                                <td className="py-2.5 text-slate-400 font-mono text-[10px]">{date}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Form Action Buttons */}
                                <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-700/50">
                                    <button 
                                        onClick={async () => {
                                            await handleSaveWorkflow({ finalize: false });
                                        }}
                                        disabled={isSaving}
                                        className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-black uppercase tracking-wider rounded-xl border border-slate-750 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                    >
                                        <i className="ph-bold ph-floppy-disk text-sm"></i>
                                        {isSaving ? "Saving..." : "Save Progress"}
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (selfAnalysis.correctCount + selfAnalysis.incorrectCount > questionCount) {
                                                if (showToast) showToast("❌ Correct + Incorrect questions cannot exceed Total Questions!", "error");
                                                return;
                                            }
                                            if (window.confirm("Are you sure you want to finalize this assessment? This will lock your self-analysis report.")) {
                                                await handleSaveWorkflow({ finalize: true });
                                            }
                                        }}
                                        disabled={isSaving}
                                        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                                    >
                                        <i className="ph-bold ph-check-square text-sm"></i>
                                        {isSaving ? "Submitting..." : "Finalize Assessment"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* COLORFUL REPORT VIEW */
                            <div className="space-y-6 animate-fade-in pb-8">
                                {/* Top Colorful Header Card */}
                                <div className="bg-gradient-to-r from-blue-600 via-indigo-650 to-purple-600 rounded-3xl p-6 text-center shadow-xl relative overflow-hidden border border-white/10 flex flex-col justify-center items-center">
                                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none"></div>
                                    <div className="bg-black/35 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-blue-200 mb-2 border border-blue-400/25">
                                        Official Self-Analysis Sheet
                                    </div>
                                    <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-1 filter drop-shadow">Self Analysis</h1>
                                    <p className="text-sm font-semibold text-slate-100/90 tracking-wide mt-1 max-w-xl truncate animate-pulse" title={selfAnalysis.topicName}>
                                        {selfAnalysis.topicName}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    {/* Questions Sheet Card */}
                                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-list-numbers text-indigo-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Question Stats</h4>
                                        </div>
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                                                <span>Total Questions:</span>
                                                <span className="font-extrabold text-white">{questionCount}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-400">Correct (+3):</span>
                                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-405 px-2 py-0.5 rounded-md font-black text-[11px]">
                                                    {selfAnalysis.correctCount}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-semibold text-slate-400">Incorrect (-1):</span>
                                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md font-black text-[11px]">
                                                    {selfAnalysis.incorrectCount}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-slate-400">
                                                <span className="font-semibold">Not Attempted:</span>
                                                <span className="bg-slate-700/50 border border-slate-700 text-slate-350 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                                    {Math.max(0, questionCount - selfAnalysis.correctCount - selfAnalysis.incorrectCount)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Marks Card */}
                                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden">
                                        <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-medal text-emerald-450 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Marks Summary</h4>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Score Achieved</span>
                                                <span className="text-2xl font-black text-white">
                                                    {selfAnalysis.correctCount * 3 - selfAnalysis.incorrectCount}
                                                    <span className="text-xs text-slate-500 font-semibold ml-1">/ {questionCount * 3}</span>
                                                </span>
                                            </div>
                                            
                                            {/* Progress Bar Gauge */}
                                            {questionCount > 0 ? (
                                                (() => {
                                                    const score = selfAnalysis.correctCount * 3 - selfAnalysis.incorrectCount;
                                                    const maxScore = questionCount * 3;
                                                    const percentage = Math.max(0, Math.round((score / maxScore) * 100));
                                                    let progressColor = 'bg-rose-500';
                                                    let textColor = 'text-rose-400';
                                                    if (percentage >= 80) { progressColor = 'bg-emerald-500'; textColor = 'text-emerald-400'; }
                                                    else if (percentage >= 50) { progressColor = 'bg-amber-500'; textColor = 'text-amber-400'; }
                                                    
                                                    return (
                                                        <div className="space-y-1.5">
                                                            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-750">
                                                                <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${percentage}%` }}></div>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <span className="font-bold text-slate-500">Efficiency</span>
                                                                <span className={`font-black ${textColor}`}>{percentage}%</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <div className="text-slate-500 text-xs italic text-center py-2">No questions defined</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Duration Card */}
                                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-hourglass text-amber-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Duration Compare</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div className="bg-slate-900/50 p-2 border border-slate-750 rounded-xl">
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">Target</span>
                                                <div className="text-sm font-black text-amber-400 mt-0.5">{selfAnalysis.targetDuration || 0} mins</div>
                                            </div>
                                            <div className="bg-slate-900/50 p-2 border border-slate-750 rounded-xl">
                                                <span className="text-[8px] font-bold text-slate-500 uppercase">Completed</span>
                                                <div className="text-sm font-black text-emerald-400 mt-0.5">
                                                    {formatTime(elapsedTimeSec)}
                                                </div>
                                            </div>
                                        </div>

                                        {selfAnalysis.targetDuration > 0 && (
                                            <div className="text-center">
                                                {Math.round(elapsedTimeSec / 60) <= selfAnalysis.targetDuration ? (
                                                    <span className="text-[9px] font-black uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                                                        ✓ Target Achieved
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] font-black uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                                                        ⌛ Target Exceeded
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Qualitative Callouts (Blunders and Resolutions) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Blunder block */}
                                    <div className="bg-rose-500/[0.03] border border-rose-500/20 rounded-2xl p-5 shadow-lg space-y-2.5">
                                        <div className="flex items-center gap-2 border-b border-rose-500/10 pb-2">
                                            <i className="ph-fill ph-warning-octagon text-rose-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">5. My Blunders</h4>
                                        </div>
                                        <p className="text-xs text-slate-200 leading-relaxed font-semibold italic break-words whitespace-pre-line">
                                            {selfAnalysis.blunder || "No blunders noted for this assignment."}
                                        </p>
                                    </div>

                                    {/* Resolution block */}
                                    <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-2xl p-5 shadow-lg space-y-2.5">
                                        <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-2">
                                            <i className="ph-fill ph-shield-check text-emerald-450 text-lg"></i>
                                            <h4 className="text-xs font-black text-emerald-450 uppercase tracking-wider">6. My Resolution</h4>
                                        </div>
                                        <p className="text-xs text-slate-200 leading-relaxed font-semibold italic break-words whitespace-pre-line">
                                            {selfAnalysis.resolution || "No resolutions set yet."}
                                        </p>
                                    </div>
                                </div>

                                {/* Attempt History (if exists) */}
                                {selfAnalysis.attempts && selfAnalysis.attempts.length > 0 && (
                                    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-lg space-y-4">
                                        <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                                            <i className="ph-bold ph-list text-blue-400 text-lg"></i>
                                            <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Attempt History</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse text-xs font-bold">
                                                <thead>
                                                    <tr className="border-b border-slate-700 text-slate-500 uppercase tracking-wider text-[10px]">
                                                        <th className="py-2">Attempt</th>
                                                        <th className="py-2">Time Spent</th>
                                                        <th className="py-2">Score</th>
                                                        <th className="py-2">Accuracy</th>
                                                        <th className="py-2">Date & Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-750 text-slate-350">
                                                    {selfAnalysis.attempts.map((att) => {
                                                        const score = (att.correctCount || 0) * 3 - (att.incorrectCount || 0);
                                                        const maxScore = questionCount * 3;
                                                        const totalTracked = (att.correctCount || 0) + (att.incorrectCount || 0);
                                                        const accuracy = totalTracked > 0 ? Math.round(((att.correctCount || 0) / totalTracked) * 100) : 0;
                                                        const date = att.timestamp ? new Date(att.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';
                                                        return (
                                                            <tr key={att.attemptNumber} className="hover:bg-slate-900/20">
                                                                <td className="py-2.5 text-white">Attempt #{att.attemptNumber}</td>
                                                                <td className="py-2.5 text-emerald-450">{att.formattedTime || formatTime(att.elapsedTimeSec || 0)}</td>
                                                                <td className="py-2.5 text-blue-400">{score} <span className="text-slate-500 font-normal">/ {maxScore}</span></td>
                                                                <td className="py-2.5 text-amber-400">{accuracy}%</td>
                                                                <td className="py-2.5 text-slate-400 font-mono text-[10px]">{date}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Actions Footer inside Self Analysis View */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-700/50">
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={() => {
                                                setSelfAnalysis(prev => ({ ...prev, isSubmitted: false }));
                                                setIsDirty(true);
                                            }}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-750 transition-all flex items-center gap-1.5 justify-center"
                                        >
                                            <i className="ph-bold ph-pencil-simple"></i> Edit Report
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const score = selfAnalysis.correctCount * 3 - selfAnalysis.incorrectCount;
                                                const maxScore = questionCount * 3;
                                                const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
                                                const summaryMd = `### Self Analysis Report: ${selfAnalysis.topicName}\n\n` + 
                                                    `- **Total Questions**: ${questionCount}\n` +
                                                    `- **Correct Questions**: ${selfAnalysis.correctCount} (+3 marks each)\n` +
                                                    `- **Incorrect Questions**: ${selfAnalysis.incorrectCount} (-1 marks each)\n` +
                                                    `- **Not Attempted**: ${Math.max(0, questionCount - selfAnalysis.correctCount - selfAnalysis.incorrectCount)}\n` +
                                                    `- **Score**: ${score} / ${maxScore} (${percentage}% Efficiency)\n` +
                                                    `- **Duration**: Target ${selfAnalysis.targetDuration} mins, Completed ${Math.round(elapsedTimeSec / 60)} mins\n\n` +
                                                    `#### My Blunder:\n${selfAnalysis.blunder || "N/A"}\n\n` +
                                                    `#### My Resolution:\n${selfAnalysis.resolution || "N/A"}`;
                                                
                                                navigator.clipboard.writeText(summaryMd);
                                                if (showToast) showToast("📋 Report Markdown copied to clipboard!", "success");
                                            }}
                                            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-1.5 justify-center"
                                        >
                                            <i className="ph-bold ph-copy"></i> Copy Markdown Summary
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>

                {/* Sticky Footer */}
                <div className="p-6 border-t border-slate-700/50 flex justify-end gap-3 flex-shrink-0 bg-slate-800">
                    {isDirty && (
                        <button 
                            onClick={async () => {
                                await handleSaveWorkflow({ finalize: false });
                            }}
                            disabled={isSaving}
                            className="w-full sm:w-36 py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white font-bold rounded-2xl shadow-md transition-all text-center flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <i className="ph-bold ph-floppy-disk"></i>
                            {isSaving ? "Saving..." : "Save Progress"}
                        </button>
                    )}
                    <button 
                        onClick={handleDiscardAndClose} 
                        className="w-full sm:w-36 py-3 px-6 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-2xl transition-colors border border-slate-650 text-center"
                    >
                        Close Viewer
                    </button>
                </div>

                {/* Custom Type Overlay */}
                {isCustomTypeModalOpen && (
                    <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md z-10 flex items-center justify-center gap-3 animate-fade-in">
                        <div className="text-[11px] font-bold text-slate-400">New Custom Type</div>
                        <input 
                            type="text" 
                            value={newCustomType}
                            onChange={e => setNewCustomType(e.target.value)}
                            placeholder="e.g. CTQ"
                            className="w-32 bg-black/30 border border-white/10 focus:border-blue-500/50 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-200 outline-none"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && saveCustomType()}
                        />
                        <button onClick={() => { setIsCustomTypeModalOpen(false); setNewCustomType(''); }} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 rounded-lg">Cancel</button>
                        <button onClick={saveCustomType} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white rounded-lg">Save</button>
                    </div>
                )}

            </div>

            {/* Resolve Mismatch Modal */}
            {isResolveModalOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[100] flex items-center justify-center animate-fade-in p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-slide-up">
                        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 bg-slate-800/50">
                            <img src="/favicon.ico" className="w-8 h-8 rounded-lg" alt="Vinyas" />
                            <div>
                                <h3 className="text-sm font-black text-white tracking-wide">Resolve Chapter Mismatch</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Link assignment to syllabus</p>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Current Chapter</div>
                                <div className="text-xs font-bold text-slate-200">{chapterName}</div>
                            </div>

                            <div className="flex bg-black/30 border border-white/5 rounded-xl p-1 gap-1">
                                <button onClick={() => setResolveSubjectMode('existing')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${resolveSubjectMode === 'existing' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Link Subject</button>
                                <button onClick={() => setResolveSubjectMode('new')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${resolveSubjectMode === 'new' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}>New Subject</button>
                            </div>

                            {resolveSubjectMode === 'existing' ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Subject</label>
                                        <select 
                                            value={resolveSubjectIdx} 
                                            onChange={e => { setResolveSubjectIdx(parseInt(e.target.value)); setResolveChapterIdx(0); }}
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                        >
                                            {data.map((s, idx) => <option key={idx} value={idx}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Chapter Mode</label>
                                        <div className="flex gap-2">
                                            <button onClick={() => setResolveChapterMode('existing')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${resolveChapterMode === 'existing' ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-white/5 bg-black/20 text-slate-400'}`}>Existing</button>
                                            <button onClick={() => setResolveChapterMode('new')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${resolveChapterMode === 'new' ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-white/5 bg-black/20 text-slate-400'}`}>New</button>
                                        </div>
                                    </div>

                                    {resolveChapterMode === 'existing' ? (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Select Chapter</label>
                                            <select 
                                                value={resolveChapterIdx} 
                                                onChange={e => setResolveChapterIdx(parseInt(e.target.value))}
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                            >
                                                {data[resolveSubjectIdx]?.chapters?.map((c, idx) => <option key={idx} value={idx}>{c.name}</option>)}
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Chapter Name</label>
                                            <input 
                                                type="text" 
                                                value={resolveNewChapterName}
                                                onChange={e => setResolveNewChapterName(e.target.value)}
                                                placeholder="e.g. Kinematics"
                                                className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Subject Name</label>
                                        <input 
                                            type="text" 
                                            value={resolveNewSubjectName}
                                            onChange={e => setResolveNewSubjectName(e.target.value)}
                                            placeholder="e.g. BITSAT Physics"
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New Chapter Name</label>
                                        <input 
                                            type="text" 
                                            value={resolveNewChapterName}
                                            onChange={e => setResolveNewChapterName(e.target.value)}
                                            placeholder="e.g. Kinematics"
                                            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 outline-none focus:border-blue-500/50"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 flex gap-2 bg-slate-800/30">
                            <button onClick={() => setIsResolveModalOpen(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 rounded-xl transition-all">Cancel</button>
                            <button onClick={handleResolveSubmit} className="flex-1 py-2.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-xs font-bold text-white shadow-lg shadow-blue-500/20 rounded-xl transition-all flex items-center justify-center gap-1.5">
                                <i className="ph-bold ph-link"></i> Link Tracker
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Compiled Remarks Summary & Export Modal Overlay */}
            {isMarkdownModalOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-2xl h-[75vh] overflow-hidden shadow-2xl animate-fade-in flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/40">
                            <div>
                                <h3 className="font-black text-white text-base">Remarks Summary & Export</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5" title={`${assignmentName} (${chapterName})`}>
                                    {truncateWords(assignmentName, 8)} ({truncateWords(chapterName, 8)})
                                </p>
                            </div>
                            <button 
                                onClick={() => setIsMarkdownModalOpen(false)} 
                                className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full transition-colors"
                            >
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>

                        {/* Tabs for switching views */}
                        <div className="flex bg-slate-900/60 p-1 border-b border-slate-700 gap-1 flex-shrink-0">
                            <button 
                                onClick={() => setRemarksTab('visual')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                    remarksTab === 'visual' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <i className="ph-bold ph-eye mr-1.5"></i> Visual Overview
                            </button>
                            <button 
                                onClick={() => setRemarksTab('markdown')}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                                    remarksTab === 'markdown' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <i className="ph-bold ph-code mr-1.5"></i> Markdown Export
                            </button>
                        </div>

                        {/* Tab Body Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/25 custom-scrollbar">
                            {remarksTab === 'visual' ? (
                                <div className="space-y-4">
                                    {Object.keys(localRemarks).filter(q => localRemarks[q]).length === 0 ? (
                                        <div className="text-center py-12">
                                            <span className="text-3.5xl">📝</span>
                                            <h4 className="text-sm font-bold text-slate-300 mt-3">No Remarks Added Yet</h4>
                                            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">Remarks you write for assignment questions will appear organized here by their states.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {Array.from({ length: questionCount }, (_, idx) => {
                                                const qNum = idx + 1;
                                                const remark = localRemarks[qNum];
                                                if (!remark) return null;

                                                const state = localProgress[qNum] || 'none';
                                                let stateLabel = 'To Do';
                                                let cardClass = 'bg-slate-850/40 border-slate-700 text-slate-300';
                                                let badgeClass = 'bg-slate-700/20 text-slate-400 border-slate-700/30';

                                                if (state === 'completed') {
                                                    stateLabel = '✓ Completed';
                                                    cardClass = 'bg-emerald-500/5 border-emerald-500/20 text-slate-200';
                                                    badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
                                                } else if (state === 'difficult') {
                                                    stateLabel = '! Difficult';
                                                    cardClass = 'bg-rose-500/5 border-rose-500/20 text-slate-200';
                                                    badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/25';
                                                } else if (state === 'later') {
                                                    stateLabel = '⌛ Later';
                                                    cardClass = 'bg-amber-500/5 border-amber-500/20 text-slate-200';
                                                    badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
                                                }

                                                return (
                                                    <div 
                                                        key={qNum}
                                                        className={`p-4 border rounded-2xl flex flex-col gap-2.5 transition-all shadow-sm ${cardClass}`}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-black text-white">Question {qNum}</span>
                                                            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${badgeClass}`}>
                                                                {stateLabel}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs leading-relaxed font-semibold italic break-words">{remark}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col gap-4">
                                    <textarea 
                                        className="w-full flex-1 min-h-[250px] bg-slate-900 border border-slate-700 rounded-2xl p-4 text-slate-200 text-xs font-mono outline-none resize-none custom-scrollbar"
                                        readOnly
                                        value={compiledMarkdown}
                                    />
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(compiledMarkdown);
                                            if (showToast) showToast("📋 Compiled Markdown copied to clipboard!", "success");
                                        }}
                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-md active:scale-[0.99]"
                                    >
                                        <i className="ph-bold ph-copy"></i> Copy Markdown to Clipboard
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-700 flex bg-slate-900/40">
                            <button 
                                onClick={() => setIsMarkdownModalOpen(false)} 
                                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors border border-slate-700"
                            >
                                Close Summary
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Overlay: Save & Finalize Confirmation */}
            {isSaveConfirmOpen && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-fade-in relative text-slate-100">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                        
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg">
                                <i className="ph-bold ph-floppy-disk"></i>
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white">Save Assignment Progress</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Choose your save mode</p>
                            </div>
                        </div>

                        <div className="text-xs text-slate-350 leading-relaxed space-y-2 font-semibold">
                            <p>
                                Would you like to just auto-save your current progress (to resume later) or finalize this assessment to compile your self-analysis report?
                            </p>
                            {!selfAnalysis.blunder && !selfAnalysis.resolution && (
                                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-3 py-2 rounded-xl flex items-start gap-1.5 mt-2">
                                    <i className="ph-bold ph-info text-sm flex-shrink-0 mt-0.5"></i>
                                    <span>Note: You haven't filled in "My Blunder" or "My Resolution" yet. You can still finalize, or save and fill them later.</span>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={async () => {
                                    setIsSaveConfirmOpen(false);
                                    await handleSaveWorkflow({ finalize: false });
                                }}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <i className="ph-bold ph-pause text-sm"></i>
                                <span>Save Progress & Pause Timer</span>
                            </button>
                            <button
                                onClick={async () => {
                                    if (selfAnalysis.correctCount + selfAnalysis.incorrectCount > questionCount) {
                                        if (showToast) showToast("❌ Correct + Incorrect questions cannot exceed Total Questions!", "error");
                                        return;
                                    }
                                    setIsSaveConfirmOpen(false);
                                    await handleSaveWorkflow({ finalize: true });
                                }}
                                className="w-full py-3 bg-gradient-to-r from-emerald-650 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                <i className="ph-bold ph-check-square text-sm"></i>
                                <span>Finalize & Submit Assessment</span>
                            </button>
                            <button
                                onClick={() => setIsSaveConfirmOpen(false)}
                                className="w-full py-2.5 bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 font-bold text-xs rounded-xl border border-slate-800 transition-colors text-center"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignmentQuestionTrackerModal;
