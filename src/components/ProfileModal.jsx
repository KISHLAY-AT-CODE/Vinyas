import React, { useState, useEffect } from 'react';

const ProfileModal = ({ isOpen, onClose, currentUsername, onSave }) => {
    const [username, setUsername] = useState(currentUsername || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setUsername(currentUsername || '');
        }
    }, [isOpen, currentUsername]);

    if (!isOpen) return null;

    const handleSave = async () => {
        const trimmed = username.trim();
        if (!trimmed) return;
        setIsSaving(true);
        try {
            await onSave(trimmed);
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div 
                className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-pop-in relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Accent Glow */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-600/10 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-[80px] pointer-events-none"></div>

                {/* Header */}
                <div className="p-5 border-b border-slate-850 bg-slate-950/20 flex justify-between items-center relative z-10">
                    <h3 className="text-base font-black text-white flex items-center gap-2.5">
                        <i className="ph-fill ph-user-circle text-orange-500 text-xl"></i>
                        Edit Profile
                    </h3>
                    <button 
                        onClick={onClose} 
                        className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800/60 transition-colors cursor-pointer"
                    >
                        <i className="ph-bold ph-x text-sm"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 relative z-10">
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">
                            Your Username
                        </label>
                        <div className="relative flex items-center">
                            <i className="ph-bold ph-user text-slate-500 absolute left-3 text-base"></i>
                            <input 
                                type="text" 
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter username..."
                                maxLength={25}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-3 text-xs text-slate-200 outline-none focus:border-orange-500/50 transition-colors font-semibold"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSave();
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-950/30 border-t border-slate-850 flex gap-3 relative z-10">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl transition-all text-xs cursor-pointer text-center"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving || !username.trim()}
                        className="flex-1 py-2.5 bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 border border-orange-500/30 text-white font-black rounded-xl shadow-lg transition-all text-xs cursor-pointer text-center disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
