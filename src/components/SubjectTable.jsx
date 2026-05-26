import React, { useState } from 'react';

export const getEffectiveStatusInfo = (chapter) => {
    let sumComp = 0, sumAcc = 0, validCount = 0;
    [chapter.dpp, chapter.module].forEach(sec => {
        if (sec && (sec.acc > 0 || sec.comp > 0)) {
            sumComp += sec.comp;
            sumAcc += sec.acc;
            validCount++;
        }
    });

    const avgAcc = validCount > 0 ? sumAcc / validCount : 0;

    if (chapter.status === 'Under Revision') return { text: 'Under Revision', isDone: false, style: 'bg-purple-500/20 text-purple-400 border-purple-500/30', type: 'revision' };
    if (chapter.status === 'Current') return { text: 'Current', isDone: false, style: 'bg-blue-500/20 text-blue-400 border-blue-500/30', type: 'current' };
    
    if (chapter.status === 'Done') { 
        if (avgAcc >= 80) return { text: 'Done', isDone: true, style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', type: 'done_green' };
        if (avgAcc >= 50) return { text: 'Done', isDone: true, style: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', type: 'done_yellow' };
        return { text: 'Done', isDone: true, style: 'bg-red-500/20 text-red-400 border-red-500/30', type: 'done_red' };
    }

    return { text: 'To Do', isDone: false, style: 'bg-slate-700 text-slate-400 border-slate-600', type: 'none' };
};

const SubjectTable = ({ subject, sIdx, handleUpdate, handleNestedUpdate, openLogModal, getChapterAnalysis, openProgressModal, addChapter, removeChapter, requestConfirm }) => {
    const [isAddingChapter, setIsAddingChapter] = useState(false);
    const [newChapterName, setNewChapterName] = useState('');
    
    let doneCount = 0;
    subject.chapters.forEach(ch => {
        const eff = getEffectiveStatusInfo(ch);
        if (eff.isDone) doneCount++;
    });

    return (
        <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden flex flex-col">
            <div className={`${subject.color} px-6 py-4 text-white flex justify-between items-center shadow-md z-10`}>
                <h2 className="text-xl font-bold">{subject.name} Tracker</h2>
                <div className="text-sm font-semibold bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                    {doneCount} / {subject.chapters.length} Done
                </div>
            </div>

            <div className="table-container overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-bold w-1/4">Chapter</th>
                            <th className="px-2 py-3 font-bold text-center">Status</th>
                            <th className="px-2 py-3 font-bold text-center">Lectures</th>
                            <th className="px-4 py-3 font-bold text-center border-l border-slate-700 bg-slate-800/30">Resources Tracking</th>
                            <th className="px-4 py-3 font-bold text-right border-l border-slate-700">Analysis</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {subject.chapters.map((chapter, cIdx) => {
                            const analysisScore = getChapterAnalysis(chapter);
                            const eff = getEffectiveStatusInfo(chapter);
                            return (
                                <tr key={cIdx} id={`chapter-${sIdx}-${cIdx}`} className="hover:bg-slate-700/40 transition-colors group">
                                    <td className="px-4 py-3 font-semibold text-slate-300 flex items-center justify-between" title={chapter.name}>
                                        <span className="truncate max-w-[150px]">{chapter.name}</span>
                                        <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openLogModal(sIdx, cIdx, chapter.name, chapter.log)} className={`transition-colors focus:outline-none p-1 rounded hover:bg-slate-700 ${chapter.log ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-300'}`} title={chapter.log ? "Edit your Notes" : "Add prep notes for AI analysis"}>
                                                <i className="ph-fill ph-notepad text-lg"></i>
                                            </button>
                                            <button onClick={() => {
                                                requestConfirm(
                                                    "Remove Chapter",
                                                    `Are you sure you want to remove "${chapter.name}"? This action is irreversible.`,
                                                    () => removeChapter(sIdx, cIdx)
                                                );
                                            }} className="transition-colors focus:outline-none p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400" title="Remove Chapter">
                                                <i className="ph-bold ph-trash text-lg"></i>
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-2 py-3">
                                        <select value={chapter.status || 'None'} onChange={(e) => handleUpdate(sIdx, cIdx, 'status', e.target.value)} className={`text-xs font-bold rounded-full px-3 py-1 w-full text-center border cursor-pointer outline-none transition-all appearance-none ${eff.style}`}>
                                            <option value="None" className="bg-slate-800 text-slate-300">To Do</option>
                                            <option value="Current" className="bg-slate-800 text-slate-300">Current</option>
                                            <option value="Under Revision" className="bg-slate-800 text-slate-300">Under Revision</option>
                                            <option value="Done" className="bg-slate-800 text-slate-300">Done</option>
                                        </select>
                                    </td>
                                    <td className="px-2 py-3">
                                        <div className="flex items-center justify-center gap-1 mx-auto w-20 bg-slate-900/80 border border-slate-700 rounded-full overflow-hidden shadow-inner p-0.5">
                                            <button 
                                                onClick={() => handleUpdate(sIdx, cIdx, 'lectures', Math.max(0, (parseInt(chapter.lectures) || 0) - 1))}
                                                className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                            >
                                                <i className="ph-bold ph-minus text-xs"></i>
                                            </button>
                                            <span className="flex-1 text-center font-bold text-slate-200 text-sm tracking-wide">
                                                {chapter.lectures || 0}
                                            </span>
                                            <button 
                                                onClick={() => handleUpdate(sIdx, cIdx, 'lectures', (parseInt(chapter.lectures) || 0) + 1)}
                                                className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                            >
                                                <i className="ph-bold ph-plus text-xs"></i>
                                            </button>
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-3 border-l border-slate-700/50 bg-slate-800/10 text-center">
                                        <button 
                                            onClick={() => openProgressModal(sIdx, cIdx)}
                                            className="group relative inline-flex items-center justify-center px-4 py-1.5 font-bold text-xs text-white transition-all duration-200 bg-slate-700 border border-slate-600 rounded-xl hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 shadow-sm overflow-hidden"
                                        >
                                            <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
                                            <span className="relative flex items-center gap-2">
                                                <i className={`ph-fill ph-fire ${eff.isDone ? 'text-orange-500' : 'text-slate-400 group-hover:text-orange-400'} transition-colors text-sm`}></i>
                                                Log Progress
                                            </span>
                                        </button>
                                    </td>

                                    <td className="px-4 py-3 text-right font-bold border-l border-slate-700">
                                        {analysisScore > 0 ? (
                                            <span className={`px-2 py-1 rounded ${analysisScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : analysisScore >= 60 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {analysisScore.toFixed(1)}%
                                            </span>
                                        ) : <span className="text-slate-600">-</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="p-3 border-t border-slate-700/50 flex justify-center bg-slate-900/50 min-h-[56px] items-center">
                {isAddingChapter ? (
                    <form 
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (newChapterName.trim()) {
                                addChapter(sIdx, newChapterName.trim());
                                setNewChapterName('');
                                setIsAddingChapter(false);
                            }
                        }}
                        className="flex gap-2 w-full max-w-xs animate-pop-in"
                    >
                        <input 
                            type="text"
                            value={newChapterName}
                            onChange={(e) => setNewChapterName(e.target.value)}
                            placeholder="Enter chapter name..."
                            autoFocus
                            className="bg-slate-950 border border-slate-750 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500 transition-all flex-1"
                        />
                        <button 
                            type="submit"
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-orange-950/20 cursor-pointer"
                        >
                            Add
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                setIsAddingChapter(false);
                                setNewChapterName('');
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                    </form>
                ) : (
                    <button 
                        onClick={() => setIsAddingChapter(true)} 
                        className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                        <i className="ph-bold ph-plus"></i> Add Custom Chapter
                    </button>
                )}
            </div>
        </div>
    );
};

export default SubjectTable;
