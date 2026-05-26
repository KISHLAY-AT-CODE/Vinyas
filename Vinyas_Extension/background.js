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

        fetch(`${apiUrl}/api/activity?syncId=${encodeURIComponent(syncId)}&checkUrl=${encodeURIComponent(url)}`)
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

        console.log(`[Vinyas Tracker Background] Sending ${type} to ${apiUrl}/api/activity`);

        fetch(`${apiUrl}/api/activity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                syncId,
                type,
                details,
                timestamp: getISTISOString()
            })
        })
        .then(async response => {
            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                console.error("[Vinyas Tracker Background] Failed to log activity to API. Status:", response.status, "Error:", errText);
                sendResponse({ success: false, status: response.status, error: errText });
            } else {
                console.log("[Vinyas Tracker Background] Successfully logged activity.");
                sendResponse({ success: true });
            }
        })
        .catch(err => {
            console.error("[Vinyas Tracker Background] Network error logging activity:", err);
            sendResponse({ success: false, error: err.message });
        });

        // Return true to indicate we will handle it asynchronously
        return true; 
    }

    if (message.action === "autoSyncDashboardConfig") {
        const { syncId, apiUrl } = message.data;
        if (syncId && apiUrl) {
            if (isValidApiUrl(apiUrl)) {
                chrome.storage.local.set({
                    vinyasSyncId: syncId,
                    vinyasApiUrl: apiUrl
                }, () => {
                    console.log("[Vinyas Tracker Background] Auto-synced config from dashboard in background: Sync ID and API URL updated.");
                    sendResponse({ success: true });
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
        chrome.storage.local.clear(() => {
            console.log("[Vinyas Tracker Background] Extension local storage cleared successfully.");
            sendResponse({ success: true });
        });
        return true;
    }
});
