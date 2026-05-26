import React from 'react';

const WhatsNewModal = ({ isOpen, changelog, currentExtVersion, installedExtVersion, onDismiss }) => {
    if (!isOpen) return null;

    const isExtUpToDate = installedExtVersion === currentExtVersion;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
            {/* The modal card container */}
            <div className="bg-slate-900/95 border border-slate-750/80 rounded-[2rem] shadow-2xl max-w-xl w-full overflow-hidden animate-pop-in flex flex-col max-h-[85vh] relative">
                {/* Visual Accent Glow */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

                {/* Header Section */}
                <div className="p-6 border-b border-slate-800/60 bg-slate-950/30 flex justify-between items-center relative z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-3xl">🎉</span>
                        <div>
                            <h2 className="text-xl font-black bg-gradient-to-r from-orange-400 via-red-400 to-blue-400 bg-clip-text text-transparent">
                                What's New in v{changelog.version}
                            </h2>
                            <p className="text-xs text-slate-500 font-bold tracking-wider mt-0.5">
                                Released on {changelog.date}
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

                    {/* Client Side Changes */}
                    {changelog.clientChanges && changelog.clientChanges.length > 0 && (
                        <div className="space-y-3 border-t border-slate-850 pt-5">
                            <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-2">
                                <i className="ph-bold ph-monitor text-blue-500 text-lg"></i>
                                <span>Client Side Changes</span>
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
                <div className="p-4 bg-slate-950/30 border-t border-slate-800/60 flex gap-3 relative z-10">
                    <button
                        onClick={onDismiss}
                        className="w-full py-3 bg-gradient-to-r from-orange-600 via-red-500 to-blue-600 hover:from-orange-500 hover:via-red-400 hover:to-blue-500 text-white text-xs font-black rounded-xl shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                    >
                        Got It, Let's Go!
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WhatsNewModal;
