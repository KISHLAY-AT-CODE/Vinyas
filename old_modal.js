import React, { useState, useEffect, useMemo } from 'react';

const AssignmentQuestionTrackerModal = ({
    isOpen,
    onClose,
    subjectName,
    chapterName,
    assignmentName,
    assignmentUrl,
    questionCount: initialCount = 0,
    questionStates: initialStates = {},
    onSaveProgress,
    showToast,
    requestConfirm
}) => {
    // Local state
    const [questionCount, setQuestionCount] = useState(0);
    const [localProgress, setLocalProgress] = useState({});
    const [toast, setToast] = useState(null);
    const [addCount, setAddCount] = useState(10);
    // Initialize local copies only when modal opens
    useEffect(() => {
        if (isOpen) {
            setQuestionCount(initialCount || 0);
            setLocalProgress(initialStates || {});
        }
    }, [isOpen]);

    // Local Toast Timer helper
    const triggerLocalToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Dynamic stats calculations
    const stats = useMemo(() => {
        let completed = 0;
        let difficult = 0;
        let later = 0;

        for (let q = 1; q <= questionCount; q++) {
            const state = localProgress[q];
            if (state === 'completed') completed++;
            else if (state === 'difficult') difficult++;
            else if (state === 'later') later++;
        }

        const calculatedComp = questionCount > 0 ? Math.round((completed / questionCount) * 100) : 0;
        const totalTracked = completed + difficult + later;
        const calculatedAcc = totalTracked > 0 ? Math.round((completed / totalTracked) * 100) : 0;

        return {
            completed,
            difficult,
            later,
            calculatedComp,
            calculatedAcc
        };
    }, [localProgress, questionCount]);

    // Add questions
    const handleAddQuestions = () => {
        if (addCount <= 0) {
            triggerLocalToast("Please enter a valid count.", "error");
            return;
        }
        setQuestionCount(prev => prev + addCount);
        triggerLocalToast(`Added ${addCount} questions successfully!`, "success");
    };

    // Delete a specific question and shift subsequent questions down
    const handleDeleteQuestion = (qNum) => {
        if (requestConfirm) {
            requestConfirm(
                "Delete Question",
                `Are you sure you want to delete Question ${qNum}? The subsequent questions will be renumbered to maintain sequence.`,
                () => {
                    const updatedProgress = {};
                    // Copy 1 to qNum - 1
                    for (let i = 1; i < qNum; i++) {
                        if (localProgress[i]) updatedProgress[i] = localProgress[i];
                    }
                    // Shift qNum + 1 to questionCount down by 1
                    for (let i = qNum + 1; i <= questionCount; i++) {
                        if (localProgress[i]) {
                            updatedProgress[i - 1] = localProgress[i];
                        }
                    }
                    setQuestionCount(prev => Math.max(0, prev - 1));
                    setLocalProgress(updatedProgress);
                    
                    triggerLocalToast(`Question ${qNum} deleted!`, "success");
                }
            );
        } else {
            // Fallback if requestConfirm is not provided
            const confirmDelete = window.confirm(`Are you sure you want to delete Question ${qNum}?`);
            if (confirmDelete) {
                const updatedProgress = {};
                for (let i = 1; i < qNum; i++) {
                    if (localProgress[i]) updatedProgress[i] = localProgress[i];
                }
                for (let i = qNum + 1; i <= questionCount; i++) {
                    if (localProgress[i]) {
                        updatedProgress[i - 1] = localProgress[i];
                    }
                }
                setQuestionCount(prev => Math.max(0, prev - 1));
                setLocalProgress(updatedProgress);
                triggerLocalToast(`Question ${qNum} deleted!`, "success");
            }
        }
    };

    // Cycle toggling state of a question
    const handleToggleQuestion = (qNum) => {
        const currentState = localProgress[qNum];
        let newState = null;

        if (!currentState || currentState === 'none') newState = 'completed';
        else if (currentState === 'completed') newState = 'difficult';
        else if (currentState === 'difficult') newState = 'later';
        else if (currentState === 'later') newState = 'none';

        setLocalProgress(prev => ({
            ...prev,
            [qNum]: newState
        }));
    };

    const handleSaveAndClose = async () => {
        if (onSaveProgress) {
            const result = await onSaveProgress({
                questionCount,
                questionStates: localProgress
            });

            if (result && result.success) {
                if (showToast) {
                    showToast("✅ Assignment progress synced successfully!", "success");
                }
                onClose();
            } else {
                triggerLocalToast("❌ Failed to save progress. Please try again.", "error");
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] w-full max-w-5xl h-[92vh] flex flex-col backdrop-blur-xl relative">
                
                {/* Local Toast Container */}
                {toast && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-4 animate-toast-slide pointer-events-auto">
                        <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-lg flex items-center justify-between gap-3 ${
                            toast.type === 'success' 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-450'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <i className={`ph-bold ${toast.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'} text-xl`}></i>
                                <span className="text-sm font-bold">{toast.message}</span>
                            </div>
                            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white transition-colors">
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden flex-shrink-0">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-bitsat-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Assignment Tracker</span>
                            <span className="bg-slate-700 text-slate-350 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                {subjectName} - {chapterName}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight flex items-center gap-2 pr-8">
                            <i className="ph-fill ph-notebook text-orange-500"></i>
                            {assignmentName}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        {assignmentUrl && (
                            <a 
                                href={assignmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-2 px-4 bg-slate-900 border border-slate-700 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <i className="ph-bold ph-link text-sm"></i>
                                View PDF
                            </a>
                        )}
                        <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2.5 rounded-full transition-colors">
                            <i className="ph-bold ph-x text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Sub-Header: Sync Settings & Legend */}
                <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-700/50 flex flex-col lg:flex-row items-center justify-between gap-4 flex-shrink-0">
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            Cloud Synced & Autosaving
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-400">
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-emerald-600 border border-emerald-500 rounded flex items-center justify-center text-[10px] text-white">✓</span>
                            <span>Completed</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-rose-600 border border-rose-500 rounded flex items-center justify-center text-[10px] text-white">!</span>
                            <span>Difficult</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-amber-600 border border-amber-500 rounded flex items-center justify-center text-[10px] text-white">⌛</span>
                            <span>Solve Later</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 bg-slate-900 border border-slate-700 rounded"></span>
                            <span>To Do</span>
                        </div>
                    </div>
                </div>

                {/* Main Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/25">

                    {/* Progress Overview Panel */}
                    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center shadow-lg">
                        <div className="md:col-span-2 space-y-3">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-black text-slate-100 uppercase tracking-wider text-xs">Completion Progress</h3>
                                <span className="text-lg font-black text-orange-400">{stats.calculatedComp}% ({stats.completed} / {questionCount} done)</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-full h-4 overflow-hidden relative">
                                <div 
                                    className="bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full transition-all duration-500 ease-out" 
                                    style={{ width: `${stats.calculatedComp}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Read-Only Accuracy */}
                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accuracy</label>
                                    <span className="text-[10px] text-slate-500 font-medium">From marked questions</span>
                                </div>
                                <span className={`text-lg font-black ${
                                    stats.calculatedAcc >= 80 ? 'text-emerald-400' : stats.calculatedAcc >= 50 ? 'text-amber-400' : 'text-rose-450'
                                }`}>{stats.calculatedAcc}%</span>
                            </div>
                            <div className="bg-slate-800 rounded-full h-2 overflow-hidden relative">
                                <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        stats.calculatedAcc >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 
                                        stats.calculatedAcc >= 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 
                                        'bg-gradient-to-r from-rose-500 to-red-500'
                                    }`}
                                    style={{ width: `${stats.calculatedAcc}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Question Input Panel */}
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-slate-200 mb-1">Add Practice Questions</h4>
                            <p className="text-xs text-slate-400">Input the number of questions to add to this assignment tracker.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                min="1" 
                                max="100" 
                                value={addCount}
                                onChange={(e) => setAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-20 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-bold text-white outline-none focus:border-orange-500 transition-all"
                            />
                            <button 
                                onClick={handleAddQuestions}
                                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 text-white font-extrabold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-orange-950/20 active:scale-95"
                            >
                                <i className="ph-bold ph-plus-circle text-base"></i>
                                Add Questions
                            </button>
                        </div>
                    </div>
                    {/* Main Content View (Question Grid) */}
                    <div>
                        {questionCount === 0 ? (
                            <div className="bg-slate-900/50 border border-slate-700/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[250px] animate-fadeIn shadow-inner w-full">
                                <div className="w-16 h-16 rounded-full bg-slate-850 border border-slate-750 flex items-center justify-center text-slate-500 mb-4 text-3xl shadow-md">
                                    📋
                                </div>
                                <h4 className="text-lg font-bold text-slate-200 mb-2">No Questions Added</h4>
                                <p className="text-xs text-slate-450 max-w-sm leading-relaxed mb-6">
                                    Add question blocks using the input field above to start marking your progress on this assignment.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-md">
                                <div className="flex justify-between items-center border-b border-slate-700/50 pb-3 mb-5">
                                    <h3 className="font-bold text-slate-200">Question Palette</h3>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg">
                                        {stats.completed} / {questionCount} Completed
                                    </span>
                                </div>

                                {/* Question Cards Grid */}
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3.5">
                                    {Array.from({ length: questionCount }, (_, idx) => {
                                        const qNum = idx + 1;
                                        const state = localProgress[qNum];
                                        
                                        let btnClass = "bg-slate-900/60 hover:bg-slate-750 text-slate-400 border-slate-700";
                                        let icon = `Q${qNum}`;

                                        if (state === 'completed') {
                                            btnClass = "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-950/20";
                                            icon = `✓ ${qNum}`;
                                        } else if (state === 'difficult') {
                                            btnClass = "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-950/20";
                                            icon = `! ${qNum}`;
                                        } else if (state === 'later') {
                                            btnClass = "bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-950/20";
                                            icon = `⌛ ${qNum}`;
                                        }

                                        return (
                                            <div key={qNum} className="relative group select-none">
                                                <button
                                                    onClick={() => handleToggleQuestion(qNum)}
                                                    className={`w-full py-3 rounded-xl text-xs font-bold border transition-all duration-100 flex items-center justify-center active:scale-95 ${btnClass}`}
                                                    title={`Cycle status for Q${qNum}`}
                                                >
                                                    {icon}
                                                </button>
                                                
                                                {/* Hover cross button to delete specific question */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteQuestion(qNum);
                                                    }}
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-650 hover:bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md border border-rose-500 opacity-0 group-hover:opacity-100 transition-opacity duration-150 active:scale-90"
                                                    title={`Delete Question ${qNum}`}
                                                >
                                                    <i className="ph-bold ph-x text-[8px]"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700/50 flex flex-col md:flex-row gap-4 flex-shrink-0 bg-slate-800">
                    <button 
                        onClick={onClose} 
                        className="flex-1 md:flex-none py-3 px-6 bg-slate-700 hover:bg-slate-650 text-slate-200 font-bold rounded-2xl transition-colors border border-slate-600"
                    >
                        Discard Changes
                    </button>
                    <button 
                        onClick={handleSaveAndClose} 
                        className="flex-1 py-3 bg-gradient-to-r from-orange-655 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black rounded-2xl shadow-lg shadow-orange-950/30 transition-all"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <i className="ph-bold ph-floppy-disk"></i>
                            Lock In Progress ({stats.calculatedComp}%) & Save
                        </div>
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AssignmentQuestionTrackerModal;
