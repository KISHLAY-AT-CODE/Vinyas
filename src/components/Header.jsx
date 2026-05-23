import React, { useRef } from 'react';
import { YogiLogo } from '../data/constants';
import { useToast } from './ToastContext';

const Header = ({ userName, syncId, targetDate, setTargetDate, daysLeft, cohort, openCohortSetup, onExportData, onImportData }) => {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();

    const handleFileImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result);
                if (onImportData) {
                    onImportData(json);
                }
            } catch (err) {
                showToast("Failed to parse JSON backup file: " + err.message, "error");
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <header className="bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800/80 text-white py-6 px-6 shadow-2xl mb-6 relative overflow-hidden">
            {/* Ambient background glow matching the icon's radial gradient */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
            
            {/* The thin, glowing brand border bottom matching the icon's key colors */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-600 via-red-500 to-blue-600 opacity-60"></div>
            
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6 relative z-10">
                <div className="flex items-center gap-5">
                    <div className="relative group">
                        {/* Glow effect around the circular logo */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full blur-md opacity-35 group-hover:opacity-60 transition-opacity duration-300"></div>
                        <YogiLogo className="w-16 h-16 relative z-10 transition-transform duration-300 group-hover:scale-[1.03] cursor-pointer" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3.5">
                            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                                {userName || 'Vinyas'}
                            </h1>
                            <button 
                                onClick={openCohortSetup}
                                className="bg-slate-900/60 hover:bg-slate-800/80 border border-orange-500/20 hover:border-orange-500/50 text-orange-400 hover:text-orange-300 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md transition-all duration-300"
                                title="Change Target Exam Cohort"
                            >
                                Target: {cohort || 'BITSAT'}
                            </button>
                        </div>
                        <p className="text-slate-400 mt-1 font-medium text-sm flex items-center gap-1.5 flex-wrap">
                            <i className="ph-fill ph-cloud-check text-orange-500 text-lg animate-pulse"></i> 
                            <span>Cross-Device Cloud Sync Active (ID: <span className="font-mono text-xs text-orange-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">{syncId}</span>)</span>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(syncId);
                                    showToast("Sync ID copied to clipboard!", "success");
                                }}
                                className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-900/60 hover:bg-slate-850 hover:text-orange-400 border border-slate-850 hover:border-orange-500/20 transition-all cursor-pointer active:scale-90"
                                title="Copy Sync ID to clipboard"
                            >
                                <i className="ph-bold ph-copy text-xs"></i>
                            </button>
                        </p>
                    </div>
                </div>
                
                {/* Modernized control dashboard panels with glassmorphism */}
                <div className="flex flex-col md:flex-row items-center gap-4 w-full lg:w-auto justify-end">
                    {/* Backup & Import Panel */}
                    {syncId && (
                        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 px-4 py-3 rounded-2xl flex items-center gap-3.5 shadow-xl hover:border-slate-700/80 transition-all duration-300 w-full md:w-auto justify-center">
                            <button 
                                onClick={onExportData}
                                className="bg-slate-950/60 hover:bg-slate-900 border border-slate-800/60 hover:border-orange-500/35 text-slate-350 hover:text-orange-400 text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-inner transition-all duration-300 active:scale-95"
                                title="Export current sync data to JSON backup"
                            >
                                <i className="ph-bold ph-download-simple text-sm"></i>
                                <span>Export</span>
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-slate-950/60 hover:bg-slate-900 border border-slate-800/60 hover:border-orange-500/35 text-slate-350 hover:text-orange-400 text-xs font-extrabold px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-inner transition-all duration-300 active:scale-95"
                                title="Import JSON backup and sync to DB"
                            >
                                <i className="ph-bold ph-upload-simple text-sm"></i>
                                <span>Import</span>
                            </button>
                            <input 
                                type="file"
                                ref={fileInputRef}
                                accept=".json"
                                onChange={handleFileImport}
                                className="hidden"
                            />
                        </div>
                    )}

                    {/* Target Date & Countdown Panel */}
                    <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 px-6 py-4 rounded-2xl flex items-center gap-6 shadow-xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300 w-full md:w-auto justify-between md:justify-start">
                        <div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Target Date</div>
                            <input 
                                type="date" 
                                value={targetDate} 
                                onChange={e => setTargetDate(e.target.value)} 
                                className="bg-transparent border-b border-slate-800 text-slate-200 font-semibold outline-none focus:border-orange-500/60 transition-colors cursor-pointer py-0.5" 
                            />
                        </div>
                        
                        <div className="w-px h-10 bg-slate-800"></div>
                        
                        <div className="flex flex-col items-end gap-2">
                            <div className="bg-slate-950/60 border border-slate-800/80 px-4 py-2 rounded-xl flex items-center gap-3 shadow-inner group-hover:border-orange-500/10 transition-colors duration-300">
                                <i className="ph-fill ph-hourglass-high text-orange-500 animate-pulse-slow text-lg"></i>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent leading-none">{daysLeft}</span>
                                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">Days to {cohort ? cohort.toUpperCase() : 'EXAM'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
