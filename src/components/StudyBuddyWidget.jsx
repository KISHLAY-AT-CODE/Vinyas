import React, { useState } from 'react';
import { generateGeminiContent } from '../services/gemini';
import { getEffectiveStatusInfo } from './SubjectTable';

// --- Modular AI Actions Configuration ---
const AI_ACTIONS = [
    {
        id: 'mock_analysis',
        icon: '🎯',
        label: 'Analyze Mock Tests',
        description: 'Get structured feedback on your scoring trends.',
        buildContext: (data, testLogs, routines, focusPoints, userName, daysLeft, currentLevel, cohort) => `
Current User State:
- Name: ${userName || 'Student'}
- Target Exam (Cohort): ${cohort || 'Unknown'}
- Days to Target: ${daysLeft}
- Current Level: ${currentLevel} (Focus Points: ${focusPoints})
- Routines: ${routines.filter(r => r.done).length}/${routines.length} completed today.
- Recent Mock Logs: ${JSON.stringify(testLogs.slice(-3))}
`,
        getPrompt: (context) => `You are an elite exam coach. Analyze the student's mock test scores. Focus ONLY on the mock scores provided. Do not invent data. \n\nContext:\n${context}\n\nRespond strictly in valid JSON format. Populate the fields with actual coaching advice and detailed insights based on the context. Do not return template placeholders.\nExpected format:\n{ "title": "Mock Analysis", "body": "your main analysis paragraph based on actual scores", "points": ["specific tip 1", "specific tip 2"] }`
    },
    {
        id: 'weakness_scan',
        icon: '📊',
        label: 'Syllabus Weakness Scan',
        description: 'Find out which subjects need more attention.',
        buildContext: (data) => {
            const summary = data.map(sub => {
                const doneCount = sub.chapters.filter(c => getEffectiveStatusInfo(c).isDone).length;
                return `${sub.name}: ${Math.round((doneCount / sub.chapters.length) * 100)}% done`;
            }).join(', ');
            return `Syllabus Completion: ${summary}`;
        },
        getPrompt: (context) => `You are an elite exam coach. Analyze the student's syllabus completion percentages. Identify the weakest subject and suggest a high-level strategy to catch up. \n\nContext:\n${context}\n\nRespond strictly in valid JSON format. Populate the fields with actual subject weakness feedback and real strategy steps. Do not return template placeholders.\nExpected format:\n{ "title": "Weakness Scan", "body": "your main analysis paragraph outlining weakest subject", "points": ["strategy tip 1", "strategy tip 2"] }`
    },
    {
        id: 'daily_strategy',
        icon: '⚡',
        label: 'Generate Today\'s Strategy',
        description: 'Get a time-management plan for pending workflows.',
        buildContext: (data, testLogs, routines) => `Pending Workflows Today: ${JSON.stringify(routines.filter(r => !r.done).map(r => ({ subject: r.subjectName, template: r.template }))) }`,
        getPrompt: (context) => `You are a productivity expert. Look at the student's pending workflows for today and generate a structured time-management strategy to finish them efficiently. \n\nContext:\n${context}\n\nRespond strictly in valid JSON format. Populate the fields with actual study blocks and actionable routines. Do not return template placeholders.\nExpected format:\n{ "title": "Today's Strategy", "body": "your main productivity advice for today's tasks", "points": ["time block 1", "time block 2"] }`
    },
    {
        id: 'motivation',
        icon: '🔥',
        label: 'Motivation Boost',
        description: 'Get a powerful philosophical quote.',
        buildContext: () => ``, // No syllabus data needed
        getPrompt: () => `You are a stoic mentor. The student is feeling burnt out from studying. Give them a powerful, impactful quote from a famous scientist, author, or poet. DO NOT mention chapter names, syllabus, or studying. Focus on resilience, greatness, and human potential. \n\nRespond strictly in valid JSON format. Populate the fields with an actual quote and its interpretation. Do not return template placeholders.\nExpected format:\n{ "title": "Author Name", "body": "The powerful quote", "points": ["A brief stoic interpretation of the quote"] }`
    }
];

