import React, { useState, useEffect, useMemo } from 'react';
import { normalizeChapterName } from '../shared/normalize.js';

const extractChapterFromDppTitle = (title) => {
    if (!title) return null;
    let cleaned = title.trim();

    // 1. Handle titles with colon/hyphen separator before DPP keyword, e.g. "Chapter - DPP 01" or "Chapter : DPP 01"
    if (/[:\-–—]\s*dpp/i.test(cleaned)) {
        const parts = cleaned.split(/[:\-–—]\s*dpp/i);
        if (parts.length > 1 && parts[0].trim().length > 0) {
            cleaned = parts[0].trim();
        }
    }

    // 2. Remove common prefixes: "DPP - ", "DPP-", "DPP "
    cleaned = cleaned.replace(/^DPP\s*[-–—:]?\s*/i, '').trim();

    // 3. Remove "DPP \d+" or "- DPP \d+" from the end
    cleaned = cleaned.replace(/\s*[-–—:]?\s*DPP\s*\d+.*$/i, '').trim();

    // 4. Remove trailing numbering like "#1", "(1)", etc.
    cleaned = cleaned.replace(/\s*[#(]?\d+[)]?\s*$/, '').trim();

    // 5. Remove trailing "MCQ Quiz" or "Quiz"
    cleaned = cleaned.replace(/\s+(?:MCQ\s+)?Quiz$/i, '').trim();

    // 6. Final cleanup of trailing hyphens/colons/spaces
    cleaned = cleaned.replace(/\s*[-–—:]\s*$/, '').trim();

    return cleaned || null;
};

const extractChapterFromModuleUrl = (url) => {
    if (!url) return null;
    const match = url.match(/chapterTitle=([^&]+)/);
    if (match) {
        let raw = match[1].replace(/\+/g, ' ');
        try {
            raw = decodeURIComponent(raw);
        } catch (e) {
            // fallback if decode fails
        }
        return raw.trim();
    }
    return null;
};

const hasDuplicateChaptersInSyllabus = (data, searchName) => {
    if (!data || !Array.isArray(data) || !searchName) return false;
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return false;
    
    // Priority 1: Exact matches
    const exactMatches = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            if (!data[sIdx].chapters[cIdx]) continue;
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized === qNormalized) {
                exactMatches.push({ sIdx, cIdx });
            }
        }
    }
    
    if (exactMatches.length > 1) {
        return true;
    }
    if (exactMatches.length === 1) {
        return false;
    }
    
    // Priority 2: Substring/fuzzy matches
    const candidates = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            if (!data[sIdx].chapters[cIdx]) continue;
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                candidates.push({
                    sIdx,
                    cIdx,
                    length: chNameNormalized.length
                });
            }
        }
    }
    
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        const maxLen = candidates[0].length;
        const topCandidates = candidates.filter(c => c.length === maxLen);
        return topCandidates.length > 1;
    }
    
    return false;
};

