import React, { useState } from 'react';

const WhatsNewModal = ({ isOpen, changelog, currentExtVersion, installedExtVersion, onDismiss, onExport, email }) => {
    const [showBackupWarning, setShowBackupWarning] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);

    if (!isOpen) return null;

    const slides = [
        { url: '/bg1.png', title: 'Theme Preview - Color-Infused Preset Design' },
        { url: '/bg2.png', title: 'Custom Themes Panel - Drag alignment, Blur & Opacity' }
    ];

    const isExtUpToDate = installedExtVersion === currentExtVersion;

    const handleGotItClick = () => {
        setShowBackupWarning(true);
    };

    const handleExportClick = async () => {
        if (onExport) {
            await onExport();
        }
        onDismiss();
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
            {/* The modal card container */}
            <div className="bg-slate-900/95 border border-slate-750/80 rounded-[2rem] shadow-2xl max-w-xl w-full overflow-hidden animate-pop-in flex flex-col max-h-[85vh] relative">
                {/* Visual Accent Glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

                {!showBackupWarning ? (
                    <>
                        {/* Header Section */}
                        <div className="p-6 border-b border-slate-800/60 bg-slate-950/30 flex justify-between items-center relative z-10">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🎉</span>
                                <div>
                                    <h2 className="text-xl font-black bg-gradient-to-r from-orange-400 via-pink-500 to-indigo-400 bg-clip-text text-transparent">
                                        Themes Update!
                                    </h2>
                                    <p className="text-xs text-slate-500 font-bold tracking-wider mt-0.5">
                                        Version {changelog.version} • Released on {changelog.date}
                                    </p>
                                </div>
                            </div>
                            {/* Badge */}
                            <span className="bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-widest animate-pulse">
                                New Update
                            </span>
                        </div>

                        {/* Scrollable Changelog Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6 relative z-10 custom-scrollbar">
                            {/* Carousel Section */}
                            <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/40 group shadow-inner mb-2">
                                <div className="absolute inset-0 flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
                                    {slides.map((slide, idx) => (
                                        <div key={idx} className="min-w-full h-full relative">
                                            <img src={slide.url} alt={slide.title} className="w-full h-full object-cover select-none pointer-events-none" />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-4 pt-12">
                                                <p className="text-xs font-bold text-slate-100 tracking-wide">{slide.title}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Left/Right Buttons */}
                                <button 
                                    onClick={() => setActiveSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1))}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800/60 flex items-center justify-center text-slate-200 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                                    title="Previous Slide"
                                    type="button"
                                >
                                    <i className="ph-bold ph-caret-left text-sm"></i>
                                </button>
                                <button 
                                    onClick={() => setActiveSlide(prev => (prev === slides.length - 1 ? 0 : prev + 1))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800/60 flex items-center justify-center text-slate-200 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                                    title="Next Slide"
                                    type="button"
                                >
                                    <i className="ph-bold ph-caret-right text-sm"></i>
                                </button>
                                
                                {/* Dot Indicators */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                                    {slides.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveSlide(idx)}
                                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${activeSlide === idx ? 'bg-orange-500 w-3' : 'bg-slate-650 hover:bg-slate-550'}`}
                                            title={`Go to slide ${idx + 1}`}
                                            type="button"
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Core Working Changes */}
                            {changelog.coreChanges && changelog.coreChanges.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-2">
                                        <i className="ph-bold ph-gear text-orange-500 text-lg"></i>
                                        <span>Core Working Changes</span>
                                    </h3>
                                    <ul className="space-y-2.5 pl-7">
                                        {changelog.coreChanges.map((change, index) => (
                                            <li key={index} className="text-slate-350 text-xs font-semibold leading-relaxed list-disc hover:text-slate-250 transition-colors">
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* What's Changed */}
                            {changelog.clientChanges && changelog.clientChanges.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-2">
                                        <i className="ph-bold ph-sparkle text-blue-500 text-lg"></i>
                                        <span>What's Changed</span>
                                    </h3>
                                    <ul className="space-y-2.5 pl-7">
                                        {changelog.clientChanges.map((change, index) => (
                                            <li key={index} className="text-slate-350 text-xs font-semibold leading-relaxed list-disc hover:text-slate-250 transition-colors">
                                                {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Action Required Box / Extension Version Warning */}
                            <div className="border-t border-slate-850 pt-5">
                                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isExtUpToDate ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                            <i className={`ph-bold ${isExtUpToDate ? 'ph-check-circle' : 'ph-warning'} text-lg`}></i>
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-extrabold text-white">
                                                Vinyas Extension Check
                                            </h4>
                                            <p className="text-[11px] font-semibold text-slate-400 leading-relaxed">
                                                {isExtUpToDate ? (
                                                    <span className="text-emerald-400">Vinyas Extension is up to date (installed: v{installedExtVersion}). Good to go!</span>
                                                ) : installedExtVersion ? (
                                                    <span>
                                                        Your Vinyas Extension is outdated (installed: <span className="font-mono text-amber-400 font-black">v{installedExtVersion}</span>, required: <span className="font-mono text-orange-400 font-black">v{currentExtVersion}</span>).
                                                    </span>
                                                ) : (
                                                    <span>
                                                        Vinyas Extension was not detected in this browser. Please download and load it to track your activity.
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Download Action Alert */}
                                    {!isExtUpToDate && (
                                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="text-[10px] text-slate-400 font-semibold max-w-sm">
                                                {changelog.actionRequired[0] || "Update your Vinyas Chrome Extension to the latest version."}
                                            </div>
                                            <a
                                                href="/Vinyas_Extension.zip"
                                                download="Vinyas_Extension.zip"
                                                className="bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 border border-orange-500/30 text-white text-[11px] font-black px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-orange-950/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer text-center"
                                                title="Download Extension ZIP file"
                                            >
                                                <i className="ph-bold ph-download-simple text-sm"></i>
                                                <span>Download Extension v{currentExtVersion}</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer Section */}
                        <div className="p-4 bg-slate-900 border-t border-slate-800/60 flex gap-3 sticky bottom-0 z-10">
                            <button
                                onClick={handleGotItClick}
                                className="w-full py-3 bg-gradient-to-r from-orange-600 via-red-500 to-blue-600 hover:from-orange-500 hover:via-red-400 hover:to-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                            >
                                Got It, Let's Go!
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Warning Header */}
                        <div className="p-6 border-b border-slate-800/60 bg-slate-950/30 flex items-center gap-3 relative z-10">
                            <span className="text-3xl">⚠️</span>
                            <div>
                                <h2 className="text-xl font-black bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                                    Backup Recommended
                                </h2>
                                <p className="text-xs text-slate-500 font-bold tracking-wider mt-0.5">
                                    Safety First
                                </p>
                            </div>
                        </div>

                        {/* Warning Content */}
                        <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 relative z-10 flex-1">
                            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-2 animate-pulse-slow">
                                <i className="ph-fill ph-warning-circle text-4xl"></i>
                            </div>
                            <p className="text-slate-200 text-sm font-semibold max-w-sm leading-relaxed">
                                We highly recommend you to backup your data before entering this update.
                            </p>
                            <p className="text-slate-400 text-xs max-w-xs leading-normal">
                                This ensures your local chapter progress, routines, and test metrics remain protected under a cryptographically secure local JSON backup file.
                            </p>
                        </div>

                        {/* Warning Footer */}
                        <div className="p-4 bg-slate-900 border-t border-slate-800/60 flex gap-3 sticky bottom-0 z-10">
                            <button
                                onClick={onDismiss}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-all text-xs cursor-pointer text-center"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExportClick}
                                className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 border border-orange-500/30 text-white font-black rounded-xl shadow-lg transition-all text-xs cursor-pointer text-center hover:scale-[1.01] active:scale-[0.99]"
                            >
                                Export Backup
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default WhatsNewModal;
