import React, { useState } from 'react';

const getISTISOString = (date = new Date()) => {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(d.getTime() + tzOffset);
    return istDate.toISOString().replace('Z', '+05:30');
};

const SpacedRepetition = ({ data, syncId, onUpdateChapter, requestConfirm }) => {
    const [activeCardIdx, setActiveCardIdx] = useState(0);
    const [showOptions, setShowOptions] = useState(false);

    // 1. Gather all chapters that are 'Done' or 'Under Revision'
    const reviewQueue = [];
    const now = new Date();

    if (Array.isArray(data)) {
        data.forEach((sub, sIdx) => {
            if (sub.chapters && Array.isArray(sub.chapters)) {
                sub.chapters.forEach((ch, cIdx) => {
                    if (ch.status === 'Done' || ch.status === 'Under Revision') {
                        const hasReviewDate = !!ch.nextReview;
                        const isDue = !hasReviewDate || new Date(ch.nextReview) <= now;
                        reviewQueue.push({
                            sIdx,
                            cIdx,
                            subjectName: sub.name,
                            subjectColor: sub.color || 'bg-blue-600',
                            chapter: ch,
                            isDue,
                            nextReviewDate: ch.nextReview ? new Date(ch.nextReview) : null
                        });
                    }
                });
            }
        });
    }

    // Sort reviewQueue: Due items first, then upcoming reviews ordered by date
    const sortedQueue = reviewQueue.sort((a, b) => {
        if (a.isDue && !b.isDue) return -1;
        if (!a.isDue && b.isDue) return 1;
        if (a.nextReviewDate && b.nextReviewDate) {
            return a.nextReviewDate - b.nextReviewDate;
        }
        return 0;
    });

    const dueCount = sortedQueue.filter(item => item.isDue).length;
    const totalScheduled = sortedQueue.length;

    // Reset card index if out of bounds
    const activeItem = sortedQueue[activeCardIdx] || sortedQueue[0] || null;

    const handleRateRecall = async (rating) => {
        if (!activeItem) return;

        const { sIdx, cIdx, chapter, subjectName } = activeItem;
        
        // Define intervals based on rated recall strength:
        // 1 = Again (1 day)
        // 2 = Hard (3 days)
        // 3 = Good (7 days)
        // 4 = Easy (14 days)
        let intervalDays = 1;
        let ratingText = 'Again';
        let ratingColor = 'text-rose-400';

        if (rating === 2) {
            intervalDays = 3;
            ratingText = 'Hard';
            ratingColor = 'text-amber-400';
        } else if (rating === 3) {
            intervalDays = 7;
            ratingText = 'Good';
            ratingColor = 'text-sky-400';
        } else if (rating === 4) {
            intervalDays = 14;
            ratingText = 'Easy';
            ratingColor = 'text-emerald-400';
        }

        // Create a date in IST, add intervalDays, and set to midnight in IST
        const getISTMidnightDate = (interval = 0) => {
            const d = new Date();
            const tzOffset = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(d.getTime() + tzOffset);
            istDate.setDate(istDate.getDate() + interval);
            istDate.setUTCHours(0, 0, 0, 0);
            return new Date(istDate.getTime() - tzOffset);
        };
        const nextDate = getISTMidnightDate(intervalDays);

        const updatedFields = {
            nextReview: getISTISOString(nextDate),
            reviewsDone: (chapter.reviewsDone || 0) + 1,
            lastReviewRating: ratingText
        };

        // Update local state in App
        onUpdateChapter(sIdx, cIdx, updatedFields);

        // Post activity to backend
        if (syncId) {
            try {
                await fetch('/api/activity', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        syncId,
                        type: 'REVISION_LOG',
                        details: {
                            title: `Reviewed: ${chapter.name}`,
                            subject: subjectName,
                            rating: ratingText,
                            nextReview: nextDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
                            pointsEarned: 15
                        },
                        timestamp: getISTISOString()
                    })
                });
            } catch (err) {
                console.error("Failed to log spaced repetition to server:", err);
            }
        }

        // Auto collapse / proceed
        setShowOptions(false);
        if (activeCardIdx >= dueCount - 1) {
            setActiveCardIdx(0);
        }
    };

    return (
        <div className="glass-card hover-spaced p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%]">
            {/* Accent lighting divider top header */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/20 to-transparent"></div>
            {/* Visual background icon */}
            <div className="absolute right-2 top-2 opacity-10 pointer-events-none drop-shadow-2xl transition-transform duration-500 group-hover:scale-110">
                <i className="ph-fill ph-brain text-[80px] text-purple-400"></i>
            </div>

            <div className="relative z-10 flex flex-col">
                {/* Header */}
                <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4">
                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                        <i className="ph-fill ph-brain text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"></i>
                        Revision Scheduler
                    </h2>
                    <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full tracking-wider">
                        Spaced Repetition
                    </span>
                </div>

                {/* Queue Summary */}
                <div className="flex gap-4 items-center justify-between mb-4 bg-slate-950/45 rounded-xl p-3 border border-slate-800/80 transition-colors group-hover:bg-slate-950/60">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">DUE REVIEWS</span>
                        <span className={`text-2xl font-black ${dueCount > 0 ? 'text-purple-400' : 'text-slate-400'}`}>
                            {dueCount}
                        </span>
                    </div>
                    <div className="w-px h-8 bg-slate-850"></div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SCHEDULED</span>
                        <span className="text-2xl font-black text-slate-300">
                            {totalScheduled}
                        </span>
                    </div>
                </div>

                {/* Active Card */}
                {activeItem ? (
                    <div className="bg-slate-955/50 border border-slate-805/85 rounded-xl p-4 flex flex-col min-h-[160px] justify-between transition-all hover:bg-slate-900/40">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-white ${activeItem.subjectColor}`}>
                                    {activeItem.subjectName}
                                </span>
                                <div className="flex items-center gap-2">
                                    {activeItem.isDue ? (
                                        <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1 animate-pulse">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                            Overdue / Due Today
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-slate-500">
                                            Next: {activeItem.nextReviewDate ? activeItem.nextReviewDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}
                                        </span>
                                    )}
                                    <button 
                                        onClick={() => {
                                            requestConfirm(
                                                "Remove from Revision Queue",
                                                `Are you sure you want to remove "${activeItem.chapter.name}" from the revision queue? This will reset its status to To Do.`,
                                                () => {
                                                    onUpdateChapter(activeItem.sIdx, activeItem.cIdx, { 
                                                        status: 'None', 
                                                        nextReview: null, 
                                                        lastReviewRating: null 
                                                    });
                                                    if (activeCardIdx > 0 && activeCardIdx >= sortedQueue.length - 1) {
                                                        setActiveCardIdx(prev => prev - 1);
                                                    }
                                                }
                                            );
                                        }}
                                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center cursor-pointer"
                                        title="Remove from revision queue"
                                    >
                                        <i className="ph-bold ph-trash text-sm"></i>
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-base font-black text-slate-200 leading-snug tracking-tight mb-2">
                                {activeItem.chapter.name}
                            </h3>
                            {activeItem.chapter.lastReviewRating && (
                                <p className="text-[11px] text-slate-500 font-bold">
                                    Last recall: <span className="text-purple-400 font-black">{activeItem.chapter.lastReviewRating}</span>
                                </p>
                            )}
                        </div>

                        {/* Interactive Recall Action */}
                        <div className="mt-4">
                            {!showOptions ? (
                                <button
                                    onClick={() => setShowOptions(true)}
                                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                                >
                                    <i className="ph-bold ph-eye"></i>
                                    Show Recall Strength
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleRateRecall(1)}
                                            className="py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/60 font-bold text-xs rounded-lg transition-colors flex flex-col items-center"
                                        >
                                            <span className="font-black text-sm">Again</span>
                                            <span className="text-[9px] text-rose-500">1d interval</span>
                                        </button>
                                        <button
                                            onClick={() => handleRateRecall(2)}
                                            className="py-2 bg-amber-950/40 hover:bg-amber-900/60 text-amber-400 border border-amber-900/60 font-bold text-xs rounded-lg transition-colors flex flex-col items-center"
                                        >
                                            <span className="font-black text-sm">Hard</span>
                                            <span className="text-[9px] text-amber-500">3d interval</span>
                                        </button>
                                        <button
                                            onClick={() => handleRateRecall(3)}
                                            className="py-2 bg-sky-950/40 hover:bg-sky-900/60 text-sky-400 border border-sky-900/60 font-bold text-xs rounded-lg transition-colors flex flex-col items-center"
                                        >
                                            <span className="font-black text-sm">Good</span>
                                            <span className="text-[9px] text-sky-500">7d interval</span>
                                        </button>
                                        <button
                                            onClick={() => handleRateRecall(4)}
                                            className="py-2 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/60 font-bold text-xs rounded-lg transition-colors flex flex-col items-center"
                                        >
                                            <span className="font-black text-sm">Easy</span>
                                            <span className="text-[9px] text-emerald-500">14d interval</span>
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowOptions(false)}
                                        className="w-full py-1 text-slate-500 hover:text-slate-300 font-bold text-[10px] text-center"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="border-2 border-dashed border-slate-700/70 rounded-xl p-6 text-center text-slate-500 flex flex-col items-center justify-center min-h-[160px]">
                        <i className="ph ph-sparkles text-3xl text-slate-600 mb-2"></i>
                        <p className="text-xs font-semibold leading-relaxed">
                            No chapters marked for review yet.<br/>
                            Mark chapters as <span className="text-emerald-400 font-bold">"Done"</span> or <span className="text-purple-400 font-bold">"Under Revision"</span> to automatically schedule revision workflows.
                        </p>
                    </div>
                )}

                {/* Queue Navigation (only if dueCount > 1) */}
                {dueCount > 1 && !showOptions && (
                    <div className="flex justify-between items-center mt-3 text-xs text-slate-400 font-bold px-1">
                        <span>Card {activeCardIdx + 1} of {dueCount}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveCardIdx(prev => (prev === 0 ? dueCount - 1 : prev - 1))}
                                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300"
                            >
                                <i className="ph-bold ph-arrow-left"></i>
                            </button>
                            <button
                                onClick={() => setActiveCardIdx(prev => (prev === dueCount - 1 ? 0 : prev + 1))}
                                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300"
                            >
                                <i className="ph-bold ph-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpacedRepetition;
