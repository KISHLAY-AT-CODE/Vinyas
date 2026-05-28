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

export const getAccuracyTheme = (score) => {
    if (score >= 80) return {
        color: 'emerald',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        border: 'border-emerald-500/30 hover:border-emerald-400/50',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:shadow-[0_0_18px_rgba(16,185,129,0.4)]',
        shimmerBg: 'from-emerald-500/0 via-emerald-400/30 to-emerald-500/0',
        rowClass: 'chapter-row-emerald'
    };
    if (score >= 60) return {
        color: 'yellow',
        text: 'text-yellow-400',
        bg: 'bg-yellow-500/10 hover:bg-yellow-500/20',
        border: 'border-yellow-500/30 hover:border-yellow-400/50',
        glow: 'shadow-[0_0_12px_rgba(234,179,8,0.25)] hover:shadow-[0_0_18px_rgba(234,179,8,0.4)]',
        shimmerBg: 'from-yellow-500/0 via-yellow-400/30 to-yellow-500/0',
        rowClass: 'chapter-row-yellow'
    };
    if (score > 0) return {
        color: 'red',
        text: 'text-red-400',
        bg: 'bg-red-500/10 hover:bg-red-500/20',
        border: 'border-red-500/30 hover:border-red-400/50',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.25)] hover:shadow-[0_0_18px_rgba(239,68,68,0.4)]',
        shimmerBg: 'from-red-500/0 via-red-400/30 to-red-500/0',
        rowClass: 'chapter-row-red'
    };
    // Default: not mentioned (white)
    return {
        color: 'white',
        text: 'text-slate-200',
        bg: 'bg-white/5 hover:bg-white/10',
        border: 'border-white/20 hover:border-white/40',
        glow: 'shadow-[0_0_10px_rgba(255,255,255,0.15)] hover:shadow-[0_0_15px_rgba(255,255,255,0.25)]',
        shimmerBg: 'from-white/0 via-white/20 to-white/0',
        rowClass: 'chapter-row-white'
    };
};

export const getSubjectGlassTheme = (colorClass, subjectName, isStuck) => {
    const colorLower = (colorClass || '').toLowerCase();
    const nameLower = (subjectName || '').toLowerCase();

    const isBlue = colorLower.includes('blue') || colorLower.includes('cyan') || colorLower.includes('indigo') || nameLower.includes('physic');
    const isGreen = colorLower.includes('emerald') || colorLower.includes('green') || nameLower.includes('chem');
    const isPurple = colorLower.includes('purple') || nameLower.includes('biolog') || nameLower.includes('botan') || nameLower.includes('zool');
    const isRed = colorLower.includes('rose') || colorLower.includes('red') || colorLower.includes('amber') || colorLower.includes('orange') || nameLower.includes('math') || nameLower.includes('algeb') || nameLower.includes('calculus');

    if (isBlue) {
        return {
            containerClass: `bg-slate-950/45 backdrop-blur-xl border-b border-blue-500/25 shadow-[0_4px_30px_rgba(59,130,246,0.12)] ${
                isStuck ? 'rounded-none border-t border-blue-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-blue-500/15'
            }`,
            titleColor: 'text-blue-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(56,189,248,0.75)]',
            badgeClass: 'bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)] hover:bg-blue-500/20',
            spotlightClass: 'bg-blue-500/20',
            iconClass: 'ph-atom'
        };
    }
    if (isGreen) {
        return {
            containerClass: `bg-slate-950/45 backdrop-blur-xl border-b border-emerald-500/25 shadow-[0_4px_30px_rgba(16,185,129,0.12)] ${
                isStuck ? 'rounded-none border-t border-emerald-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-emerald-500/15'
            }`,
            titleColor: 'text-emerald-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(52,211,153,0.75)]',
            badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20',
            spotlightClass: 'bg-emerald-500/20',
            iconClass: 'ph-flask'
        };
    }
    if (isPurple) {
        return {
            containerClass: `bg-slate-950/45 backdrop-blur-xl border-b border-purple-500/25 shadow-[0_4px_30px_rgba(168,85,247,0.12)] ${
                isStuck ? 'rounded-none border-t border-purple-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-purple-500/15'
            }`,
            titleColor: 'text-purple-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(192,132,252,0.75)]',
            badgeClass: 'bg-purple-500/10 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:bg-purple-500/20',
            spotlightClass: 'bg-purple-500/20',
            iconClass: 'ph-dna'
        };
    }
    if (isRed) {
        return {
            containerClass: `bg-slate-950/45 backdrop-blur-xl border-b border-rose-500/25 shadow-[0_4px_30px_rgba(244,63,94,0.12)] ${
                isStuck ? 'rounded-none border-t border-rose-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-rose-500/15'
            }`,
            titleColor: 'text-rose-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(251,113,133,0.75)]',
            badgeClass: 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)] hover:bg-rose-500/20',
            spotlightClass: 'bg-rose-500/20',
            iconClass: 'ph-compass'
        };
    }

    // Default fallback (beautiful glassy indigo)
    return {
        containerClass: `bg-slate-950/45 backdrop-blur-xl border-b border-indigo-500/20 shadow-[0_4px_30px_rgba(99,102,241,0.08)] ${
            isStuck ? 'rounded-none border-t border-indigo-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-indigo-500/10'
        }`,
        titleColor: 'text-indigo-400 font-extrabold tracking-wide drop-shadow-[0_0_12px_rgba(129,140,248,0.6)]',
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-[0_0_10px_rgba(99,102,241,0.1)] hover:bg-indigo-500/20',
        spotlightClass: 'bg-indigo-500/15',
        iconClass: 'ph-books'
    };
};

