import React, { useState, useEffect, useMemo } from 'react';

// Default exercise templates based on the subject
const SUBJECT_TEMPLATES = {
    Maths: {
        "Exercise 1": 38,
        "Exercise 2": 16,
        "Exercise 3": 30,
        "Exercise 4": 30,
        "Exercise 5": 45,
        "Exercise 6": 15
    },
    Physics: {
        "Exercise 1": 60,
        "Exercise 2": 50,
        "Exercise 3": 44,
        "Exercise 4": 46,
        "Exercise 5": 95,
        "Exercise 6": 10
    },
    Chem: {
        "Exercise 1": 45,
        "Exercise 2": 55,
        "Exercise 3": 36,
        "Exercise 4": 60,
        "Exercise 5": 55,
        "Exercise 6": 14
    }
};

const FALLBACK_TEMPLATE = {
    "Exercise 1": 30,
    "Exercise 2": 30,
    "Exercise 3": 30,
    "Exercise 4": 30,
    "Exercise 5": 30,
    "Exercise 6": 30
};

const ModuleQuestionTrackerModal = ({
    isOpen,
    onClose,
    subjectName,
    chapterName,
    chapterIndex,
    currentModuleComp,
    currentModuleAcc,
    questionStates = {},
    onSaveProgress,
    customExerciseConfig = null,
    exerciseDisplayNames = null
}) => {
    if (!isOpen) return null;

    // Normalization helper
    const normalizeSub = (sub) => {
        const s = sub.toLowerCase().trim();
        if (s.includes('math')) return 'Maths';
        if (s.includes('phys')) return 'Physics';
        if (s.includes('chem')) return 'Chem';
        return sub;
    };

    const normalizedSubName = normalizeSub(subjectName);
    const isChapter1 = useMemo(() => {
        if (chapterIndex === 0) return true;
        const c = chapterName.toLowerCase();
        if (normalizedSubName === 'Maths' && c.includes('sets')) return true;
        if (normalizedSubName === 'Physics' && c.includes('units')) return true;
        if (normalizedSubName === 'Chem' && c.includes('mole')) return true;
        return false;
    }, [normalizedSubName, chapterName, chapterIndex]);

    // Determine the exercise questions structure for this subject
    const exercisesConfig = useMemo(() => {
        if (customExerciseConfig && Object.keys(customExerciseConfig).length > 0) {
            return customExerciseConfig;
        }
        return SUBJECT_TEMPLATES[normalizedSubName] || FALLBACK_TEMPLATE;
    }, [customExerciseConfig, normalizedSubName]);

    // Local State
    const [localProgress, setLocalProgress] = useState({});
    const [toast, setToast] = useState(null);

    // Initialize local copy when modal opens or prop changes
    useEffect(() => {
        if (isOpen) {
            setLocalProgress(questionStates || {});
        }
    }, [isOpen, questionStates]);

    // Toast Timer helper
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Build the query key for a given question
    const getQuestionKey = (exName, qNum) => {
        if (isChapter1) {
            return `${normalizedSubName}-${exName}-${qNum}`;
        } else {
            return `${normalizedSubName}-${chapterName}-${exName}-${qNum}`;
        }
    };

    // Dynamic stats calculations
    const stats = useMemo(() => {
        let total = 0;
        let completed = 0;
        let difficult = 0;
        let later = 0;

        Object.entries(exercisesConfig).forEach(([exName, qCount]) => {
            total += qCount;
            for (let q = 1; q <= qCount; q++) {
                const key = getQuestionKey(exName, q);
                const state = localProgress[key];
                if (state === 'completed') completed++;
                else if (state === 'difficult') difficult++;
                else if (state === 'later') later++;
            }
        });

        const calculatedComp = total > 0 ? Math.round((completed / total) * 100) : 0;
        const totalTracked = completed + difficult + later;
        const calculatedAcc = totalTracked > 0 ? Math.round((completed / totalTracked) * 100) : 0;

        return {
            total,
            completed,
            difficult,
            later,
            calculatedComp,
            calculatedAcc
        };
    }, [localProgress, exercisesConfig, isChapter1, chapterName, normalizedSubName]);

    // Handle question status manual toggling
    const handleToggleQuestion = (exName, qNum) => {
        const key = getQuestionKey(exName, qNum);
        const currentState = localProgress[key];
        let newState = null;

        if (!currentState) newState = 'completed';
        else if (currentState === 'completed') newState = 'difficult';
        else if (currentState === 'difficult') newState = 'later';

        const updatedProgress = { ...localProgress };
        if (newState) {
            updatedProgress[key] = newState;
        } else {
            delete updatedProgress[key];
        }

        setLocalProgress(updatedProgress);
    };

    const handleSaveAndClose = () => {
        // Lock in progress and accuracy to Vinyas syllabus state
        onSaveProgress({
            comp: stats.calculatedComp,
            acc: stats.calculatedAcc,
            questionStates: localProgress
        });
        showToast("Progress and accuracy locked in successfully!", "success");
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.6)] w-full max-w-5xl h-[92vh] flex flex-col backdrop-blur-xl relative">
                
                {/* Premium Toast Container */}
                {toast && (
                    <div key={toast.message + toast.type} className="absolute top-4 left-1/2 z-[100] w-full max-w-md px-4 animate-toast-slide pointer-events-auto">
                        <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-lg flex items-center justify-between gap-3 ${
                            toast.type === 'success' 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <i className={`ph-fill ${toast.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'} text-xl`}></i>
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
                            <span className="text-xs font-bold text-bitsat-400 uppercase tracking-widest">Interactive Module Tracker</span>
                            <span className="bg-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                {subjectName}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-white leading-tight flex items-center gap-2">
                            <i className="ph-fill ph-grid-nine text-bitsat-500"></i>
                            {chapterName}
                        </h2>
                    </div>

                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2.5 rounded-full transition-colors">
                            <i className="ph-bold ph-x text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Sub-Header: Sync Settings & Legend */}
                <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-700/50 flex flex-col lg:flex-row items-center justify-between gap-4 flex-shrink-0">
                    {/* Database File connection */}
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
                        
                        {/* Interactive Completion Stats */}
                        <div className="md:col-span-2 space-y-3">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-black text-slate-100 uppercase tracking-wider text-xs">Completion Progress</h3>
                                <span className="text-lg font-black text-bitsat-400">{stats.calculatedComp}% ({stats.completed} / {stats.total} done)</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-full h-4 overflow-hidden relative">
                                <div 
                                    className="bg-gradient-to-r from-bitsat-600 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
                                    style={{ width: `${stats.calculatedComp}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Read-Only Module Accuracy */}
                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Module Accuracy</label>
                                    <span className="text-[10px] text-slate-500 font-medium">Auto-calculated from progress</span>
                                </div>
                                <span className={`text-lg font-black ${
                                    stats.calculatedAcc >= 80 ? 'text-emerald-400' : stats.calculatedAcc >= 50 ? 'text-amber-400' : 'text-rose-400'
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
                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                <span>{stats.completed} Done</span>
                                <span>{stats.difficult + stats.later} Marked/Later</span>
                            </div>
                        </div>
                    </div>

                    {/* Exercises Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300 opacity-100">
                        {Object.entries(exercisesConfig).map(([exName, qCount]) => {
                            // Calculate completed questions for this exercise
                            let doneInExercise = 0;
                            for (let q = 1; q <= qCount; q++) {
                                if (localProgress[getQuestionKey(exName, q)] === 'completed') doneInExercise++;
                            }

                            const displayName = (exerciseDisplayNames && exerciseDisplayNames[exName]) || exName;

                            return (
                                <div key={exName} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 hover:border-slate-600/80 transition-all flex flex-col h-full shadow-md">
                                    <div className="flex justify-between items-center border-b border-slate-700/50 pb-3 mb-4">
                                        <h3 className="font-bold text-slate-200">{displayName}</h3>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-900/60 px-2.5 py-1 rounded-lg">
                                            {doneInExercise} / {qCount} Completed
                                        </span>
                                    </div>
                                    
                                    {/* Questions grid */}
                                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                                        {Array.from({ length: qCount }, (_, idx) => {
                                            const qNum = idx + 1;
                                            const key = getQuestionKey(exName, qNum);
                                            const state = localProgress[key];
                                            
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
                                                <button
                                                    key={qNum}
                                                    onClick={() => handleToggleQuestion(exName, qNum)}
                                                    className={`py-2 rounded-xl text-xs font-bold border transition-all duration-100 flex items-center justify-center select-none active:scale-95 ${btnClass}`}
                                                    title={`Toggle status for ${exName} Q${qNum}`}
                                                >
                                                    {icon}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
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
                        className="flex-1 py-3 bg-gradient-to-r from-bitsat-600 to-indigo-650 hover:from-bitsat-500 hover:to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-950/30 transition-all"
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

export default ModuleQuestionTrackerModal;
