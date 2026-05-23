import React from 'react';

const FireSlider = ({ label, value, onChange, colorTheme }) => {
    // Generate fire elements based on value
    const intensity = value < 50 ? 'low' : value <= 85 ? 'medium' : 'high';
    
    return (
        <div className="mb-8 relative">
            <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-bold text-slate-300 uppercase tracking-wider">{label}</label>
                <span className={`text-2xl font-black ${intensity === 'high' ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse' : intensity === 'medium' ? 'text-orange-400' : 'text-yellow-500'}`}>
                    {value}%
                </span>
            </div>

            {/* Fire Animation Container */}
            <div className="relative w-full h-12 flex items-end justify-between px-2 mb-1 pointer-events-none">
                {[...Array(5)].map((_, i) => {
                    const threshold = i * 20;
                    const isActive = value >= threshold;
                    const isFurious = intensity === 'high' && isActive;
                    
                    return (
                        <div key={i} className="relative flex flex-col items-center justify-end h-full w-8">
                            {/* Stick */}
                            <div className="w-1.5 h-4 bg-[#4a3f35] rounded-sm z-10 absolute bottom-0"></div>
                            
                            {/* Fire */}
                            <div className={`absolute bottom-3 transition-all duration-300 origin-bottom 
                                ${isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}
                                ${intensity === 'high' ? 'animate-bounce' : 'animate-pulse'}`}
                            >
                                <i className={`ph-fill ph-fire 
                                    ${intensity === 'high' ? 'text-3xl text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,1)]' : 
                                      intensity === 'medium' ? 'text-2xl text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]' : 
                                      'text-xl text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.6)]'}
                                `}></i>
                                
                                {/* Sparkles for Furious Mode */}
                                {isFurious && (
                                    <>
                                        <div className="absolute -top-4 -left-2 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-ping"></div>
                                        <div className="absolute -top-6 left-4 w-1 h-1 bg-red-300 rounded-full animate-ping delay-75"></div>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Actual Slider */}
            <input 
                type="range" 
                min="0" 
                max="100" 
                value={value} 
                onChange={onChange}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer outline-none transition-colors shadow-inner
                    ${intensity === 'high' ? 'bg-red-900/50 accent-red-500' : 
                      intensity === 'medium' ? 'bg-orange-900/50 accent-orange-500' : 
                      'bg-yellow-900/50 accent-yellow-500'}
                `}
                style={{
                    background: `linear-gradient(to right, ${intensity === 'high' ? '#ef4444' : intensity === 'medium' ? '#f97316' : '#eab308'} ${value}%, rgba(30,41,59,0.5) ${value}%)`
                }}
            />
        </div>
    );
};

export default FireSlider;
