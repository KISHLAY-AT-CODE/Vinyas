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
    } else if (request.action === "syncQuestionUpdate") {
        console.log("[Vinyas Tracker] Received syncQuestionUpdate from background worker:", request.data);
        try {
            window.postMessage({
                type: 'VINYAS_SYNC_QUESTION_UPDATE',
                data: request.data
            }, '*');
            sendResponse({ success: true });
        } catch (e) {
            console.error("[Vinyas Tracker] Failed to forward syncQuestionUpdate message to web app page:", e);
            sendResponse({ success: false, error: e.message });
        }
    }
    // Return true to keep the message channel open for asynchronous response
    return true;
});

// Injected UI Toasts for Connection Feedback
const showPairingPopup = (syncId, userName) => {
    const existing = document.getElementById('vinyas-extension-pair-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'vinyas-extension-pair-toast';
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 999999;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(249, 115, 22, 0.35);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.15);
        border-radius: 20px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f8fafc;
        max-width: 380px;
        animation: vinyasToastSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    if (!document.getElementById('vinyas-extension-animations')) {
        const style = document.createElement('style');
        style.id = 'vinyas-extension-animations';
        style.textContent = `
            @keyframes vinyasToastSlideIn {
                from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes vinyasToastSlideOut {
                from { transform: translateY(0) scale(1); opacity: 1; }
                to { transform: translateY(-20px) scale(0.95); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(249, 115, 22, 0.15);
        border: 1px solid rgba(249, 115, 22, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #f97316;
        font-size: 20px;
        font-weight: bold;
    `;
    iconContainer.innerHTML = '🔌';

    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-grow: 1;
        min-w-0;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0.5px;
        color: #f8fafc;
        text-transform: uppercase;
    `;
    title.textContent = 'Extension Auto-Paired';

    const desc = document.createElement('div');
    desc.style.cssText = `
        font-size: 11px;
        color: #94a3b8;
        font-weight: 500;
        line-height: 1.4;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `;
    desc.textContent = `Active Profile: ${userName || 'Vinyas User'} (${syncId ? syncId.substring(0, 12) + '...' : ''})`;

    textContainer.appendChild(title);
    textContainer.appendChild(desc);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
    `;
    closeBtn.innerHTML = '✖';
    closeBtn.onmouseover = () => { closeBtn.style.color = '#f8fafc'; };
    closeBtn.onmouseout = () => { closeBtn.style.color = '#64748b'; };
    closeBtn.onclick = () => {
        toast.style.animation = 'vinyasToastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 400);
    };

    toast.appendChild(iconContainer);
    toast.appendChild(textContainer);
    toast.appendChild(closeBtn);

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'vinyasToastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
};

const showUnpairingPopup = () => {
    const existing = document.getElementById('vinyas-extension-pair-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'vinyas-extension-pair-toast';
    toast.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 999999;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(244, 63, 94, 0.35);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(244, 63, 94, 0.15);
        border-radius: 20px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #f8fafc;
        max-width: 380px;
        animation: vinyasToastSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    `;

    if (!document.getElementById('vinyas-extension-animations')) {
        const style = document.createElement('style');
        style.id = 'vinyas-extension-animations';
        style.textContent = `
            @keyframes vinyasToastSlideIn {
                from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes vinyasToastSlideOut {
                from { transform: translateY(0) scale(1); opacity: 1; }
                to { transform: translateY(-20px) scale(0.95); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    const iconContainer = document.createElement('div');
    iconContainer.style.cssText = `
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(244, 63, 94, 0.15);
        border: 1px solid rgba(244, 63, 94, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: #f43f5e;
        font-size: 20px;
        font-weight: bold;
    `;
    iconContainer.innerHTML = '🔌';

    const textContainer = document.createElement('div');
    textContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex-grow: 1;
        min-w-0;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 0.5px;
        color: #f8fafc;
        text-transform: uppercase;
    `;
    title.textContent = 'Extension Disconnected';

    const desc = document.createElement('div');
    desc.style.cssText = `
        font-size: 11px;
        color: #94a3b8;
        font-weight: 500;
        line-height: 1.4;
    `;
    desc.textContent = 'Credentials cleared from browser extension.';

    textContainer.appendChild(title);
    textContainer.appendChild(desc);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s;
    `;
    closeBtn.innerHTML = '✖';
    closeBtn.onmouseover = () => { closeBtn.style.color = '#f8fafc'; };
    closeBtn.onmouseout = () => { closeBtn.style.color = '#64748b'; };
    closeBtn.onclick = () => {
        toast.style.animation = 'vinyasToastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 400);
    };

    toast.appendChild(iconContainer);
    toast.appendChild(textContainer);
    toast.appendChild(closeBtn);

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'vinyasToastSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
};

// Safe context validation check
const isContextValid = () => {
    try {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            return false;
        }
        // Accessing getManifest will throw an exception if the context is invalidated.
        chrome.runtime.getManifest();
        return true;
    } catch (e) {
        return false;
    }
};

// Forward secure events from the Vinyas App page to the extension backend
window.addEventListener("message", (event) => {
    if (!isContextValid()) return; // Stop executing if extension context was invalidated
    
    if (event.data) {
        if (event.data.type === 'VINYAS_LOGOUT_EVENT') {
            try {
                chrome.runtime.sendMessage({ action: "clearExtensionStorage" }, (response) => {
                    // Suppress any errors caused by asynchronous invalidation
                    if (chrome.runtime.lastError) return;
                    if (response && response.success && response.cleared) {
                        showUnpairingPopup();
                    }
                });
            } catch (e) {
                console.warn("[Vinyas Tracker] Suppressed message error (context invalidated):", e);
            }
        } else if (event.data.type === 'VINYAS_LOGIN_EVENT') {
            console.log("[Vinyas Tracker] Login event detected. Auto-syncing credentials to background script.");
            try {
                chrome.runtime.sendMessage({
                    action: "autoSyncDashboardConfig",
                    data: {
                        syncId: event.data.syncId,
                        userName: event.data.userName,
                        cohort: event.data.cohort,
                        apiUrl: event.data.apiUrl
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) return;
                    if (response && response.success && response.changed) {
                        showPairingPopup(event.data.syncId, event.data.userName);
                    }
                });
            } catch (e) {
                console.warn("[Vinyas Tracker] Suppressed message error (context invalidated):", e);
            }
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
        } else if (event.data.type === 'VINYAS_DASHBOARD_UPDATE') {
            try {
                chrome.runtime.sendMessage({
                    action: "dashboardSyllabusUpdate",
                    data: event.data.data
                }, (response) => {
                    if (chrome.runtime.lastError) return;
                });
            } catch (e) {
                console.warn("[Vinyas Tracker] Suppressed message error (context invalidated):", e);
            }
        }
    }
});

// Auto-sync configuration on load
const autoSyncOnLoad = () => {
    if (!isContextValid()) return;
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
            }, (response) => {
                if (chrome.runtime.lastError) return;
                if (response && response.success && response.changed) {
                    showPairingPopup(syncId, userName);
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

// Real-time localStorage pairing state monitor
let lastSeenSyncId = localStorage.getItem('vinyasBitsatSyncId') || null;

const pollingInterval = setInterval(() => {
    // If context is invalidated, clear the interval timer to stop background noise
    if (!isContextValid()) {
        console.log("[Vinyas Tracker] Invalidation detected. Stopping active localStorage watcher interval.");
        clearInterval(pollingInterval);
        return;
    }

    try {
        const currentSyncId = localStorage.getItem('vinyasBitsatSyncId') || null;
        const currentUserName = localStorage.getItem('vinyasUserName') || '';
        const currentCohort = localStorage.getItem('vinyasCohort') || '';
        const currentApiUrl = window.location.origin;

        if (currentSyncId !== lastSeenSyncId) {
            console.log(`[Vinyas Tracker] Real-time state change detected: "${lastSeenSyncId}" -> "${currentSyncId}"`);
            
            // Update lastSeenSyncId immediately to prevent infinite loops if runtime message fails
            lastSeenSyncId = currentSyncId;

            if (!currentSyncId) {
                // Account deleted or logged out -> Auto disconnect
                chrome.runtime.sendMessage({ action: "clearExtensionStorage" }, (response) => {
                    if (chrome.runtime.lastError) return;
                    if (response && response.success && response.cleared) {
                        showUnpairingPopup();
                    }
                });
            } else {
                // New sync ID detected -> Auto pair
                chrome.runtime.sendMessage({
                    action: "autoSyncDashboardConfig",
                    data: {
                        syncId: currentSyncId,
                        userName: currentUserName,
                        cohort: currentCohort,
                        apiUrl: currentApiUrl
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) return;
                    if (response && response.success && response.changed) {
                        showPairingPopup(currentSyncId, currentUserName);
                    }
                });
            }
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error in real-time pairing watcher:", e);
        if (!isContextValid() || (e && e.message && e.message.includes("context invalidated"))) {
            console.log("[Vinyas Tracker] Invalidation detected in catch. Stopping active watcher interval.");
            clearInterval(pollingInterval);
        }
    }
}, 500);
