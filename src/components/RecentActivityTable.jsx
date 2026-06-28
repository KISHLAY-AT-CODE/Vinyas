import React, { useMemo } from 'react';
import { getEffectiveStatusInfo, getAccuracyTheme, calculateChapterBreakdown, getSubjectGlassTheme } from './SubjectTable';

const RecentActivityTable = ({
    allSubjects = [],
    activities = [],
    handleUpdate,
    openLogModal,
    removeChapter,
    requestConfirm,
    openProgressModal,
    getChapterAnalysis,
    onSelectSubject,
    performanceMode = false
}) => {
    // Compute Recent Chapters (up to 5 recently modified chapters from EACH subject)
    const recentChapters = useMemo(() => {
        if (!allSubjects || allSubjects.length === 0) return [];

        const normalize = (name) => (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

        // Build a mapping of normalized chapter names to their latest activity timestamp
        const chapterLatestActivityMap = {};
        (activities || []).forEach(act => {
            if (!act.details) return;
            let rawChName = null;
            if (act.type === 'DPP_SCORE') {
                const title = act.details.title || '';
                if (act.details.quizType === 'DPP') {
                    rawChName = (title.split(/\s*-\s*/)[0] || '').trim();
                } else {
                    rawChName = act.details.chapterName || '';
                }
            } else {
                rawChName = act.details.chapterName || act.details.title || '';
            }

            const normName = normalize(rawChName);
            if (normName) {
                const timestamp = act.timestamp ? new Date(act.timestamp).getTime() : 0;
                if (!chapterLatestActivityMap[normName] || timestamp > chapterLatestActivityMap[normName].timestamp) {
                    chapterLatestActivityMap[normName] = {
                        timestamp,
                        type: act.type,
                        details: act.details
                    };
                }
            }
        });

        const resultChapters = [];

        // For each subject, grab all chapters, find their latestTime, sort them, take top 5
        allSubjects.forEach((sub, sIdx) => {
            const subChaptersWithTime = (sub.chapters || []).map((ch, cIdx) => {
                const normName = normalize(ch.name);
                const actData = chapterLatestActivityMap[normName];
                
                let latestTime = 0;
                let activityType = null;
                let activityLabel = '';

                if (actData) {
                    latestTime = actData.timestamp;
                    activityType = actData.type;
                    if (actData.type === 'DPP_SCORE') {
                        activityLabel = actData.details.quizType === 'DPP' ? 'DPP Submitted' : 'Module Submitted';
                    } else if (actData.type === 'VIDEO_PROGRESS') {
                        activityLabel = 'Lecture Logged';
                    } else if (actData.type === 'ASSIGNMENT_SUBMISSION') {
                        activityLabel = 'Assignment Submitted';
                    }
                }

                if (ch.lastModified) {
                    const manualTime = new Date(ch.lastModified).getTime();
                    if (manualTime > latestTime) {
                        latestTime = manualTime;
                        activityType = 'MANUAL';
                        activityLabel = 'Status Updated';
                    }
                }

                // Fallback for chapters that have progress but no timestamp yet (from legacy database/imports)
                if (latestTime === 0) {
                    const hasProgress = (ch.status && ch.status !== 'None') || 
                                       (parseInt(ch.lectures) || 0) > 0 || 
                                       (ch.dpp?.comp || 0) > 0 || 
                                       (ch.module?.comp || 0) > 0 ||
                                       (ch.assignments && ch.assignments.length > 0);
                    if (hasProgress) {
                        latestTime = 1; // Mark with low-priority default timestamp
                        activityType = 'LEGACY_PROGRESS';
                        activityLabel = 'Study Progress';
                    }
                }

                return {
                    chapter: ch,
                    sIdx,
                    cIdx,
                    subjectName: sub.name,
                    subjectColor: sub.color,
                    latestTime,
                    activityType,
                    activityLabel
                };
            });

            // Filter out chapters that have no activity at all (latestTime === 0)
            const activeChapters = subChaptersWithTime.filter(item => item.latestTime > 0);

            // Sort by latestTime descending
            activeChapters.sort((a, b) => b.latestTime - a.latestTime);

            // Take the 5 latest from this subject
            const top5ForSub = activeChapters.slice(0, 5);

            resultChapters.push(...top5ForSub);
        });

        // Finally, sort the combined cross-subject list by latestTime descending
        resultChapters.sort((a, b) => b.latestTime - a.latestTime);

        return resultChapters;
    }, [allSubjects, activities]);

    const glassTheme = getSubjectGlassTheme('indigo', 'Recent Activity', false);

    return (
        <div className="dynamic-glass-card shadow-2xl flex flex-col relative rounded-2xl transition-all duration-300">
            <div className={`${glassTheme.containerClass} px-6 py-4 flex justify-between items-center z-20 sticky top-0 transition-all duration-300 overflow-hidden group/header rounded-t-2xl`}>
                <div className={`absolute -left-12 -top-12 w-28 h-28 rounded-full blur-3xl pointer-events-none opacity-50 ${glassTheme.spotlightClass}`} />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/header:animate-shine pointer-events-none" />

                <div className="flex items-center gap-3 select-none relative z-10">
                    <h2 className={`text-xl font-black flex items-center gap-2.5 relative z-10 transition-all duration-300 ${glassTheme.titleColor}`}>
                        <i className="ph-fill ph-clock-counter-clockwise text-2xl"></i>
                        <span>Recent Activity</span>
                    </h2>
                </div>
            </div>

            {recentChapters.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/10 rounded-b-2xl border-t border-slate-800/40 flex flex-col items-center justify-center gap-3 px-4">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center text-slate-500 text-2xl shadow-inner">
                        <i className="ph-bold ph-calendar-blank"></i>
                    </div>
                    <p className="font-bold text-sm text-slate-400">No active prep logs found.</p>
                    <p className="text-xs text-slate-500 max-w-[280px]">Complete a DPP, watch video lectures, or update chapter status to populate your Recent Activity dashboard.</p>
                </div>
            ) : (
                <div className="table-container overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-bold w-1/4">Chapter</th>
                                <th className="px-2 py-3 font-bold text-center border-l border-slate-700/30">Status</th>
                                <th className="px-2 py-3 font-bold text-center border-l border-slate-700/30">Lectures</th>
                                <th className="px-4 py-3 font-bold text-center border-l border-slate-700/30 bg-slate-800/30">Resources Tracking</th>
                                <th className="px-4 py-3 font-bold text-center border-l border-slate-700/30">Analysis</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {recentChapters.map((item, index) => {
                                const { chapter, sIdx, cIdx, subjectName, subjectColor } = item;
                                const analysisScore = getChapterAnalysis(chapter);
                                const eff = getEffectiveStatusInfo(chapter);
                                const theme = getAccuracyTheme(analysisScore);

                                return (
                                    <tr key={`${sIdx}-${cIdx}`} id={`recent-chapter-${sIdx}-${cIdx}`} className={`transition-all duration-300 group relative ${theme.rowClass}`}>
                                        <td className="px-4 py-3 font-semibold text-slate-350 flex items-center justify-between" title={`${chapter.name} (${subjectName})`}>
                                            {!performanceMode && (
                                                <div className="row-fill-container">
                                                    <div className="row-fill-wave" />
                                                    <i className={`ph-fill ph-diamond absolute text-[10px] pointer-events-none float-particle-1 ${theme.text} opacity-60 left-[10%]`} />
                                                    <i className={`ph-fill ph-sparkle absolute text-[9px] pointer-events-none float-particle-2 ${theme.text} opacity-60 left-[30%]`} />
                                                    <i className={`ph-fill ph-diamond absolute text-[8px] pointer-events-none float-particle-3 ${theme.text} opacity-60 left-[50%]`} />
                                                    <i className={`ph-fill ph-sparkles absolute text-[11px] pointer-events-none float-particle-4 ${theme.text} opacity-60 left-[70%]`} />
                                                    <i className={`ph-fill ph-diamond absolute text-[9px] pointer-events-none float-particle-5 ${theme.text} opacity-60 left-[85%]`} />
                                                </div>
                                            )}

                                            <div className="flex flex-col min-w-0 flex-1 mr-2 relative z-10">
                                                <div className="flex items-center gap-2">
                                                    <span className={`truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[220px] md:max-w-[320px] lg:max-w-[420px] xl:max-w-[550px] transition-all duration-300 relative group-hover:${theme.text} font-bold text-slate-300`}>
                                                        {chapter.name}
                                                    </span>
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelectSubject && onSelectSubject(sIdx);
                                                        }}
                                                        className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer select-none"
                                                        title={`Click to switch to ${subjectName}`}
                                                    >
                                                        {subjectName}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] text-slate-500 font-normal mt-0.5">
                                                    {item.activityLabel}
                                                </span>
                                            </div>
                                            
                                            <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
                                                <button 
                                                    onClick={() => openLogModal(sIdx, cIdx, chapter.name, chapter.log)} 
                                                    className={`transition-colors focus:outline-none p-1 rounded hover:bg-slate-700 ${chapter.log ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-300'}`} 
                                                    title={chapter.log ? "Edit your Notes" : "Add prep notes for AI analysis"}
                                                >
                                                    <i className="ph-fill ph-notepad text-lg"></i>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        requestConfirm(
                                                            "Remove Chapter",
                                                            `Are you sure you want to remove "${chapter.name}"? This action is irreversible.`,
                                                            () => removeChapter(sIdx, cIdx)
                                                        );
                                                    }} 
                                                    className="transition-colors focus:outline-none p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400" 
                                                    title="Remove Chapter"
                                                >
                                                    <i className="ph-bold ph-trash text-lg"></i>
                                                </button>
                                            </div>

                                            {/* Segmented status bar at bottom of the row */}
                                            {(() => {
                                                const breakdown = calculateChapterBreakdown(chapter);
                                                    return (
                                                        <div className="absolute bottom-0 left-0 right-0 h-[3.5px] flex z-35 pointer-events-none overflow-hidden border-t border-slate-950/50">
                                                            {breakdown.correct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${breakdown.correct}%` }} />}
                                                            {breakdown.incorrect > 0 && <div className="bg-red-500 h-full" style={{ width: `${breakdown.incorrect}%` }} />}
                                                            {breakdown.notAttempted > 0 && <div className="bg-slate-700 h-full" style={{ width: `${breakdown.notAttempted}%` }} />}
                                                        </div>
                                                    );
                                            })()}
                                        </td>
                                        <td className="px-2 py-3 border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                            <select 
                                                value={chapter.status || 'None'} 
                                                onChange={(e) => handleUpdate(sIdx, cIdx, 'status', e.target.value)} 
                                                className={`text-xs font-bold rounded-full px-3 py-1 w-full text-center border cursor-pointer outline-none transition-all appearance-none ${eff.style} relative z-10`}
                                            >
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

                                        <td className="px-4 py-3 text-center font-bold border-l border-slate-700/20 transition-all duration-300 relative z-10">
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
            )}

            <div className="h-4 bg-slate-950/20 rounded-b-2xl border-t border-slate-800/10" />
        </div>
    );
};

export default RecentActivityTable;
