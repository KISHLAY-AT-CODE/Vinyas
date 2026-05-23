import React from 'react';

const StreakCalendar = ({ activities, streakInfo }) => {
    const { currentStreak, maxStreak, multiplier } = streakInfo || { currentStreak: 0, maxStreak: 0, multiplier: 1.0 };

    // 1. Calculate activity count for each of the last 28 days
    const activityCounts = {};
    const today = new Date();

    const getFormattedDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    if (Array.isArray(activities)) {
        activities.forEach(act => {
            if (act.timestamp) {
                const dateStr = getFormattedDate(new Date(act.timestamp));
                activityCounts[dateStr] = (activityCounts[dateStr] || 0) + 1;
            }
        });
    }

    // Generate last 28 days
    const days = [];
    for (let i = 27; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        days.push(d);
    }

    // Partition into 4 weeks of 7 days (for grid columns)
    const weeks = [];
    for (let w = 0; w < 4; w++) {
        const weekDays = [];
        for (let d = 0; d < 7; d++) {
            weekDays.push(days[w * 7 + d]);
        }
        weeks.push(weekDays);
    }

    const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    return (
        <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 relative overflow-hidden group">
            {/* Visual background icon */}
            <div className="absolute right-2 top-2 opacity-10 pointer-events-none drop-shadow-2xl">
                <i className="ph-fill ph-calendar text-[80px] text-emerald-400"></i>
            </div>

            <div className="relative z-10 flex flex-col">
                {/* Header */}
                <div className="w-full flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <i className="ph-fill ph-fire text-orange-500"></i>
                        Streak & Activity
                    </h2>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">
                        Multiplier: {multiplier.toFixed(1)}x
                    </span>
                </div>

                {/* Multipliers & Stats Row */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-slate-900 border border-slate-700/60 p-3 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-lg border border-orange-500/20">
                            🔥
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">CURRENT STREAK</span>
                            <span className="text-base font-black text-slate-200">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</span>
                        </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-700/60 p-3 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-lg border border-yellow-500/20">
                            👑
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase block leading-none">LONGEST STREAK</span>
                            <span className="text-base font-black text-slate-200">{maxStreak} {maxStreak === 1 ? 'day' : 'days'}</span>
                        </div>
                    </div>
                </div>

                {/* 28-day Activity Grid */}
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 flex flex-col items-center">
                    <div className="flex gap-3 items-center">
                        {/* Day names column */}
                        <div className="flex flex-col gap-1.5 justify-between text-[9px] font-bold text-slate-500 select-none">
                            <span>M</span>
                            <span>W</span>
                            <span>F</span>
                            <span>S</span>
                        </div>

                        {/* Weeks grid */}
                        <div className="flex gap-2">
                            {weeks.map((week, wIdx) => (
                                <div key={wIdx} className="flex flex-col gap-1.5">
                                    {week.map((date, dIdx) => {
                                        const dateStr = getFormattedDate(date);
                                        const count = activityCounts[dateStr] || 0;
                                        
                                        // Colors: HSL emerald tailored shades for premium look
                                        let colorClass = 'bg-slate-800 border-slate-700 hover:border-slate-500';
                                        if (count === 1) {
                                            colorClass = 'bg-emerald-950 border-emerald-900 hover:border-emerald-700';
                                        } else if (count === 2) {
                                            colorClass = 'bg-emerald-800 border-emerald-700 hover:border-emerald-500';
                                        } else if (count >= 3) {
                                            colorClass = 'bg-emerald-500 border-emerald-400 hover:border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.3)]';
                                        }

                                        return (
                                            <div
                                                key={dIdx}
                                                className={`w-3.5 h-3.5 rounded-sm border transition-all duration-300 hover:scale-110 cursor-pointer ${colorClass}`}
                                                title={`${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${count} ${count === 1 ? 'activity' : 'activities'}`}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Grid Legend */}
                    <div className="flex items-center justify-between w-full mt-4 text-[10px] text-slate-500 font-bold border-t border-slate-800/80 pt-3">
                        <span>Less active</span>
                        <div className="flex gap-1.5 items-center">
                            <div className="w-2.5 h-2.5 rounded-sm bg-slate-800 border border-slate-700" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-950 border border-emerald-900" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-800 border border-emerald-700" />
                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-400" />
                        </div>
                        <span>More active</span>
                    </div>
                </div>

                {/* Multplier Rule hint */}
                <div className="text-[10px] text-slate-500 text-center font-semibold mt-3 italic">
                    🔥 Maintain a 3-day streak for 1.2x XP, or 7-day for 1.5x XP!
                </div>
            </div>
        </div>
    );
};

export default StreakCalendar;
