import React, { useState, useEffect } from 'react';

const ResolveSubmissionsModal = ({ 
    isOpen, 
    onClose, 
    unresolvedSubmissions, 
    data, 
    onAddChapter, 
    onCreateSubjectAndChapter,
    onLinkChapter, 
    onDismiss,
    onLinkBookToSubject,
    onCreateSubjectAndLinkBook,
    activities,
    onLinkBookChapter,
    onCreateSubjectAndLinkBookChapter
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
                    The following DPP/Module/Assignment submissions from PW did not automatically match any chapter in your syllabus.
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
                                onCreateSubjectAndChapter={onCreateSubjectAndChapter}
                                filterMode={sub.section}
                                onLinkChapter={onLinkChapter}
                                onDismiss={onDismiss}
                                onLinkBookToSubject={onLinkBookToSubject}
                                onCreateSubjectAndLinkBook={onCreateSubjectAndLinkBook}
                                activities={activities}
                                onLinkBookChapter={onLinkBookChapter}
                                onCreateSubjectAndLinkBookChapter={onCreateSubjectAndLinkBookChapter}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const UnresolvedItem = ({ 
    sub, 
    data, 
    onAddChapter, 
    onCreateSubjectAndChapter,
    onLinkChapter, 
    onDismiss, 
    onLinkBookToSubject, 
    onCreateSubjectAndLinkBook,
    activities,
    onLinkBookChapter,
    onCreateSubjectAndLinkBookChapter
}) => {
    const [mode, setMode] = useState(null); // 'link' or 'create' or null
    const [targetSubject, setTargetSubject] = useState(data[0]?.name || '');
    const [chapterMode, setChapterMode] = useState('existing'); // 'existing' or 'new'
    const [selectedChapter, setSelectedChapter] = useState('');
    const [newChapterName, setNewChapterName] = useState(sub.chapterSearch || '');
    const [newSubjectName, setNewSubjectName] = useState('');

    const targetSubjectObj = data.find(d => d.name === targetSubject);
    const chaptersOfTarget = targetSubjectObj?.chapters || [];

    useEffect(() => {
        if (data && data.length > 0 && !targetSubject) {
            setTargetSubject(data[0].name);
        }
    }, [data, targetSubject]);

    // Auto-initialize selectedChapter when targetSubject changes
    useEffect(() => {
        if (chaptersOfTarget.length > 0) {
            setSelectedChapter(chaptersOfTarget[0].name);
        } else {
            setSelectedChapter('');
            setChapterMode('new'); // force new chapter if there are none
        }
    }, [targetSubject, chaptersOfTarget]);

    const getBookName = (bookUrl) => {
        for (const subItem of data) {
            if (subItem.bookUrl === bookUrl && subItem.bookName) return subItem.bookName;
            const b = subItem.books?.find(x => x.url === bookUrl);
            if (b && b.name) return b.name;
        }
        const act = activities?.find(a => a.type === 'BOOK_SUBMISSION' && a.details?.url === bookUrl);
        if (act && act.details?.bookName) return act.details.bookName;
        
        try {
            const parts = bookUrl.split('/');
            const id = parts[parts.length - 1] || 'Book';
            return `Book (${id.slice(0, 6)})`;
        } catch(e) {
            return 'Module Book';
        }
    };

    if (sub.section === 'book_chapter') {
        const bookUrl = sub.act.details?.bookUrl;
        const bookNameResolved = getBookName(bookUrl);

        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 animate-fade-in">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-white font-bold">{sub.chapterSearch}</h3>
                        <p className="text-xs text-slate-400">
                            Book: <span className="font-semibold text-slate-300">{bookNameResolved}</span> | Type: <span className="font-semibold text-slate-300">BOOK CHAPTER</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setMode(mode === 'link' ? null : 'link')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'link' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                            Link to Subject
                        </button>
                        <button onClick={() => setMode(mode === 'create' ? null : 'create')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'create' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                            Create New Subject
                        </button>
                        <button onClick={() => onDismiss(sub.act.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-red-400 hover:bg-red-900/30 hover:border-red-800 transition-colors">
                            Ignore
                        </button>
                    </div>
                </div>

                {mode === 'link' && (
                    <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-4 animate-fade-in">
                        <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Select Subject:</label>
                                <select 
                                    value={targetSubject} 
                                    onChange={(e) => setTargetSubject(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                                >
                                    {data.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chapter Mode:</label>
                                <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                    {chaptersOfTarget.length > 0 && (
                                        <button 
                                            onClick={() => setChapterMode('existing')} 
                                            className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${chapterMode === 'existing' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            Existing
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => setChapterMode('new')} 
                                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${chapterMode === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        New Chapter
                                    </button>
                                </div>
                            </div>

                            {chapterMode === 'existing' && chaptersOfTarget.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Select Chapter:</label>
                                    <select 
                                        value={selectedChapter} 
                                        onChange={(e) => setSelectedChapter(e.target.value)}
                                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                                    >
                                        {chaptersOfTarget.map(ch => <option key={ch.name} value={ch.name}>{ch.name}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">New Chapter Name:</label>
                                    <input 
                                        type="text" 
                                        value={newChapterName}
                                        onChange={(e) => setNewChapterName(e.target.value)}
                                        placeholder="e.g. Kinematics"
                                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end mt-2">
                            <button 
                                onClick={() => {
                                    const finalChName = chapterMode === 'existing' ? selectedChapter : newChapterName.trim();
                                    if (finalChName) {
                                        onLinkBookChapter(sub.act, targetSubject, finalChName);
                                    }
                                }}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                            >
                                Confirm Link
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-4 animate-fade-in">
                        <div className="flex flex-wrap gap-4">
                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">New Subject Name:</label>
                                <input 
                                    type="text" 
                                    value={newSubjectName}
                                    onChange={(e) => setNewSubjectName(e.target.value)}
                                    placeholder="e.g. Physics"
                                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-emerald-500 font-semibold"
                                />
                            </div>
                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chapter Name:</label>
                                <input 
                                    type="text" 
                                    value={newChapterName}
                                    onChange={(e) => setNewChapterName(e.target.value)}
                                    placeholder="e.g. Kinematics"
                                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-emerald-500 font-semibold"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end mt-2">
                            <button 
                                onClick={() => {
                                    if (newSubjectName.trim() && newChapterName.trim()) {
                                        onCreateSubjectAndLinkBookChapter(sub.act, newSubjectName.trim(), newChapterName.trim());
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                            >
                                Create & Link
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (sub.section === 'book') {
        return (
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 animate-fade-in">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-white font-bold">{sub.chapterSearch}</h3>
                        <p className="text-xs text-slate-400">
                            Type: <span className="font-semibold text-slate-300">UNRESOLVED BOOK</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setMode(mode === 'link' ? null : 'link')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'link' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                            Link to Subject
                        </button>
                        <button onClick={() => setMode(mode === 'create' ? null : 'create')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'create' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                            Create New Subject
                        </button>
                        <button onClick={() => onDismiss(sub.act.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-red-400 hover:bg-red-900/30 hover:border-red-800 transition-colors">
                            Ignore
                        </button>
                    </div>
                </div>

                {mode === 'link' && (
                    <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center gap-3 animate-fade-in">
                        <span className="text-sm text-slate-400 font-bold uppercase tracking-wider text-xs">Link to Subject:</span>
                        <select 
                            value={targetSubject} 
                            onChange={(e) => setTargetSubject(e.target.value)}
                            className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                        >
                            {data.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                        </select>
                        <button 
                            onClick={() => onLinkBookToSubject(sub.act, targetSubject)}
                            className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                        >
                            Confirm Link
                        </button>
                    </div>
                )}

                {mode === 'create' && (
                    <div className="mt-4 p-3 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-3 animate-fade-in">
                        <span className="text-xs text-slate-450 font-bold uppercase tracking-wider">Create and Link to New Subject:</span>
                        <div className="flex gap-3 items-center">
                            <input 
                                type="text" 
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                                placeholder="e.g. Physics"
                                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-emerald-500 flex-1 font-semibold"
                            />
                            <button 
                                onClick={() => {
                                    if (newSubjectName.trim()) {
                                        onCreateSubjectAndLinkBook(sub.act, newSubjectName.trim());
                                    }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                            >
                                Create & Link
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 animate-fade-in">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-white font-bold">{sub.chapterSearch}</h3>
                    <p className="text-xs text-slate-400">
                        Type: <span className="font-semibold text-slate-300">
                            {sub.section === 'module_layout' ? 'MODULE LAYOUT' : sub.section === 'assignments' ? 'ASSIGNMENT' : sub.section.toUpperCase()}
                        </span> | {
                            sub.section === 'module_layout' ? (
                                <span>
                                    {sub.act.details.exercises ? Object.keys(sub.act.details.exercises).length : 0} Exercises ({
                                        sub.act.details.exercises ? Object.values(sub.act.details.exercises).reduce((a, b) => a + b, 0) : 0
                                    } Questions)
                                </span>
                            ) : sub.section === 'assignments' ? (
                                <span>
                                    Name: <span className="text-slate-300 font-semibold">{sub.act.details.assignmentName}</span>
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
                    <button onClick={() => setMode(mode === 'link' ? null : 'link')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'link' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                        Link to Subject
                    </button>
                    <button onClick={() => setMode(mode === 'create' ? null : 'create')} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${mode === 'create' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}>
                        Create New Subject
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

            {mode === 'link' && (
                <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-4 animate-fade-in">
                    <div className="flex flex-wrap gap-4 items-center">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Select Subject:</label>
                            <select 
                                value={targetSubject} 
                                onChange={(e) => setTargetSubject(e.target.value)}
                                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                            >
                                {data.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chapter Mode:</label>
                            <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                                {chaptersOfTarget.length > 0 && (
                                    <button 
                                        onClick={() => setChapterMode('existing')} 
                                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${chapterMode === 'existing' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Existing
                                    </button>
                                )}
                                <button 
                                    onClick={() => setChapterMode('new')} 
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${chapterMode === 'new' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                                >
                                    New Chapter
                                </button>
                            </div>
                        </div>

                        {chapterMode === 'existing' && chaptersOfTarget.length > 0 ? (
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Select Chapter:</label>
                                <select 
                                    value={selectedChapter} 
                                    onChange={(e) => setSelectedChapter(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                                >
                                    {chaptersOfTarget.map(ch => <option key={ch.name} value={ch.name}>{ch.name}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">New Chapter Name:</label>
                                <input 
                                    type="text" 
                                    value={newChapterName}
                                    onChange={(e) => setNewChapterName(e.target.value)}
                                    placeholder="e.g. Kinematics"
                                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2 outline-none focus:border-indigo-500 font-semibold"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end mt-2">
                        <button 
                            onClick={() => {
                                const finalChName = chapterMode === 'existing' ? selectedChapter : newChapterName.trim();
                                if (finalChName) {
                                    if (chapterMode === 'existing') {
                                        const sIdx = data.findIndex(s => s.name === targetSubject);
                                        const cIdx = data[sIdx].chapters.findIndex(c => c.name === selectedChapter);
                                        onLinkChapter(sub, sIdx, cIdx);
                                    } else {
                                        onAddChapter(sub, targetSubject, finalChName);
                                    }
                                }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                        >
                            Confirm Link
                        </button>
                    </div>
                </div>
            )}

            {mode === 'create' && (
                <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700 flex flex-col gap-4 animate-fade-in">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">New Subject Name:</label>
                            <input 
                                type="text" 
                                value={newSubjectName}
                                onChange={(e) => setNewSubjectName(e.target.value)}
                                placeholder="e.g. Physics"
                                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-emerald-500 font-semibold"
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chapter Name:</label>
                            <input 
                                type="text" 
                                value={newChapterName}
                                onChange={(e) => setNewChapterName(e.target.value)}
                                placeholder="e.g. Kinematics"
                                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg p-2.5 outline-none focus:border-emerald-500 font-semibold"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end mt-2">
                        <button 
                            onClick={() => {
                                if (newSubjectName.trim() && newChapterName.trim()) {
                                    onCreateSubjectAndChapter(sub, newSubjectName.trim(), newChapterName.trim());
                                }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
                        >
                            Create & Link
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResolveSubmissionsModal;
