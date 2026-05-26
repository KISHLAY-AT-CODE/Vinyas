// Vinyas Tracker extension content script for Dashboard Auto-Detection
// This script runs only on Vinyas dashboard tabs to bridge sync configuration securely.

console.log("[Vinyas Tracker] Dashboard Connector injected and active.");

// Listen for secure messages from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getDashboardConfig") {
        try {
            const syncId = localStorage.getItem('vinyasBitsatSyncId');
            const userName = localStorage.getItem('vinyasUserName');
            const cohort = localStorage.getItem('vinyasCohort');
            const apiUrl = window.location.origin;

            if (syncId) {
                console.log("[Vinyas Tracker] Dispatching credentials to extension popup safely.");
                sendResponse({
                    success: true,
                    syncId,
                    userName,
                    cohort,
                    apiUrl
                });
            } else {
                sendResponse({
                    success: false,
                    error: "No Sync ID configured on this dashboard page."
                });
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Failed to retrieve local storage sync config:", e);
            sendResponse({
                success: false,
                error: e.message
            });
        }
    }
    // Return true to keep the message channel open for asynchronous response
    return true;
});

// Forward secure events from the Vinyas App page to the extension backend
window.addEventListener("message", (event) => {
    if (event.data) {
        if (event.data.type === 'VINYAS_LOGOUT_EVENT') {
            chrome.runtime.sendMessage({ action: "clearExtensionStorage" });
        } else if (event.data.type === 'VINYAS_LOGIN_EVENT') {
            console.log("[Vinyas Tracker] Login event detected. Auto-syncing credentials to background script.");
            chrome.runtime.sendMessage({
                action: "autoSyncDashboardConfig",
                data: {
                    syncId: event.data.syncId,
                    userName: event.data.userName,
                    cohort: event.data.cohort,
                    apiUrl: event.data.apiUrl
                }
            });
        } else if (event.data.type === 'VINYAS_REQUEST_EXT_VERSION') {
            try {
                const manifest = chrome.runtime.getManifest();
                window.postMessage({
                    type: 'VINYAS_EXT_VERSION_RESPONSE',
                    version: manifest.version
                }, '*');
            } catch (e) {
                console.error("[Vinyas Tracker] Failed to respond with extension version:", e);
            }
        }
    }
});

// Auto-sync configuration on load
const autoSyncOnLoad = () => {
    try {
        const syncId = localStorage.getItem('vinyasBitsatSyncId');
        const userName = localStorage.getItem('vinyasUserName');
        const cohort = localStorage.getItem('vinyasCohort');
        const apiUrl = window.location.origin;

        if (syncId) {
            console.log("[Vinyas Tracker] Auto-syncing credentials on tab load to background script.");
            chrome.runtime.sendMessage({
                action: "autoSyncDashboardConfig",
                data: {
                    syncId,
                    userName,
                    cohort,
                    apiUrl
                }
            });
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Failed auto-syncing credentials on load:", e);
    }
};

if (document.readyState === "complete" || document.readyState === "interactive") {
    autoSyncOnLoad();
} else {
    window.addEventListener("DOMContentLoaded", autoSyncOnLoad);
}
