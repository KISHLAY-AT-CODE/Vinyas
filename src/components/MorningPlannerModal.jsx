import React, { useState } from 'react';

const MorningPlannerModal = ({ isOpen, onClose, data, onAddRoutine }) => {
    const hasData = Array.isArray(data) && data.length > 0;

    const [selectedSubjectIdx, setSelectedSubjectIdx] = useState(0);
    const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);
    const [selectedTemplate, setSelectedTemplate] = useState('lecture');

    if (!isOpen) return null;

    const templates = [
        { id: 'lecture', name: 'Lecture', icon: 'ph-video-camera', color: 'text-red-400' },
        { id: 'dpp', name: 'DPP Practice', icon: 'ph-fire', color: 'text-orange-500' },
        { id: 'notes', name: 'Read Notes', icon: 'ph-book-open', color: 'text-blue-500' },
        { id: 'revision', name: 'Revision', icon: 'ph-arrows-clockwise', color: 'text-emerald-500' },
        { id: 'mock', name: 'Mock Test', icon: 'ph-exam', color: 'text-purple-500' }
    ];

    const subject = hasData ? (data[selectedSubjectIdx] || data[0]) : null;
    const chapters = subject?.chapters || [];

    const handleAdd = () => {
        if (!hasData || !subject) return;
        const chapter = chapters[selectedChapterIdx];
        if (!chapter) return;
        
        onAddRoutine({
            id: Date.now().toString(),
            sIdx: selectedSubjectIdx,
            cIdx: selectedChapterIdx,
            subjectName: subject.name,
            chapterName: chapter.name,
            template: selectedTemplate,
            done: false
        });
        
        // Reset chapter selection for next add
        setSelectedChapterIdx(0);
    };

    if (!hasData) {
        return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-animate">
                <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col p-6 items-center text-center">
                    <i className="ph-bold ph-warning text-4xl text-amber-400 mb-4 animate-bounce"></i>
                    <h2 className="text-xl font-black text-white mb-2">No Syllabus Setup Found</h2>
                    <p className="text-sm text-slate-400 mb-6 max-w-sm">
                        You need to set up your cohort/syllabus before you can plan your daily study routines.
                    </p>
                    <button onClick={onClose} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg">
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-animate">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-700 bg-slate-900/30 flex justify-between items-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <i className="ph-fill ph-sun text-yellow-400"></i> Plan Your Day
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-1">Select topics and assign templates to build your daily workflow.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors relative z-10">
                        <i className="ph-bold ph-x"></i>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Subject Select */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">1. Select Subject</label>
                        <div className="grid grid-cols-3 gap-2">
                            {data.map((sub, idx) => (
                                <button 
                                    key={idx}
                                    onClick={() => { setSelectedSubjectIdx(idx); setSelectedChapterIdx(0); }}
                                    className={`py-2 px-3 rounded-lg text-sm font-bold transition-all border ${selectedSubjectIdx === idx ? 'bg-slate-700 text-white border-slate-500 shadow-md' : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:bg-slate-800'}`}
                                >
                                    {sub.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chapter Select */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">2. Select Chapter</label>
                        <select 
                            value={selectedChapterIdx} 
                            onChange={(e) => setSelectedChapterIdx(parseInt(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg p-3 outline-none focus:border-blue-500 transition-colors font-medium appearance-none cursor-pointer"
                        >
                            {chapters.map((ch, idx) => (
                                <option key={idx} value={idx}>{ch.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Template Select */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">3. Assign Template</label>
                        <div className="grid grid-cols-2 gap-3">
                            {templates.map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => setSelectedTemplate(t.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTemplate === t.id ? 'bg-slate-700 border-slate-500 shadow-lg scale-[1.02]' : 'bg-slate-900/30 border-slate-700 hover:bg-slate-800 hover:border-slate-600'}`}
                                >
                                    <i className={`ph-fill ${t.icon} text-2xl ${t.color}`}></i>
                                    <span className={`font-bold ${selectedTemplate === t.id ? 'text-white' : 'text-slate-300'}`}>{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-0">
                    <button 
                        onClick={handleAdd}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2"
                    >
                        <i className="ph-bold ph-plus"></i> Add to Today's Workflow
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MorningPlannerModal;
