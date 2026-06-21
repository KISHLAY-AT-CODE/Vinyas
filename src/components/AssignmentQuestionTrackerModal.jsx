import React, { useState, useEffect, useMemo, useRef } from 'react';

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
    onSaveProgress,
    onUpdateMetadata,
    onResolveAssignment,
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
        }
    }, [isOpen, initialCount, initialStates, initialRemarks, initialChapter, initialName, initialType]);

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

    const handleSaveMetaAndProgress = async () => {
        if (onUpdateMetadata) {
            onUpdateMetadata(assignmentName.trim(), assignmentType);
        }
        if (onSaveProgress) {
            await onSaveProgress({
                questionCount,
                questionStates: localProgress,
                questionRemarks: localRemarks
            });
        }
    };

    // Auto-save debouncer
    useEffect(() => {
        if (!isOpen) return;
        if (isInitialLoad) {
            setIsInitialLoad(false);
            return;
        }
        setIsDirty(true);
        const timer = setTimeout(async () => {
            await handleSaveMetaAndProgress();
            setIsDirty(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, [questionCount, localProgress, localRemarks, assignmentName, assignmentType, chapterName]);

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

    const handleSaveAndClose = async () => {
        setIsSaving(true);
        try {
            await handleSaveMetaAndProgress();
            setIsDirty(false);
            if (showToast) showToast("✅ Progress Saved Successfully!", "success");
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            if (showToast) showToast("❌ Failed to save progress", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDiscardAndClose = () => {
        if (isDirty) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                return;
            }
        }
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
                        <h2 className="text-2xl font-black text-white leading-tight flex items-center gap-2">
                            <i className="ph-fill ph-notebook text-blue-500"></i>
                            {chapterName} <span className="text-slate-400 font-semibold text-lg">({assignmentName})</span>
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

                {/* Main Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900/25">
                    
                    {/* Sub-Header: Settings & Legend (Non-sticky card inside scroll area) */}
                    <div className="p-5 bg-slate-800/80 border border-slate-700 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-4 shadow-lg">
                        {/* Settings Controls */}
                        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                            <button 
                                onClick={() => setIsResolveModalOpen(true)}
                                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-605 text-slate-300 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                                title="Link Tracker to a different Subject/Chapter"
                            >
                                <i className="ph-bold ph-link text-sm"></i>
                                <span>Link Chapter</span>
                            </button>

                            <div className="w-[1px] h-6 bg-slate-700 hidden sm:block"></div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Name:</span>
                                <input 
                                    type="text" 
                                    value={assignmentName} 
                                    onChange={e => setAssignmentName(e.target.value)} 
                                    className="w-[150px] sm:w-[180px] bg-slate-900 hover:bg-slate-950 focus:bg-black border border-slate-700 focus:border-blue-500/50 rounded-xl text-xs font-bold text-slate-200 px-3 py-1.5 outline-none transition-all"
                                    placeholder="Assignment"
                                    title="Assignment Name"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Type:</span>
                                <select 
                                    value={baseCustomTypes.includes(assignmentType) || activeCustomTypes.includes(assignmentType) ? assignmentType : 'Custom'} 
                                    onChange={handleTypeChange}
                                    className="bg-slate-900 hover:bg-slate-950 focus:bg-black border border-slate-700 focus:border-blue-500/50 rounded-xl text-xs font-bold text-slate-200 px-3 py-1.5 outline-none transition-all cursor-pointer"
                                    title="Assignment Type"
                                >
                                    {baseCustomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    {activeCustomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    <option value="Custom">+ Custom</option>
                                </select>
                            </div>

                            {isDirty ? (
                                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg animate-pulse">Unsaved Changes...</span>
                            ) : (
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">Saved & Synced</span>
                            )}
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
                    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center shadow-lg">
                        
                        {/* Interactive Completion Stats */}
                        <div className="md:col-span-2 space-y-3">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-black text-slate-100 uppercase tracking-wider text-xs">Completion Progress</h3>
                                <span className="text-lg font-black text-blue-400">{stats.calculatedComp}% ({stats.completed} / {questionCount} done)</span>
                            </div>
                            <div className="bg-slate-900 border border-slate-700 rounded-full h-4 overflow-hidden relative">
                                <div 
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out" 
                                    style={{ width: `${stats.calculatedComp}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Remarks Compile / Accuracy Indicator */}
                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-2 flex flex-col justify-between h-full">
                            <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Remarks Summary</label>
                                    <span className="text-[10px] text-slate-500 font-medium">Review compiled feedback</span>
                                </div>
                                <span className="text-lg font-black text-blue-400">
                                    {Object.keys(localRemarks).filter(q => localRemarks[q]).length} Notes
                                </span>
                            </div>
                            <button 
                                onClick={handleCompileMarkdown}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                            >
                                <i className="ph-bold ph-notebook"></i>
                                View Remarks Summary
                            </button>
                        </div>
                    </div>

                    {/* Questions Grid */}
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-md flex flex-col gap-6">
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
                            <div>
                                <h3 className="font-black text-slate-200 text-sm uppercase tracking-wider">Assignment Questions</h3>
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Click a question to view remarks. Click again to toggle status, or use options below.</p>
                            </div>
                            <span className="text-xs font-bold text-slate-300 bg-slate-900/60 px-3 py-1 rounded-lg border border-slate-700">
                                {stats.completed} / {questionCount} Completed
                            </span>
                        </div>
                        
                        {questionCount === 0 ? (
                            <div className="text-center py-10">
                                <span className="text-3xl">📭</span>
                                <h4 className="text-sm font-bold text-slate-350 mt-3">No Questions Added</h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">Initialize the question count below to begin tracking your assignment progress.</p>
                                <div className="flex items-center justify-center gap-3">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={addCount} 
                                        onChange={e => setAddCount(parseInt(e.target.value) || 1)} 
                                        className="w-16 bg-slate-900 border border-slate-700 focus:border-blue-500/50 rounded-xl text-sm font-bold text-slate-200 px-3 py-2 outline-none text-center"
                                    />
                                    <button 
                                        onClick={() => handleAddQuestions(addCount)}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                                    >
                                        Initialize
                                    </button>
                                </div>
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
                                            btnClass = "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-950/20"; 
                                            displayIcon = `✓ ${qNum}`; 
                                        }
                                        else if (state === 'difficult') { 
                                            btnClass = "bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-950/20"; 
                                            displayIcon = `! ${qNum}`; 
                                        }
                                        else if (state === 'later') { 
                                            btnClass = "bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-950/20"; 
                                            displayIcon = `⌛ ${qNum}`; 
                                        }
                                        
                                        if (selectedQNum === qNum) {
                                            btnClass += " ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-105";
                                        }

                                        return (
                                            <button 
                                                key={qNum}
                                                onClick={() => handleToggleQuestion(qNum)}
                                                className={`py-2.5 rounded-xl text-xs font-bold border transition-all duration-100 flex items-center justify-center relative select-none ${btnClass}`}
                                                title={`Q${qNum} (${state})`}
                                            >
                                                {displayIcon}
                                                {hasRemark && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-400 rounded-full"></span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Question Grid modification controls */}
                                <div className="flex items-center justify-between border-t border-slate-700/50 pt-4 flex-wrap gap-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Add Questions:</span>
                                        <button 
                                            onClick={() => handleAddQuestions(5)}
                                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-all active:scale-95"
                                        >
                                            +5 Questions
                                        </button>
                                        <button 
                                            onClick={() => handleAddQuestions(10)}
                                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-all active:scale-95"
                                        >
                                            +10 Questions
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            value={addCount} 
                                            onChange={e => setAddCount(parseInt(e.target.value) || 1)} 
                                            className="w-12 text-center bg-slate-900 border border-slate-700 focus:border-blue-500/50 rounded-lg text-xs font-bold text-slate-200 px-1 py-1.5 outline-none transition-all"
                                        />
                                        <button 
                                            onClick={() => handleAddQuestions(addCount)}
                                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-all active:scale-95"
                                        >
                                            Add Custom
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Question details/remarks panel (Sticky at the bottom of the modal container, outside scrollable area) */}
                {selectedQNum && (
                    <div className={`mx-6 mb-4 bg-slate-800 border rounded-2xl p-5 shadow-lg animate-fade-in space-y-4 flex-shrink-0 transition-all duration-300 ${
                        localProgress[selectedQNum] === 'completed' ? 'border-emerald-500/30 bg-emerald-500/[0.02]' :
                        localProgress[selectedQNum] === 'difficult' ? 'border-rose-500/30 bg-rose-500/[0.02]' :
                        localProgress[selectedQNum] === 'later' ? 'border-amber-500/30 bg-amber-500/[0.02]' :
                        'border-slate-700'
                    }`}>
                        <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                            <div className="flex items-center gap-2.5">
                                <span className="text-sm font-black text-slate-200">Question {selectedQNum} Details</span>
                                {getQuestionStateBadge(localProgress[selectedQNum])}
                            </div>
                            <button 
                                onClick={() => setSelectedQNum(null)}
                                className="text-slate-400 hover:text-white transition-colors p-1"
                                title="Deselect Question"
                            >
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            {/* Set Status Buttons */}
                            <div className="space-y-2 col-span-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Set Status</label>
                                <div className="flex flex-wrap gap-1.5">
                                    <button 
                                        onClick={() => setLocalProgress(prev => ({...prev, [selectedQNum]: 'completed'}))}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                            localProgress[selectedQNum] === 'completed' 
                                                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/20' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        ✓ Completed
                                    </button>
                                    <button 
                                        onClick={() => setLocalProgress(prev => ({...prev, [selectedQNum]: 'difficult'}))}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                            localProgress[selectedQNum] === 'difficult' 
                                                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/20' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        ! Difficult
                                    </button>
                                    <button 
                                        onClick={() => setLocalProgress(prev => ({...prev, [selectedQNum]: 'later'}))}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                            localProgress[selectedQNum] === 'later' 
                                                ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-950/20' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        ⌛ Later
                                    </button>
                                    <button 
                                        onClick={() => setLocalProgress(prev => {
                                            const updated = { ...prev };
                                            delete updated[selectedQNum];
                                            return updated;
                                        })}
                                        className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                            !localProgress[selectedQNum] || localProgress[selectedQNum] === 'none'
                                                ? 'bg-slate-700 text-white border-slate-600 shadow-md shadow-slate-950/20' 
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>

                            {/* Remarks inputs (with word wrap textarea) */}
                            <div className="space-y-2 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remarks / Notes</label>
                                <div className="flex items-stretch gap-2.5">
                                    <textarea 
                                        value={localRemarks[selectedQNum] || ''}
                                        onChange={e => setLocalRemarks(prev => ({...prev, [selectedQNum]: e.target.value}))}
                                        placeholder="Add a note... e.g. Silly mistake with signs."
                                        className="flex-1 min-h-[60px] max-h-[120px] bg-slate-900 focus:bg-slate-950 border border-slate-700 focus:border-blue-500/50 rounded-xl p-2.5 text-xs text-slate-200 outline-none transition-all font-semibold resize-y custom-scrollbar"
                                        rows={2}
                                    />
                                    <button 
                                        onClick={() => setSelectedQNum(null)}
                                        className="px-4 bg-slate-700 hover:bg-slate-600 border border-slate-750 text-slate-200 font-bold rounded-xl transition-all flex items-center justify-center whitespace-nowrap self-stretch"
                                    >
                                        Close Panel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="p-6 border-t border-slate-700/50 flex flex-col md:flex-row gap-4 flex-shrink-0 bg-slate-800">
                    <button 
                        onClick={handleDiscardAndClose} 
                        className="flex-1 md:flex-none py-3 px-6 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-2xl transition-colors border border-slate-650"
                        disabled={isSaving}
                    >
                        Close & Discard
                    </button>
                    <button 
                        onClick={handleSaveAndClose} 
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-950/30 transition-all flex items-center justify-center gap-2"
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Saving progress...
                            </>
                        ) : (
                            <>
                                <i className="ph-bold ph-floppy-disk text-lg"></i>
                                Save & Lock In Progress ({stats.calculatedComp}%)
                            </>
                        )}
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
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{assignmentName} ({chapterName})</p>
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
        </div>
    );
};

export default AssignmentQuestionTrackerModal;
