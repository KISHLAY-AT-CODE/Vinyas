import React, { useState } from 'react';
import PomodoroTimer from './PomodoroTimer';
import SpacedRepetition from './SpacedRepetition';
import StreakCalendar from './StreakCalendar';

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
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl relative group animate-pop-in">
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <div className="flex gap-2 items-center mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 self-start">
                            {goal.time} • {goal.subject}
                        </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-200">{goal.title}</h3>
                </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 mb-3">
                {goal.faculty && <span className="flex items-center gap-1"><i className="ph-fill ph-user text-slate-500"></i> {goal.faculty}</span>}
                <span className={`flex items-center gap-1 ${goal.dppStatus === 'No DPP' ? 'text-rose-450' : 'text-emerald-450'}`}>
                    <i className="ph-fill ph-file-text"></i> {goal.dppStatus}
                </span>
            </div>

            {/* Selection Toggles */}
            <div className="flex gap-2 bg-slate-955 p-1 rounded-lg mb-3 border border-slate-800">
                <button
                    disabled={!goal.suggestLecture}
                    onClick={() => setIncludeLecture(!includeLecture)}
                    className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        !goal.suggestLecture ? 'opacity-30 cursor-not-allowed bg-slate-900/40 text-slate-650' :
                        includeLecture ? 'bg-blue-650/20 text-blue-400 border border-blue-500/35 shadow-sm shadow-blue-950/20' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-400'
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
                            includeDpp ? 'bg-indigo-650/20 text-indigo-400 border border-indigo-500/35 shadow-sm shadow-indigo-950/20' : 'bg-transparent text-slate-500 border border-transparent hover:text-slate-400'
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
                    className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs transition-colors border border-slate-750 shadow-sm cursor-pointer"
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

