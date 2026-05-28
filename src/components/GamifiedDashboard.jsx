import React, { useState } from 'react';
import PomodoroTimer from './PomodoroTimer';
import SpacedRepetition from './SpacedRepetition';
import StreakCalendar from './StreakCalendar';
import { Reorder, motion, AnimatePresence } from 'framer-motion';

const TAB_CONFIG = {
    fire: {
        label: 'Focus Fire',
        icon: 'ph-bold ph-fire',
        activeIcon: 'ph-fill ph-fire',
        activeBg: 'bg-orange-500/10',
        activeText: 'text-orange-400',
        glowBorder: 'border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
        indicatorBg: 'bg-orange-500',
        hoverStyles: 'hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/30 hover:shadow-[0_0_15px_rgba(249,115,22,0.15)]',
        hoverAnimation: 'hover-wiggle'
    },
    syllabus: {
        label: 'Overall Syllabus',
        icon: 'ph-bold ph-chart-pie',
        activeIcon: 'ph-fill ph-chart-pie',
        activeBg: 'bg-violet-500/10',
        activeText: 'text-violet-455',
        glowBorder: 'border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]',
        indicatorBg: 'bg-violet-500',
        hoverStyles: 'hover:bg-violet-500/10 hover:text-violet-455 hover:border-violet-500/30 hover:shadow-[0_0_15px_rgba(139,92,246,0.15)]',
        hoverAnimation: 'hover-spin-slow'
    },
    streak: {
        label: 'Streak Grid',
        icon: 'ph-bold ph-calendar-blank',
        activeIcon: 'ph-fill ph-calendar',
        activeBg: 'bg-emerald-500/10',
        activeText: 'text-emerald-400',
        glowBorder: 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]',
        indicatorBg: 'bg-emerald-500',
        hoverStyles: 'hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]',
        hoverAnimation: 'hover-shake'
    },
    goals: {
        label: 'Suggested Goals',
        icon: 'ph-bold ph-lightbulb',
        activeIcon: 'ph-fill ph-lightbulb',
        activeBg: 'bg-yellow-500/10',
        activeText: 'text-yellow-455',
        glowBorder: 'border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
        indicatorBg: 'bg-yellow-500',
        hoverStyles: 'hover:bg-yellow-500/10 hover:text-yellow-455 hover:border-yellow-500/30 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]',
        hoverAnimation: 'hover-pulse-fast'
    },
    routine: {
        label: "Today's Plan",
        icon: 'ph-bold ph-calendar-check',
        activeIcon: 'ph-fill ph-calendar-check',
        activeBg: 'bg-blue-500/10',
        activeText: 'text-blue-400',
        glowBorder: 'border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]',
        indicatorBg: 'bg-blue-500',
        hoverStyles: 'hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]',
        hoverAnimation: 'hover-scale-up'
    },
    timer: {
        label: 'Focus Timer',
        icon: 'ph-bold ph-timer',
        activeIcon: 'ph-fill ph-timer',
        activeBg: 'bg-sky-500/10',
        activeText: 'text-sky-400',
        glowBorder: 'border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.15)]',
        indicatorBg: 'bg-sky-500',
        hoverStyles: 'hover:bg-sky-500/10 hover:text-sky-400 hover:border-sky-500/30 hover:shadow-[0_0_15px_rgba(14,165,233,0.15)]',
        hoverAnimation: 'hover-rotate-gear'
    },
    spaced: {
        label: 'Revision Scheduler',
        icon: 'ph-bold ph-repeat',
        activeIcon: 'ph-fill ph-repeat',
        activeBg: 'bg-purple-500/10',
        activeText: 'text-purple-400',
        glowBorder: 'border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
        indicatorBg: 'bg-purple-500',
        hoverStyles: 'hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]',
        hoverAnimation: 'hover-pulse-fast'
    },
    achievements: {
        label: 'Achievements',
        icon: 'ph-bold ph-medal',
        activeIcon: 'ph-fill ph-medal',
        activeBg: 'bg-amber-500/10',
        activeText: 'text-amber-455',
        glowBorder: 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]',
        indicatorBg: 'bg-amber-500',
        hoverStyles: 'hover:bg-amber-500/10 hover:text-amber-455 hover:border-amber-500/30 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]',
        hoverAnimation: 'hover-bounce-sm'
    }
};


