import React from 'react';


export const generateEmptyChapter = (name) => ({
    name, status: 'None', lectures: 0, log: '',
    dpp: { acc: 0, comp: 0 },
    module: { acc: 0, comp: 0 },
    dppLogs: {},
    moduleLogs: {},
    customExerciseConfig: null,
    exerciseDisplayNames: null,
    moduleQuestionStates: {},
    focusTime: 0,
    reviewsDone: 0,
    nextReview: null,
    lastReviewRating: null
});

export const initialSyllabus = [];

export const YogiLogo = ({ className = "w-10 h-10" }) => (
    <svg className={`${className} shadow-lg rounded-full`} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="50%" stopColor="#0b0f19" />
                <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            <linearGradient id="border-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.6} />
                <stop offset="40%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
            </linearGradient>

            <linearGradient id="left-stem-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ea580c" />
                <stop offset="60%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#facc15" />
            </linearGradient>

            <linearGradient id="right-rib1-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#f97316" />
            </linearGradient>

            <linearGradient id="right-rib2-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#db2777" />
                <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>

            <radialGradient id="radial-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.15} />
                <stop offset="70%" stopColor="#3b82f6" stopOpacity={0.03} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </radialGradient>

            <filter id="drop-shadow" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow dx="0" dy="16" stdDeviation="20" floodColor="#000000" floodOpacity={0.6} />
            </filter>

            <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>

        <rect width="496" height="496" x="8" y="8" rx="248" fill="url(#bg-grad)" stroke="url(#border-grad)" strokeWidth="4" />

        <circle cx="256" cy="256" r="230" fill="url(#radial-glow)" />

        <g filter="url(#drop-shadow)" transform="translate(12, -4)">
            <circle cx="244" cy="260" r="148" fill="none" stroke="#334155" strokeDasharray="8 12" strokeWidth="1.5" strokeOpacity={0.4} />
            
            <path d="M 172,130 C 172,130 186,190 216,285 C 222,305 235,340 244,360 C 246,364 250,364 252,360 C 255,354 262,330 268,310 L 220,170 C 214,152 196,130 172,130 Z" fill="url(#left-stem-grad)" filter="url(#logo-glow)" />

            <path d="M 234,324 C 252,310 290,265 315,225 C 328,205 332,192 332,184 C 332,176 324,170 316,170 C 304,170 290,188 274,212 L 242,260 Z" fill="url(#right-rib1-grad)" />

            <path d="M 264,260 C 288,230 330,172 356,134 C 368,116 374,104 374,96 C 374,86 364,80 354,80 C 342,80 326,98 308,124 L 272,178 Z" fill="url(#right-rib2-grad)" />

            <g transform="translate(366, 88)">
                <circle cx="0" cy="0" r="16" fill="#facc15" opacity="0.3" filter="url(#logo-glow)" />
                <path d="M 0,-8 L 2.5,-2.5 L 8,0 L 2.5,2.5 L 0,8 L -2.5,2.5 L -8,0 L -2.5,-2.5 Z" fill="#fef08a" />
            </g>

            <line x1="140" y1="180" x2="160" y2="180" stroke="#f97316" strokeWidth="4" strokeLinecap="round" strokeOpacity={0.6} />
            <line x1="148" y1="210" x2="162" y2="210" stroke="#ea580c" strokeWidth="4" strokeLinecap="round" strokeOpacity={0.6} />
            <line x1="162" y1="240" x2="172" y2="240" stroke="#dc2626" strokeWidth="4" strokeLinecap="round" strokeOpacity={0.6} />
        </g>
    </svg>
);

