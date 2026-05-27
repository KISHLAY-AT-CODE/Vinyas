import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { YogiLogo } from '../data/constants';
import { useToast } from './ToastContext';
import { VINYAS_APP_VERSION, VINYAS_EXTENSION_VERSION } from '../data/version';

const Header = ({ 
    userName, 
    syncId, 
    targetDate, 
    setTargetDate, 
    daysLeft, 
    cohort, 
    openCohortSetup, 
    onOpenProfile,
    onExportData, 
    onImportData, 
    onLogout, 
    onDeleteAccount, 
    onNavigateToExtension, 
    onOpenBackupSettings, 
    onOpenChangeLog, 
    onSaveTargetDate, 
    showExtensionWarning,
    searchQuery,
    setSearchQuery,
    isSearchFocused,
    setIsSearchFocused,
    searchResults,
    handleInlineSearchSelect
}) => {
    const fileInputRef = useRef(null);
    const { showToast } = useToast();
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [showSyncId, setShowSyncId] = React.useState(false);
    const [datePopupOpen, setDatePopupOpen] = React.useState(false);
    const [isHeaderCollapsed, setIsHeaderCollapsed] = React.useState(() => {
        return localStorage.getItem('vinyas_header_collapsed') === 'true';
    });
    const dropdownRef = React.useRef(null);
    const searchRef = React.useRef(null);
    const datePopupRef = React.useRef(null);
    const datePopupBtnRef = React.useRef(null);
    const searchInputRef = React.useRef(null);

    const [localDate, setLocalDate] = React.useState(targetDate || '');
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        setLocalDate(targetDate || '');
    }, [targetDate]);

    const toggleHeaderCollapse = () => {
        const newState = !isHeaderCollapsed;
        setIsHeaderCollapsed(newState);
        localStorage.setItem('vinyas_header_collapsed', String(newState));
    };

    const handleDateSave = async () => {
        if (!localDate) return;
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (onSaveTargetDate) {
                await onSaveTargetDate(localDate);
            } else {
                setTargetDate(localDate);
            }
            showToast("Target date updated and synced!", "success");
            setDatePopupOpen(false);
        } catch (err) {
            showToast("Failed to save target date: " + err.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setSettingsOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
            if (datePopupRef.current && !datePopupRef.current.contains(event.target)) {
                if (!datePopupBtnRef.current || !datePopupBtnRef.current.contains(event.target)) {
                    setDatePopupOpen(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [setIsSearchFocused]);

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
        <header className={`bg-gradient-to-b from-slate-950/90 via-slate-900/90 to-slate-950/90 backdrop-blur-md border-b border-slate-800/80 text-white px-4 shadow-2xl mb-6 sticky top-0 z-40 transition-all duration-300 ${isHeaderCollapsed ? 'py-2.5' : 'py-5'}`}>
            {/* Ambient background glow container */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px]"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px]"></div>
            </div>
            
            {/* Brand Border Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-600 via-red-500 to-blue-600 opacity-60"></div>

            {/* Red Extension Alert Banner */}
            {!isHeaderCollapsed && showExtensionWarning && (
                <div className="max-w-7xl mx-auto mb-3 bg-rose-950/65 border border-rose-900/60 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in relative z-50">
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 flex-shrink-0 animate-pulse">
                            <i className="ph-bold ph-warning text-lg"></i>
                        </span>
                        <div>
                            <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider">
                                Vinyas Tracker Extension Action Required
                            </h4>
                            <p className="text-[11px] font-semibold text-slate-300 mt-0.5 leading-relaxed">
                                Missing or outdated extension detected (required: v1.2.1). Please download and load the updated extension in your browser.
                            </p>
                        </div>
                    </div>
                    <a
                        href="/Vinyas_Extension.zip"
                        download="Vinyas_Extension.zip"
                        className="bg-rose-600 hover:bg-rose-500 border border-rose-500/30 text-white text-[11px] font-black px-5 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-rose-950/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                        title="Download Extension ZIP file"
                    >
                        <i className="ph-bold ph-download-simple text-sm"></i>
                        <span>Download Extension v1.2.1</span>
                    </a>
                </div>
            )}
            
            <div className="w-full flex items-center justify-between gap-4 sm:gap-6 relative z-10">
                {/* LEFT SIDE: Brand Logo, name & version (no box) */}
                <div className={`flex items-center transition-all duration-300 shrink-0 ${isHeaderCollapsed ? 'gap-3' : 'gap-5'}`}>
                    <div className="relative group shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-red-500 rounded-full blur-md opacity-35 group-hover:opacity-60 transition-opacity duration-300"></div>
                        <YogiLogo className={`relative z-10 transition-all duration-300 group-hover:scale-[1.03] cursor-pointer ${isHeaderCollapsed ? 'w-10 h-10' : 'w-14 h-14'}`} />
                    </div>

                    {!isHeaderCollapsed ? (
                        /* Expanded Brand text & version stack */
                        <div className="flex flex-col justify-center animate-fade-in">
                            <h1 
                                className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 via-red-500 via-pink-500 via-blue-500 to-yellow-400 bg-clip-text text-transparent leading-none mb-1.5 drop-shadow-[0_2px_10px_rgba(249,115,22,0.35)]"
                                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                            >
                                Vinyas
                            </h1>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)] whitespace-nowrap">
                                    v{VINYAS_APP_VERSION || '1.2.1'}
                                </span>
                                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] whitespace-nowrap">
                                    ext v{VINYAS_EXTENSION_VERSION || '1.2.1'}
                                </span>
                            </div>
                        </div>
                    ) : (
                        /* Collapsed username at left corner next to logo */
                        <span className="text-sm sm:text-base font-black bg-gradient-to-r from-orange-400 via-red-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(249,115,22,0.25)] tracking-tight truncate max-w-[150px] animate-fade-in shrink-0">
                            {userName || 'User'}
                        </span>
                    )}
                </div>

                {/* GREETINGS & SETTINGS PILL: Only shown when expanded */}
                {!isHeaderCollapsed && (
                    <>
                        {/* Divider */}
                        <div className="w-px h-8 bg-slate-600/60 shrink-0 animate-fade-in mx-3 sm:mx-5"></div>

                        {/* Greetings stack and settings icon in glassy look */}
                        <div className="bg-slate-900/40 backdrop-blur-md border border-white/20 px-5 py-2.5 rounded-2xl flex items-center gap-5 shadow-[0_0_20px_rgba(249,115,22,0.12)] hover:shadow-[0_0_25px_rgba(249,115,22,0.18)] transition-all duration-300 shrink-0 animate-fade-in">
                            <div className="flex items-center gap-1.5 text-base sm:text-lg tracking-wide whitespace-nowrap min-w-0">
                                <span className="font-semibold text-slate-400 shrink-0">Greetings</span>
                                <span className="font-black bg-gradient-to-r from-orange-400 via-red-500 to-yellow-400 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(249,115,22,0.25)] truncate max-w-[80px] sm:max-w-[150px] md:max-w-none">
                                    {userName || 'User'}
                                </span>
                            </div>

                            {/* Separation Line */}
                            <div className="w-px h-6 bg-slate-600/60"></div>

                            {/* Settings Dropdown right beside greetings */}
                            <div className="relative" ref={dropdownRef}>
                                <button 
                                    onClick={() => setSettingsOpen(!settingsOpen)}
                                    className="w-10 h-10 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/80 hover:border-orange-500/35 rounded-xl flex items-center justify-center text-slate-300 hover:text-orange-400 shadow transition-all active:scale-95 cursor-pointer"
                                    title="Open Settings"
                                >
                                    <i className={`ph-bold ph-gear text-lg transition-transform duration-500 ${settingsOpen ? 'rotate-90 text-orange-400' : ''}`}></i>
                                </button>
                                
                                {settingsOpen && (
                                    <div className="absolute left-0 mt-2 w-52 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-pop-in flex flex-col gap-1">
                                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-3 py-1.5 border-b border-slate-800">
                                            System Settings
                                        </div>
                                        
                                        {/* Relocated Sync ID Section */}
                                        <div className="p-2 border-b border-slate-800 flex flex-col gap-1.5 bg-slate-900/40 rounded-lg m-1">
                                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 uppercase tracking-wider px-1">
                                                <span>Sync ID</span>
                                                <button 
                                                    onClick={() => setShowSyncId(!showSyncId)}
                                                    className="text-orange-400 hover:text-orange-300 font-black cursor-pointer"
                                                >
                                                    {showSyncId ? "Hide" : "Show"}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-md">
                                                <span className="font-mono text-[10px] text-orange-400 font-bold flex-1 truncate select-all">
                                                    {showSyncId ? syncId : '••••••••••••••••'}
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(syncId);
                                                        showToast("Sync ID copied to clipboard!", "success");
                                                    }}
                                                    className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-orange-400 border border-slate-800 transition-all flex items-center justify-center cursor-pointer"
                                                    title="Copy Sync ID"
                                                >
                                                    <i className="ph-bold ph-copy text-[10px]"></i>
                                                </button>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onOpenProfile();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-orange-400 hover:text-orange-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-user-circle text-sm text-orange-500"></i>
                                            <span>Profile Settings</span>
                                        </button>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                openCohortSetup();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-orange-400 hover:text-orange-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-books text-sm text-orange-500"></i>
                                            <span>Syllabus: {cohort || 'BITSAT'}</span>
                                        </button>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onNavigateToExtension();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-puzzle-piece text-sm text-emerald-500"></i>
                                            <span>Extension & Tutorials</span>
                                        </button>

                                        <div className="h-px bg-slate-800 my-1"></div>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onExportData();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-download-simple text-sm text-slate-400"></i>
                                            <span>Export Backup (JSON)</span>
                                        </button>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                fileInputRef.current?.click();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-upload-simple text-sm text-slate-400"></i>
                                            <span>Import Backup (JSON)</span>
                                        </button>

                                        <div className="h-px bg-slate-800 my-1"></div>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onOpenBackupSettings();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-envelope-simple text-sm text-slate-400"></i>
                                            <span>Backup Settings</span>
                                        </button>

                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onOpenChangeLog();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-newspaper text-sm text-slate-400"></i>
                                            <span>Change Logs</span>
                                        </button>
                                        
                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onLogout();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 flex items-center gap-2.5 transition-all cursor-pointer"
                                        >
                                            <i className="ph-bold ph-sign-out text-sm text-slate-400"></i>
                                            <span>Logout Session</span>
                                        </button>
                                        
                                        <button 
                                            onClick={() => {
                                                setSettingsOpen(false);
                                                onDeleteAccount();
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 flex items-center gap-2.5 transition-all cursor-pointer border border-transparent hover:border-rose-900/30"
                                        >
                                            <i className="ph-bold ph-trash text-sm text-rose-500"></i>
                                            <span>Delete Account</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* CENTRAL SEARCH BAR: Spans dynamically over available middle space */}
                <div className={`relative transition-all duration-300 ${isSearchFocused ? 'flex-1 min-w-[150px] mx-2' : 'mx-2 md:flex-1 md:min-w-[150px]'}`} ref={searchRef}>
                    <div 
                        onClick={() => {
                            if (!isSearchFocused) {
                                setIsSearchFocused(true);
                                setTimeout(() => searchInputRef.current?.focus(), 50);
                            }
                        }}
                        className={`flex items-center bg-slate-900/60 border ${isSearchFocused ? 'border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.15)] px-4 py-3' : 'border-slate-800 p-3 md:px-4 md:py-3'} rounded-xl cursor-pointer transition-all duration-300 justify-center`}
                    >
                        <i className={`ph-bold ph-magnifying-glass text-base ${isSearchFocused ? 'text-orange-400' : 'text-slate-400'} shrink-0`}></i>
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search chapters..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            className={`bg-transparent text-slate-200 outline-none placeholder-slate-500 text-sm font-semibold transition-all duration-300 ${isSearchFocused ? 'w-full ml-2.5 opacity-100' : 'w-0 md:w-full md:ml-2.5 overflow-hidden opacity-0 md:opacity-100'}`}
                        />
                        {isSearchFocused && searchQuery && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery('');
                                }} 
                                className="text-slate-400 hover:text-slate-300 ml-1.5 cursor-pointer shrink-0"
                            >
                                <i className="ph-fill ph-x-circle text-base"></i>
                            </button>
                        )}
                    </div>
                    {isSearchFocused && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden modal-animate max-h-60 overflow-y-auto">
                            {searchResults.map((res, i) => (
                                <div 
                                    key={i} 
                                    onMouseDown={() => {
                                        handleInlineSearchSelect(res.sIdx, res.cIdx);
                                        setIsSearchFocused(false);
                                    }} 
                                    className="px-3.5 py-2.5 hover:bg-slate-800 cursor-pointer flex items-center justify-between border-b border-slate-800 last:border-0 transition-colors"
                                >
                                    <span className="font-semibold text-xs text-slate-300">{res.name}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-black text-white ${res.color}`}>{res.subject}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE: Countdown and Hidden Input */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Countdown Widget */}
                    <div className={`bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl flex items-center shadow-xl relative overflow-hidden group hover:border-slate-700/80 transition-all duration-300 ${isHeaderCollapsed ? 'px-4 py-2 gap-3' : 'px-8 py-3.5 gap-6'}`}>
                        <div className="flex flex-col items-end justify-center">
                            <span className={`font-black bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent leading-none ${isHeaderCollapsed ? 'text-2xl' : 'text-3xl'}`}>{daysLeft}</span>
                            {!isHeaderCollapsed && (
                                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mt-0.5">days</span>
                            )}
                        </div>
                        
                        {!isHeaderCollapsed && (
                            <>
                                <div className="w-px h-8 bg-slate-800"></div>
                                
                                <div className="relative flex items-center justify-center">
                                    <button 
                                        type="button"
                                        ref={datePopupBtnRef}
                                        onClick={() => setDatePopupOpen(!datePopupOpen)}
                                        className="w-10 h-10 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/60 hover:border-orange-500/35 text-slate-300 hover:text-orange-400 rounded-xl flex items-center justify-center shadow-inner transition-all duration-300 active:scale-95 cursor-pointer relative"
                                        title="Change Target Date"
                                    >
                                        <i className="ph-bold ph-calendar-blank text-lg"></i>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Hidden file input for import */}
                    <input 
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        onChange={handleFileImport}
                        className="hidden"
                    />

                    {/* Collapse/Expand Toggle Button: Always visible at the absolute rightmost edge */}
                    <button 
                        onClick={toggleHeaderCollapse}
                        className="w-8 h-8 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-orange-400 flex items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer shrink-0"
                        title={isHeaderCollapsed ? "Expand Header" : "Collapse Header"}
                    >
                        <i className={`ph-bold ${isHeaderCollapsed ? 'ph-caret-down' : 'ph-caret-up'} text-base`}></i>
                    </button>
                </div>
            </div>

            {/* Target Date Picker Modal Overlay */}
            {datePopupOpen && createPortal(
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDatePopupOpen(false)}>
                    <div 
                        ref={datePopupRef}
                        className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-sm overflow-hidden animate-pop-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                <i className="ph-bold ph-calendar-blank text-orange-400"></i> Set Target Date
                            </h3>
                            <button 
                                onClick={() => setDatePopupOpen(false)}
                                className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-805 text-slate-455 hover:text-white flex items-center justify-center border border-slate-800 transition-colors cursor-pointer"
                            >
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>
                        <div className="space-y-4">
                            <input 
                                type="date" 
                                value={localDate} 
                                onChange={e => setLocalDate(e.target.value)} 
                                className="bg-slate-900 border border-slate-800 text-slate-200 text-sm font-semibold outline-none rounded-xl p-3 w-full focus:border-orange-500/50 transition-all" 
                            />
                            <button 
                                onClick={handleDateSave}
                                disabled={isSaving}
                                className="w-full bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 border border-orange-500/30 text-white text-xs font-black py-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                                {isSaving ? 'Saving...' : 'Save Date'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </header>
    );
};

export default Header;
