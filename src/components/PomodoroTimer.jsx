import React, { useState, useEffect, useRef } from 'react';
import { useToast } from './ToastContext';

const PomodoroTimer = ({ data, syncId, onLogFocusTime }) => {
    const { showToast } = useToast();
    const [duration, setDuration] = useState(25); // in minutes
    const [timeLeft, setTimeLeft] = useState(25 * 60); // in seconds
    const [isRunning, setIsRunning] = useState(false);
    const [selectedSubjectIdx, setSelectedSubjectIdx] = useState(0);
    const [selectedChapterIdx, setSelectedChapterIdx] = useState(0);

    const timerRef = useRef(null);
    const hasData = Array.isArray(data) && data.length > 0;
    const subject = hasData ? (data[selectedSubjectIdx] || data[0]) : null;
    const chapters = subject?.chapters || [];
    const activeChapter = chapters[selectedChapterIdx] || chapters[0];

    // Reset timer when duration changes
    useEffect(() => {
        setTimeLeft(duration * 60);
        setIsRunning(false);
        if (timerRef.current) clearInterval(timerRef.current);
    }, [duration]);

    // Timer logic
    useEffect(() => {
        if (isRunning) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        setIsRunning(false);
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRunning, selectedSubjectIdx, selectedChapterIdx]);

    const playBeep = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
            gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start();
            osc.stop(audioCtx.currentTime + 1.2); // play for 1.2 seconds
        } catch (e) {
            console.error("Failed to play notification audio:", e);
        }
    };

    const handleTimerComplete = async () => {
        playBeep();
        
        const focusMinutes = duration;
        const earnedXP = focusMinutes * 2;
        
        if (hasData && subject && activeChapter) {
            // Update parent state
            onLogFocusTime(selectedSubjectIdx, selectedChapterIdx, focusMinutes);
            
            // Log to database serverless activity endpoint
            if (syncId) {
                try {
                    await fetch('/api/activity', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            syncId,
                            type: 'FOCUS_SESSION',
                            details: {
                                title: `Focused on ${activeChapter.name}`,
                                subject: subject.name,
                                durationMinutes: focusMinutes,
                                pointsEarned: earnedXP
                            },
                            timestamp: new Date().toISOString()
                        })
                    });
                } catch (err) {
                    console.error("Failed to log focus activity to server:", err);
                }
            }
        }
        
        showToast(`🎉 Focus session completed! You earned ${earnedXP} Focus Points! Take a short break.`, 'success');
        setTimeLeft(duration * 60);
    };

    const toggleTimer = () => {
        setIsRunning(!isRunning);
    };

    const resetTimer = () => {
        setIsRunning(false);
        setTimeLeft(duration * 60);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const progressPct = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

    return (
        <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 p-6 relative overflow-hidden group">
            <div className="absolute right-2 top-2 opacity-10 pointer-events-none drop-shadow-2xl">
                <i className="ph-fill ph-timer text-[80px] text-blue-400"></i>
            </div>
            
            <div className="relative z-10 flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <i className="ph-fill ph-hourglass text-blue-400"></i>
                        Focus Timer
                    </h2>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                        Pomodoro
                    </span>
                </div>

                {/* Topic Selector */}
                {hasData && (
                    <div className="w-full mb-4 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <select 
                                value={selectedSubjectIdx}
                                onChange={(e) => { setSelectedSubjectIdx(parseInt(e.target.value)); setSelectedChapterIdx(0); }}
                                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2 outline-none focus:border-blue-500 cursor-pointer w-full font-bold"
                            >
                                {data.map((sub, idx) => (
                                    <option key={idx} value={idx}>{sub.name}</option>
                                ))}
                            </select>

                            <select 
                                value={selectedChapterIdx}
                                onChange={(e) => setSelectedChapterIdx(parseInt(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-2 outline-none focus:border-blue-500 cursor-pointer w-full font-bold"
                            >
                                {chapters.map((ch, idx) => (
                                    <option key={idx} value={idx}>{ch.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* Timer Display */}
                <div className="relative w-36 h-36 flex items-center justify-center my-2">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="#1e293b" strokeWidth="6" />
                        <circle 
                            cx="50" cy="50" r="44" fill="none" stroke="#3b82f6" 
                            className="transition-all duration-300 ease-out" 
                            strokeWidth="6" 
                            strokeDasharray="276.4" 
                            strokeDashoffset={276.4 - (276.4 * progressPct) / 100} 
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-100 font-mono tracking-tighter">
                            {formatTime(timeLeft)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            {isRunning ? 'FOCUSING' : 'PAUSED'}
                        </span>
                    </div>
                </div>

                {/* Duration Shortcuts */}
                <div className="flex gap-1.5 justify-center mb-5 w-full">
                    {[5, 15, 25, 50].map((t) => (
                        <button
                            key={t}
                            onClick={() => setDuration(t)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${duration === t ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-slate-900/50 text-slate-400 border-slate-700 hover:bg-slate-800'}`}
                        >
                            {t}m
                        </button>
                    ))}
                </div>

                {/* Controls */}
                <div className="flex gap-3 w-full">
                    <button
                        onClick={toggleTimer}
                        className={`flex-1 py-3 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${isRunning ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30'}`}
                    >
                        <i className={`ph-bold ${isRunning ? 'ph-pause' : 'ph-play'}`}></i>
                        {isRunning ? 'Pause' : 'Start'}
                    </button>
                    <button
                        onClick={resetTimer}
                        className="px-4 py-3 bg-slate-900 hover:bg-slate-950 text-slate-400 hover:text-white border border-slate-700 rounded-xl transition-all"
                        title="Reset Timer"
                    >
                        <i className="ph-bold ph-arrow-counter-clockwise"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PomodoroTimer;
