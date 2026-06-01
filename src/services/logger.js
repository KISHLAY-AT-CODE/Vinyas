import { getISTISOString } from '../shared/time.js';

const LOG_LIMIT = 500;

let cachedLogs = null;
let saveTimeout = null;

const loadLogsIntoCache = () => {
    if (cachedLogs !== null) return cachedLogs;
    try {
        cachedLogs = JSON.parse(localStorage.getItem('vinyasLocalLogs') || '[]');
    } catch (e) {
        cachedLogs = [];
    }
    return cachedLogs;
};

export const logEvent = (type, details, severity = 'info') => {
    try {
        const logs = loadLogsIntoCache();
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

        // Debounce writing logs to localStorage to avoid blocking the main thread during rapid logging
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            try {
                localStorage.setItem('vinyasLocalLogs', JSON.stringify(logs));
            } catch (e) {
                console.error("Local storage log save failed:", e);
            }
        }, 1000); // 1-second debounce window

        // Dispatch custom event to notify listeners of a new log in real-time
        window.dispatchEvent(new CustomEvent('vinyas-new-log', { detail: newLog }));
    } catch (e) {
        console.error("Local logging error:", e);
    }
};

export const getLocalLogs = () => {
    return loadLogsIntoCache();
};

export const clearLocalLogs = () => {
    cachedLogs = [];
    if (saveTimeout) clearTimeout(saveTimeout);
    try {
        localStorage.setItem('vinyasLocalLogs', '[]');
        window.dispatchEvent(new CustomEvent('vinyas-new-log', { detail: null }));
    } catch (e) {}
};

// Initialize window global logger for absolute ease of use in non-component files
if (typeof window !== 'undefined') {
    window.vinyasLogger = { logEvent, getLocalLogs, clearLocalLogs };
}
