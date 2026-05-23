import React from 'react';

const SearchOverlay = ({ 
    overlaySearchOpen, 
    closeRoutineModal, 
    overlayInputRef, 
    overlaySearchQuery, 
    setOverlaySearchQuery, 
    overlaySearchResults, 
    handleOverlaySearchSelect, 
    activeRoutineIndex 
}) => {
    if (!overlaySearchOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4 bg-slate-950/90 backdrop-blur-sm animate-pop-in" onClick={closeRoutineModal}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center px-6 py-5 border-b border-slate-700/50 bg-slate-900/30">
                    <i className="ph-bold ph-magnifying-glass text-2xl text-bitsat-500 mr-4"></i>
                    <input 
                        ref={overlayInputRef}
                        type="text" 
                        placeholder={activeRoutineIndex !== null ? "Search chapter to update and complete routine..." : "Jump instantly to any chapter..."} 
                        value={overlaySearchQuery}
                        onChange={(e) => setOverlaySearchQuery(e.target.value)}
                        className="bg-transparent text-xl text-slate-100 w-full outline-none placeholder-slate-500 font-medium"
                    />
                    <button onClick={closeRoutineModal} className="text-slate-500 hover:text-slate-300 bg-slate-800 p-2 rounded-lg ml-2">
                        <kbd className="font-mono text-xs font-bold">ESC</kbd>
                    </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto">
                    {overlaySearchResults.length > 0 ? overlaySearchResults.map((res, i) => (
                        <div key={i} onClick={() => handleOverlaySearchSelect(res.sIdx, res.cIdx)} className="px-6 py-4 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700/30 transition-colors group">
                            <span className="font-semibold text-slate-200 group-hover:text-white text-lg">{res.name}</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs px-2.5 py-1 rounded-md font-bold text-white shadow-sm ${res.color}`}>{res.subject}</span>
                                <i className="ph-bold ph-arrow-right text-slate-500 group-hover:text-bitsat-400 transition-colors"></i>
                            </div>
                        </div>
                    )) : overlaySearchQuery ? (
                        <div className="px-6 py-8 text-center text-slate-500 font-medium">No chapters found matching "{overlaySearchQuery}"</div>
                    ) : (
                        <div className="px-6 py-8 text-center text-slate-500 font-medium text-sm">Type to search your syllabus...</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SearchOverlay;
