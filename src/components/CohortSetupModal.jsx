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
    };

    const selectTemplateAndContinue = (templateName) => {
        setCohortInput(templateName);
        setIsTemplateSelect(true);
        setCustomSyllabus([]); // clear previous syllabus fields
        if (templates[templateName]) {
            const loadedSyllabus = templates[templateName].map(sub => ({
                name: sub.name,
                chapters: sub.chapters.map(ch => ({
                    name: ch.name,
                    status: 'None',
                    lectures: 0,
                    log: '',
                    dpp: { acc: 0, comp: 0 },
                    module: { acc: 0, comp: 0 }
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
            showToast('No matching template. Created customizable blank subjects.', 'info');
        }
        setActiveSubjectIdx(0);
        setStep(2);
    };

    // Go to step 2: Curation/Customization Screen
    const handleNextStep = () => {
        if (!cohortInput.trim()) return;

        // Try to find a matching template (case-insensitive)
        const matchedKey = templateNames.find(
            t => t.toLowerCase() === cohortInput.trim().toLowerCase()
        );

        if (matchedKey) {
            selectTemplateAndContinue(matchedKey);
        } else {
            selectTemplateAndContinue(cohortInput.trim());
        }
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
                    module: { acc: 0, comp: 0 }
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

    const handleFinishSetup = () => {
        if (customSyllabus.length === 0) {
            showToast('Please add at least one subject.', 'warning');
            return;
        }

        // Initialize the cohort exam name and subjects list
        const subjectNames = customSyllabus.map(s => s.name);
        onInitializeCohort(cohortInput.trim(), subjectNames, isTemplateSelect);

        // Append the exact customized templates & chapters
        onAppendSyllabus(customSyllabus, isTemplateSelect);

        logEvent('COHORT_SETUP_COMPLETE', { 
            cohort: cohortInput.trim(), 
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
                        <i className="ph-fill ph-target text-indigo-500"></i> Cohort Setup
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">Configure your target exam and curate your syllabus.</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    {/* --- STEP 1: Exam Name & Template Matching --- */}
                    {step === 1 && (
                        <div className="space-y-5 py-2 animate-fade-in">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">1. Target Exam</label>
                                <input 
                                    type="text" 
                                    value={cohortInput} 
                                    onChange={e => {
                                        setCohortInput(e.target.value);
                                        setShowSuggestions(true);
                                    }} 
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:border-indigo-500 transition-colors font-bold text-lg" 
                                    placeholder="e.g. JEE Mains, BITSAT, NEET"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            if (showSuggestions && filteredSuggestions.length > 0) {
                                                selectTemplateAndContinue(filteredSuggestions[0]);
                                            } else {
                                                handleNextStep();
                                            }
                                        }
                                    }}
                                />
                                {showSuggestions && cohortInput.trim().length > 0 && filteredSuggestions.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto custom-scrollbar divide-y divide-slate-800">
                                        {filteredSuggestions.map((name, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    selectTemplateAndContinue(name);
                                                    setShowSuggestions(false);
                                                }}
                                                className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-indigo-400 flex items-center justify-between transition-colors group"
                                            >
                                                <span>{name}</span>
                                                <span className="text-xs text-slate-500 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                                                    Use Template <i className="ph-bold ph-arrow-right"></i>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {templateNames.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Or select from Preloaded Templates</label>
                                    <div className="flex flex-wrap gap-2">
                                        {templateNames.map((name, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    selectTemplateAndContinue(name);
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                                    cohortInput.trim().toLowerCase() === name.toLowerCase()
                                                        ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                                                }`}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {loadingTemplates && (
                                <p className="text-xs text-slate-500 italic"><i className="ph-bold ph-spinner-gap animate-spin"></i> Loading server templates...</p>
                            )}

                            <button 
                                onClick={handleNextStep}
                                disabled={!cohortInput.trim()}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next: Curate Syllabus <i className="ph-bold ph-arrow-right"></i>
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

                            <div className="flex gap-3 pt-4 border-t border-slate-700/50 mt-auto">
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
