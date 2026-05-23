import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'error', duration = 5000) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type, duration }]);
        
        // Remove toast automatically after its duration
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, removeToast }}>
            {children}
            
            {/* Global premium toast container */}
            <div className="fixed top-4 left-1/2 z-[9999] flex flex-col gap-3 pointer-events-none w-full max-w-md px-4">
                {toasts.map((toast) => (
                    <div 
                        key={toast.id} 
                        className="animate-toast-slide pointer-events-auto w-full select-none"
                    >
                        <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 transition-all duration-300 ${
                            toast.type === 'success' 
                                ? 'bg-emerald-950/85 border-emerald-500/30 text-emerald-200' 
                                : toast.type === 'warning'
                                ? 'bg-amber-950/85 border-amber-500/30 text-amber-200'
                                : toast.type === 'info'
                                ? 'bg-slate-900/85 border-blue-500/30 text-slate-200'
                                : 'bg-rose-950/85 border-rose-500/30 text-rose-200'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <i className={`ph-fill ${
                                    toast.type === 'success' 
                                        ? 'ph-check-circle text-emerald-400' 
                                        : toast.type === 'warning'
                                        ? 'ph-warning-circle text-amber-400'
                                        : toast.type === 'info'
                                        ? 'ph-info text-blue-400'
                                        : 'ph-x-circle text-rose-400'
                                } text-xl`}></i>
                                <span className="text-sm font-bold leading-snug">{toast.message}</span>
                            </div>
                            <button 
                                onClick={() => removeToast(toast.id)} 
                                className="text-slate-400 hover:text-white transition-colors flex-shrink-0"
                            >
                                <i className="ph-bold ph-x text-sm"></i>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
