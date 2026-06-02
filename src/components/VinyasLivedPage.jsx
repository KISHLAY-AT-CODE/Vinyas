import React from 'react';
import vinyasLivedHtml from '../../Vinyas_lived.html?raw';

const VinyasLivedPage = ({ onBack }) => {
    return (
        <div className="h-screen w-screen flex flex-col bg-[#060813] relative overflow-hidden z-50">
            {/* Back Button Overlay */}
            <div className="absolute top-4 left-4 z-[9999]">
                <button 
                    onClick={onBack} 
                    className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800/90 text-white font-extrabold text-xs rounded-xl border border-slate-800 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:border-orange-500/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                >
                    <i className="ph-bold ph-arrow-left"></i>
                    Back to Dashboard
                </button>
            </div>
            
            {/* Render the raw Vinyas_lived.html in srcDoc */}
            <iframe 
                srcDoc={vinyasLivedHtml} 
                className="w-full h-full border-none"
                title="Vinyas Journey & Chronicles"
            />
        </div>
    );
};

export default VinyasLivedPage;