const SubjectTable = ({ subject, sIdx, handleUpdate, handleNestedUpdate, openLogModal, getChapterAnalysis, openProgressModal, addChapter, removeChapter, requestConfirm }) => {
    const [showAddChapterModal, setShowAddChapterModal] = useState(false);
    const [newChapterName, setNewChapterName] = useState('');
    const headerRef = React.useRef(null);
    const [isStuck, setIsStuck] = useState(false);

    React.useEffect(() => {
        let ticking = false;
        let cachedNavbarHeight = 72;

        const updateNavbarHeight = () => {
            if (typeof document !== 'undefined') {
                cachedNavbarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 72;
            }
        };

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (!headerRef.current) {
                        ticking = false;
                        return;
                    }
                    const rect = headerRef.current.getBoundingClientRect();
                    const parentRect = headerRef.current.parentElement.getBoundingClientRect();
                    
                    const isElementStuck = rect.top <= cachedNavbarHeight + 2 && parentRect.bottom > cachedNavbarHeight + 15;
                    setIsStuck(isElementStuck);
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Cache initially
        updateNavbarHeight();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', () => {
            updateNavbarHeight();
            handleScroll();
        });
        
        // Dynamic checker interval for layout shifts (e.g. extension banner toggled)
        const intervalId = setInterval(updateNavbarHeight, 1500);

        // Initial check on mount
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearInterval(intervalId);
        };
    }, []);
    
    let doneCount = 0;
    subject.chapters.forEach(ch => {
        const eff = getEffectiveStatusInfo(ch);
        if (eff.isDone) doneCount++;
    });

    const glassTheme = getSubjectGlassTheme(subject.color, subject.name, isStuck);

    return (
        <div className={`bg-slate-900/40 backdrop-blur-md border border-slate-850/80 shadow-2xl flex flex-col relative transition-all duration-300 ${
            isStuck ? 'rounded-none border-x-0' : 'rounded-2xl'
        }`}>
            <div 
                ref={headerRef} 
                className={`${glassTheme.containerClass} px-6 py-4 flex justify-between items-center z-20 sticky top-[var(--navbar-height)] transition-all duration-300 overflow-hidden group/header`}
            >
                {/* Modern Specular Highlight & Glow Spotlight */}
                <div className={`absolute -left-12 -top-12 w-28 h-28 rounded-full blur-3xl pointer-events-none opacity-50 ${glassTheme.spotlightClass}`} />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/header:animate-shine pointer-events-none" />

                <h2 className={`text-xl font-black flex items-center gap-2.5 relative z-10 ${glassTheme.titleColor}`}>
                    <i className={`ph-fill ${glassTheme.iconClass} text-2xl`}></i>
                    <span>{subject.name} Tracker</span>
                </h2>
                
                <div className="flex items-center gap-3 relative z-10">
                    {/* Compact Glass Custom Chapter Add Button on right dead corner */}
                    <button 
                        onClick={() => setShowAddChapterModal(true)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-md ${glassTheme.badgeClass}`}
                        title="Add Custom Chapter"
                    >
                        <i className="ph-bold ph-plus text-xs"></i>
                    </button>

                    {/* Done Count Badge */}
                    <div className={`text-sm font-black px-3.5 py-1.5 rounded-xl backdrop-blur-md transition-all duration-300 hover:scale-105 cursor-pointer select-none ${glassTheme.badgeClass}`}>
                        {doneCount} / {subject.chapters.length} Done
                    </div>
                </div>
            </div>

            <div className="table-container overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-bold w-1/4">Chapter</th>
                            <th className="px-2 py-3 font-bold text-center border-l border-slate-700/30">Status</th>
                            <th className="px-2 py-3 font-bold text-center border-l border-slate-700/30">Lectures</th>
                            <th className="px-4 py-3 font-bold text-center border-l border-slate-700/30 bg-slate-800/30">Resources Tracking</th>
                            <th className="px-4 py-3 font-bold text-right border-l border-slate-700/30">Analysis</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {subject.chapters.map((chapter, cIdx) => {
                            const analysisScore = getChapterAnalysis(chapter);
                            const eff = getEffectiveStatusInfo(chapter);
                            const theme = getAccuracyTheme(analysisScore);
                            return (
                                <tr key={cIdx} id={`chapter-${sIdx}-${cIdx}`} className={`transition-all duration-300 group relative ${theme.rowClass}`}>
                                    <td className="px-4 py-3 font-semibold text-slate-300 flex items-center justify-between" title={chapter.name}>
                                        {/* Dynamic Rising Fill Animation with Sparkles and Crystals */}
                                        <div className="row-fill-container">
                                            <div className="row-fill-wave" />
                                            <i className={`ph-fill ph-diamond absolute text-[10px] pointer-events-none float-particle-1 ${theme.text} opacity-60 left-[10%]`} />
                                            <i className={`ph-fill ph-sparkle absolute text-[9px] pointer-events-none float-particle-2 ${theme.text} opacity-60 left-[30%]`} />
                                            <i className={`ph-fill ph-diamond absolute text-[8px] pointer-events-none float-particle-3 ${theme.text} opacity-60 left-[50%]`} />
                                            <i className={`ph-fill ph-sparkles absolute text-[11px] pointer-events-none float-particle-4 ${theme.text} opacity-60 left-[70%]`} />
                                            <i className={`ph-fill ph-diamond absolute text-[9px] pointer-events-none float-particle-5 ${theme.text} opacity-60 left-[85%]`} />
                                        </div>

                                        <div className="flex items-center min-w-0 flex-1 mr-2 relative z-10">
                                            <span className={`truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[220px] md:max-w-[320px] lg:max-w-[420px] xl:max-w-[550px] transition-all duration-300 relative group-hover:${theme.text}`}>
                                                {chapter.name}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
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
                                    <td className="px-2 py-3 border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                        <select value={chapter.status || 'None'} onChange={(e) => handleUpdate(sIdx, cIdx, 'status', e.target.value)} className={`text-xs font-bold rounded-full px-3 py-1 w-full text-center border cursor-pointer outline-none transition-all appearance-none ${eff.style} relative z-10`}>
                                            <option value="None" className="bg-slate-800 text-slate-300">To Do</option>
                                            <option value="Current" className="bg-slate-800 text-slate-300">Current</option>
                                            <option value="Under Revision" className="bg-slate-800 text-slate-300">Under Revision</option>
                                            <option value="Done" className="bg-slate-800 text-slate-300">Done</option>
                                        </select>
                                    </td>
                                    <td className="px-2 py-3 border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                        <div className="flex items-center justify-center gap-1 mx-auto w-20 bg-slate-900/80 border border-slate-700 rounded-full overflow-hidden shadow-inner p-0.5 relative z-10">
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
                                    
                                    <td className="px-4 py-3 border-l border-slate-700/20 bg-slate-800/10 text-center transition-all duration-300 group-hover:bg-transparent relative z-10">
                                        <button 
                                            onClick={() => openProgressModal(sIdx, cIdx)}
                                            className={`group/btn relative z-10 inline-flex items-center justify-center px-4 py-1.5 font-black text-xs text-white transition-all duration-300 ${theme.bg} ${theme.border} ${theme.glow} border rounded-xl hover:scale-[1.05] active:scale-[0.97] focus:outline-none shadow-md overflow-hidden cursor-pointer`}
                                        >
                                            <span className={`absolute inset-0 w-full h-full bg-gradient-to-r ${theme.shimmerBg} -translate-x-full group-hover/btn:animate-shine pointer-events-none`}></span>
                                            <span className="relative flex items-center gap-2">
                                                <i className={`ph-fill ph-fire ${theme.text} transition-colors text-sm group-hover/btn:scale-110 transition-transform`}></i>
                                                Log Progress
                                            </span>
                                        </button>
                                    </td>

                                    <td className="px-4 py-3 text-right font-bold border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                        {analysisScore > 0 ? (
                                            <span className={`px-2.5 py-1 rounded-lg transition-all duration-300 border relative z-10 ${
                                                analysisScore >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.25)] group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 
                                                analysisScore >= 60 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-[0_0_10px_rgba(234,179,8,0.25)] group-hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 
                                                'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.25)] group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                                            }`}>
                                                {analysisScore.toFixed(1)}%
                                            </span>
                                        ) : <span className="text-slate-600 font-normal relative z-10">-</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {/* Decorative rounded base spacer */}
            <div className="h-4 bg-slate-950/20 rounded-b-2xl border-t border-slate-800/10" />

            {/* Custom Chapter Add Popup Modal */}
            {showAddChapterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-pop-in relative">
                        {/* Themed background neon glow spotlight */}
                        <div className={`absolute -left-12 -top-12 w-24 h-24 rounded-full blur-3xl pointer-events-none opacity-30 ${glassTheme.spotlightClass}`} />
                        
                        <button 
                            onClick={() => {
                                setShowAddChapterModal(false);
                                setNewChapterName('');
                            }} 
                            className="absolute top-4 right-4 text-slate-450 hover:text-white transition-colors"
                        >
                            <i className="ph-bold ph-x text-lg"></i>
                        </button>
                        
                        <div className="mb-4">
                            <h3 className={`text-base font-black flex items-center gap-2 ${glassTheme.titleColor}`}>
                                <i className="ph-fill ph-plus-circle text-lg"></i>
                                Add Custom Chapter
                            </h3>
                            <p className="text-xs text-slate-450 mt-1">Create a custom syllabus tracker chapter inside {subject.name}.</p>
                        </div>
                        
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const name = newChapterName.trim();
                                if (name) {
                                    addChapter(sIdx, name);
                                    setNewChapterName('');
                                    setShowAddChapterModal(false);
                                }
                            }}
                            className="space-y-4"
                        >
                            <input 
                                type="text"
                                value={newChapterName}
                                onChange={e => setNewChapterName(e.target.value)}
                                placeholder="e.g. Kinetic Theory of Gases"
                                autoFocus
                                required
                                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                            />
                            
                            <div className="flex gap-2 justify-end">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowAddChapterModal(false);
                                        setNewChapterName('');
                                    }}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-750 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer ${
                                        subject.name.toLowerCase().includes('physic') ? 'bg-blue-600 hover:bg-blue-500' :
                                        subject.name.toLowerCase().includes('chem') ? 'bg-emerald-600 hover:bg-emerald-500' :
                                        subject.name.toLowerCase().includes('math') ? 'bg-rose-600 hover:bg-rose-500' :
                                        subject.name.toLowerCase().includes('biolog') ? 'bg-purple-600 hover:bg-purple-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                    }`}
                                >
                                    Create Chapter
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectTable;
