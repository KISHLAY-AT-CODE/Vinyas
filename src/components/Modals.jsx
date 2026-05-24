import React from 'react';
import { useToast } from './ToastContext';

const Modals = ({
    routineModalType,
    closeRoutineModal,
    selectedInorganicChapter,
    inorganicChapterInput,
    setInorganicChapterInput,
    inorganicSearchResults,
    setSelectedInorganicChapter,
    routineLogInput,
    setRoutineLogInput,
    saveInorganicRoutineLog,
    saveTestLog,
    logModalOpen,
    activeLog,
    setActiveLog,
    saveLog,
    setLogModalOpen,
    aiError,
    currentLevel
}) => {
    const { showToast } = useToast();
    return (
        <>
            {/* Routine: Inorganic Revision Modal */}
            {routineModalType === 'inorganic' && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-animate">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <i className="ph-fill ph-flask text-emerald-400"></i> Log Inorganic Revision
                            </h3>
                            <button onClick={closeRoutineModal} className="text-slate-400 hover:text-white"><i className="ph-bold ph-x text-xl"></i></button>
                        </div>
                        <div className="p-6">
                            {!selectedInorganicChapter ? (
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-slate-300">Search Chemistry Chapter:</label>
                                    <div className="relative">
                                        <i className="ph-bold ph-magnifying-glass absolute left-3 top-3.5 text-slate-500"></i>
                                        <input type="text" autoFocus value={inorganicChapterInput} onChange={e => setInorganicChapterInput(e.target.value)} placeholder="Type to search..." className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 outline-none focus:border-emerald-500 transition-colors" />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-xl mt-2 bg-slate-900/50">
                                        {inorganicSearchResults.map(ch => (
                                            <div key={ch.cIdx} onClick={() => setSelectedInorganicChapter(ch)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-800 last:border-0 text-slate-200 font-medium">
                                                {ch.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-pop-in">
                                    <div className="bg-emerald-900/20 border border-emerald-500/30 px-4 py-3 rounded-xl flex justify-between items-center">
                                        <span className="font-bold text-emerald-400">{selectedInorganicChapter.name}</span>
                                        <button onClick={() => setSelectedInorganicChapter(null)} className="text-xs font-bold text-slate-400 hover:text-white">Change</button>
                                    </div>
                                    <label className="text-sm font-semibold text-slate-300 block mt-4">Progress Log:</label>
                                    <textarea autoFocus value={routineLogInput} onChange={e => setRoutineLogInput(e.target.value)} placeholder="E.g., Read NCERT pages 45-60, solved 20 Qs..." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 h-28 outline-none focus:border-emerald-500 transition-colors resize-none"></textarea>
                                    <button onClick={saveInorganicRoutineLog} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors mt-2">Save & Complete Routine</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Routine: Test Log Modal */}
            {routineModalType === 'test' && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-animate">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <i className="ph-fill ph-exam text-orange-400"></i> Mock Test Journal
                            </h3>
                            <button onClick={closeRoutineModal} className="text-slate-400 hover:text-white"><i className="ph-bold ph-x text-xl"></i></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-400">Log your mock test score, or skip if you aren\'t testing today.</p>
                            
                            <textarea autoFocus value={routineLogInput} onChange={e => setRoutineLogInput(e.target.value)} placeholder="E.g., Scored 210/390. Need to improve speed in Maths. Screwed up electrostatics logic." className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 h-24 outline-none focus:border-orange-500 transition-colors resize-none"></textarea>
                            

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => saveTestLog(true)} className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold rounded-xl shadow-sm transition-colors text-sm w-1/3 text-center whitespace-nowrap">
                                    No Test Today
                                </button>
                                <button onClick={() => saveTestLog(false)} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl shadow-lg transition-colors">
                                    Log Test & Complete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Basic Chapter Log Modal */}
            {logModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm modal-animate">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                        <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <i className="ph-fill ph-notepad text-indigo-400"></i> Log: {activeLog.name}
                            </h3>
                            <button onClick={() => setLogModalOpen(false)} className="text-slate-400 hover:text-white"><i className="ph-bold ph-x text-xl"></i></button>
                        </div>
                        <div className="p-5">
                            <p className="text-xs text-slate-400 mb-3">Add notes for AI analysis.</p>
                            <textarea value={activeLog.text} onChange={(e) => setActiveLog({...activeLog, text: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 h-32 resize-none" placeholder="E.g., Confident with theory, weak on PYQs..."></textarea>
                        </div>
                        <div className="p-4 border-t border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setLogModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-300">Cancel</button>
                            <button onClick={saveLog} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg shadow-md">Save Log</button>
                        </div>
                    </div>
                </div>
            )}


        </>
    );
};

export default Modals;