const ProgressModal = ({ 
    isOpen, 
    onClose, 
    chapterData, 
    chapterName,
    onSave,
    activities,
    onOpenTracker,
    data = []
}) => {
    // Local state for the modal
    const [activeTab, setActiveTab] = useState('dpp');
    const [comp, setComp] = useState(0);
    const [acc, setAcc] = useState(0);
    const [selectedActivity, setSelectedActivity] = useState(null);

    // Load initial values when tab or chapter changes
    useEffect(() => {
        if (chapterData && chapterData[activeTab]) {
            setComp(chapterData[activeTab].comp || 0);
            setAcc(chapterData[activeTab].acc || 0);
        } else {
            setComp(0);
            setAcc(0);
        }
    }, [activeTab, chapterData]);

    // Filter activities that match this chapter (deduplicated by activity ID)
    const chapterActivities = useMemo(() => {
        if (!activities || !chapterName) return [];
        const chNameNormalized = normalizeChapterName(chapterName);
        const seenIds = new Set();
        
        return activities.filter(act => {
            if (act.type !== 'DPP_SCORE') return false;
            // Deduplicate by ID
            if (seenIds.has(act.id)) return false;
            seenIds.add(act.id);
            
            // 1. Direct match by resolved ID inside chapterData.dppLogs or chapterData.moduleLogs
            const isDirectDppMatch = !!(chapterData && chapterData.dppLogs && chapterData.dppLogs[act.id]);
            const isDirectModuleMatch = !!(chapterData && chapterData.moduleLogs && chapterData.moduleLogs[act.id]);
            if (isDirectDppMatch || isDirectModuleMatch) {
                return true;
            }
            
            const details = act.details || {};
            
            // 2. Fuzzy match by DPP title or module URL chapter title param
            let chapterSearch = null;
            if (details.quizType === 'DPP') {
                chapterSearch = extractChapterFromDppTitle(details.title);
            } else if (details.quizType === 'MODULE') {
                chapterSearch = extractChapterFromModuleUrl(details.url);
            }
            
            if (chapterSearch) {
                // If the submitted chapter search maps to multiple chapters with the same name,
                // we ONLY allow showing this activity if it was directly matched/resolved to this chapter.
                if (hasDuplicateChaptersInSyllabus(data, chapterSearch)) {
                    return false;
                }

                const qNormalized = normalizeChapterName(chapterSearch);
                if (qNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                    return true;
                }
            }
            
            // 3. Fallback to basic substring matching
            // If the current chapter name has duplicates, skip fallback to avoid displaying duplicate-named activities.
            if (hasDuplicateChaptersInSyllabus(data, chapterName)) {
                return false;
            }

            const chNameLower = chapterName.toLowerCase().trim();
            if (details.title && details.title.toLowerCase().includes(chNameLower)) return true;
            
            return false;
        });
    }, [activities, chapterName, chapterData, data]);

    // Filter activities for the active tab
    const tabActivities = useMemo(() => {
        return chapterActivities.filter(act => {
            const quizType = act.details?.quizType || 'DPP';
            if (activeTab === 'dpp') {
                return quizType === 'DPP';
            } else {
                return quizType === 'MODULE';
            }
        });
    }, [chapterActivities, activeTab]);

    // Compute averages from detected activities
    const activityAverages = useMemo(() => {
        if (tabActivities.length === 0) return null;
        let totalAcc = 0, totalScore = 0, scoreCount = 0;
        let totalCorrect = 0, totalIncorrect = 0, ratioCount = 0;
        
        tabActivities.forEach(act => {
            const d = act.details || {};
            totalAcc += (d.accuracy || 0);
            if (d.score) {
                const parts = String(d.score).split('/').map(s => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > 0) {
                    totalScore += (parts[0] / parts[1]) * 100;
                    scoreCount++;
                }
            }
            if (d.correct !== undefined && d.incorrect !== undefined) {
                totalCorrect += parseInt(d.correct) || 0;
                totalIncorrect += parseInt(d.incorrect) || 0;
                ratioCount++;
            }
        });
        
        const count = tabActivities.length;
        return {
            avgAcc: Math.round(totalAcc / count),
            avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : null,
            totalCorrect,
            totalIncorrect,
            hasRatio: ratioCount > 0,
            count
        };
    }, [tabActivities]);

    const handleSave = () => {
        onSave(activeTab, { comp: parseInt(comp), acc: parseInt(acc) });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-animate">
            <div className="bg-slate-800/90 border border-slate-600 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] max-w-md w-full overflow-hidden backdrop-blur-xl max-h-[90vh] flex flex-col">
              <div className="overflow-y-auto custom-scrollbar flex-1">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-start relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Log Progress</h3>
                        <h2 className="text-xl font-black text-white leading-tight pr-8">{chapterName}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition-colors relative z-10">
                        <i className="ph-bold ph-x"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Tabs */}
                    <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl mb-8 border border-slate-700/50">
                        {['dpp', 'module', 'assignments'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 text-sm font-bold uppercase tracking-wider rounded-lg transition-all
                                    ${activeTab === tab ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'module' && (
                        <div className="mb-6 bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5 text-center flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-bitsat-500/10 border border-bitsat-500/20 flex items-center justify-center text-bitsat-400 mb-3 text-xl">
                                🎯
                            </div>
                            <h4 className="text-sm font-bold text-slate-200 mb-1">
                                Interactive Question Tracker
                            </h4>
                            <p className="text-xs text-slate-400 mb-4 max-w-[280px] mx-auto leading-relaxed">
                                Track completion status, difficulty, and bookmarks chapterwise. All progress is automatically synced to your cloud database.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenTracker();
                                    onClose();
                                }}
                                className="w-full py-3 bg-gradient-to-r from-bitsat-600 to-indigo-650 hover:from-bitsat-500 hover:to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-950/30 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="ph-bold ph-grid-nine text-sm"></i>
                                Open Interactive Tracker
                            </button>
                        </div>
                    )}

                    {activeTab === 'dpp' && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* Completion Stat Card */}
                            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-xl pointer-events-none"></div>
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-2">
                                    <i className="ph-bold ph-chart-pie-slice text-lg"></i>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Completion
                                </span>
                                <span className="text-3xl font-black text-white">
                                    {comp}%
                                </span>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                                    <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${comp}%` }}></div>
                                </div>
                            </div>

                            {/* Accuracy Stat Card */}
                            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                                    <i className="ph-bold ph-target text-lg"></i>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Avg Accuracy
                                </span>
                                <span className="text-3xl font-black text-white">
                                    {acc}%
                                </span>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${acc}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="space-y-3 mb-6">
                            {(!chapterData || !chapterData.assignments || chapterData.assignments.length === 0) ? (
                                <div className="text-center bg-slate-900/40 border border-slate-700/50 rounded-2xl p-8 flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3 text-lg">
                                        📄
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-300 mb-1">No Sync'd Assignments</h4>
                                    <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                                        Sync assignments automatically by opening assignment PDFs on PW batches.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {chapterData.assignments.map((assignment, idx) => (
                                        <div 
                                            key={idx} 
                                            className="p-4 bg-slate-950/40 border border-slate-700/50 rounded-2xl flex items-center justify-between gap-3 hover:bg-slate-900/60 hover:border-slate-600 transition-all backdrop-blur-md relative overflow-hidden"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 text-orange-400 text-base">
                                                    📄
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-slate-200 truncate pr-2" title={assignment.name}>
                                                        {assignment.name}
                                                    </h4>
                                                    <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]" title={assignment.url}>
                                                        {assignment.url}
                                                    </p>
                                                </div>
                                            </div>
                                            <a 
                                                href={assignment.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className="py-2 px-3 bg-gradient-to-r from-orange-600 to-red-650 hover:from-orange-500 hover:to-red-600 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-orange-950/20"
                                            >
                                                <i className="ph-bold ph-arrow-square-out text-sm"></i>
                                                Open
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chapter-Specific Activity Feed with Averages */}
                    {tabActivities.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="ph-fill ph-activity text-sm"></i>
                                Detected {activeTab === 'dpp' ? 'DPP' : 'Module'} Activity ({tabActivities.length})
                            </h4>

                            {/* Average Stats */}
                            {activityAverages && (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {/* Correct : Incorrect ratio */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Correct / Wrong</span>
                                        {activityAverages.hasRatio ? (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-lg font-black text-emerald-400">{activityAverages.totalCorrect}</span>
                                                <span className="text-sm font-bold text-slate-500">/</span>
                                                <span className="text-lg font-black text-rose-400">{activityAverages.totalIncorrect}</span>
                                            </div>
                                        ) : (
                                            <span className="text-lg font-black text-slate-500">N/A</span>
                                        )}
                                    </div>
                                    {/* Avg Accuracy */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Avg Acc</span>
                                        <span className={`text-lg font-black ${activityAverages.avgAcc > 80 ? 'text-emerald-400' : activityAverages.avgAcc > 50 ? 'text-amber-400' : 'text-rose-400'}`}>{activityAverages.avgAcc}%</span>
                                        <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${activityAverages.avgAcc > 80 ? 'bg-emerald-500' : activityAverages.avgAcc > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${activityAverages.avgAcc}%` }}></div>
                                        </div>
                                    </div>
                                    {/* Avg Score */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Avg Score</span>
                                        <span className="text-lg font-black text-blue-400">{activityAverages.avgScore !== null ? `${activityAverages.avgScore}%` : 'N/A'}</span>
                                        {activityAverages.avgScore !== null && (
                                            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${activityAverages.avgScore}%` }}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Activity Items (clickable) */}
                            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                {tabActivities.map((act, i) => {
                                    const d = act.details || {};
                                    const isDpp = d.quizType === 'DPP';
                                    return (
                                        <div 
                                            key={act.id || i} 
                                            className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-slate-800 transition-colors"
                                            onClick={() => setSelectedActivity(act)}
                                        >
                                            <div className="mt-0.5 w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-sm border border-slate-600">
                                                {isDpp ? '📝' : '⚡'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDpp ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {d.quizType || 'SCORE'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                        {new Date(act.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {d.url && (
                                                        <a 
                                                            href={d.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 hover:underline ml-auto"
                                                            title={`Go to PW ${d.quizType || 'DPP'}`}
                                                        >
                                                            <i className="ph-bold ph-link"></i> Open PW
                                                        </a>
                                                    )}
                                                    {!d.url && <i className="ph-bold ph-arrow-up-right text-slate-500 text-xs ml-auto"></i>}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-slate-400">Acc: <span className={`font-bold ${d.accuracy > 80 ? 'text-emerald-400' : d.accuracy > 50 ? 'text-amber-400' : 'text-rose-400'}`}>{d.accuracy}%</span></span>
                                                    <span className="text-slate-400">Comp: <span className="font-bold text-slate-200">{d.completion}%</span></span>
                                                    {d.score && <span className="text-slate-400">Score: <span className="font-bold text-blue-400">{d.score}</span></span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
              </div>

                {/* Footer */}
                <div className="p-6 pt-3 pb-5 border-t border-slate-700/50 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] transition-all flex items-center justify-center gap-2"
                    >
                        <i className="ph-bold ph-check-circle"></i> Close
                    </button>
                </div>
            </div>

            {/* Activity Details Popup (same style as GamifiedDashboard) */}
            {selectedActivity && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedActivity(null)}>
                    <div 
                        className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-100">{selectedActivity.details.quizType || 'Activity'} Details</h2>
                                    <p className="text-sm text-slate-400 mt-1">{new Date(selectedActivity.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedActivity(null)}
                                    className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                                >
                                    <i className="ph-bold ph-x"></i>
                                </button>
                            </div>

                            <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-700">
                                <h3 className="text-sm font-bold text-slate-300 mb-1">Title</h3>
                                <p className="text-slate-100 font-medium leading-snug">{selectedActivity.details.title}</p>
                            </div>

                            {selectedActivity.details.url && (
                                <div className="mb-6">
                                    <a 
                                        href={selectedActivity.details.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                                    >
                                        <i className="ph-bold ph-link-simple"></i> Open PW Specific {selectedActivity.details.quizType || 'DPP'}
                                    </a>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Score</span>
                                    <span className="text-2xl font-black text-blue-400">{selectedActivity.details.score || 'N/A'}</span>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Accuracy</span>
                                    <span className={`text-2xl font-black ${selectedActivity.details.accuracy > 80 ? 'text-emerald-400' : selectedActivity.details.accuracy > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                        {selectedActivity.details.accuracy}%
                                    </span>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Correct</span>
                                    <span className="text-xl font-bold text-emerald-400">{selectedActivity.details.correct || 'N/A'}</span>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Incorrect</span>
                                    <span className="text-xl font-bold text-rose-400">{selectedActivity.details.incorrect || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-slate-900 px-5 py-4 rounded-xl border border-slate-700">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Time Taken</span>
                                    <span className="font-mono text-slate-300 font-bold">{selectedActivity.details.timeTaken || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-700"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Completion</span>
                                    <span className="text-slate-300 font-bold">{selectedActivity.details.completion}%</span>
                                </div>
                            </div>

                            {/* Action Buttons for Activity Details */}
                            <div className="mt-6">
                                <button 
                                    onClick={() => setSelectedActivity(null)}
                                    className="w-full py-3.5 bg-slate-700/50 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-sm border border-slate-600/50"
                                >
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressModal;
