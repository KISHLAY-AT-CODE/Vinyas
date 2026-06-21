const getISTISOString = (date = new Date()) => {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + tzOffset);
    return istDate.toISOString().replace('Z', '+05:30');
};

// Strict URL validation to protect against SSRF and arbitrary fetch vulnerabilities
function isValidApiUrl(urlStr) {
    try {
        const parsed = new URL(urlStr);
        // Only allow http: and https: protocols
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }

        const hostname = parsed.hostname.toLowerCase();

        // 1. Allow localhost, 127.0.0.1, and [::1] (IPv6 loopback)
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
            return true;
        }

        // 2. Allow any subdomains of vercel.app
        if (hostname.endsWith('.vercel.app')) {
            return true;
        }

        // 3. Exclude private network IPs to block internal SSRF scanning
        // Block 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
        const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = hostname.match(ipv4Regex);
        if (match) {
            const octet1 = parseInt(match[1], 10);
            const octet2 = parseInt(match[2], 10);
            if (
                octet1 === 10 ||
                (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
                (octet1 === 192 && octet2 === 168) ||
                (octet1 === 169 && octet2 === 254)
            ) {
                return false;
            }
        }

        // 4. Require valid, standard public domain pattern
        return hostname.length > 0 && hostname.includes('.');
    } catch (e) {
        return false;
    }
}

let pendingClickLog = null;
let knownNewTabs = new Set();
let recentlyCreatedTabs = [];

function cleanRecentTabs() {
    const now = Date.now();
    recentlyCreatedTabs = recentlyCreatedTabs.filter(t => now - t.time < 3000);
}

function broadcastActionToDashboard(action, data) {
    try {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                const url = tab.url || '';
                if (url.includes('localhost:') || url.includes('127.0.0.1') || url.includes('.vercel.app')) {
                    console.log(`[Vinyas Tracker Background] Broadcasting ${action} to dashboard tab:`, tab.id, url);
                    chrome.tabs.sendMessage(tab.id, {
                        action: action,
                        data: data
                    }, () => {
                        if (chrome.runtime.lastError) {
                            // Silent ignore if the message handler is not yet registered in this tab
                        }
                    });
                }
            });
        });
    } catch (e) {
        console.error(`[Vinyas Tracker Background] Error in broadcasting ${action}:`, e);
    }
}