const StudyBuddyWidget = ({ data, routines, testLogs, focusPoints, currentLevel, userName, daysLeft, cohort }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeView, setActiveView] = useState('menu'); // 'menu', 'loading', 'result'
    const [aiResult, setAiResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    const handleActionClick = async (action) => {
        setActiveView('loading');
        setErrorMsg('');
        
        try {
            const context = action.buildContext(data, testLogs, routines, focusPoints, userName, daysLeft, currentLevel, cohort);
            const prompt = action.getPrompt(context);
            // System instruction optimized to guide open models to output real, populated JSON objects
            const systemInstruction = `You are a helpful AI coach. You will be asked to perform tasks and respond strictly in valid JSON format.
CRITICAL: Do not return a JSON schema, schema definition, or placeholder strings. You must populate the fields with actual content, recommendations, quotes, or strategies based on the user's context.
Example of expected output structure:
{
  "title": "Actual Title Here",
  "body": "Actual detailed message here...",
  "points": ["Specific action point 1", "Specific action point 2"]
}`;
            
            const response = await generateGeminiContent(prompt, systemInstruction, true);
            
            setAiResult({
                ...response,
                actionIcon: action.icon
            });
            setActiveView('result');
        } catch (error) {
            console.error("Action Error:", error);
            setErrorMsg("Failed to generate response. Please try again.");
            setActiveView('menu');
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end pointer-events-none">
            {/* Widget Window */}
            <div className={`pointer-events-auto transition-all duration-500 ease-in-out origin-bottom-right mb-4 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'} w-[350px] sm:w-[380px] bg-slate-900 border border-slate-700 shadow-[0_10px_40px_rgba(0,0,0,0.5)] rounded-2xl flex flex-col overflow-hidden`}>
                
                {/* Header */}
                <div className="bg-gradient-to-r from-bitsat-800 to-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center shadow-inner relative">
                            <span className="text-sm">🤖</span>
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-slate-900"></div>
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white">Vinyas AI Coach</h3>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Online</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeView === 'result' && (
                            <button onClick={() => setActiveView('menu')} className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg border border-slate-700 text-xs font-bold">
                                Back
                            </button>
                        )}
                        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors ml-2">
                            <i className="ph-bold ph-x text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-4 custom-scrollbar max-h-[60vh] overflow-y-auto">
                    
                    {errorMsg && (
                        <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl text-sm font-medium">
                            {errorMsg}
                        </div>
                    )}

                    {activeView === 'menu' && (
                        <div className="space-y-3 animate-fade-in">
                            <p className="text-sm text-slate-300 mb-4 px-1">How can I help you today, {userName || 'Champ'}?</p>
                            {AI_ACTIONS.map(action => (
                                <button 
                                    key={action.id}
                                    onClick={() => handleActionClick(action)}
                                    className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-bitsat-500 rounded-xl p-3 flex items-start gap-3 transition-all text-left group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                        {action.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-200 group-hover:text-bitsat-400 transition-colors">{action.label}</h4>
                                        <p className="text-[11px] text-slate-400 mt-0.5">{action.description}</p>
                                    </div>
                                    <i className="ph-bold ph-caret-right text-slate-500 self-center opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </button>
                            ))}
                        </div>
                    )}

                    {activeView === 'loading' && (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-4 animate-fade-in">
                            <i className="ph-bold ph-spinner-gap text-4xl animate-spin text-bitsat-500"></i>
                            <p className="animate-pulse font-medium text-sm">Analyzing your data...</p>
                        </div>
                    )}

                    {activeView === 'result' && aiResult && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{aiResult.actionIcon}</span>
                                <h3 className="text-lg font-black text-white">{aiResult.title}</h3>
                            </div>
                            
                            <div className="bg-bitsat-500/10 border border-bitsat-500/20 p-4 rounded-xl">
                                <p className="text-sm text-slate-200 leading-relaxed italic">
                                    "{aiResult.body}"
                                </p>
                            </div>

                            {aiResult.points && aiResult.points.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Actionable Points</h4>
                                    {aiResult.points.map((point, idx) => (
                                        <div key={idx} className="flex gap-3 text-slate-300 text-sm bg-slate-800 p-3 rounded-xl border border-slate-700">
                                            <i className="ph-fill ph-check-circle text-emerald-500 text-lg flex-shrink-0"></i> 
                                            <span className="leading-snug">{point}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>

            {/* Toggle Button */}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all duration-300 transform hover:scale-105 group relative
                    ${isOpen ? 'bg-slate-700 rotate-90' : 'bg-gradient-to-tr from-bitsat-600 to-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.6)]'}
                `}
            >
                {isOpen ? (
                    <i className="ph-bold ph-x text-2xl group-hover:-rotate-90 transition-transform duration-300"></i>
                ) : (
                    <>
                        <i className="ph-fill ph-robot text-2xl animate-pulse-slow"></i>
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-slate-900 rounded-full animate-ping"></span>
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-slate-900 rounded-full"></span>
                    </>
                )}
            </button>
        </div>
    );
};

export default StudyBuddyWidget;