const ActivityItem = ({ act, onSelect }) => {
    const isDpp = act.type === 'DPP_SCORE';
    const isVideo = act.type === 'VIDEO_PROGRESS';

    return (
        <div 
            className={`p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-start gap-3 transition-colors ${isDpp ? 'cursor-pointer hover:bg-slate-800' : ''}`}
            onClick={() => isDpp && onSelect(act)}
        >
            <div className="mt-0.5 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-lg border border-slate-600">
                {isVideo ? '🎥' : isDpp ? '📝' : '⚡'}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
                <div className="flex justify-between items-start">
                    <h4 className="text-sm font-bold text-slate-200 truncate">
                        {isDpp ? (act.details.quizType ? `${act.details.quizType} SUBMITTED` : 'DPP/MODULE SUBMITTED') : (act.details.title || act.type)}
                    </h4>
                    {isDpp && (
                        <i className="ph-bold ph-arrow-up-right text-slate-500 hover:text-blue-400 transition-colors"></i>
                    )}
                </div>
                
                <p className="text-xs text-slate-400 mt-1 truncate">
                    {isVideo ? `Watched ${act.details.currentTime} / ${act.details.duration} (${Math.round((act.details.currentTimeSeconds / act.details.durationSeconds) * 100) || 0}%)` : 
                     isDpp ? <span className="text-slate-300 font-medium truncate block">{act.details.title}</span> : 
                     JSON.stringify(act.details)}
                </p>
                
                <span className="text-[10px] text-slate-500 font-medium mt-2 block">
                    {new Date(act.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                </span>
            </div>
        </div>
    );
};

const SuggestedGoalCard = ({ goal, onDiscard, onSave }) => {
    const [includeLecture, setIncludeLecture] = React.useState(goal.suggestLecture);
    const [includeDpp, setIncludeDpp] = React.useState(goal.suggestDpp);

    return (
        <div className="bg-slate-955/40 border border-slate-800 p-4 rounded-xl relative group animate-pop-in transition-all duration-300 hover:border-yellow-500/25 hover:bg-slate-900/40 shadow-[0_0_15px_rgba(234,179,8,0.02)] hover:shadow-[0_0_20px_rgba(234,179,8,0.06)]">
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <div className="flex gap-2 items-center mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/80 self-start">
                            {goal.time} • {goal.subject}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">{goal.title}</h3>
                </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 mb-3">
                {goal.faculty && <span className="flex items-center gap-1"><i className="ph-fill ph-user text-slate-500"></i> {goal.faculty}</span>}
                <span className={`flex items-center gap-1 ${goal.dppStatus === 'No DPP' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    <i className="ph-fill ph-file-text"></i> {goal.dppStatus}
                </span>
            </div>

            {/* Selection Toggles */}
            <div className="flex gap-2 bg-slate-950/70 p-1 rounded-lg mb-3 border border-slate-850/80">
                <button
                    disabled={!goal.suggestLecture}
                    onClick={() => setIncludeLecture(!includeLecture)}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        !goal.suggestLecture ? 'opacity-30 cursor-not-allowed bg-slate-900/40 text-slate-650' :
                        includeLecture ? 'bg-blue-500/10 text-blue-450 border border-blue-500/25 shadow-sm shadow-blue-950/20' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-400'
                    }`}
                >
                    <i className={`ph-bold ${includeLecture ? 'ph-check-circle' : 'ph-circle'} text-xs`}></i>
                    Lecture
                </button>
                {goal.hasDpp && (
                    <button
                        disabled={!goal.suggestDpp}
                        onClick={() => setIncludeDpp(!includeDpp)}
                        className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            !goal.suggestDpp ? 'opacity-30 cursor-not-allowed bg-slate-900/40 text-slate-650' :
                            includeDpp ? 'bg-indigo-500/10 text-indigo-450 border border-indigo-500/25 shadow-sm shadow-indigo-950/20' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-400'
                        }`}
                    >
                        <i className={`ph-bold ${includeDpp ? 'ph-check-circle' : 'ph-circle'} text-xs`}></i>
                        DPP
                    </button>
                )}
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={onDiscard}
                    className="flex-1 py-2 rounded-lg bg-slate-950/30 hover:bg-slate-900/50 text-slate-400 hover:text-slate-350 font-bold text-xs transition-colors border border-slate-800/80 shadow-sm cursor-pointer"
                >
                    Discard
                </button>
                <button 
                    disabled={!includeLecture && !includeDpp}
                    onClick={() => onSave(includeLecture, includeDpp)}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-500 hover:to-indigo-600 text-white font-bold text-xs transition-all border border-blue-500 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Save to Plan
                </button>
            </div>
        </div>
    );
};

const GamifiedDashboard = ({ currentLevel, focusPoints, levelProgressPct, xpToNextLevel, routines, handleRoutineClick, calculateGlobalProgress, data, openMorningPlanner, openNightlyWrapUp, achievements, activities, cohort, suggestedGoals, handleSaveGoal, handleDiscardGoal, handleRemoveRoutine, syncId, onLogFocusTime, onUpdateChapter, streakInfo, onTriggerSpecificAchievement, requestConfirm, isCardHidden, handleToggleCardHidden, onTabChange, performanceMode = false }) => {
    const [selectedActivity, setSelectedActivity] = useState(null);
    
    // Filter out connection tests
    const visibleActivities = activities?.filter(a => a.type !== 'CONNECTION_TEST') || [];
    
    // Determine if it's currently night (6 PM to 4 AM)
    const currentHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            hourCycle: 'h23'
        }).format(new Date()),
        10
    );
    const isNight = currentHour >= 18 || currentHour < 4;

    const initialOrder = (() => {
        const saved = localStorage.getItem('vinyas_sidebar_order');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const expectedTabs = ['fire', 'syllabus', 'streak', 'goals', 'routine', 'timer', 'spaced', 'achievements'];
                    const filtered = parsed.filter(item => expectedTabs.includes(item));
                    const missing = expectedTabs.filter(item => !filtered.includes(item));
                    return [...filtered, ...missing];
                }
            } catch (e) {
                console.error("Error parsing sidebar order from localStorage", e);
            }
        }
        return ['fire', 'syllabus', 'streak', 'goals', 'routine', 'timer', 'spaced', 'achievements'];
    })();

    const [sidebarOrder, setSidebarOrder] = useState(initialOrder);
    
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('vinyas_active_sidebar_tab') || initialOrder[0] || 'fire';
    });
    // isCardHidden state and handleToggleCardHidden lifted to App.jsx

    const handleReorder = (newOrder) => {
        setSidebarOrder(newOrder);
        localStorage.setItem('vinyas_sidebar_order', JSON.stringify(newOrder));
    };

    const handleTabClick = (tabId) => {
        if (tabId !== activeTab && onTabChange) {
            onTabChange();
        }
        setActiveTab(tabId);
        localStorage.setItem('vinyas_active_sidebar_tab', tabId);
    };

    return (
        <div className={`relative transition-all duration-300 pl-14 xl:pl-0 ${isCardHidden ? 'xl:col-span-0 xl:absolute xl:w-0 xl:h-0 xl:overflow-hidden pointer-events-none h-16 xl:h-auto' : 'xl:col-span-1 w-full h-[480px] xl:h-auto'}`}>
            {/* Unified Fixed Y-Centered Wrapper (Dynamically offset under sticky navbar) */}
            <div className="fixed left-2 sm:left-4 top-[calc(var(--navbar-height)+16px)] z-40 flex items-center gap-2 sm:gap-4 pointer-events-none transition-all duration-300">
                {/* Reorderable Sidebar Dock */}
                <Reorder.Group
                    axis="y"
                    values={sidebarOrder}
                    onReorder={handleReorder}
                    className="flex flex-col gap-3 p-3 bg-slate-950/85 backdrop-blur-md border border-slate-800/85 rounded-2xl shrink-0 pointer-events-auto relative z-20 shadow-[0_0_30px_rgba(0,0,0,0.8),_inset_0_1px_1px_rgba(255,255,255,0.05)]"
                    style={{ touchAction: 'none' }}
                >
                    {sidebarOrder.map((id) => {
                        const config = TAB_CONFIG[id];
                        if (!config) return null;
                        const isActive = activeTab === id;
                        
                        return (
                            <Reorder.Item
                                key={id}
                                value={id}
                                className={`w-12 h-12 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-300 relative group
                                    ${isActive 
                                        ? `glass-card border border-white/20 bg-gradient-to-br from-white/10 to-slate-950/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_20px_rgba(255,255,255,0.08)] ${config.activeText} ${config.glowBorder}` 
                                        : `bg-transparent text-slate-455 border border-transparent ${config.hoverStyles || ''}`
                                    }
                                `}
                                whileDrag={performanceMode ? {} : { scale: 1.1, zIndex: 50 }}
                                onClick={() => handleTabClick(id)}
                            >
                                {/* Active Indicator Line */}
                                {isActive && (
                                    <motion.div 
                                        layoutId={performanceMode ? undefined : "activeIndicator"}
                                        className={`absolute left-0 w-1 h-6 rounded-r-full ${config.indicatorBg}`}
                                        transition={performanceMode ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
                                    />
                                )}
                                
                                {/* Icon */}
                                <i className={`${isActive ? config.activeIcon : config.icon} text-xl transition-transform duration-300 group-hover:scale-110 ${config.hoverAnimation || ''}`}></i>
                                
                                {/* Tooltip */}
                                <div className="absolute left-full ml-3 px-3 py-1.5 bg-slate-955/95 border border-slate-800 text-slate-200 font-bold text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 transform translate-x-1 group-hover:translate-x-0 z-[100] whitespace-nowrap shadow-xl">
                                    {config.label}
                                </div>
                            </Reorder.Item>
                        );
                    })}

                    {/* Unhide / Expand Button (Right Arrow at vertical Y-center) */}
                    {isCardHidden && (
                        <button 
                            onClick={() => handleToggleCardHidden(false)}
                            className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 rounded-full bg-slate-900 border border-slate-750 hover:border-slate-500 text-slate-400 hover:text-slate-200 flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-110 pointer-events-auto"
                            title="Expand Widget"
                        >
                            <i className="ph-bold ph-caret-right text-xs"></i>
                        </button>
                    )}
                </Reorder.Group>

                {/* Active Card Container (Centered relative to the sidebar wrapper) */}
                <AnimatePresence mode="wait">
                    {!isCardHidden && (
                        <motion.div
                            key={activeTab}
                            initial={performanceMode ? {} : { opacity: 0, x: -20 }}
                            animate={performanceMode ? {} : { opacity: 1, x: 0 }}
                            exit={performanceMode ? {} : { opacity: 0, x: -20 }}
                            transition={performanceMode ? { duration: 0 } : { duration: 0.2 }}
                            className="w-[calc(100vw-80px)] sm:w-[320px] pointer-events-auto z-10 relative"
                        >
                            <div className="relative w-full">
                                {/* Hide Button (Left Arrow at vertical Y-center) */}
                                <button 
                                    onClick={() => handleToggleCardHidden(true)}
                                    className="absolute -left-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 rounded-full bg-slate-900 border border-slate-750 hover:border-slate-500 text-slate-400 hover:text-slate-200 flex items-center justify-center shadow-md cursor-pointer transition-all hover:scale-110 pointer-events-auto"
                                    title="Hide Dashboard Widget"
                                >
                                    <i className="ph-bold ph-caret-left text-xs"></i>
                                </button>         

                            {activeTab === 'fire' && (
                                <div className="glass-card hover-fire p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%]">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent"></div>
                                    <div className="absolute right-2 top-2 opacity-20 pointer-events-none drop-shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                                        <i className="ph-fill ph-fire text-[90px] text-fire"></i>
                                    </div>
                                    
                                    <div className="relative z-10">
                                        <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4">
                                            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                                <i className="ph-fill ph-fire text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]"></i>
                                                {cohort ? cohort.toUpperCase() : 'EXAM'} Fire
                                            </h2>
                                            <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full tracking-wider">
                                                XP Matrix
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-400 mb-4 font-medium">Earn Focus Points by completing tasks.</p>
                                        
                                        <div className="flex items-end justify-between mb-2">
                                            <div>
                                                <div className="text-xs text-bitsat-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
                                                    <span>Level {currentLevel}</span>
                                                    {streakInfo?.multiplier > 1.0 && (
                                                        <span className="text-[9px] font-black px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded">
                                                            {streakInfo.multiplier}x Streak
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-4xl font-black text-slate-100 font-mono tracking-tight">{focusPoints.toLocaleString()} <span className="text-lg text-slate-500 font-semibold tracking-normal">XP</span></span>
                                            </div>
                                        </div>
                                        
                                        <div className="w-full bg-slate-955 rounded-full h-3 overflow-hidden shadow-inner border border-slate-800/80 mt-4 relative">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-blue-500 via-red-500 to-yellow-400 shadow-[0_0_12px_rgba(249,115,22,0.8)]" 
                                                style={{ width: `${levelProgressPct}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-[10px] text-right text-slate-500 mt-1.5 font-bold tracking-wider">{1000 - xpToNextLevel} XP to Level {currentLevel + 1}</div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'syllabus' && (
                                <div className="glass-card hover-syllabus p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%]">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent"></div>
                                    <div className="absolute right-2 top-2 opacity-10 pointer-events-none drop-shadow-2xl transition-transform duration-500 group-hover:scale-110">
                                        <i className="ph-fill ph-chart-pie text-[80px] text-violet-500"></i>
                                    </div>

                                    <div className="relative z-10">
                                        <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4">
                                            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                                <i className="ph-fill ph-chart-pie text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]"></i>
                                                Overall Syllabus
                                            </h2>
                                            <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-violet-500/10 text-violet-450 border border-violet-500/20 rounded-full tracking-wider">
                                                Global Syllabus
                                            </span>
                                        </div>

                                        <div className="flex items-end gap-2 mb-2">
                                            <span className="text-4xl font-black text-slate-100">{calculateGlobalProgress()}%</span>
                                            <span className="text-sm text-slate-400 font-medium mb-1">Completed</span>
                                        </div>
                                        
                                        <div className="w-full bg-slate-955 rounded-full h-3 mb-6 overflow-hidden shadow-inner border border-slate-800/80">
                                            <div className="bg-emerald-500 h-3 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${calculateGlobalProgress()}%` }}></div>
                                        </div>
                                        
                                        <div className="space-y-3 mb-2 bg-slate-950/45 p-3 rounded-xl border border-slate-850/50">
                                            {data.map((sub, i) => {
                                                const done = sub.chapters.filter(c => c.status === 'Done').length;
                                                const pct = Math.round((done / sub.chapters.length) * 100);
                                                return (
                                                    <div key={i} className="flex justify-between items-center text-sm">
                                                        <span className="font-semibold text-slate-400">{sub.name}</span>
                                                        <span className="font-bold text-slate-200">{pct}% ({done}/{sub.chapters.length})</span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                        {activeTab === 'streak' && (
                            <StreakCalendar activities={activities} streakInfo={streakInfo} />
                        )}

                        {activeTab === 'goals' && (
                            suggestedGoals && suggestedGoals.length > 0 ? (
                                <div className="glass-card hover-goals p-6 flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%] h-full">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent"></div>
                                    
                                    <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4 relative z-10 shrink-0">
                                        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                            <i className="ph-fill ph-lightbulb text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]"></i>
                                            Suggested Goals
                                        </h2>
                                        <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-yellow-500/10 text-yellow-455 border border-yellow-500/20 rounded-full tracking-wider">
                                            PW Recommendations
                                        </span>
                                    </div>

                                    <div className="space-y-3 relative z-10">
                                        {suggestedGoals.map(goal => (
                                            <SuggestedGoalCard 
                                                key={goal.id} 
                                                goal={goal} 
                                                onDiscard={() => handleDiscardGoal(goal.id, goal.hasDpp)} 
                                                onSave={(includeLec, includeDpp) => handleSaveGoal(goal, includeLec, includeDpp)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="glass-card hover-goals p-6 flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%]">
                                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent"></div>
                                    
                                    <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4 relative z-10">
                                        <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                            <i className="ph-fill ph-lightbulb text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]"></i>
                                            Suggested Goals
                                        </h2>
                                        <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-yellow-500/10 text-yellow-455 border border-yellow-500/20 rounded-full tracking-wider">
                                            PW Recommendations
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-center justify-center text-center py-10 px-4 relative z-10">
                                        <div className="w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-3xl mb-4 animate-pulse-slow">
                                            💡
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-200 mb-1">No Recommended Goals</h3>
                                        <p className="text-xs text-slate-400 max-w-[200px] leading-relaxed">
                                            All caught up! Check back later for personalized study suggestions.
                                        </p>
                                    </div>
                                </div>
                            )
                        )}

                        {activeTab === 'routine' && (
                            <div className="glass-card hover-routine p-6 flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%]">
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
                                <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                                
                                <div className="w-full flex justify-between items-center pb-3 border-b border-slate-800/60 mb-4 relative z-10">
                                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                        <i className="ph-fill ph-calendar-check text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"></i>
                                        Today's Plan
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full tracking-wider">
                                            Daily Routine
                                        </span>
                                        <button 
                                            onClick={openMorningPlanner}
                                            className="w-7 h-7 rounded-lg bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-400 flex items-center justify-center transition-all shadow-sm cursor-pointer"
                                            title="Add to Plan"
                                        >
                                            <i className="ph-bold ph-plus text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[300px] relative z-10">
                                    {routines.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 font-medium text-sm border border-slate-800/60 bg-slate-955/40 rounded-xl">
                                            Your day is empty.<br/>Click + to plan your workflows.
                                        </div>
                                    ) : routines.map((routine, i) => (
                                        <div key={routine.id || i}
                                            onClick={!routine.done ? () => openNightlyWrapUp(routine.id) : undefined}
                                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 group relative overflow-hidden ${!routine.done ? 'cursor-pointer' : ''}
                                                ${routine.done 
                                                    ? 'bg-emerald-950/20 border-emerald-500/20 hover:bg-emerald-955/30' 
                                                    : 'bg-slate-955/50 border-slate-800/80 hover:border-slate-700/80 hover:bg-slate-900/60'}
                                            `}
                                        >
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleRemoveRoutine(routine.id); }}
                                                className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-slate-800 z-10 cursor-pointer"
                                                title="Remove Goal"
                                            >
                                                <i className="ph-bold ph-x text-[10px]"></i>
                                            </button>
                                            <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors
                                                ${routine.done ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-955 border-slate-800 group-hover:border-slate-700'}
                                            `}>
                                                {routine.done && <i className="ph-bold ph-check text-xs"></i>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <span className={`text-sm font-black transition-colors truncate ${routine.done ? 'text-emerald-400 line-through opacity-80' : 'text-slate-200'}`}>
                                                        {routine.subjectName}
                                                    </span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${routine.done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-955 text-slate-455 border border-slate-800/85'}`}>
                                                        {routine.template}
                                                    </span>
                                                </div>
                                                <span className={`block text-xs mt-0.5 transition-colors truncate ${routine.done ? 'text-emerald-500/70' : 'text-slate-450'}`}>
                                                    {routine.chapterName || routine.task}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {isNight && routines.filter(r => !r.done).length > 0 && (
                                    <button 
                                        onClick={() => openNightlyWrapUp()}
                                        className="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all flex items-center justify-center gap-2 relative z-10 animate-pulse-slow cursor-pointer"
                                    >
                                        <i className="ph-fill ph-moon-stars text-xl"></i> Nightly Wrap-up
                                    </button>
                                )}
                            </div>
                        )}


                        {activeTab === 'timer' && (
                            <PomodoroTimer data={data} syncId={syncId} onLogFocusTime={onLogFocusTime} />
                        )}

                        {activeTab === 'spaced' && (
                            <SpacedRepetition data={data} syncId={syncId} onUpdateChapter={onUpdateChapter} requestConfirm={requestConfirm} />
                        )}

                        {activeTab === 'achievements' && (
                            <div className="glass-card hover-achievements p-6 relative overflow-visible group transition-all duration-300 hover:-translate-y-0.5 hover:scale-[100.5%]">
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"></div>
                                
                                <div className="w-full flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-slate-800/60 mb-4">
                                    <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                                        <i className="ph-fill ph-medal text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"></i>
                                        Achievements
                                    </h2>
                                    <span className="text-[10px] uppercase font-black px-2.5 py-0.5 bg-amber-500/10 text-amber-455 border border-amber-500/20 rounded-full tracking-wider whitespace-nowrap">
                                        Unlocked Gallery
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {(() => {
                                        const FALLBACK_ACHIEVEMENTS = [
                                            { id: 'syllabus_starter', title: 'Syllabus Starter', description: 'Began progress on your syllabus by completing some part of a chapter or DPP.', icon: '🚀', unlocked: false },
                                            { id: 'first_strike', title: 'First Strike', description: 'Logged your first mock test or practice log in the planner.', icon: '🎯', unlocked: false },
                                            { id: 'mock_master', title: 'Mock Master', description: 'Logged 5 or more mock tests or practice logs.', icon: '🏆', unlocked: false },
                                            { id: 'night_owl', title: 'Night Owl', description: 'Studied late at night between 12 AM and 4 AM IST.', icon: '🦉', unlocked: false },
                                            { id: 'early_bird', title: 'Early Bird', description: 'Studied early in the morning between 5 AM and 8 AM IST.', icon: '🌅', unlocked: false },
                                            { id: 'dpp_sniper', title: 'DPP Sniper', description: 'Achieved 100% completion on at least 3 DPPs.', icon: '🎯', unlocked: false },
                                            { id: 'module_conqueror', title: 'Module Conqueror', description: 'Achieved 100% completion on any interactive chapter module tracker.', icon: '👑', unlocked: false },
                                            { id: 'perfect_accuracy', title: 'Perfect Accuracy', description: 'Achieved 90%+ accuracy on any module or DPP.', icon: '🔥', unlocked: false },
                                            { id: 'consistent_scholar', title: 'Consistent Scholar', description: 'Completed 5 or more daily routines or plans.', icon: '📅', unlocked: false },
                                            { id: 'dpp_killer', title: 'DPP Killer', description: 'Submitted 3 DPPs or modules with above 85% accuracy in a single day.', icon: '💀', unlocked: false },
                                            { id: 'are_you_procrastinating', title: 'Are you procrastinating?', description: 'Fewer than 2 DPP or module uploads logged by 11 PM today.', icon: '🛌', unlocked: false },
                                            { id: 'sleeping_beauty', title: 'Sleeping Beauty', description: "Sleeping a bit much aren't you?", icon: '😴', unlocked: false },
                                            { id: 'dead_man_walking', title: 'Dead Man Walking', description: 'Logged active study sessions or quiz submissions during critical fatigue hours between 2 AM and 5 AM IST.', icon: '🧟', unlocked: false }
                                        ];
                                        const displayAchievements = (achievements && achievements.length > 0 ? achievements : FALLBACK_ACHIEVEMENTS).filter(ach => ach.unlocked);
                                        
                                        if (displayAchievements.length === 0) {
                                            return (
                                                <div className="text-xs text-slate-500 italic py-2 font-medium">
                                                    No achievements unlocked yet. Keep studying to unlock!
                                                </div>
                                            );
                                        }

                                        return displayAchievements.map((ach, i) => {
                                            return (
                                                <div 
                                                    key={i} 
                                                    onClick={() => onTriggerSpecificAchievement && onTriggerSpecificAchievement(ach.id)}
                                                    className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner group relative transition-all duration-300 border-2 bg-slate-900/90 border-yellow-500/70 shadow-[0_0_15px_rgba(234,179,8,0.25)] hover:border-yellow-400 hover:scale-105 hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] cursor-pointer"
                                                    title="Click to view achievement details"
                                                >
                                                    <span className="text-2xl transition-transform group-hover:scale-110 drop-shadow-md">
                                                        {ach.icon}
                                                    </span>
                                                    
                                                    {/* Premium Tooltip */}
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-955/95 border border-slate-700 text-white rounded-xl shadow-2xl p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-[100] backdrop-blur-md">
                                                        <div className="flex items-center gap-1.5 mb-1 font-bold text-xs">
                                                            <span className="text-sm">{ach.icon}</span>
                                                            <span className="text-yellow-400">{ach.title}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 leading-normal mb-1.5">{ach.description}</div>
                                                        <div className="text-[9px] border-t border-slate-800 pt-1.5 flex justify-between font-medium">
                                                            <span className="text-green-400">
                                                                ✓ Unlocked
                                                            </span>
                                                            {ach.unlockedAt && (
                                                                <span className="text-slate-500">{ach.unlockedAt}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            </div>

            {/* Activity Details Modal */}
            {selectedActivity && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedActivity(null)}>
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
                                    className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-colors cursor-pointer"
                                >
                                    <i className="ph-bold ph-x"></i>
                                </button>
                            </div>

                            <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-700">
                                <h3 className="text-sm font-bold text-slate-300 mb-1">Title</h3>
                                <p className="text-slate-100 font-medium leading-snug">{selectedActivity.details.title}</p>
                            </div>

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
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GamifiedDashboard;
