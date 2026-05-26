import React, { useState, useEffect } from 'react';

const ResolveSubmissionsModal = ({ 
    isOpen, 
    onClose, 
    unresolvedSubmissions, 
    data, 
    onAddChapter, 
    onLinkChapter, 
    onDismiss 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto animate-pop-in">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <i className="ph-bold ph-x text-2xl"></i>
                </button>
                
                <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                    <i className="ph-fill ph-warning-circle text-red-500"></i>
                    Resolve Submissions
                </h2>
                <p className="text-slate-400 mb-6 text-sm">
                    The following DPP/Module submissions from PW did not automatically match any chapter in your syllabus.
                </p>

                {unresolvedSubmissions.length === 0 ? (
                    <div className="text-center text-slate-500 py-8">
                        No unresolved submissions! 🎉
                    </div>
                ) : (
                    <div className="space-y-4">
                        {unresolvedSubmissions.map((sub) => (
                            <UnresolvedItem 
                                key={sub.act.id} 
                                sub={sub} 
                                data={data} 
                                onAddChapter={onAddChapter}
                                filterMode={sub.section}
                                onLinkChapter={onLinkChapter}
                                onDismiss={onDismiss}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const UnresolvedItem = ({ sub, data, onAddChapter, onLinkChapter, onDismiss }) => {
    const [mode, setMode] = useState(null); // 'add' or 'link'
    const [selectedSubject, setSelectedSubject] = useState(data[0]?.name || '');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (data && data.length > 0 && !selectedSubject) {
            setSelectedSubject(data[0].name);
        }
    }, [data, selectedSubject]);

    const searchResults = searchQuery.trim() ? data.flatMap((subject, sIdx) => 
        subject.chapters
            .map((chapter, cIdx) => ({ sIdx, cIdx, chapterName: chapter.name, subjectName: subject.name, color: subject.color }))
            .filter(res => res.chapterName.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 5) : [];

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-white font-bold">{sub.chapterSearch}</h3>
                    <p className="text-xs text-slate-400">
                        Type: <span className="font-semibold text-slate-300">
                            {sub.section === 'module_layout' ? 'MODULE LAYOUT' : sub.section.toUpperCase()}
                        </span> | {
                            sub.section === 'module_layout' ? (
                                <span>
                                    {sub.act.details.exercises ? Object.keys(sub.act.details.exercises).length : 0} Exercises ({
                                        sub.act.details.exercises ? Object.values(sub.act.details.exercises).reduce((a, b) => a + b, 0) : 0
                                    } Questions)
                                </span>
                            ) : (
                                <span>
                                    Score: {sub.act.details.completion || 0}% Comp, {sub.act.details.accuracy || 0}% Acc
                                </span>
                            )
                        }
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setMode(mode === 'add' ? null : 'add')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'add' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                        Add New
                    </button>
                    <button onClick={() => setMode(mode === 'link' ? null : 'link')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'link' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                        Link Existing
                    </button>
                    <button onClick={() => onDismiss(sub.act.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-red-400 hover:bg-red-900/30 hover:border-red-800 transition-colors">
                        Ignore
                    </button>
                </div>
            </div>

            {sub.message && (
                <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs flex items-start gap-2.5 shadow-inner">
                    <i className="ph-fill ph-warning-circle text-amber-500 text-lg mt-0.5"></i>
                    <div>
                        <span className="font-semibold block text-amber-300 mb-0.5">Multiple Chapters Found</span>
                        <span>{sub.message}</span>
                    </div>
                </div>
            )}

            {mode === 'add' && (
                <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-3 animate-fade-in">
                    <span className="text-sm text-slate-400">Subject:</span>
                    <select 
                        value={selectedSubject} 
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2 outline-none focus:border-emerald-500"
                    >
                        {data.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                    </select>
                    <button 
                        onClick={() => onAddChapter(sub, selectedSubject)}
                        className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                        Confirm & Add
                    </button>
                </div>
            )}

            {mode === 'link' && (
                <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700 animate-fade-in relative">
                    <input 
                        type="text" 
                        placeholder="Search existing chapters..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg p-2 outline-none focus:border-indigo-500 mb-2"
                    />
                    {searchResults.length > 0 && (
                        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-2">
                            {searchResults.map(res => (
                                <button 
                                    key={`${res.sIdx}-${res.cIdx}`}
                                    onClick={() => onLinkChapter(sub, res.sIdx, res.cIdx)}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 flex justify-between items-center transition-colors"
                                >
                                    <span className="text-sm text-slate-200">{res.chapterName}</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${res.color}`}>{res.subjectName}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {searchQuery.trim() && searchResults.length === 0 && (
                        <div className="text-xs text-slate-500 px-2 mt-2">No matching chapters found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResolveSubmissionsModal;
