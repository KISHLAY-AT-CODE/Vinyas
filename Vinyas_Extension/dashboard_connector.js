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

// Forward secure logout events from the Vinyas App page to the extension backend
window.addEventListener("message", (event) => {
    if (event.data && event.data.type === 'VINYAS_LOGOUT_EVENT') {
        chrome.runtime.sendMessage({ action: "clearExtensionStorage" });
    }
});
