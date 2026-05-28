import React from 'react';

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-pop-in">
                <div className="p-5 border-b border-slate-800/60 flex justify-between items-center bg-slate-950/20">
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <i className="ph-fill ph-warning-circle text-orange-500 text-lg"></i>
                        {title || 'Confirm Action'}
                    </h3>
                    <button 
                        onClick={onCancel} 
                        className="text-slate-400 hover:text-white transition-colors p-1"
                    >
                        <i className="ph-bold ph-x text-lg"></i>
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-slate-300 text-sm leading-relaxed font-medium">
                        {message || 'Are you sure you want to perform this action?'}
                    </p>
                </div>
                <div className="p-4 bg-slate-900 border-t border-slate-800/60 flex justify-end gap-3 sticky bottom-0 z-10">
                    <button 
                        onClick={onCancel} 
                        className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-950/20 hover:bg-slate-850 border border-slate-800 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm} 
                        className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl shadow-lg shadow-orange-950/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