function sendActivityToApi(logData) {
    const { syncId, apiUrl, type, details, timestamp } = logData;
    
    console.log(`[Vinyas Tracker Background] Sending ${type} to ${apiUrl}/api/activity (Final)`);

    fetch(`${apiUrl}/api/activity`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            syncId,
            type,
            details,
            timestamp: timestamp || getISTISOString()
        })
    })
    .then(async response => {
        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error("[Vinyas Tracker Background] Failed to log activity to API. Status:", response.status, "Error:", errText);
        } else {
            console.log("[Vinyas Tracker Background] Successfully logged activity.");
            broadcastActionToDashboard('syncRefresh');
        }
    })
    .catch(err => {
        console.error("[Vinyas Tracker Background] Network error logging activity:", err);
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkUrl") {
        const { syncId, apiUrl, url } = message.data;

        if (!syncId || !apiUrl) {
            console.error("[Vinyas Tracker Background] Missing Sync ID or API URL for checkUrl");
            sendResponse({ exists: false, error: "Missing Sync ID or API URL" });
            return true;
        }

        if (!isValidApiUrl(apiUrl)) {
            console.error("[Vinyas Tracker Background] Blocked invalid or unsafe API URL for checkUrl:", apiUrl);
            sendResponse({ exists: false, error: "Invalid or unsafe API URL" });
            return true;
        }

        fetch(`${apiUrl}/api/activity?syncId=${encodeURIComponent(syncId)}&checkUrl=${encodeURIComponent(url)}`, { cache: 'no-store' })
        .then(async response => {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(errText || `HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            sendResponse({ exists: !!data.exists });
        })
        .catch(err => {
            console.error("[Vinyas Tracker Background] Error checking URL existence:", err);
            sendResponse({ exists: false, error: err.message });
        });

        return true; // Handle asynchronously
    }

    if (message.action === "checkAssignmentUrl") {
        const { syncId, apiUrl, url } = message.data;

        if (!syncId || !apiUrl) {
            console.error("[Vinyas Tracker Background] Missing Sync ID or API URL for checkAssignmentUrl");
            sendResponse({ exists: false, error: "Missing Sync ID or API URL" });
            return true;
        }

        if (!isValidApiUrl(apiUrl)) {
            console.error("[Vinyas Tracker Background] Blocked invalid or unsafe API URL for checkAssignmentUrl:", apiUrl);
            sendResponse({ exists: false, error: "Invalid or unsafe API URL" });
            return true;
        }

        fetch(`${apiUrl}/api/activity?syncId=${encodeURIComponent(syncId)}&checkAssignmentUrl=${encodeURIComponent(url)}`, { cache: 'no-store' })
        .then(async response => {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(errText || `HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            sendResponse({ exists: !!data.exists, assignmentData: data.assignmentData || null });
        })
        .catch(err => {
            console.error("[Vinyas Tracker Background] Error checking assignment URL existence:", err);
            sendResponse({ exists: false, error: err.message });
        });

        return true; // Handle asynchronously
    }

    if (message.action === "addAssignment") {
        const { syncId, apiUrl, subjectName, chapterName, assignmentName, assignmentType, url } = message.data;

        if (!syncId || !apiUrl) {
            console.error("[Vinyas Tracker Background] Missing Sync ID or API URL for addAssignment");
            sendResponse({ success: false, error: "Missing Sync ID or API URL" });
            return true;
        }

        if (!isValidApiUrl(apiUrl)) {
            console.error("[Vinyas Tracker Background] Blocked invalid or unsafe API URL for addAssignment:", apiUrl);
            sendResponse({ success: false, error: "Invalid or unsafe API URL" });
            return true;
        }

        fetch(`${apiUrl}/api/activity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId,
                type: 'ADD_ASSIGNMENT',
                details: {
                    subjectName,
                    chapterName,
                    assignmentName,
                    assignmentType,
                    url
                }
            })
        })
        .then(async response => {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(errText || `HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            broadcastActionToDashboard('syncRefresh');
            sendResponse({ success: true, unresolved: !!data.unresolved });
        })
        .catch(err => {
            console.error("[Vinyas Tracker Background] Error adding assignment:", err);
            sendResponse({ success: false, error: err.message });
        });

        return true; // Handle asynchronously
    }

    if (message.action === "syncAssignmentProgress") {
        const { syncId, apiUrl, url, questionCount, questionStates, questionRemarks } = message.data;

        if (!syncId || !apiUrl) {
            console.error("[Vinyas Tracker Background] Missing Sync ID or API URL for syncAssignmentProgress");
            sendResponse({ success: false, error: "Missing Sync ID or API URL" });
            return true;
        }

        if (!isValidApiUrl(apiUrl)) {
            console.error("[Vinyas Tracker Background] Blocked invalid or unsafe API URL for syncAssignmentProgress:", apiUrl);
            sendResponse({ success: false, error: "Invalid or unsafe API URL" });
            return true;
        }

        fetch(`${apiUrl}/api/activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                syncId,
                type: 'SYNC_ASSIGNMENT_PROGRESS',
                details: { url, questionCount, questionStates, questionRemarks }
            })
        })
        .then(async response => {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(errText || `HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            broadcastActionToDashboard('syncRefresh');
            sendResponse({ success: true });
        })
        .catch(err => {
            console.error("[Vinyas Tracker Background] Error syncing assignment progress:", err);
            sendResponse({ success: false, error: err.message });
        });

        return true; // Handle asynchronously
    }

    if (message.action === "logActivity") {
        const { syncId, apiUrl, type, details } = message.data;

        if (!syncId || !apiUrl) {
            console.error("[Vinyas Tracker Background] Missing Sync ID or API URL", { syncId: syncId ? `${syncId.slice(0, 4)}...${syncId.slice(-4)}` : 'null', apiUrl });
            sendResponse({ success: false, error: "Missing Sync ID or API URL" });
            return true;
        }

        // Validate the API URL before making external network request
        if (!isValidApiUrl(apiUrl)) {
            console.error("[Vinyas Tracker Background] Blocked invalid or unsafe API URL:", apiUrl);
            sendResponse({ success: false, error: "Invalid or unsafe API URL" });
            return true;
        }

        const logData = {
            syncId,
            apiUrl,
            type,
            details: { ...details },
            timestamp: getISTISOString()
        };

        // If it's already marked as isOpenInNewTab, send immediately
        if (details && details.isOpenInNewTab) {
            sendActivityToApi(logData);
            sendResponse({ success: true });
            return true;
        }

        // For click logs, try to match with recently created tabs or buffer
        if (type === 'PDF_CLICK') {
            cleanRecentTabs();
            
            // Check if a new tab was created recently (within the last 1.5 seconds)
            const matchedTab = recentlyCreatedTabs.find(t => Date.now() - t.time < 1500);
            
            if (matchedTab) {
                console.log("[Vinyas Tracker Background] Found recently created tab in history:", matchedTab);
                
                logData.details.isOpenInNewTab = true;
                logData.tabId = matchedTab.tabId;
                
                // If the tab already has a resolved URL, use it and send immediately
                if (matchedTab.url && matchedTab.url.startsWith('http') && !matchedTab.url.includes('chrome://') && !matchedTab.url.includes('about:blank')) {
                    logData.details.url = matchedTab.url;
                    sendActivityToApi(logData);
                    sendResponse({ success: true, correlatedRecent: true });
                    return true;
                } else {
                    // Otherwise, buffer and wait for this specific tab's URL to resolve
                    if (pendingClickLog && pendingClickLog.timeoutId) {
                        clearTimeout(pendingClickLog.timeoutId);
                        sendActivityToApi(pendingClickLog);
                    }
                    
                    pendingClickLog = {
                        ...logData,
                        time: Date.now(),
                        timeoutId: setTimeout(() => {
                            if (pendingClickLog && pendingClickLog.time === logData.time) {
                                sendActivityToApi(pendingClickLog);
                                pendingClickLog = null;
                            }
                        }, 3000)
                    };
                    
                    sendResponse({ success: true, bufferedForUrl: true });
                    return true;
                }
            }

            // Otherwise, buffer for 400ms to see if one is created shortly after
            if (pendingClickLog && pendingClickLog.timeoutId) {
                clearTimeout(pendingClickLog.timeoutId);
                sendActivityToApi(pendingClickLog); // Send previous pending click log first
            }

            pendingClickLog = {
                ...logData,
                time: Date.now(),
                tabId: null, // associated tab ID
                timeoutId: setTimeout(() => {
                    if (pendingClickLog && pendingClickLog.time === logData.time) {
                        sendActivityToApi(pendingClickLog);
                        pendingClickLog = null;
                    }
                }, 400) // Default same-tab delay
            };

            sendResponse({ success: true, buffered: true });
            return true;
        }

        // Otherwise, send directly (e.g. video progress, DPP scores)
        sendActivityToApi(logData);
        if (type === 'INTERACTIVE_QUESTION_UPDATE') {
            broadcastActionToDashboard('syncQuestionUpdate', details);
        }
        sendResponse({ success: true });
        return true;
    }

    if (message.action === "dashboardSyllabusUpdate") {
        const syllabusData = message.data;
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                const url = tab.url || '';
                const isPwPage = url.includes("books.pw.live") || url.includes("books.physicswallah.live") || url.includes("pw.live");
                if (isPwPage) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "syllabusUpdated",
                        data: syllabusData
                    }, () => {
                        if (chrome.runtime.lastError) {}
                    });
                }
            });
        });
        sendResponse({ success: true });
        return true;
    }

    if (message.action === "autoSyncDashboardConfig") {
        const { syncId, apiUrl } = message.data;
        if (syncId && apiUrl) {
            if (isValidApiUrl(apiUrl)) {
                chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
                    const prevSyncId = result.vinyasSyncId || '';
                    const prevApiUrl = result.vinyasApiUrl || '';
                    const isDifferent = prevSyncId !== syncId || prevApiUrl !== apiUrl;

                    if (isDifferent) {
                        chrome.storage.local.set({
                            vinyasSyncId: syncId,
                            vinyasApiUrl: apiUrl
                        }, () => {
                            console.log("[Vinyas Tracker Background] Auto-synced config from dashboard: Sync ID and API URL updated.");
                            try {
                                if (typeof chrome.action.openPopup === 'function') {
                                    chrome.action.openPopup();
                                }
                            } catch (e) {
                                console.error("[Vinyas Tracker Background] Failed to open popup programmatically:", e);
                            }
                            sendResponse({ success: true, changed: true });
                        });
                    } else {
                        sendResponse({ success: true, changed: false });
                    }
                });
            } else {
                console.error("[Vinyas Tracker Background] Blocked invalid/unsafe auto-sync API URL:", apiUrl);
                sendResponse({ success: false, error: "Unsafe API URL" });
            }
        } else {
            sendResponse({ success: false, error: "Missing syncId or apiUrl" });
        }
        return true;
    }

    if (message.action === "clearExtensionStorage") {
        chrome.storage.local.get(['vinyasSyncId'], (result) => {
            const hadSyncId = !!result.vinyasSyncId;
            if (hadSyncId) {
                chrome.storage.local.clear(() => {
                    console.log("[Vinyas Tracker Background] Extension local storage cleared successfully.");
                    try {
                        if (typeof chrome.action.openPopup === 'function') {
                            chrome.action.openPopup();
                        }
                    } catch (e) {
                        console.error("[Vinyas Tracker Background] Failed to open popup programmatically on disconnect:", e);
                    }
                    sendResponse({ success: true, cleared: true });
                });
            } else {
                chrome.storage.local.clear(() => {
                    sendResponse({ success: true, cleared: false });
                });
            }
        });
        return true;
    }

    if (message.action === "fetchSyllabus") {
        const { syncId, apiUrl } = message.data;
        if (!syncId || !apiUrl) {
            sendResponse({ success: false, error: "Missing Sync ID or API URL" });
            return true;
        }
        if (!isValidApiUrl(apiUrl)) {
            sendResponse({ success: false, error: "Invalid API URL" });
            return true;
        }

        fetch(`${apiUrl}/api/data?syncId=${encodeURIComponent(syncId)}`)
        .then(async response => {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                throw new Error(errText || `HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            sendResponse({ success: true, data });
        })
        .catch(err => {
            console.error("[Vinyas Tracker Background] Error fetching syllabus:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }
});

// Listen for new tab creation or updates to catch programmatic redirection
function handleNewTabEvent(tabId, url) {
    if (!pendingClickLog) return;
    
    // If we've associated this tabId or if we don't have a tabId associated yet
    if (pendingClickLog.tabId !== null && pendingClickLog.tabId !== tabId) return;

    // Check if the URL is resolved and valid
    if (url && url.startsWith('http') && !url.includes('chrome://') && !url.includes('about:blank')) {
        // Prevent duplicate tab triggers
        if (knownNewTabs.has(tabId + '-' + url)) return;
        knownNewTabs.add(tabId + '-' + url);

        console.log("[Vinyas Tracker Background] Resolving tab URL for new tab activity:", url);

        if (pendingClickLog.timeoutId) {
            clearTimeout(pendingClickLog.timeoutId);
        }

        // Update the log URL and dispatch
        pendingClickLog.details.isOpenInNewTab = true;
        pendingClickLog.details.url = url;
        
        sendActivityToApi(pendingClickLog);
        pendingClickLog = null;
    }
}

chrome.tabs.onCreated.addListener((tab) => {
    try {
        console.log("[Vinyas Tracker Background] Tab created event:", tab.id, tab.url);
        
        cleanRecentTabs();
        recentlyCreatedTabs.push({
            tabId: tab.id,
            url: tab.url || '',
            time: Date.now()
        });

        // Check if we can correlate with a currently pending click log
        if (pendingClickLog) {
            console.log("[Vinyas Tracker Background] Correlating new tab with active pending click.");
            pendingClickLog.details.isOpenInNewTab = true;
            pendingClickLog.tabId = tab.id;
            
            if (pendingClickLog.timeoutId) {
                clearTimeout(pendingClickLog.timeoutId);
            }
            
            const logRef = pendingClickLog;
            pendingClickLog.timeoutId = setTimeout(() => {
                if (pendingClickLog && pendingClickLog.time === logRef.time) {
                    console.log("[Vinyas Tracker Background] Fallback timeout fired: sending tab log as is without resolved URL.");
                    sendActivityToApi(pendingClickLog);
                    pendingClickLog = null;
                }
            }, 3000);

            if (tab.url) {
                handleNewTabEvent(tab.id, tab.url);
            }
        }
    } catch (e) {
        console.error("[Vinyas Tracker Background] Error onCreated tab:", e);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    try {
        if (changeInfo.url) {
            cleanRecentTabs();
            const index = recentlyCreatedTabs.findIndex(t => t.tabId === tabId);
            if (index !== -1) {
                recentlyCreatedTabs[index].url = changeInfo.url;
            }
        }

        if (pendingClickLog && pendingClickLog.tabId === tabId && changeInfo.url) {
            handleNewTabEvent(tabId, changeInfo.url);
        }
    } catch (e) {
        console.error("[Vinyas Tracker Background] Error onUpdated tab:", e);
    }
});

// Periodic cleanup of tab cache
setInterval(() => {
    if (knownNewTabs.size > 100) {
        knownNewTabs.clear();
    }
}, 60000);
