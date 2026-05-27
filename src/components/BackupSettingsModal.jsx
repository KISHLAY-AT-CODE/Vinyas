import React, { useState } from 'react';

const BackupSettingsModal = ({ isOpen, onClose, email, setEmail, autoBackupEnabled, setAutoBackupEnabled, onSendTestMail }) => {
    const [localEmail, setLocalEmail] = useState(email || '');
    const [localEnabled, setLocalEnabled] = useState(autoBackupEnabled || false);
    const [sendingTest, setSendingTest] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        setEmail(localEmail.trim());
        setAutoBackupEnabled(localEnabled);
        onClose();
    };

    const handleTriggerTest = async () => {
        const mailTarget = localEmail.trim();
        if (!mailTarget) return;

        try {
            setSendingTest(true);
            await onSendTestMail(mailTarget);
        } finally {
            setSendingTest(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-700 relative modal-animate flex flex-col">
                {/* Close Button */}
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                    <i className="ph-bold ph-x text-lg"></i>
                </button>

                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-xl font-black text-slate-100 flex items-center gap-2.5">
                        <i className="ph-fill ph-envelope-simple text-indigo-500"></i> Backup Settings
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Configure your automated weekly syllabus database backups.</p>
                </div>

                <div className="space-y-6">
                    {/* Email Input */}
                    <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">
                            Backup Destination Email
                        </label>
                        <div className="relative flex items-center">
                            <i className="ph-bold ph-envelope text-slate-500 absolute left-3 text-base"></i>
                            <input 
                                type="email" 
                                value={localEmail}
                                onChange={e => setLocalEmail(e.target.value)}
                                placeholder="e.g. yourname@example.com"
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-3 py-3 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors font-semibold"
                            />
                        </div>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex items-center justify-between bg-slate-900/40 border border-slate-700/50 p-4 rounded-2xl">
                        <div>
                            <h4 className="text-xs font-bold text-slate-200">Weekly Auto-Backups</h4>
                            <p className="text-[10px] text-slate-500 mt-1">Dispatches scheduled backups every Sunday.</p>
                        </div>
                        
                        {/* Custom Switch Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={localEnabled}
                                onChange={e => setLocalEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-950 border border-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-checked:after:bg-white peer-checked:after:border-transparent"></div>
                        </label>
                    </div>

                    {/* Warning/Security info card */}
                    <div className="bg-emerald-950/15 border border-emerald-900/25 rounded-2xl p-4 flex gap-3 text-left">
                        <i className="ph-fill ph-shield-checkered text-emerald-450 text-xl shrink-0 mt-0.5 animate-pulse-slow"></i>
                        <div>
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">
                                Client-Side Encrypted
                            </span>
                            <p className="text-[10px] text-slate-450 leading-relaxed">
                                🔒 Backups are client-side encrypted utilizing your private Sync ID. Secure even if your email is compromised.
                            </p>
                        </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-750">
                        {localEmail.trim() && (
                            <button
                                onClick={handleTriggerTest}
                                disabled={sendingTest}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-950 border border-slate-700 hover:border-indigo-500/50 text-slate-350 hover:text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <i className={`ph-bold ${sendingTest ? 'ph-spinner-gap animate-spin text-indigo-400' : 'ph-paper-plane-tilt text-sm'}`}></i>
                                <span>{sendingTest ? 'Sending Verification Mail...' : 'Send Test Backup Mail Now'}</span>
                            </button>
                        )}
                        
                        <div className="flex gap-3 mt-1.5">
                            <button 
                                onClick={onClose} 
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-650 text-slate-300 font-bold rounded-xl transition-all text-xs cursor-pointer text-center"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black rounded-xl shadow-lg shadow-indigo-950/20 transition-all text-xs cursor-pointer text-center"
                            >
                                Save Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackupSettingsModal;
