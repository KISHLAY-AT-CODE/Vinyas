import React, { useState, useEffect } from 'react';

const ExtensionPage = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('install'); // 'features' | 'install' | 'prompts'
    const [currentSlide, setCurrentSlide] = useState(0);
    const [workSlide, setWorkSlide] = useState(0);
    const [metadata, setMetadata] = useState({
        extension: { version: '2.0.0', formattedSize: '95.8 KB' },
        apk: { version: 'v1.0.0' /* APK_VERSION_META */, formattedSize: '132.00 MB' }
    });

    useEffect(() => {
        let isMounted = true;
        fetch('/api/extension-metadata')
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch');
                return res.json();
            })
            .then(data => {
                if (isMounted && data && data.extension && data.apk) {
                    setMetadata(data);
                }
            })
            .catch(err => console.error('Error fetching extension metadata:', err));
        return () => { isMounted = false; };
    }, []);


    const screenshots = [
        {
            src: '/guide_1.png',
            title: '1. Download Vinyas Extension',
            description: 'Download the secure Chrome extension ZIP bundle using the orange button on the left. Extract the ZIP file into a convenient directory on your local machine.'
        },
        {
            src: '/guide_2.png',
            title: '2. Turn on Developer Mode',
            description: 'Open Google Chrome, navigate to chrome://extensions/ in your address bar, and click the "Developer mode" toggle switch in the top-right corner to turn it ON.'
        },
        {
            src: '/guide_3.png',
            title: '3. Click Load Unpacked',
            description: 'Click the "Load unpacked" button in the top-left corner of the extensions page to initiate loading the local directory.'
        },
        {
            src: '/guide_4.png',
            title: '4. Select Extracted Folder',
            description: 'In the file selector window, select the extracted folder of the extension (e.g., Vinyas_Extension) and click Select Folder.'
        },
        {
            src: '/guide_5.png',
            title: '5. Verify Extension Card',
            description: 'Confirm that the "Vinyas Sync Tracker" extension card successfully loaded in your Chrome extensions manager without any error badges.'
        },
        {
            src: '/guide_6.png',
            title: '6. Pin to Chrome Toolbar',
            description: 'Click the extension puzzle icon in the top-right corner of Chrome, find "Vinyas Sync Tracker", and click the Pin icon to keep it visible on your toolbar.'
        },
        {
            src: '/guide_7.png',
            title: '7. Launch and Auto-Pair',
            description: 'Click the pinned Vinyas icon on your Chrome toolbar while having this Vinyas dashboard open. Click the "Auto-Pair" button to instantly synchronize trackers. If auto-sync is not visible then reload the homepage, if still not visible you can just add the url of the homepage and your sync ID from homepage, click on save and test configuration and you are ready to go!'
        }
    ];

    const workScreenshots = [
        {
            src: '/work_1.png',
            title: '1. Send Progress to Vinyas',
            description: 'Click on "Sent to Vinyas" on DPP/Module Submission.'
        },
        {
            src: '/work_2.png',
            title: '2. Click the Refresh Trigger',
            description: 'Whenever you open vinyas study tracker, you can see a refresh button click it.'
        },
        {
            src: '/work_3.png',
            title: '3. Find Your Target Chapter',
            description: 'Search for the chapter you want to see progress about.'
        },
        {
            src: '/work_4.png',
            title: '4. Open Progress Details',
            description: 'Click on Log Progress button and see the progress in popup.'
        },
        {
            src: '/work_5.png',
            title: '5. Explore Detailed Analytics',
            description: 'Various details and analysis of each section will be visible.'
        },
        {
            src: '/work_6.png',
            title: '6. Review Individual Submissions',
            description: 'You can click on individual DPP/Module submission to view it, new features will be added later! Stay in touch.'
        }
    ];

    const handlePrevSlide = () => {
        setCurrentSlide(prev => (prev === 0 ? screenshots.length - 1 : prev - 1));
    };

    const handleNextSlide = () => {
        setCurrentSlide(prev => (prev === screenshots.length - 1 ? 0 : prev + 1));
    };

    const handlePrevWorkSlide = () => {
        setWorkSlide(prev => (prev === 0 ? workScreenshots.length - 1 : prev - 1));
    };

    const handleNextWorkSlide = () => {
        setWorkSlide(prev => (prev === workScreenshots.length - 1 ? 0 : prev + 1));
    };

    return (
        <div className="h-screen bg-slate-950 text-slate-200 py-12 px-4 sm:px-6 lg:px-8 relative overflow-y-auto overflow-x-hidden animate-fade-in font-sans">
            {/* Ambient decorative background glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 rounded-full blur-[150px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[150px] pointer-events-none"></div>
            
            <div className="max-w-5xl mx-auto relative z-10">
                {/* Back Button */}
                <button 
                    onClick={onBack}
                    className="mb-8 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
                >
                    <i className="ph-bold ph-arrow-left text-sm"></i>
                    <span>Back to Dashboard</span>
                </button>

                {/* Hero Header */}
                <div className="text-center mb-12">
                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest px-3.5 py-1.5 rounded-full inline-block mb-4 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                        ⚡ Vinyas Companion System
                    </span>
                    <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent tracking-tight">
                        Vinyas Tracker Extension
                    </h1>
                    <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        Never tick a checklist manually again. Install our browser extension to auto-sync your video watch durations, textbook questions, and DPP accuracy metrics in real-time.
                    </p>
                </div>

                {/* Quick Segmented Navigation */}
                <div className="flex justify-center mb-12">
                    <div className="flex gap-2 p-1.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl backdrop-blur-xl">
                        {[
                            { id: 'features', label: '🚀 Student Benefits', icon: 'ph-sparkles' },
                            { id: 'install', label: '📸 Visual Setup Tutorial', icon: 'ph-camera' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    activeTab === tab.id 
                                        ? 'bg-gradient-to-r from-orange-600/90 to-red-650/90 text-white shadow-lg shadow-orange-950/20' 
                                        : 'text-slate-500 hover:text-slate-350 hover:bg-slate-800/30'
                                }`}
                            >
                                <i className={`ph-bold ${tab.icon}`}></i>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Download & Action Panel */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12 items-start">
                    {/* Left: Instant Downloader Column */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Chrome Extension Card */}
                        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-orange-500/20 transition-all duration-300">
                            {/* Corner Glow */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-500/10 to-red-500/0 blur-xl group-hover:opacity-100 transition-opacity"></div>
                            
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-5 shadow-inner shadow-orange-950/20">
                                    <i className="ph-fill ph-download-simple text-2xl animate-pulse"></i>
                                </div>
                                <h3 className="text-base font-bold text-slate-100 group-hover:text-white transition-colors">
                                    Extension ZIP Bundle
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                    Install the companion tracker locally in a few quick steps. Secure, lightweight, and engineered entirely for students.
                                </p>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="bg-slate-950/65 border border-slate-800/50 rounded-2xl p-4 space-y-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <div className="flex justify-between">
                                        <span>Version</span>
                                        <span className="text-slate-350">{metadata.extension.version}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Format</span>
                                        <span className="text-slate-350">Chrome ZIP</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>File Size</span>
                                        <span className="text-slate-350">{metadata.extension.formattedSize}</span>
                                    </div>
                                </div>
                                
                                <a 
                                    href="/Vinyas_Extension.zip" 
                                    download="Vinyas_Extension.zip"
                                    className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-red-650/90 text-white font-extrabold rounded-xl shadow-lg shadow-orange-950/25 hover:shadow-orange-950/45 hover:scale-[1.02] active:scale-98 transition-all text-xs flex items-center justify-center gap-2 group cursor-pointer"
                                >
                                    <span>Download ZIP Bundle</span>
                                    <i className="ph-bold ph-download-simple text-sm group-hover:translate-y-0.5 transition-transform"></i>
                                </a>
                            </div>
                        </div>

                        {/* Android APK Card */}
                        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
                            {/* Corner Glow */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-500/10 to-teal-500/0 blur-xl group-hover:opacity-100 transition-opacity"></div>
                            
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 shadow-inner shadow-emerald-950/20">
                                    <img src="/icon.svg" alt="Vinyas Logo" className="w-6 h-6 object-contain animate-pulse" />
                                </div>
                                <h3 className="text-base font-bold text-slate-100 group-hover:text-white transition-colors">
                                    Vinyas Android App
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                                    Track progress on the go. Synchronize watch hours, access syllabus details, and monitor achievements directly from your mobile.
                                </p>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="bg-slate-950/65 border border-slate-800/50 rounded-2xl p-4 space-y-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <div className="flex justify-between">
                                        <span>Version</span>
                                        <span className="text-slate-350">{metadata.apk.version}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Format</span>
                                        <span className="text-slate-350">Android APK</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>File Size</span>
                                        <span className="text-slate-350">{metadata.apk.formattedSize}</span>
                                    </div>
                                </div>
                                
                                <a 
                                    href={"https://github.com/KISHLAY-AT-CODE/VinyasApp/releases/download/v1.0.0/application-4fd94fa9-30d5-4484-a4b8-9d9a09ae56c0.apk" /* APK_DOWNLOAD_URL */}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-650/90 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-950/25 hover:shadow-emerald-950/45 hover:scale-[1.02] active:scale-98 transition-all text-xs flex items-center justify-center gap-2 group cursor-pointer"
                                >
                                    <span>Download Android APK</span>
                                    <i className="ph-bold ph-download-simple text-sm group-hover:translate-y-0.5 transition-transform"></i>
                                </a>
                                <div className="text-center text-[10px] text-emerald-500 font-semibold mt-1">
                                    Initial Release: v1.0.0 {/* APK_VERSION_LABEL */}
                                </div>
                            </div>
                        </div>

                        {/* GitHub Button */}
                        <a 
                            href="https://github.com/KISHLAY-AT-CODE/Vinyas" 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3.5 bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 text-slate-450 hover:text-white font-extrabold rounded-xl shadow-inner transition-all text-xs flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            <i className="ph-bold ph-github-logo text-sm group-hover:rotate-12 transition-transform"></i>
                            <span>View GitHub Repository</span>
                        </a>
                    </div>

                    {/* Right: Dynamic Interactive Content Area */}
                    <div className="lg:col-span-3">
                        {activeTab === 'features' && (
                            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl min-h-[350px] flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-slate-100 flex items-center gap-2 mb-2">
                                        🚀 How Vinyas Supercharges Your Study Flow
                                    </h3>
                                    <p className="text-xs text-slate-450 leading-relaxed mb-6">
                                        The extension runs quietly in your browser background. As you work through the PW curriculum website, it connects your actual progress instantly back to your personal syllabus tracker.
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="bg-slate-950/50 border border-slate-900 p-5 rounded-2xl hover:border-slate-800 transition-all group">
                                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-lg mb-3.5 group-hover:scale-105 transition-transform">
                                                🎥
                                            </div>
                                            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Auto-Log Lectures</h4>
                                            <p className="text-[11px] text-slate-450 mt-2 leading-relaxed">
                                                Tracks video durations. Once you finish watching a PW class lecture, Vinyas auto-increments your subject class count!
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 border border-slate-900 p-5 rounded-2xl hover:border-slate-800 transition-all group">
                                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg mb-3.5 group-hover:scale-105 transition-transform">
                                                📝
                                            </div>
                                            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Sync DPP Quizzes</h4>
                                            <p className="text-[11px] text-slate-450 mt-2 leading-relaxed">
                                                Grabs DPP and module quiz completion ratios, accuracy metrics, correct/wrong answers, and saves logs.
                                            </p>
                                        </div>

                                        <div className="bg-slate-950/50 border border-slate-900 p-5 rounded-2xl hover:border-slate-800 transition-all group">
                                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-lg mb-3.5 group-hover:scale-105 transition-transform">
                                                🏆
                                            </div>
                                            <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Unlock Badges</h4>
                                            <p className="text-[11px] text-slate-450 mt-2 leading-relaxed">
                                                Syncs study slots to earn new gamified badges like Sleeping Beauty and Night Owl to reward consistent grinds.
                                            </p>
                                        </div>
                                    </div>

                                    {/* How It Works Divider */}
                                    <div className="mt-10 pt-8 border-t border-slate-800/80">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                                                    ⚡ How Vinyas Works in Action
                                                </h3>
                                                <p className="text-xs text-slate-450 mt-1 leading-normal">
                                                    Follow this quick 6-step visual tour showing how tracking progress automatically reflects on your syllabus portal.
                                                </p>
                                            </div>
                                            
                                            {/* Slide indicator dots */}
                                            <div className="flex gap-1.5">
                                                {workScreenshots.map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setWorkSlide(idx)}
                                                        className={`w-2.5 h-2.5 rounded-full transition-all border ${
                                                            workSlide === idx 
                                                                ? 'bg-orange-500 border-orange-400 scale-110 shadow-[0_0_8px_rgba(249,115,22,0.4)]' 
                                                                : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                                                        }`}
                                                        title={`Go to Step ${idx + 1}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        {/* Slider Display Container */}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-950/40 border border-slate-900/60 p-6 sm:p-8 rounded-3xl relative">
                                            
                                            {/* Left/Right Action Arrows */}
                                            <button 
                                                onClick={handlePrevWorkSlide}
                                                className="absolute left-3 w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-800 hover:border-slate-700 shadow-lg active:scale-90 transition-all z-10 cursor-pointer"
                                                title="Previous Step"
                                            >
                                                <i className="ph-bold ph-caret-left text-lg"></i>
                                            </button>
                                            <button 
                                                onClick={handleNextWorkSlide}
                                                className="absolute right-3 w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-800 hover:border-slate-700 shadow-lg active:scale-90 transition-all z-10 cursor-pointer"
                                                title="Next Step"
                                            >
                                                <i className="ph-bold ph-caret-right text-lg"></i>
                                            </button>

                                            {/* Step Info Box */}
                                            <div className="md:col-span-5 px-6 sm:px-10 flex flex-col justify-center">
                                                <span className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black flex items-center justify-center mb-3">
                                                    {workSlide + 1}
                                                </span>
                                                <h4 className="text-base sm:text-lg font-black text-slate-200 tracking-tight leading-snug">
                                                    {workScreenshots[workSlide].title}
                                                </h4>
                                                <p className="text-xs sm:text-sm text-slate-400 mt-4 leading-relaxed">
                                                    {workScreenshots[workSlide].description}
                                                </p>
                                            </div>

                                            {/* Step Screenshot Image */}
                                            <div className="md:col-span-7 flex flex-col items-center justify-center px-4">
                                                <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden p-2.5 shadow-2xl relative group hover:border-slate-700 transition-all w-full max-w-[520px] flex items-center justify-center">
                                                    <img 
                                                        src={workScreenshots[workSlide].src} 
                                                        alt={workScreenshots[workSlide].title} 
                                                        className="w-full h-auto rounded-xl object-contain max-h-[340px] border border-slate-900 group-hover:scale-[1.015] transition-transform duration-300"
                                                    />
                                                    <div className="absolute inset-0 bg-slate-950/10 group-hover:bg-transparent transition-colors pointer-events-none"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 bg-orange-950/15 border border-orange-900/25 rounded-2xl p-4 flex gap-3 text-left">
                                    <i className="ph-fill ph-shield-checkered text-orange-400 text-xl shrink-0 mt-0.5"></i>
                                    <div>
                                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest block mb-0.5">
                                            Designed with Student Privacy First
                                        </span>
                                        <p className="text-[10px] text-slate-450 leading-relaxed">
                                            🔒 Zero passwords collected. Progress logs are sent directly to your database securely via encryption.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'install' && (
                            <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl flex flex-col justify-between">
                                <div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-100 flex items-center gap-2">
                                                📸 Interactive Installation Tutorial
                                            </h3>
                                            <p className="text-xs text-slate-450 mt-1 leading-normal">
                                                Follow the visual slides showing exactly how to load and pair the extension in Google Chrome.
                                            </p>
                                        </div>
                                        
                                        {/* Slide indicator dots */}
                                        <div className="flex gap-1.5">
                                            {screenshots.map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentSlide(idx)}
                                                    className={`w-2.5 h-2.5 rounded-full transition-all border ${
                                                        currentSlide === idx 
                                                            ? 'bg-orange-500 border-orange-400 scale-110 shadow-[0_0_8px_rgba(249,115,22,0.4)]' 
                                                            : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                                                    }`}
                                                    title={`Go to Step ${idx + 1}`}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Slider Display Container */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-slate-950/40 border border-slate-900/60 p-6 sm:p-8 rounded-3xl relative">
                                        
                                        {/* Left/Right Action Arrows */}
                                        <button 
                                            onClick={handlePrevSlide}
                                            className="absolute left-3 w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-800 hover:border-slate-700 shadow-lg active:scale-90 transition-all z-10 cursor-pointer"
                                            title="Previous Step"
                                        >
                                            <i className="ph-bold ph-caret-left text-lg"></i>
                                        </button>
                                        <button 
                                            onClick={handleNextSlide}
                                            className="absolute right-3 w-9 h-9 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-800 hover:border-slate-700 shadow-lg active:scale-90 transition-all z-10 cursor-pointer"
                                            title="Next Step"
                                        >
                                            <i className="ph-bold ph-caret-right text-lg"></i>
                                        </button>

                                        {/* Step Info Box */}
                                        <div className="md:col-span-5 px-6 sm:px-10 flex flex-col justify-center">
                                            <span className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-black flex items-center justify-center mb-3">
                                                {currentSlide + 1}
                                            </span>
                                            <h4 className="text-base sm:text-lg font-black text-slate-200 tracking-tight leading-snug">
                                                {screenshots[currentSlide].title}
                                            </h4>
                                            <p className="text-xs sm:text-sm text-slate-400 mt-4 leading-relaxed">
                                                {screenshots[currentSlide].description}
                                            </p>
                                        </div>

                                        {/* Step Screenshot Image */}
                                        <div className="md:col-span-7 flex flex-col items-center justify-center px-4">
                                            <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden p-2.5 shadow-2xl relative group hover:border-slate-700 transition-all w-full max-w-[520px] flex items-center justify-center">
                                                <img 
                                                    src={screenshots[currentSlide].src} 
                                                    alt={screenshots[currentSlide].title} 
                                                    className="w-full h-auto rounded-xl object-contain max-h-[340px] border border-slate-900 group-hover:scale-[1.015] transition-transform duration-300"
                                                />
                                                <div className="absolute inset-0 bg-slate-950/10 group-hover:bg-transparent transition-colors pointer-events-none"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Why Auto-pairing note */}
                                <div className="mt-6 bg-blue-950/15 border border-blue-900/25 rounded-2xl p-4 flex gap-3 text-left">
                                    <i className="ph-fill ph-info text-blue-450 text-xl shrink-0 mt-0.5"></i>
                                    <div>
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-0.5">
                                            Quick Sync pairing instructions
                                        </span>
                                        <p className="text-[10px] text-slate-450 leading-relaxed">
                                            The extension automatically queries the active Vinyas page to map your cryptographically secure Sync ID and configurations — avoiding tedious manual settings.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer status */}
                <div className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                    <p className="flex items-center justify-center gap-1.5">
                        <i className="ph-fill ph-shield-checkered text-emerald-500 text-sm"></i>
                        <span>End-to-End Cryptographic Security Active</span>
                    </p>
                    <p className="mt-1 font-semibold text-slate-650">
                        🔒 Uses secure client-side proxying to protect your study logs.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ExtensionPage;