export const YogiLogoAlt = ({ className = "w-10 h-10" }) => (
    <svg className={`${className} shadow-lg rounded-full`} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
            {/* Background Gradient (Sleek Obsidian & Cyber Indigo) */}
            <linearGradient id="bg-grad-alt" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#050515" />
                <stop offset="50%" stopColor="#0a0927" />
                <stop offset="100%" stopColor="#020208" />
            </linearGradient>

            {/* Outer Border Glow Gradient */}
            <linearGradient id="border-grad-alt" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>

            {/* Left Wing Gradient (Royal Indigo-Violet Glass) */}
            <linearGradient id="left-wing-grad-alt" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="70%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>

            {/* Right Wing Gradient (Electric Cyan Glass) */}
            <linearGradient id="right-wing-grad-alt" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0891b2" />
                <stop offset="60%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>

            {/* Neon Progress Track Gradient (Pink-Purple-Cyan Ascent) */}
            <linearGradient id="track-grad-alt" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="50%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Ambient Background Radial Lighting */}
            <radialGradient id="radial-glow-alt" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.18} />
                <stop offset="60%" stopColor="#06b6d4" stopOpacity={0.04} />
                <stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </radialGradient>

            {/* Drop Shadow Filter for 3D Layering */}
            <filter id="drop-shadow-alt" x="-10%" y="-10%" width="130%" height="130%">
                <feDropShadow dx={0} dy={12} stdDeviation={15} floodColor="#000000" floodOpacity={0.65} />
            </filter>

            {/* Intense Neon Glow Filter */}
            <filter id="neon-glow-alt" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation={8} result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>

            {/* Subtle Glow Filter */}
            <filter id="subtle-glow-alt" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* Canvas Squircle Background */}
        <rect width="496" height="496" x="8" y="8" rx="248" fill="url(#bg-grad-alt)" stroke="url(#border-grad-alt)" strokeWidth="4" />

        {/* Radial Background Lighting Overlay */}
        <circle cx="256" cy="256" r="230" fill="url(#radial-glow-alt)" />

        {/* Technical Orbit Grids (Structured Syllabus Tracking Theme) */}
        <g opacity={0.25}>
            <circle cx="256" cy="256" r="160" fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 8" />
            <circle cx="256" cy="256" r="120" fill="none" stroke="#06b6d4" strokeWidth={1} strokeDasharray="12 6" />
            <line x1="256" y1="50" x2="256" y2="462" stroke="#475569" strokeWidth={0.5} strokeDasharray="4 4" />
            <line x1="50" y1="256" x2="462" y2="256" stroke="#475569" strokeWidth={0.5} strokeDasharray="4 4" />
        </g>

        {/* Main Floating Content Group */}
        <g filter="url(#drop-shadow-alt)">
            
            {/* Left Wing (Syllabus Structure Base) */}
            <path d="M 170,160 C 155,160 145,172 148,187 L 218,362 C 224,377 238,385 250,385 C 256,385 262,382 266,377 L 224,225 C 220,210 206,160 170,160 Z" fill="url(#left-wing-grad-alt)" opacity={0.85} />

            {/* Right Wing (Active Execution & Completion) */}
            <path d="M 342,160 C 357,160 367,172 364,187 L 294,362 C 288,377 274,385 262,385 C 256,385 250,382 246,377 L 288,225 C 292,210 306,160 342,160 Z" fill="url(#right-wing-grad-alt)" opacity={0.85} />

            {/* Neon Progress Track Spline (Winding through the structured V wings) */}
            <path d="M 160,290 C 185,330 225,360 256,360 C 290,360 325,270 360,130" fill="none" stroke="url(#track-grad-alt)" strokeWidth={7} strokeLinecap="round" filter="url(#neon-glow-alt)" />

            {/* Progress Nodes (Representing modular milestones / lessons completed) */}
            {/* Node 1: Completed Start Point */}
            <circle cx="160" cy="290" r="10" fill="#ec4899" filter="url(#subtle-glow-alt)" />
            <circle cx="160" cy="290" r="4" fill="#ffffff" />

            {/* Node 2: Mid-point Progress */}
            <circle cx="225" cy="342" r="10" fill="#a855f7" filter="url(#subtle-glow-alt)" />
            <circle cx="225" cy="342" r="4" fill="#ffffff" />

            {/* Node 3: Current Study Goal Active */}
            <circle cx="295" cy="310" r="12" fill="#06b6d4" filter="url(#neon-glow-alt)" />
            <circle cx="295" cy="310" r="5" fill="#ffffff" />

            {/* Ultimate Target Goal / Star of Achievement (Top-Right Destination) */}
            <g transform="translate(360, 130)" filter="url(#neon-glow-alt)">
                {/* Pulsing Halo */}
                <circle cx="0" cy="0" r="22" fill="#22d3ee" opacity={0.25} />
                <circle cx="0" cy="0" r="14" fill="#a855f7" opacity={0.4} />
                {/* High-Tech Star Shape */}
                <path d="M 0,-12 L 3,-3 L 12,0 L 3,3 L 0,12 L -3,3 L -12,0 L -3,-3 Z" fill="#ffffff" />
            </g>
        </g>
    </svg>
);