const GamifiedDashboard = ({ currentLevel, focusPoints, levelProgressPct, xpToNextLevel, routines, handleRoutineClick, calculateGlobalProgress, data, openMorningPlanner, openNightlyWrapUp, achievements, activities, cohort, suggestedGoals, handleSaveGoal, handleDiscardGoal, handleRemoveRoutine, openActivityConsole, syncId, onLogFocusTime, onUpdateChapter, streakInfo, onTriggerSpecificAchievement, requestConfirm }) => {
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

    return (
        <div className="xl:col-span-1 space-y-6">
            {/* Gamified Focus Points Matrix */}
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 relative overflow-hidden group">
                <div className="absolute right-2 top-2 opacity-20 pointer-events-none drop-shadow-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    <i className="ph-fill ph-fire text-[90px] text-fire"></i>
                </div>
                <div className="relative z-10">
                    <h2 className="text-lg font-bold text-slate-100 mb-1 flex items-center gap-2">
                        <i className="ph-fill ph-fire text-orange-500 mr-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]"></i>
                        {cohort ? cohort.toUpperCase() : 'EXAM'} Fire
                    </h2>
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
                    
                    <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden shadow-inner border border-slate-700/50 mt-4 relative">
                        <div 
                            className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-blue-500 via-red-500 to-yellow-400 shadow-[0_0_12px_rgba(249,115,22,0.8)]" 
                            style={{ width: `${levelProgressPct}%` }}
                        ></div>
                    </div>
                    <div className="text-[10px] text-right text-slate-500 mt-1 font-bold tracking-wider">{1000 - xpToNextLevel} XP to Level {currentLevel + 1}</div>
                </div>
            </div>

            {/* Global Progress */}
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-chart-pie text-bitsat-600 text-xl"></i> Overall Syllabus
                </h2>
                <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black text-slate-100">{calculateGlobalProgress()}%</span>
                    <span className="text-sm text-slate-400 font-medium mb-1">Completed</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3 mb-6 overflow-hidden shadow-inner">
                    <div className="bg-emerald-500 h-3 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${calculateGlobalProgress()}%` }}></div>
                </div>
                <div className="space-y-3 mb-2">
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

            {/* Streak Grid Calendar */}
            <StreakCalendar activities={activities} streakInfo={streakInfo} />

            {/* Suggested Goals (from PW Upcoming Events) */}
            {suggestedGoals && suggestedGoals.length > 0 && (
                <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 relative z-10">
                        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                            <i className="ph-fill ph-lightbulb text-yellow-500 text-xl"></i> Suggested Goals
                        </h2>
                        <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full font-bold">New</span>
                    </div>
                    <div className="space-y-3">
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
            )}

            {/* Daily Routine Workflow */}
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 flex flex-col relative overflow-hidden">
                <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <i className="ph-fill ph-calendar-check text-bitsat-500 text-xl"></i> Today's Plan
                    </h2>
                    <button 
                        onClick={openMorningPlanner}
                        className="w-8 h-8 rounded-full bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-400 flex items-center justify-center transition-all shadow-sm cursor-pointer"
                        title="Add to Plan"
                    >
                        <i className="ph-bold ph-plus"></i>
                    </button>
                </div>
                
                <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-[300px]">
                    {routines.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 font-medium text-sm border-2 border-dashed border-slate-700 rounded-xl">
                            Your day is empty.<br/>Click + to plan your workflows.
                        </div>
                    ) : routines.map((routine, i) => (
                        <div key={routine.id || i}
                            onClick={!routine.done ? () => openNightlyWrapUp(routine.id) : undefined}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 group relative overflow-hidden ${!routine.done ? 'cursor-pointer' : ''}
                                ${routine.done 
                                    ? 'bg-emerald-900/20 border-emerald-500/30' 
                                    : 'bg-slate-900/50 border-slate-700 hover:border-slate-500'}
                            `}
                        >
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveRoutine(routine.id); }}
                                className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-slate-800 z-10 cursor-pointer"
                                title="Remove Goal"
                            >
                                <i className="ph-bold ph-x text-xs"></i>
                            </button>
                            <div className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border transition-colors
                                ${routine.done ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-800 border-slate-600 group-hover:border-slate-400'}
                            `}>
                                {routine.done && <i className="ph-bold ph-check text-xs"></i>}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <span className={`text-sm font-black transition-colors ${routine.done ? 'text-emerald-400 line-through opacity-80' : 'text-slate-200'}`}>
                                        {routine.subjectName}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${routine.done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                        {routine.template}
                                    </span>
                                </div>
                                <span className={`block text-xs mt-0.5 transition-colors ${routine.done ? 'text-emerald-500/70' : 'text-slate-400'}`}>
                                    {routine.chapterName || routine.task}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {isNight && routines.filter(r => !r.done).length > 0 && (
                    <button 
                        onClick={() => openNightlyWrapUp()}
                        className="mt-4 w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center justify-center gap-2 relative z-10 animate-pulse-slow cursor-pointer"
                    >
                        <i className="ph-fill ph-moon-stars text-xl"></i> Nightly Wrap-up
                    </button>
                )}
            </div>

            {/* Pomodoro Focus Timer */}
            <PomodoroTimer data={data} syncId={syncId} onLogFocusTime={onLogFocusTime} />

            {/* Spaced Repetition Cards */}
            <SpacedRepetition data={data} syncId={syncId} onUpdateChapter={onUpdateChapter} requestConfirm={requestConfirm} />

            {/* Achievements Gallery */}
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6">
                <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <i className="ph-fill ph-medal text-yellow-500 text-xl"></i> Achievements
                </h2>
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
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-950/95 border border-slate-700 text-white rounded-xl shadow-2xl p-2.5 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 z-[100] backdrop-blur-md">
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

            {/* Activity Feed */}
            <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none transition-transform duration-500 group-hover:scale-110">
                    <i className="ph-fill ph-terminal-window text-[120px] text-blue-500"></i>
                </div>
                <h2 className="text-lg font-bold text-slate-100 mb-2 flex items-center gap-2 relative z-10">
                    <i className="ph-fill ph-terminal-window text-blue-500 text-xl"></i> Live Activity Console
                </h2>
                <p className="text-xs text-slate-400 mb-6 relative z-10">
                    Monitor real-time progress from the Chrome Extension.
                </p>
                <button 
                    onClick={() => openActivityConsole()}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-950 border border-slate-600 hover:border-blue-500 text-slate-200 hover:text-white font-bold rounded-xl shadow-inner transition-all flex items-center justify-center gap-2 relative z-10 group/btn cursor-pointer"
                >
                    <i className="ph-bold ph-broadcast text-blue-400 group-hover/btn:animate-pulse"></i> Open Live Console
                </button>
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
