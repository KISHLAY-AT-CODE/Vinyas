import { getISTISOString } from '../shared/time.js';

const LOG_LIMIT = 500;

export const logEvent = (type, details, severity = 'info') => {
    try {
        const logs = JSON.parse(localStorage.getItem('vinyasLocalLogs') || '[]');
        const newLog = {
            id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: getISTISOString(),
            type,
            details: typeof details === 'object' ? details : { message: details },
            severity // 'info' | 'warning' | 'error' | 'success'
        };
        logs.unshift(newLog);
        if (logs.length > LOG_LIMIT) {
            logs.length = LOG_LIMIT;
        }
        localStorage.setItem('vinyasLocalLogs', JSON.stringify(logs));
        
        // Dispatch custom event to notify listeners of a new log in real-time
        window.dispatchEvent(new CustomEvent('vinyas-new-log', { detail: newLog }));
    } catch (e) {
        console.error("Local logging error:", e);
    }
};

export const getLocalLogs = () => {
    try {
        return JSON.parse(localStorage.getItem('vinyasLocalLogs') || '[]');
    } catch (e) {
        return [];
    }
};

export const clearLocalLogs = () => {
    try {
        localStorage.setItem('vinyasLocalLogs', '[]');
        window.dispatchEvent(new CustomEvent('vinyas-new-log', { detail: null }));
    } catch (e) {}
};

// Initialize window global logger for absolute ease of use in non-component files
if (typeof window !== 'undefined') {
    window.vinyasLogger = { logEvent, getLocalLogs, clearLocalLogs };
}
