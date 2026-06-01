import React, { useState, useEffect } from 'react';
import { logEvent } from '../services/logger';
import { useToast } from './ToastContext';

const CohortSetupModal = ({ isOpen, onClose, currentCohort, onInitializeCohort, onAppendSyllabus }) => {
    const { showToast } = useToast();
    const [step, setStep] = useState(1);
    
    // Templates state
    const [templates, setTemplates] = useState({});
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    // Step 1 State
    const [cohortInput, setCohortInput] = useState(currentCohort || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isTemplateSelect, setIsTemplateSelect] = useState(false);
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    
    // Step 2 State (Custom Syllabus Builder)
    const [customSyllabus, setCustomSyllabus] = useState([]);
    const [activeSubjectIdx, setActiveSubjectIdx] = useState(0);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newChapterName, setNewChapterName] = useState('');

    // Fetch templates from server on mount
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                setLoadingTemplates(true);
                const response = await fetch('/api/templates');
                if (response.ok) {
                    const data = await response.json();
                    setTemplates(data);
                }
            } catch (err) {
                console.error("Error fetching templates:", err);
            } finally {
                setLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, []);

    // Preset options matching the templates keys
    const templateNames = Object.keys(templates);

    if (!isOpen) return null;

    const handleClose = () => {
        resetState();
        onClose();
    };

    const resetState = () => {
        setStep(1);
        setCohortInput(currentCohort || '');
        setCustomSyllabus([]);
        setActiveSubjectIdx(0);
        setNewSubjectName('');
        setNewChapterName('');
        setIsTemplateSelect(false);
        setIsCreatingCustom(false);
    };

    const handleNextStep = () => {
        if (!cohortInput || !cohortInput.trim()) return;

        const templateName = cohortInput.trim();
        setCustomSyllabus([]); // clear previous syllabus fields
        
        if (isCreatingCustom) {
            setCustomSyllabus([
                { name: 'Physics', chapters: [] },
                { name: 'Chemistry', chapters: [] },
                { name: 'Mathematics', chapters: [] }
            ]);
            setIsTemplateSelect(true);
            showToast('Created custom blank templates. Add your chapters!', 'info');
        } else if (templates[templateName]) {
            const loadedSyllabus = templates[templateName].map(sub => ({
                name: sub.name,
                chapters: sub.chapters.map(ch => ({
                    name: ch.name,
                    status: 'None',
                    lectures: 0,
                    log: '',
                    dpp: { acc: 0, comp: 0 },
                    module: { acc: 0, comp: 0 },
                    dppLogs: {},
                    moduleLogs: {},
                    customExerciseConfig: null,
                    exerciseDisplayNames: null,
                    moduleQuestionStates: {},
                    focusTime: 0,
                    reviewsDone: 0,
                    nextReview: null,
                    lastReviewRating: null
                }))
            }));
            setCustomSyllabus(loadedSyllabus);
            showToast(`Loaded ${templateName} template syllabus!`, 'success');
        } else {
            setCustomSyllabus([
                { name: 'Physics', chapters: [] },
                { name: 'Chemistry', chapters: [] },
                { name: 'Mathematics', chapters: [] }
            ]);
            showToast('Created customizable blank subjects.', 'info');
        }
        setActiveSubjectIdx(0);
        setStep(2);
    };

    // Subject editing helpers
    const addSubject = () => {
        const name = newSubjectName.trim();
        if (!name) return;

        const exists = customSyllabus.some(s => s.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            showToast('Subject already exists', 'warning');
            return;
        }

        setCustomSyllabus([...customSyllabus, { name, chapters: [] }]);
        setNewSubjectName('');
        setActiveSubjectIdx(customSyllabus.length); // Select new subject tab
    };

    const removeSubject = (idxToRemove) => {
        if (customSyllabus.length <= 1) {
            showToast('At least one subject is required', 'warning');
            return;
        }
        const filtered = customSyllabus.filter((_, idx) => idx !== idxToRemove);
        setCustomSyllabus(filtered);
        setActiveSubjectIdx(0);
    };

    // Chapter editing helpers
    const addChapter = () => {
        const name = newChapterName.trim();
        if (!name) return;

        const currentSubject = customSyllabus[activeSubjectIdx];
        if (!currentSubject) return;

        const exists = currentSubject.chapters.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            showToast('Chapter already exists in this subject', 'warning');
            return;
        }

        setCustomSyllabus(prev => prev.map((sub, idx) => {
            if (idx !== activeSubjectIdx) return sub;
            return {
                ...sub,
                chapters: [...sub.chapters, {
                    name,
                    status: 'None',
                    lectures: 0,
                    log: '',
                    dpp: { acc: 0, comp: 0 },
                    module: { acc: 0, comp: 0 },
                    dppLogs: {},
                    moduleLogs: {},
                    customExerciseConfig: null,
                    exerciseDisplayNames: null,
                    moduleQuestionStates: {},
                    focusTime: 0,
                    reviewsDone: 0,
                    nextReview: null,
                    lastReviewRating: null
                }]
            };
        }));
        setNewChapterName('');
    };

    const removeChapter = (chapterIdx) => {
        setCustomSyllabus(prev => prev.map((sub, idx) => {
            if (idx !== activeSubjectIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.filter((_, idxCh) => idxCh !== chapterIdx)
            };
        }));
    };

    const handleFinishSetup = async () => {
        if (customSyllabus.length === 0) {
            showToast('Please add at least one subject.', 'warning');
            return;
        }

        const trimmedCohort = cohortInput.trim();

        if (isCreatingCustom) {
            showToast(`Custom cohort "${trimmedCohort}" created successfully!`, 'success');
        }

        // Initialize the cohort exam name and subjects list
        const subjectNames = customSyllabus.map(s => s.name);
        onInitializeCohort(trimmedCohort, subjectNames, isTemplateSelect);

        // Append the exact customized templates & chapters
        onAppendSyllabus(customSyllabus, isTemplateSelect);

        logEvent('COHORT_SETUP_COMPLETE', { 
            cohort: trimmedCohort, 
            subjects: subjectNames,
            chaptersCount: customSyllabus.reduce((acc, s) => acc + s.chapters.length, 0)
        }, 'success');

        handleClose();
    };

    const filteredSuggestions = templateNames.filter(name =>
        name.toLowerCase().includes(cohortInput.toLowerCase())
    );

    const activeSubject = customSyllabus[activeSubjectIdx];

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl max-w-2xl w-full border border-slate-700 relative modal-animate max-h-[95vh] flex flex-col">
                <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                    <i className="ph-bold ph-x text-xl"></i>
                </button>

                <div className="mb-4">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <i className="ph-fill ph-target text-indigo-500"></i> Syllabus Setup
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Select your target exam template and curate your syllabus.</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {/* --- STEP 1: Exam Name & Template Matching --- */}
                    {step === 1 && (
                        <div className="space-y-6 py-2 animate-fade-in">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                                    Select Target Exam Template
                                </label>
                                
                                {loadingTemplates ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                                        <i className="ph-bold ph-spinner-gap text-3xl animate-spin text-indigo-500"></i>
                                        <p className="text-xs font-semibold uppercase tracking-wider">Loading preloaded syllabus templates...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Create Custom Template Option */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCohortInput('');
                                                setIsCreatingCustom(true);
                                                setIsTemplateSelect(false);
                                            }}
                                            className={`p-5 rounded-2xl border text-left transition-all duration-300 relative group flex flex-col justify-between h-32 cursor-pointer border-dashed ${
                                                isCreatingCustom
                                                    ? 'bg-indigo-950/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30'
                                                    : 'bg-slate-900/50 hover:bg-slate-900 border-slate-700/60 hover:border-slate-500'
                                            }`}
                                        >
                                            {isCreatingCustom && (
                                                <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs border border-indigo-400/50 shadow shadow-indigo-950/50 animate-pop-in">
                                                    <i className="ph-bold ph-check text-[10px]"></i>
                                                </div>
                                            )}
                                            
                                            <div>
                                                <h3 className={`font-black text-base flex items-center gap-1.5 transition-colors ${isCreatingCustom ? 'text-indigo-400' : 'text-slate-350 group-hover:text-white'}`}>
                                                    <i className="ph-bold ph-plus-circle text-lg text-indigo-500"></i>
                                                    Create Custom Template
                                                </h3>
                                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-1.5">
                                                    Define your own subjects & chapters
                                                </p>
                                            </div>
                                            
                                            <div className="text-xs font-bold text-slate-500 pt-2.5 mt-2 border-t border-slate-800/40">
                                                Directly stored in database
                                            </div>
                                        </button>

                                        {templateNames.map((name, idx) => {
                                            const isSelected = cohortInput === name && !isCreatingCustom;
                                            const subjectCount = templates[name]?.length || 0;
                                            const chapterCount = templates[name]?.reduce((acc, sub) => acc + (sub.chapters?.length || 0), 0) || 0;
                                            
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setCohortInput(name);
                                                        setIsTemplateSelect(true);
                                                        setIsCreatingCustom(false);
                                                    }}
                                                    className={`p-5 rounded-2xl border text-left transition-all duration-300 relative group flex flex-col justify-between h-32 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-950/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-500/30'
                                                            : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                                                    }`}
                                                >
                                                    {/* Selected Indicator Checkmark */}
                                                    {isSelected && (
                                                        <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs border border-indigo-400/50 shadow shadow-indigo-950/50 animate-pop-in">
                                                            <i className="ph-bold ph-check text-[10px]"></i>
                                                        </div>
                                                    )}
                                                    
                                                    <div>
                                                        <h3 className={`font-black text-base transition-colors ${isSelected ? 'text-indigo-400' : 'text-slate-200 group-hover:text-white'}`}>
                                                            {name}
                                                        </h3>
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">
                                                            Exam Cohort Template
                                                        </p>
                                                    </div>
                                                    
                                                    <div className="flex gap-4 text-xs font-semibold text-slate-450 border-t border-slate-800/40 pt-2.5 mt-2">
                                                        <span className="flex items-center gap-1">
                                                            <i className="ph-bold ph-books text-slate-500"></i>
                                                            {subjectCount} {subjectCount === 1 ? 'Subject' : 'Subjects'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <i className="ph-bold ph-list-numbers text-slate-500"></i>
                                                            {chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {isCreatingCustom && (
                                <div className="mt-4 p-4 bg-slate-900/45 border border-slate-700/50 rounded-2xl animate-pop-in">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                        Custom Cohort / Exam Name
                                    </label>
                                    <input 
                                        type="text"
                                        value={cohortInput}
                                        onChange={(e) => setCohortInput(e.target.value)}
                                        placeholder="e.g. BITSAT Prep, NEET Crash Course..."
                                        className="w-full bg-slate-900 border border-slate-750 focus:border-indigo-500/80 rounded-xl px-4 py-2.5 text-sm text-slate-250 outline-none transition-all duration-300 font-semibold"
                                        onKeyDown={(e) => e.key === 'Enter' && cohortInput.trim() && handleNextStep()}
                                    />
                                    <p className="text-[10px] text-slate-500 font-semibold mt-1.5 leading-relaxed">
                                        This template will be saved dynamically to the server's templates database.
                                    </p>
                                </div>
                            )}

                            <button 
                                onClick={handleNextStep}
                                disabled={!cohortInput || !cohortInput.trim()}
                                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-950/20 hover:shadow-indigo-950/40 hover:scale-[1.01] active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span>Continue to Curate Syllabus</span>
                                <i className="ph-bold ph-arrow-right"></i>
                            </button>
                        </div>
                    )}

                    {/* --- STEP 2: Customize Syllabus (Subjects & Chapters) --- */}
                    {step === 2 && (
                        <div className="space-y-5 py-2 animate-fade-in flex flex-col h-full min-h-[400px]">
                            {/* Subject Tabs */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subjects</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {customSyllabus.map((sub, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveSubjectIdx(idx)}
                                            className={`px-3.5 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
                                                activeSubjectIdx === idx
                                                    ? 'bg-indigo-600 border-transparent text-white shadow-md'
                                                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                                            }`}
                                        >
                                            {sub.name}
                                            <span className="text-[10px] bg-slate-950/40 text-slate-300 px-1.5 py-0.5 rounded-full">{sub.chapters.length}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Add New Subject */}
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={newSubjectName}
                                        onChange={e => setNewSubjectName(e.target.value)}
                                        placeholder="Create custom subject (e.g. Biology)"
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                                        onKeyDown={e => e.key === 'Enter' && addSubject()}
                                    />
                                    <button onClick={addSubject} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors text-xs font-bold">
                                        Add Subject
                                    </button>
                                </div>
                            </div>

                            {activeSubject && (
                                <div className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex flex-col min-h-[220px]">
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                                            Active Subject: <span className="text-indigo-400">{activeSubject.name}</span>
                                        </h3>
                                        <button 
                                            onClick={() => removeSubject(activeSubjectIdx)}
                                            className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors"
                                            title="Delete Subject"
                                        >
                                            <i className="ph-bold ph-trash"></i> Delete Subject
                                        </button>
                                    </div>

                                    {/* Chapters List */}
                                    <div className="flex-1 overflow-y-auto max-h-48 pr-1 custom-scrollbar space-y-2 mb-3">
                                        {activeSubject.chapters.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic py-4 text-center">No chapters added yet. Add some below!</p>
                                        ) : (
                                            activeSubject.chapters.map((ch, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
                                                    <span className="text-xs text-slate-300 font-medium">{ch.name}</span>
                                                    <button 
                                                        onClick={() => removeChapter(idx)} 
                                                        className="text-slate-500 hover:text-rose-400 transition-colors"
                                                    >
                                                        <i className="ph-bold ph-trash"></i>
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Add Chapter Form */}
                                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                                        <input 
                                            type="text" 
                                            value={newChapterName}
                                            onChange={e => setNewChapterName(e.target.value)}
                                            placeholder={`Add chapter to ${activeSubject.name}`}
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                                            onKeyDown={e => e.key === 'Enter' && addChapter()}
                                        />
                                        <button onClick={addChapter} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors text-xs font-bold">
                                            Add Chapter
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 border-t border-slate-700/50 mt-auto sticky bottom-0 z-10 bg-slate-800 pb-1">
                                <button 
                                    onClick={() => setStep(1)} 
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold px-4 py-2.5 rounded-lg transition-all text-sm flex items-center gap-1"
                                >
                                    <i className="ph-bold ph-arrow-left"></i> Back
                                </button>
                                <button 
                                    onClick={handleFinishSetup}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    Done & Finish Setup <i className="ph-bold ph-check-circle"></i>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default CohortSetupModal;
