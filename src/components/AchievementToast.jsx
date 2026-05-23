import React, { useEffect, useState, useRef } from 'react';

const SpecialAchievementArt = ({ id, icon }) => {
    switch (id) {
        case 'night_owl':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance">
                    {/* Background moon glow */}
                    <div className="absolute w-36 h-36 rounded-full bg-yellow-500/10 blur-2xl"></div>
                    
                    {/* Sleek SVG Owl with coffee */}
                    <svg className="w-36 h-36 text-slate-200 drop-shadow-[0_0_15px_rgba(234,179,8,0.25)]" viewBox="0 0 100 100" fill="currentColor">
                        <defs>
                            <filter id="eyeGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.2" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        {/* Body */}
                        <path d="M50,15 C30,15 25,35 25,60 C25,80 35,90 50,90 C65,90 75,80 75,60 C75,35 70,15 50,15 Z" fill="#0f172a" stroke="#334155" strokeWidth="2.5" />
                        {/* Belly feathers */}
                        <path d="M40,65 Q50,70 60,65 M43,73 Q50,78 57,73" stroke="#475569" strokeWidth="2" fill="none" />
                        {/* Head/Face mask */}
                        <path d="M22,30 L40,42 L60,42 L78,30 L70,55 L30,55 Z" fill="#1e293b" />
                        {/* Beak */}
                        <polygon points="50,48 46,40 54,40" fill="#eab308" />
                        
                        {/* LEFT EYE */}
                        {/* Bloodshot sclera */}
                        <circle cx="36" cy="38" r="9" fill="#fff" stroke="#475569" strokeWidth="1.5" />
                        <circle cx="36" cy="38" r="9" fill="rgba(239,68,68,0.08)" />
                        {/* Left eye veins */}
                        <path d="M28.5,35 Q30.5,36 32,37" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M28.5,41 Q30.5,40 32,39" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M33,30.5 Q34,33 34.5,34" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M39,30.5 Q38,33 37.5,34" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M43.5,35 Q41.5,36 40,37" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M43.5,41 Q41.5,40 40,39" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M33,45.5 Q34,43 34.5,42" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M39,45.5 Q38,43 37.5,42" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        {/* Left Iris & Pupil */}
                        <circle cx="36" cy="38" r="4.5" fill="#facc15" filter="url(#eyeGlow)" className="animate-pulse" style={{ animationDuration: '3s' }} />
                        <circle cx="36" cy="38" r="2" fill="#000" />

                        {/* RIGHT EYE */}
                        {/* Bloodshot sclera */}
                        <circle cx="64" cy="38" r="9" fill="#fff" stroke="#475569" strokeWidth="1.5" />
                        <circle cx="64" cy="38" r="9" fill="rgba(239,68,68,0.08)" />
                        {/* Right eye veins */}
                        <path d="M56.5,35 Q58.5,36 60,37" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M56.5,41 Q58.5,40 60,39" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M61,30.5 Q62,33 62.5,34" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M67,30.5 Q66,33 65.5,34" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M71.5,35 Q69.5,36 68,37" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M71.5,41 Q69.5,40 68,39" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M61,45.5 Q62,43 62.5,42" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        <path d="M67,45.5 Q66,43 65.5,42" stroke="#ef4444" strokeWidth="0.5" fill="none" />
                        {/* Right Iris & Pupil */}
                        <circle cx="64" cy="38" r="4.5" fill="#facc15" filter="url(#eyeGlow)" className="animate-pulse" style={{ animationDuration: '3s' }} />
                        <circle cx="64" cy="38" r="2" fill="#000" />

                        {/* COFFEE CUP ON THE SIDE */}
                        {/* Saucer */}
                        <ellipse cx="80" cy="85" rx="9" ry="2.5" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
                        {/* Cup handle */}
                        <path d="M85,74 C89,74 89,82 85,82" stroke="#475569" strokeWidth="1.5" fill="none" />
                        {/* Cup Body */}
                        <path d="M73,72 L87,72 L85,84 L75,84 Z" fill="#334155" stroke="#475569" strokeWidth="1.5" />
                        {/* Coffee fill surface */}
                        <ellipse cx="80" cy="72" rx="6" ry="2" fill="#78350f" stroke="#475569" strokeWidth="0.5" />
                        {/* Steam rising */}
                        <path d="M77,66 Q75,60 78,56" stroke="#94a3b8" strokeWidth="0.8" fill="none" className="animate-pulse" />
                        <path d="M82,66 Q80,59 83,55" stroke="#94a3b8" strokeWidth="0.8" fill="none" className="animate-pulse" />
                    </svg>
                </div>
            );
        case 'early_bird':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance">
                    <div className="absolute w-36 h-36 rounded-full bg-orange-500/20 blur-3xl"></div>
                    <svg className="w-36 h-36" viewBox="0 0 100 100">
                        <circle cx="50" cy="55" r="22" fill="url(#sunGrad)" className="drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]" />
                        <path d="M15,80 L35,50 L55,70 L75,45 L90,80 Z" fill="#0f172a" stroke="#334155" strokeWidth="2.5" />
                        <path d="M38,32 Q46,26 50,34 Q54,26 62,32 Q54,34 50,38 Q46,34 38,32 Z" fill="#e2e8f0" />
                        <defs>
                            <linearGradient id="sunGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#f97316" />
                                <stop offset="100%" stopColor="#eab308" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
            );
        case 'syllabus_starter':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-rocket-launch">
                    <div className="absolute bottom-8 w-16 h-24 bg-gradient-to-t from-transparent via-orange-500 to-yellow-400 blur-xl opacity-80 animate-pulse"></div>
                    <span className="text-[90px] drop-shadow-[0_0_20px_rgba(249,115,22,0.5)] select-none">🚀</span>
                </div>
            );
        case 'first_strike':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance overflow-hidden">
                    {/* Background fire glow */}
                    <div className="absolute w-36 h-36 rounded-full bg-orange-500/10 blur-2xl"></div>
                    
                    {/* Golden bullet SVG */}
                    <svg className="w-36 h-36 drop-shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-bullet-slide" viewBox="0 0 100 100">
                        <defs>
                            {/* Horizontal trail gradient */}
                            <linearGradient id="trailGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="rgba(239, 68, 68, 0)" />
                                <stop offset="50%" stopColor="rgba(249, 115, 22, 0.4)" />
                                <stop offset="100%" stopColor="rgba(253, 224, 71, 0.8)" />
                            </linearGradient>
                            {/* Muzzle fire gradient */}
                            <linearGradient id="fireGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#ef4444" />
                                <stop offset="60%" stopColor="#f97316" />
                                <stop offset="100%" stopColor="#facc15" />
                            </linearGradient>
                            {/* Metallic gradients */}
                            <linearGradient id="bulletGold" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#7c2d12" />
                                <stop offset="25%" stopColor="#d97706" />
                                <stop offset="50%" stopColor="#fef08a" />
                                <stop offset="75%" stopColor="#eab308" />
                                <stop offset="100%" stopColor="#78350f" />
                            </linearGradient>
                            <linearGradient id="casingGold" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#78350f" />
                                <stop offset="20%" stopColor="#b45309" />
                                <stop offset="40%" stopColor="#fef9c3" />
                                <stop offset="60%" stopColor="#d97706" />
                                <stop offset="80%" stopColor="#b45309" />
                                <stop offset="100%" stopColor="#451a03" />
                            </linearGradient>
                            {/* Fire glow filter */}
                            <filter id="fireGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        
                        {/* Speed lines trailing (High-speed parallax particles) */}
                        <g opacity="0.7">
                            <line x1="0" y1="20" x2="25" y2="20" stroke="#fde047" strokeWidth="1.5" className="animate-fast-particle" />
                            <line x1="0" y1="80" x2="35" y2="80" stroke="#f97316" strokeWidth="1" className="animate-medium-particle" style={{ animationDelay: '0.2s' }} />
                            <line x1="0" y1="12" x2="20" y2="12" stroke="#ef4444" strokeWidth="2" className="animate-slow-particle" style={{ animationDelay: '0.4s' }} />
                            <line x1="0" y1="88" x2="30" y2="88" stroke="#fde047" strokeWidth="1" className="animate-medium-particle" style={{ animationDelay: '0.6s' }} />
                        </g>

                        {/* Supersonic Expanding Shockwaves */}
                        <g className="animate-shockwave-1">
                            <ellipse cx="85" cy="50" rx="3" ry="6" stroke="rgba(254, 240, 138, 0.7)" strokeWidth="1.2" fill="none" />
                        </g>
                        <g className="animate-shockwave-2">
                            <ellipse cx="85" cy="50" rx="3" ry="6" stroke="rgba(249, 115, 22, 0.5)" strokeWidth="1.2" fill="none" />
                        </g>

                        {/* Muzzle fire burst behind the bullet (wiggling) */}
                        <g className="animate-flame-wiggle" style={{ transformOrigin: '20px 50px' }}>
                            <path d="M 20,44 Q 0,34 -15,44 Q -5,50 -22,50 Q -5,50 -15,56 Q 0,66 20,56 Z" fill="url(#fireGrad)" filter="url(#fireGlow)" opacity="0.95" />
                        </g>

                        {/* Bullet Body (mechanical jitter/vibration) */}
                        <g className="animate-bullet-jitter" style={{ transformOrigin: '50px 50px' }}>
                            {/* Bullet Base Rim */}
                            <path d="M 21,41 C 20.5,41 20,41.5 20,42 L 20,58 C 20,58.5 20.5,59 21,59 L 24,59 L 24,41 Z" fill="url(#casingGold)" />
                            
                            {/* Extractor Groove */}
                            <rect x="24" y="43" width="3" height="14" fill="#451a03" />
                            
                            {/* Casing Body */}
                            <path d="M 27,41 L 52,41 L 55,44 L 57,44 L 57,56 L 55,56 L 52,59 L 27,59 Z" fill="url(#casingGold)" />
                            
                            {/* Projectile (Bullet Tip) */}
                            <path d="M 57,44 C 67,44 78,47 85,50 C 78,53 67,56 57,56 Z" fill="url(#bulletGold)" />
                            
                            {/* Aerodynamic Wind Shear lines wrapping around bullet */}
                            <path d="M 64,36 C 75,37 84,43 90,50 C 84,57 75,63 64,64" stroke="rgba(254, 240, 138, 0.6)" strokeWidth="1" fill="none" strokeDasharray="8 6" className="animate-wind-shear" />
                        </g>
                    </svg>
                </div>
            );
        case 'dpp_sniper':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance">
                    {/* Background green glow representing scope HUD */}
                    <div className="absolute w-36 h-36 rounded-full bg-emerald-500/10 blur-2xl"></div>
                    
                    {/* Sniper Scope SVG */}
                    <svg className="w-36 h-36 drop-shadow-[0_0_20px_rgba(16,185,129,0.25)] animate-scope-breath" viewBox="0 0 100 100">
                        <defs>
                            {/* Steel target plate gradient */}
                            <linearGradient id="metalPlate" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#475569" />
                                <stop offset="30%" stopColor="#94a3b8" />
                                <stop offset="50%" stopColor="#cbd5e1" />
                                <stop offset="70%" stopColor="#64748b" />
                                <stop offset="100%" stopColor="#334155" />
                            </linearGradient>
                            {/* Lens reflection gradient */}
                            <linearGradient id="lensGlare" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="rgba(255, 255, 255, 0.25)" />
                                <stop offset="40%" stopColor="rgba(255, 255, 255, 0.05)" />
                                <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                            </linearGradient>
                            {/* Green scope reticle glow */}
                            <filter id="greenGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="1" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        
                        {/* Scope View Field Limit */}
                        <circle cx="50" cy="50" r="44" fill="#0b0f19" />
                        
                        {/* Metallic Plate Target in background */}
                        <g>
                            {/* Steel Plate */}
                            <rect x="23" y="27" width="54" height="46" rx="5" fill="url(#metalPlate)" stroke="#1e293b" strokeWidth="1.5" />
                            
                            {/* Corner bolts */}
                            <circle cx="28" cy="32" r="2" fill="#1e293b" />
                            <circle cx="72" cy="32" r="2" fill="#1e293b" />
                            <circle cx="28" cy="68" r="2" fill="#1e293b" />
                            <circle cx="72" cy="68" r="2" fill="#1e293b" />
                            
                            {/* DPP Text etched/stenciled */}
                            <text x="50" y="54" fontFamily="Impact, sans-serif" fontSize="16" fontWeight="bold" fill="#0f172a" textAnchor="middle" letterSpacing="1.5">
                                DPP
                            </text>
                            
                            {/* BULLET HOLE 1 (Top Left of target center) */}
                            <g>
                                {/* Radiating cracks */}
                                <path d="M 34,39 L 29,36 M 38,38 L 44,35 M 39,43 L 42,48 M 34,42 L 30,45" stroke="#0f172a" strokeWidth="0.8" strokeLinecap="round" />
                                <path d="M 34.5,39.5 L 29.5,36.5 M 38.5,38.5 L 44.5,35.5 M 39.5,43.5 L 42.5,48.5 M 34.5,42.5 L 30.5,45.5" stroke="#cbd5e1" strokeWidth="0.4" strokeLinecap="round" opacity="0.6" />
                                {/* Jagged entry hole */}
                                <circle cx="36" cy="40" r="3" fill="#020617" stroke="#94a3b8" strokeWidth="0.5" />
                                <circle cx="36" cy="40" r="1.5" fill="#000" />
                            </g>
                            
                            {/* BULLET HOLE 2 (Bottom Right of target center) */}
                            <g>
                                {/* Radiating cracks */}
                                <path d="M 60,57 L 55,54 M 64,56 L 69,53 M 65,61 L 68,66 M 60,60 L 56,63" stroke="#0f172a" strokeWidth="0.8" strokeLinecap="round" />
                                <path d="M 60.5,57.5 L 55.5,54.5 M 64.5,56.5 L 69.5,53.5 M 65.5,61.5 L 68.5,66.5 M 60.5,60.5 L 56.5,63.5" stroke="#cbd5e1" strokeWidth="0.4" strokeLinecap="round" opacity="0.6" />
                                {/* Jagged entry hole */}
                                <circle cx="62" cy="58" r="3" fill="#020617" stroke="#94a3b8" strokeWidth="0.5" />
                                <circle cx="62" cy="58" r="1.5" fill="#000" />
                            </g>
                        </g>

                        {/* Sniper HUD Scope Overlay (in front of plate) */}
                        <g filter="url(#greenGlow)">
                            {/* Fine outer reticle ring */}
                            <circle cx="50" cy="50" r="41" stroke="#10b981" strokeWidth="1" fill="none" opacity="0.7" />
                            
                            {/* Reticle crosshair bars */}
                            <line x1="9" y1="50" x2="38" y2="50" stroke="#10b981" strokeWidth="1.5" />
                            <line x1="62" y1="50" x2="91" y2="50" stroke="#10b981" strokeWidth="1.5" />
                            <line x1="50" y1="9" x2="50" y2="38" stroke="#10b981" strokeWidth="1.5" />
                            <line x1="50" y1="62" x2="50" y2="91" stroke="#10b981" strokeWidth="1.5" />
                            
                            {/* Central crosshair ring */}
                            <circle cx="50" cy="50" r="6" stroke="#10b981" strokeWidth="1" fill="none" />
                            <circle cx="50" cy="50" r="1" fill="#ef4444" />
                            
                            {/* Range tick marks */}
                            {/* Left side */}
                            <line x1="28" y1="48" x2="28" y2="52" stroke="#10b981" strokeWidth="0.8" />
                            <line x1="18" y1="46" x2="18" y2="54" stroke="#10b981" strokeWidth="0.8" />
                            {/* Right side */}
                            <line x1="72" y1="48" x2="72" y2="52" stroke="#10b981" strokeWidth="0.8" />
                            <line x1="82" y1="46" x2="82" y2="54" stroke="#10b981" strokeWidth="0.8" />
                            {/* Top side */}
                            <line x1="48" y1="28" x2="52" y2="28" stroke="#10b981" strokeWidth="0.8" />
                            <line x1="46" y1="18" x2="54" y2="18" stroke="#10b981" strokeWidth="0.8" />
                            {/* Bottom side */}
                            <line x1="48" y1="72" x2="52" y2="72" stroke="#10b981" strokeWidth="0.8" />
                            <line x1="46" y1="82" x2="54" y2="82" stroke="#10b981" strokeWidth="0.8" />
                            
                            {/* HUD digital corner indicators */}
                            <path d="M 20,20 L 14,20 L 14,26" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.6" />
                            <path d="M 80,20 L 86,20 L 86,26" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.6" />
                            <path d="M 20,80 L 14,80 L 14,74" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.6" />
                            <path d="M 80,80 L 86,80 L 86,74" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.6" />
                        </g>
                        
                        {/* Scope Outer Steel Ring */}
                        <circle cx="50" cy="50" r="44" stroke="#1e293b" strokeWidth="3.5" fill="none" />
                        
                        {/* Lens Glare */}
                        <path d="M 8.5,35 A 41.5,41.5 0 0,1 65,8.5 Z" fill="url(#lensGlare)" />
                    </svg>
                </div>
            );
        case 'mock_master':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-stamp-slam">
                    <svg className="w-36 h-36 text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3.5">
                        <circle cx="50" cy="50" r="40" strokeDasharray="6,6" className="animate-spin" style={{ animationDuration: '25s' }} />
                        <circle cx="50" cy="50" r="30" />
                        <circle cx="50" cy="50" r="20" />
                        <circle cx="50" cy="50" r="8" fill="#ef4444" />
                        <line x1="50" y1="5" x2="50" y2="95" strokeOpacity="0.4" strokeWidth="1.5" />
                        <line x1="5" y1="50" x2="95" y2="50" strokeOpacity="0.4" strokeWidth="1.5" />
                    </svg>
                </div>
            );
        case 'dpp_killer':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance overflow-hidden">
                    {/* Pulsing blood-red ambient glow */}
                    <div className="absolute w-40 h-40 rounded-full bg-red-950/40 border border-red-500/15 blur-2xl animate-pulse" style={{ animationDuration: '2.5s' }}></div>
                    
                    {/* SVG Graphic */}
                    <svg className="w-38 h-38 drop-shadow-[0_0_25px_rgba(220,38,38,0.45)]" viewBox="0 0 100 100">
                        <defs>
                            {/* Steel blade gradient */}
                            <linearGradient id="bladeMetal" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#94a3b8" />
                                <stop offset="40%" stopColor="#475569" />
                                <stop offset="70%" stopColor="#1e293b" />
                                <stop offset="100%" stopColor="#020617" />
                            </linearGradient>
                            {/* Crimson blood gradient */}
                            <linearGradient id="bloodRed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#dc2626" />
                                <stop offset="50%" stopColor="#991b1b" />
                                <stop offset="100%" stopColor="#450a0a" />
                            </linearGradient>
                            {/* Demon Eye Glow Filter */}
                            <filter id="demonGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="1.5" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        
                        {/* Menacing runic ring background */}
                        <circle cx="50" cy="50" r="46" stroke="#991b1b" strokeWidth="1.2" strokeDasharray="4,8" opacity="0.8" className="animate-spin" style={{ animationDuration: '20s' }} />
                        <circle cx="50" cy="50" r="42" stroke="#7f1d1d" strokeWidth="0.5" opacity="0.3" />
                        
                        {/* Sinister ritual star lines */}
                        <path 
                            d="M 50,8 L 78,74 L 14,35 L 86,35 L 22,74 Z" 
                            stroke="#b91c1c" 
                            strokeWidth="0.6" 
                            strokeDasharray="2,4" 
                            fill="none" 
                            opacity="0.35" 
                            className="animate-spin" 
                            style={{ animationDuration: '40s', transformOrigin: '50px 50px' }} 
                        />

                        {/* 1. Paper Sheet (named DPP, tilted, with slashes & blood splatters) - Rendered behind the knife */}
                        <g transform="rotate(-6 50 50)">
                            {/* Paper card (Torn, ragged-edged, slight shadow) */}
                            <path 
                                d="M 25,20 C 35,19.5 65,20.2 75,20 C 75.5,35 74.8,55 75,64 L 71,67 L 74,71 L 67,75 L 63,80 C 50,80.5 35,79.5 25,80 C 24.5,65 25.2,35 25,20 Z" 
                                fill="#f8fafc" 
                                stroke="#475569" 
                                strokeWidth="1.5" 
                                className="drop-shadow-2xl" 
                            />
                            
                            {/* Burnt / Charred Corner Details */}
                            <path d="M 75,64 L 71,67 L 74,71 L 67,75 L 63,80 L 67,80 L 75,73 Z" fill="#090505" opacity="0.85" />
                            <path d="M 71,67 L 74,71 L 67,75 L 63,80 L 62,80 L 66,75 L 70,71 L 69,67 Z" fill="#450a0a" opacity="0.9" />
                            
                            {/* Paper lines (Adjusted for torn edges) */}
                            <line x1="30" y1="36" x2="70" y2="36" stroke="#cbd5e1" strokeWidth="0.8" />
                            <line x1="30" y1="42" x2="70" y2="42" stroke="#cbd5e1" strokeWidth="0.8" />
                            <line x1="30" y1="48" x2="70" y2="48" stroke="#cbd5e1" strokeWidth="0.8" />
                            <line x1="30" y1="54" x2="70" y2="54" stroke="#cbd5e1" strokeWidth="0.8" />
                            <line x1="30" y1="60" x2="70" y2="60" stroke="#cbd5e1" strokeWidth="0.8" />
                            <line x1="30" y1="66" x2="67" y2="66" stroke="#cbd5e1" strokeWidth="0.8" />
                            <line x1="30" y1="72" x2="60" y2="72" stroke="#cbd5e1" strokeWidth="0.8" />
                            
                            {/* Red margin line */}
                            <line x1="35" y1="20" x2="35" y2="80" stroke="#f87171" strokeWidth="0.6" opacity="0.7" />
                            
                            {/* Bloody written "DPP" Header */}
                            <g transform="translate(36, 25)">
                                {/* Letter D */}
                                <path d="M 0,1 L 0,11 M 0,2 C 4,1.5 7,3 7,6 C 7,9 4,10 0,9.5" stroke="#450a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M 0,2 C 4,1.5 7,3 7,6 C 7,9 4,10 0,9.5" stroke="#b91c1c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Drip on D */}
                                <path d="M 0,11 L 0,13.5" stroke="#b91c1c" strokeWidth="1" strokeLinecap="round" />
                                <circle cx="0" cy="13.5" r="0.6" fill="#b91c1c" />

                                {/* Letter P */}
                                <path d="M 12,1 L 12,11 M 12,2 C 16,1.5 18,3 18,5.5 C 18,8 16,9 12,8.5" stroke="#450a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M 12,2 C 16,1.5 18,3 18,5.5 C 18,8 16,9 12,8.5" stroke="#b91c1c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Drip on P */}
                                <path d="M 12,11 L 12,14" stroke="#b91c1c" strokeWidth="1" strokeLinecap="round" />
                                <circle cx="12" cy="14" r="0.6" fill="#b91c1c" />

                                {/* Second Letter P */}
                                <path d="M 23,1 L 23,11 M 23,2 C 27,1.5 29,3 29,5.5 C 29,8 27,9 23,8.5" stroke="#450a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M 23,2 C 27,1.5 29,3 29,5.5 C 29,8 27,9 23,8.5" stroke="#b91c1c" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                {/* Drip on second P */}
                                <path d="M 23,11 L 23,13" stroke="#b91c1c" strokeWidth="1" strokeLinecap="round" />
                                <circle cx="23" cy="13" r="0.6" fill="#b91c1c" />
                            </g>
                            
                            {/* Blood Splatters on Paper */}
                            <circle cx="33" cy="45" r="1.5" fill="#7f1d1d" opacity="0.9" />
                            <circle cx="34.5" cy="47" r="0.7" fill="#7f1d1d" opacity="0.9" />
                            <circle cx="68" cy="32" r="1.2" fill="#7f1d1d" opacity="0.9" />
                            <circle cx="69.5" cy="34" r="0.5" fill="#7f1d1d" opacity="0.9" />
                            {/* Drip running down from skull stamp area */}
                            <path d="M 42,66 L 42,74 C 42,75 41.5,76 41.5,77" stroke="#7f1d1d" strokeWidth="0.8" fill="none" opacity="0.85" />
                            <circle cx="41.5" cy="77" r="0.5" fill="#7f1d1d" opacity="0.85" />
                            
                            {/* Deep Slice Gash showing background and blood edge */}
                            <path d="M 28,49 Q 48,47 68,45 L 68,48.5 Q 48,50.5 28,52.5 Z" fill="#090d16" />
                            <path d="M 28,49 Q 48,47 68,45" stroke="#450a0a" strokeWidth="1.2" strokeLinecap="round" />
                            <path d="M 28,52.5 Q 48,50.5 68,48.5" stroke="#b91c1c" strokeWidth="0.8" strokeLinecap="round" />

                            {/* Aggressive Custom Skull Stamp */}
                            <g transform="translate(50, 56)" opacity="0.95">
                                {/* Sinister Horns */}
                                <path d="M -10,-12 C -18,-18 -22,-10 -15,-6 C -18,-8 -16,-13 -10,-11 Z" fill="#7f1d1d" />
                                <path d="M 10,-12 C 18,-18 22,-10 15,-6 C 18,-8 16,-13 10,-11 Z" fill="#7f1d1d" />
                                
                                {/* Skull Main Body - sharper cheekbones */}
                                <path d="M -12,-9 C -12,-21 12,-21 12,-9 C 12,-4 10,-1 7.5,1.5 L 7.5,6.5 C 7.5,8 5,9 0,9 C -5,9 -7.5,8 -7.5,6.5 L -7.5,1.5 C -10,-1 -12,-4 -12,-9 Z" fill="#991b1b" />
                                
                                {/* Sinister forehead cracks */}
                                <path d="M -2,-17 L -4,-13 L -2,-10" stroke="#020617" strokeWidth="0.8" fill="none" opacity="0.7" />
                                <path d="M 3,-18 L 1,-15 L 4,-12" stroke="#020617" strokeWidth="0.8" fill="none" opacity="0.7" />

                                {/* Menacing Angry Eyebrows */}
                                <path d="M -9.5,-12.5 L -2.5,-9" stroke="#020617" strokeWidth="2.2" strokeLinecap="round" />
                                <path d="M 9.5,-12.5 L 2.5,-9" stroke="#020617" strokeWidth="2.2" strokeLinecap="round" />
                                
                                {/* Deep triangular/angled eye sockets */}
                                <polygon points="-9,-10.5 -2.5,-7.5 -7.5,-5" fill="#020617" />
                                <polygon points="9,-10.5 2.5,-7.5 7.5,-5" fill="#020617" />
                                
                                {/* Piercing Glowing Eyes with filter */}
                                <circle cx="-6" cy="-8" r="1.5" fill="#ff3333" filter="url(#demonGlow)" className="animate-pulse" />
                                <circle cx="6" cy="-8" r="1.5" fill="#ff3333" filter="url(#demonGlow)" className="animate-pulse" />
                                <circle cx="-6" cy="-8" r="0.6" fill="#ffffff" />
                                <circle cx="6" cy="-8" r="0.6" fill="#ffffff" />
                                
                                {/* Nose Cavity (inverted heart/triangle) */}
                                <path d="M 0,-4.5 L -2,-1.5 L -0.5,-1 L 0,-2.5 L 0.5,-1 L 2,-1.5 Z" fill="#020617" />
                                
                                {/* Sharp Vicious Fangs & Jagged Teeth */}
                                <polygon points="-5.5,1.5 -3.5,4.5 -2.5,1.5" fill="#020617" />
                                <polygon points="5.5,1.5 3.5,4.5 2.5,1.5" fill="#020617" />
                                <polygon points="-1,1.5 0,3.5 1,1.5" fill="#020617" />
                                
                                {/* Lower jaw/teeth grid */}
                                <path d="M -5.5,6 L -5.5,4.5 L 5.5,4.5 L 5.5,6 Z" fill="#020617" />
                                <line x1="-3.5" y1="4.5" x2="-3.5" y2="6.5" stroke="#991b1b" strokeWidth="0.8" />
                                <line x1="0" y1="4.5" x2="0" y2="6.5" stroke="#991b1b" strokeWidth="0.8" />
                                <line x1="3.5" y1="4.5" x2="3.5" y2="6.5" stroke="#991b1b" strokeWidth="0.8" />
                            </g>
                        </g>

                        {/* 2. Knife Drop Shadow (rendered in front of paper, offset by translate) */}
                        <g className="animate-dpp-knife-reveal" transform="translate(2.5, 2.5)" opacity="0.35">
                            {/* Combined outline of the knife for shadow */}
                            <path d="M 52,44 L 72,24 C 73.5,22.5 76,22.5 77.5,24 L 79,25.5 C 80.5,27 80.5,29.5 79,31 L 59,51 Z" fill="#000" />
                            <rect x="48" y="41" width="6" height="18" transform="rotate(45 51 50)" fill="#000" rx="1" />
                            <path d="M 47,45 L 42,50 L 44,50 L 38,54 L 40,54 L 34,58 L 36,58 L 30,62 L 32,62 L 12,80 C 15,85 22,89 28,85 L 53,51 Z" fill="#000" />
                        </g>

                        {/* 3. Tactical Combat Knife (rendered in front of the paper for 100% visibility) */}
                        <g className="animate-dpp-knife-reveal">
                            {/* Knife Handle (tactical textured black grip) */}
                            <path d="M 52,44 L 72,24 C 73.5,22.5 76,22.5 77.5,24 L 79,25.5 C 80.5,27 80.5,29.5 79,31 L 59,51 Z" fill="#111827" stroke="#1e293b" strokeWidth="1" />
                            {/* Handle ridges */}
                            <line x1="57" y1="39" x2="61" y2="43" stroke="#1e293b" strokeWidth="1.2" />
                            <line x1="61" y1="35" x2="65" y2="39" stroke="#1e293b" strokeWidth="1.2" />
                            <line x1="65" y1="31" x2="69" y2="35" stroke="#1e293b" strokeWidth="1.2" />
                            <line x1="69" y1="27" x2="73" y2="31" stroke="#1e293b" strokeWidth="1.2" />
                            
                            {/* Glass Breaker Pommel at handle end */}
                            <polygon points="78,22 83,17 81,25" fill="#475569" stroke="#1f2937" strokeWidth="0.8" />
                            
                            {/* Tactical Crossguard (gunmetal) */}
                            <rect x="48" y="41" width="6" height="18" transform="rotate(45 51 50)" fill="#374151" rx="1" stroke="#0f172a" strokeWidth="1" />
                            
                            {/* Knife Blade (Thick Vicious Serrated Bowie/Survival Blade pointing down-left) */}
                            <path 
                                d="M 47,45 L 42,50 L 44,50 L 38,54 L 40,54 L 34,58 L 36,58 L 30,62 L 32,62 L 12,80 C 15,85 22,89 28,85 L 53,51 Z" 
                                fill="url(#bladeMetal)" 
                                stroke="#1e293b" 
                                strokeWidth="1" 
                            />
                            
                            {/* Blade center fuller/blood groove */}
                            <path d="M 44,49 L 26,67" stroke="#020617" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.75" />
                            <path d="M 44,49 L 26,67" stroke="#991b1b" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.5" />
                            
                            {/* Razor Sharp Cutting Edge Highlight */}
                            <path d="M 12,80 C 15,85 22,89 28,85 L 53,51" stroke="#f1f5f9" strokeWidth="1.2" fill="none" opacity="0.8" />
                            
                            {/* Dripping blood tip on blade */}
                            <path d="M 12,80 C 14,78 18,80 18,83 C 18,85 15,86 12,80 Z" fill="url(#bloodRed)" />
                            
                            {/* Active dripping blood drops */}
                            <circle cx="12" cy="80" r="1.2" fill="url(#bloodRed)" className="animate-blood-drip" />
                            <circle cx="12" cy="80" r="0.8" fill="url(#bloodRed)" className="animate-blood-drip" style={{ animationDelay: '0.8s' }} />
                            
                            {/* Blade Glint Sparkle */}
                            <g className="animate-blade-glint" style={{ transformOrigin: '12px 80px' }}>
                                <polygon points="12,72 14,78 20,80 14,82 12,88 10,82 4,80 10,78" fill="#ffffff" opacity="0.95" />
                                <circle cx="12" cy="80" r="1.5" fill="#ffffff" />
                            </g>
                        </g>
                    </svg>
                </div>
            );
        case 'module_conqueror':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center">
                    <div className="absolute w-36 h-36 bg-slate-900 border-2 border-yellow-500/30 rounded-2xl rotate-45 flex items-center justify-center shadow-2xl"></div>
                    <span className="text-[90px] absolute z-10 animate-crown-drop drop-shadow-[0_0_25px_rgba(234,179,8,0.6)] select-none">👑</span>
                </div>
            );
        case 'perfect_accuracy':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-fire-erupt">
                    <div className="absolute w-32 h-32 rounded-full bg-red-500/20 blur-3xl"></div>
                    <span className="text-[100px] drop-shadow-[0_0_30px_rgba(239,68,68,0.7)] select-none">🔥</span>
                </div>
            );
        case 'consistent_scholar':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center">
                    <span className="text-[85px] grayscale opacity-45 select-none animate-art-entrance">📅</span>
                    <span className="text-[100px] absolute z-10 animate-stamp-slam drop-shadow-[0_0_30px_rgba(34,197,94,0.6)] select-none">✅</span>
                </div>
            );
        case 'are_you_procrastinating':
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance overflow-hidden">
                    {/* Deep dark ambient room background */}
                    <div className="absolute w-40 h-40 rounded-full bg-slate-900/60 border border-slate-700/30 blur-2xl"></div>
                    
                    {/* SVG Graphic - Skeleton on Deathbed */}
                    <svg className="w-38 h-38 drop-shadow-[0_0_15px_rgba(16,185,129,0.15)]" viewBox="0 0 100 100">
                        {/* Background Wall & Floor division */}
                        <rect x="10" y="20" width="80" height="40" fill="#0f172a" rx="5" />
                        <rect x="10" y="60" width="80" height="20" fill="#020617" rx="5" />
                        
                        {/* Wall Clock at 11:00 PM */}
                        <g transform="translate(25, 30)">
                            <circle cx="0" cy="0" r="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                            <circle cx="0" cy="0" r="4.5" fill="#0f172a" />
                            <line x1="0" y1="0" x2="-2" y2="-2.5" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" /> {/* Hour hand at 11 */}
                            <line x1="0" y1="0" x2="0" y2="-3.5" stroke="#cbd5e1" strokeWidth="0.6" strokeLinecap="round" /> {/* Minute hand at 12 */}
                            <circle cx="0" cy="0" r="0.8" fill="#e2e8f0" />
                        </g>

                        {/* Heart Monitor (IV Stand Style) */}
                        <g transform="translate(80, 25)">
                            {/* Stand Pole */}
                            <rect x="-1" y="0" width="2" height="45" fill="#334155" />
                            {/* Monitor Screen Block */}
                            <rect x="-8" y="5" width="16" height="12" rx="1.5" fill="#020617" stroke="#475569" strokeWidth="1" />
                            <rect x="-6.5" y="6.5" width="13" height="9" rx="0.5" fill="#0f172a" />
                            
                            {/* Green ECG Pulse Line with animation */}
                            <path 
                                d="M -6.5,11 L -3,11 L -2,8 L -1,13 L 0,10 L 1,11 L 6.5,11" 
                                fill="none" 
                                stroke="#10b981" 
                                strokeWidth="0.8" 
                                className="animate-ecg-pulse"
                            />
                        </g>

                        {/* Bed Frame & Mattress */}
                        <g transform="translate(10, 60)">
                            {/* Headboard */}
                            <rect x="5" y="-18" width="6" height="24" rx="2" fill="#334155" />
                            <rect x="5" y="-15" width="8" height="15" rx="1" fill="#1e293b" />
                            
                            {/* Mattress Base */}
                            <rect x="10" y="0" width="60" height="8" rx="2" fill="#cbd5e1" />
                            <rect x="10" y="8" width="60" height="4" rx="1" fill="#475569" />
                            
                            {/* Footboard */}
                            <rect x="68" y="-5" width="4" height="15" rx="1.5" fill="#334155" />
                        </g>

                        {/* Pillow */}
                        <ellipse cx="25" cy="57" rx="8" ry="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.5" />

                        {/* Skeleton Body */}
                        <g transform="translate(20, 56)">
                            {/* Skull resting on pillow */}
                            <g transform="rotate(-15, 5, -2)">
                                {/* Skull cranium */}
                                <path d="M 1,-6 C 1,-11 9,-11 9,-6 C 9,-3 8,-1 6.5,0 L 6.5,2.5 C 6.5,3.5 3.5,3.5 3.5,2.5 L 3.5,0 C 2,-1 1,-3 1,-6 Z" fill="#f8fafc" />
                                {/* Hollow Eye Sockets */}
                                <circle cx="3.5" cy="-4" r="1.2" fill="#020617" />
                                <circle cx="6.5" cy="-4" r="1.2" fill="#020617" />
                                {/* Nose Cavity */}
                                <path d="M 5,-2 L 4.5,-1 L 5.5,-1 Z" fill="#020617" />
                                {/* Teeth lines */}
                                <line x1="4.5" y1="1" x2="4.5" y2="2" stroke="#020617" strokeWidth="0.5" />
                                <line x1="5.5" y1="1" x2="5.5" y2="2" stroke="#020617" strokeWidth="0.5" />
                            </g>
                            
                            {/* Neck & Spine (horizontal) */}
                            <line x1="10" y1="0" x2="25" y2="2" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
                            
                            {/* Ribcage */}
                            <path d="M 14,0 Q 14,-4 18,-3" fill="none" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" />
                            <path d="M 16,0.5 Q 16,-3.5 20,-2.5" fill="none" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" />
                            <path d="M 18,1 Q 18,-3 22,-2" fill="none" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" />
                            
                            <path d="M 14,0 Q 14,4 18,3" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" />
                            <path d="M 16,0.5 Q 16,3.5 20,2.5" fill="none" stroke="#e2e8f0" strokeWidth="1" strokeLinecap="round" />
                            
                            {/* Arm draped over the bed side */}
                            <g>
                                {/* Upper Arm bone */}
                                <line x1="16" y1="2" x2="18" y2="10" stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
                                {/* Elbow joint */}
                                <circle cx="18" cy="10" r="1" fill="#e2e8f0" />
                                {/* Forearm bone (hanging down) */}
                                <line x1="18" y1="10" x2="16" y2="18" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" />
                                {/* Skeletal Hand/Fingers */}
                                <path d="M 16,18 L 15,21 M 16,18 L 16.5,21 M 16,18 L 17.5,20.5" stroke="#e2e8f0" strokeWidth="0.8" fill="none" strokeLinecap="round" />
                            </g>
                        </g>

                        {/* Blanket covering lower body */}
                        <path 
                            d="M 35,55 C 45,52 65,54 70,58 L 70,68 L 35,68 Z" 
                            fill="#1e293b" 
                            stroke="#334155" 
                            strokeWidth="1" 
                        />
                        <path 
                            d="M 35,55 C 45,53 60,55 70,58 L 70,62 C 60,59 45,57 35,60 Z" 
                            fill="#334155" 
                        />
                        
                        {/* Floating "Z" Sleep Bubbles */}
                        <g fill="#cbd5e1" fontFamily="sans-serif" fontWeight="bold">
                            <text x="25" y="45" fontSize="6" className="animate-z-float-1">Z</text>
                            <text x="30" y="42" fontSize="5" className="animate-z-float-2">z</text>
                            <text x="22" y="38" fontSize="4" className="animate-z-float-3">z</text>
                        </g>
                    </svg>
                </div>
            );
        default:
            return (
                <div className="relative w-48 h-48 flex items-center justify-center animate-art-entrance">
                    <div className="absolute w-32 h-32 rounded-full bg-yellow-500/10 blur-2xl"></div>
                    <div className="absolute w-40 h-40 border-2 border-yellow-500/20 border-dashed rounded-full animate-spin" style={{ animationDuration: '12s' }}></div>
                    <span className="text-[95px] drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] select-none">{icon}</span>
                </div>
            );
    }
};

const AchievementToast = ({ achievement, onClose }) => {
    const [shared, setShared] = useState(false);
    const [rewardClaimed, setRewardClaimed] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPersisted, setIsPersisted] = useState(false);

    const cardRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (achievement) {
            // Keep display until user clicks to dismiss
        }
    }, [achievement, onClose]);

    const stopAutoClose = () => {
        setIsPersisted(true);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    const handleShare = (e) => {
        e.stopPropagation();
        stopAutoClose();

        if (isGenerating) return;
        setIsGenerating(true);
        setStatusMessage('Generating shareable card...');

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 500;
            canvas.height = 600;
            const ctx = canvas.getContext('2d');

            // 1. Draw Background Gradient
            const grad = ctx.createLinearGradient(0, 0, 0, 600);
            grad.addColorStop(0, '#0f172a');
            grad.addColorStop(1, '#020617');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 500, 600);

            // 2. Draw Card Border
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 496, 596);

            // 3. Draw Header Brand Text
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#eab308'; // yellow-500
            ctx.font = '900 10px sans-serif';
            ctx.fillText('ACHIEVEMENT UNLOCKED', 250, 50);

            // 4. Draw Title
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 26px sans-serif';
            ctx.fillText(achievement.title, 250, 360);

            // 5. Draw Divider Line
            const divGrad = ctx.createLinearGradient(150, 0, 350, 0);
            divGrad.addColorStop(0, 'rgba(234, 179, 8, 0)');
            divGrad.addColorStop(0.5, 'rgba(234, 179, 8, 0.8)');
            divGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
            ctx.fillStyle = divGrad;
            ctx.fillRect(150, 385, 200, 2);

            // 6. Draw Description (with word wrapping)
            ctx.fillStyle = '#94a3b8';
            ctx.font = '500 14px sans-serif';
            
            const wrapText = (text, x, y, maxWidth, lineHeight) => {
                const words = text.split(' ');
                let line = '';
                let currentY = y;
                for (let n = 0; n < words.length; n++) {
                    let testLine = line + words[n] + ' ';
                    let metrics = ctx.measureText(testLine);
                    let testWidth = metrics.width;
                    if (testWidth > maxWidth && n > 0) {
                        ctx.fillText(line, x, currentY);
                        line = words[n] + ' ';
                        currentY += lineHeight;
                    } else {
                        line = testLine;
                    }
                }
                ctx.fillText(line, x, currentY);
            };

            wrapText(achievement.description, 250, 420, 360, 22);

            // 7. Draw branding footer
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('VINYAS STUDY TRACKER', 250, 530);

            // Finalize Share and Save PNG
            const completeShare = async (canvasNode) => {
                try {
                    canvasNode.toBlob(async (blob) => {
                        if (!blob) throw new Error('Blob generation failed');

                        // Trigger download
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${achievement.id || 'achievement'}-unlocked.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);

                        // Try to copy to clipboard
                        let copied = false;
                        if (navigator.clipboard && navigator.clipboard.write) {
                            try {
                                await navigator.clipboard.write([
                                    new ClipboardItem({ [blob.type]: blob })
                                ]);
                                copied = true;
                            } catch (clipErr) {
                                console.warn('Image clipboard write failed:', clipErr);
                            }
                        }

                        setShared(true);
                        if (copied) {
                            setStatusMessage('Image copied to clipboard & downloaded! 📸');
                        } else {
                            const textToCopy = `🏆 I unlocked the "${achievement.title}" achievement in Vinyas! - "${achievement.description}"`;
                            try {
                                await navigator.clipboard.writeText(textToCopy);
                                setStatusMessage('Image downloaded & share text copied! 📝');
                            } catch (txtErr) {
                                setStatusMessage('Image downloaded successfully! 💾');
                            }
                        }
                        setIsGenerating(false);
                    }, 'image/png');
                } catch (err) {
                    console.error('Blob callback error:', err);
                    setStatusMessage('Error creating image file.');
                    setIsGenerating(false);
                }
            };

            // 8. Draw the Visual Art
            const cardNode = cardRef.current;
            const svgEl = cardNode ? cardNode.querySelector('svg') : null;

            if (svgEl) {
                const serializer = new XMLSerializer();
                let svgString = serializer.serializeToString(svgEl);

                // Fetch browser computed styles to resolve Tailwind classes and theme colors
                const computedStyle = window.getComputedStyle(svgEl);
                const computedColor = computedStyle.color || '#ffffff';
                const computedFilter = computedStyle.filter || 'none';

                // Resolve all dynamic currentColor inherits with the computed hex/rgb color
                svgString = svgString.replaceAll('currentColor', computedColor);

                // Inject dynamic style block containing active color and filters directly into SVG
                const styleBlock = `<style>
                    svg {
                        color: ${computedColor};
                        filter: ${computedFilter !== 'none' ? computedFilter : ''};
                    }
                </style>`;

                // Add explicit width/height and namespaces to ensure rendering inside Image
                if (!svgString.includes('xmlns=')) {
                    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                if (!svgString.includes('width=')) {
                    svgString = svgString.replace('<svg', '<svg width="180" height="180"');
                } else {
                    svgString = svgString.replace(/width="[^"]*"/, 'width="180"').replace(/height="[^"]*"/, 'height="180"');
                }

                // Insert the style block right after the opening svg tag bracket
                const insertIndex = svgString.indexOf('>') + 1;
                svgString = svgString.slice(0, insertIndex) + styleBlock + svgString.slice(insertIndex);

                // Create a standard URL-encoded SVG data URL (robust across all modern browsers)
                const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 160, 100, 180, 180);
                    completeShare(canvas);
                };
                img.onerror = (errEvent) => {
                    console.error('Failed to draw SVG, fallback to emoji:', errEvent);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '80px sans-serif';
                    ctx.fillText(achievement.icon || '🏆', 250, 190);
                    completeShare(canvas);
                };
                img.src = svgUrl;
            } else {
                // Emoji drawing
                ctx.fillStyle = '#ffffff';
                ctx.font = '80px sans-serif';
                ctx.fillText(achievement.icon || '🏆', 250, 190);
                completeShare(canvas);
            }
        } catch (err) {
            console.error('Canvas share generation failed:', err);
            setStatusMessage('Failed to generate image.');
            setIsGenerating(false);
        }
    };

    const handleClaimReward = (e) => {
        e.stopPropagation();
        stopAutoClose();

        if (rewardClaimed) return;

        setRewardClaimed(true);
        setStatusMessage('Claimed: +100 Focus XP & Customized Profile Theme! 🌟');
    };

    if (!achievement) return null;

    return (
        <div 
            onClick={onClose}
            className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md select-none overflow-hidden cursor-pointer ${
                isPersisted ? 'opacity-100' : 'animate-cinematic-unlock'
            }`}
            title="Click anywhere to dismiss"
        >
            {/* Ambient beams */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.3)_0%,rgba(0,0,0,0.85)_80%)] pointer-events-none"></div>
            
            <div className="w-full flex flex-col items-center justify-center gap-6 z-10">
                {/* Achievement Unlocked Header (Outside the card, not captured on share) */}
                <div className="text-center animate-text-fade-up">
                    <div className="text-[10px] uppercase font-black text-yellow-500 tracking-[0.3em] drop-shadow-[0_0_8px_rgba(234,179,8,0.3)] animate-pulse">
                        Achievement Unlocked!
                    </div>
                </div>

                {/* Achievement Card Wrapper (Capturable Node) */}
                <div 
                    ref={cardRef}
                    onClick={(e) => e.stopPropagation()} // Clicking inside card shouldn't close it
                    className="flex flex-col items-center justify-center p-8 rounded-3xl bg-slate-950/70 border border-slate-800/85 backdrop-blur-sm max-w-xs w-full mx-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] animate-text-fade-up select-none cursor-default"
                >
                    {/* Visual Art */}
                    <div className="mb-5 flex justify-center items-center">
                        <SpecialAchievementArt id={achievement.id} icon={achievement.icon} />
                    </div>

                    {/* Text section (Only title & description inside the card) */}
                    <div className="text-center flex flex-col items-center">
                        <h1 className="text-2xl font-extrabold text-white tracking-wide mb-2.5 drop-shadow-md">
                            {achievement.title}
                        </h1>
                        <p className="text-xs text-slate-300 leading-relaxed font-semibold opacity-90 max-w-[240px]">
                            {achievement.description}
                        </p>
                    </div>
                </div>

                {/* Interactive Action Buttons */}
                <div className="flex gap-4 mt-2 animate-text-fade-up" style={{ animationDelay: '0.2s' }}>
                    <button 
                        onClick={handleShare}
                        disabled={isGenerating}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-bold text-xs transition-all duration-300 cursor-pointer ${
                            shared 
                            ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.15)]' 
                            : 'bg-slate-950 border-slate-800 hover:border-yellow-500/50 text-slate-200 hover:text-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.15)] active:scale-95'
                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <i className={`ph-bold ${isGenerating ? 'ph-spinner animate-spin' : shared ? 'ph-check-circle' : 'ph-share-network'} text-base`}></i>
                        {isGenerating ? 'Generating...' : shared ? 'Shared!' : 'Share Progress'}
                    </button>

                    <button 
                        onClick={handleClaimReward}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-bold text-xs transition-all duration-300 cursor-pointer ${
                            rewardClaimed 
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]' 
                            : 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/30 hover:border-yellow-500/60 text-yellow-400 hover:text-yellow-300 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)] active:scale-95'
                        }`}
                        disabled={rewardClaimed}
                    >
                        <i className={`ph-bold ${rewardClaimed ? 'ph-sparkles' : 'ph-gift'} text-base`}></i>
                        {rewardClaimed ? 'Reward Claimed!' : 'Claim Reward'}
                    </button>
                </div>

                {/* Micro-interaction status notification */}
                {statusMessage && (
                    <div className="absolute bottom-12 px-5 py-2 rounded-full bg-slate-950/90 border border-slate-800 text-xs text-yellow-400 font-semibold shadow-2xl animate-bounce flex items-center gap-2 z-20">
                        <span>✨</span>
                        <span>{statusMessage}</span>
                        <span>✨</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AchievementToast;
