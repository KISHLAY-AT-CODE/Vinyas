(function() {
if (window.self !== window.top) {
    // Avoid running inside nested iframes specifically for secure Cloudflare verification/challenge frames
    // to prevent Turnstile security blocks (e.g. Turnstile error 600010)
    const url = window.location.href.toLowerCase();
    if (url.includes('/cdn-cgi/') || url.includes('turnstile') || url.includes('challenge-platform') || url.includes('cloudflare')) {
        return;
    }
}

console.log("[Vinyas Tracker] Content script injected on PW.");

let syncId = null;
let apiUrl = 'http://localhost:3000';

let isWidgetHiddenByUser = false;
chrome.storage.local.get(['widgetHiddenByUser'], (res) => {
    isWidgetHiddenByUser = !!res.widgetHiddenByUser;
});
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.widgetHiddenByUser) {
        isWidgetHiddenByUser = !!changes.widgetHiddenByUser.newValue;
        if (isWidgetHiddenByUser) {
            const existing = document.getElementById('vinyas-tracker-widget-host');
            if (existing) existing.remove();
        }
    }
});

const maskSyncId = (id) => id ? `${id.slice(0, 4)}...${id.slice(-4)}` : 'null';

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function normalizeChapterName(name) {
    if (!name) return "";
    const normalized = name
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(word => {
            if (word.length > 3 && word.endsWith('s')) {
                return word.slice(0, -1);
            }
            return word;
        })
        .filter(Boolean)
        .join(' ');

    const CHAPTER_SYNONYMS = {
        "atomic structure": "structure of atom",
        "structure of atoms": "structure of atom",
        "structure of atom": "structure of atom",
        "periodic table": "classification of elements and periodicity in properties",
        "periodicity in properties": "classification of elements and periodicity in properties",
        "periodicity in propertie": "classification of elements and periodicity in properties",
        "periodic classification": "classification of elements and periodicity in properties",
        "states of matter": "states of matter",
        "chemical bonding": "chemical bonding and molecular structure",
        "bonding": "chemical bonding and molecular structure",
        "thermodynamics": "chemical thermodynamics",
        "equilibrium": "equilibrium",
        "redox": "redox reactions",
        "solutions": "solutions",
        "electrochemistry": "electrochemistry",
        "kinetics": "chemical kinetics",
        "surface chemistry": "surface chemistry",
        "coordination": "coordination compounds",
        "haloalkanes": "haloalkanes and haloarenes",
        "haloarenes": "haloalkanes and haloarenes",
        "alcohol": "alcohols phenols and ethers",
        "phenol": "alcohols phenols and ethers",
        "ether": "alcohols phenols and ethers",
        "carbonyl": "aldehydes ketones and carboxylic acids",
        "aldehyde": "aldehydes ketones and carboxylic acids",
        "ketone": "aldehydes ketones and carboxylic acids",
        "carboxylic acid": "aldehydes ketones and carboxylic acids",
        "amines": "amines",
        "biomolecules": "biomolecules",
        "polymers": "polymers",
        "chemistry in everyday life": "chemistry in everyday life",
        "goc": "organic chemistry some basic principles and techniques",
        "general organic chemistry": "organic chemistry some basic principles and techniques",
        "organic chemistry basic principles": "organic chemistry some basic principles and techniques"
    };

    return CHAPTER_SYNONYMS[normalized] || normalized;
}

function normalizeUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return '';
    try {
        let u = urlStr.trim().toLowerCase();
        
        // Normalize domains
        u = u.replace('books.physicswallah.live', 'books.pw.live');
        u = u.replace('www.physicswallah.live', 'pw.live');
        u = u.replace('physicswallah.live', 'pw.live');
        u = u.replace('www.pw.live', 'pw.live');
        
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
            u = 'https://' + u;
        }
        
        const urlObj = new URL(u);
        
        // Special normalization for PDF notes pages: we want to extract the PDF URL,
        // clean all query parameters/signatures from it, and construct a stable notes URL.
        if (urlObj.pathname.includes('/notes') && urlObj.searchParams.has('pdf')) {
            let pdfUrl = urlObj.searchParams.get('pdf');
            if (pdfUrl) {
                try {
                    // Try to parse the inner PDF URL
                    const innerUrl = new URL(pdfUrl);
                    // Strip all query parameters and hash from the PDF URL
                    innerUrl.search = '';
                    innerUrl.hash = '';
                    pdfUrl = innerUrl.toString();
                } catch (err) {
                    // Fallback to simple string manipulation if it's not a full absolute URL
                    pdfUrl = pdfUrl.split('?')[0].split('#')[0];
                }
                // Return a standardized note URL format
                return `https://pw.live/notes?pdf=${pdfUrl.toLowerCase().trim()}`;
            }
        }
        
        // General query normalization for other pages (DPPs, Practice modules, etc.)
        const paramsToRemove = ['token', 'time', 'session', 'index', 'utm', 'reattempt', 'type', 'referrer', 'permissions'];
        paramsToRemove.forEach(p => {
            urlObj.searchParams.delete(p);
        });
        
        // Sort query parameters
        const keys = Array.from(urlObj.searchParams.keys()).sort();
        const sortedParams = new URLSearchParams();
        keys.forEach(k => {
            sortedParams.set(k, urlObj.searchParams.get(k));
        });
        urlObj.search = sortedParams.toString();
        urlObj.hash = '';
        
        return urlObj.toString();
    } catch (e) {
        return urlStr;
    }
}

function findChapterMatchesInSyllabus(subjects, searchName) {
    if (!subjects || !searchName) return [];
    
    const normSearch = normalizeChapterName(searchName);
    if (!normSearch) return [];
    
    const exactMatches = [];
    subjects.forEach((sub, sIdx) => {
        sub.chapters?.forEach((ch, cIdx) => {
            const namesToCheck = [ch.name];
            if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
            for (const key of Object.keys(ch)) {
                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                    namesToCheck.push(ch[key]);
                }
            }
            for (const name of namesToCheck) {
                if (normalizeChapterName(name) === normSearch) {
                    exactMatches.push({ sIdx, cIdx, subject: sub, chapter: ch });
                    break;
                }
            }
        });
    });
    if (exactMatches.length > 0) return exactMatches;
    
    const candidates = [];
    subjects.forEach((sub, sIdx) => {
        sub.chapters?.forEach((ch, cIdx) => {
            const namesToCheck = [ch.name];
            if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
            for (const key of Object.keys(ch)) {
                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                    namesToCheck.push(ch[key]);
                }
            }
            for (const name of namesToCheck) {
                const chNorm = normalizeChapterName(name);
                if (chNorm.length > 2 && (chNorm.includes(normSearch) || normSearch.includes(chNorm))) {
                    candidates.push({ sIdx, cIdx, subject: sub, chapter: ch, length: chNorm.length });
                    break;
                }
            }
        });
    });
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        const maxLen = candidates[0].length;
        return candidates.filter(c => c.length === maxLen).map(c => ({ sIdx: c.sIdx, cIdx: c.cIdx, subject: c.subject, chapter: c.chapter }));
    }
    
    return [];
}

function extractChapterFromDppTitle(title) {
    if (!title) return null;
    let cleaned = title.trim();

    if (/[:\-–—]\s*dpp/i.test(cleaned)) {
        const parts = cleaned.split(/[:\-–—]\s*dpp/i);
        if (parts.length > 1 && parts[0].trim().length > 0) {
            cleaned = parts[0].trim();
        }
    }
    cleaned = cleaned.replace(/^DPP\s*[-–—:]?\s*/i, '').trim();
    cleaned = cleaned.replace(/\s*[-–—:]?\s*DPP\s*\d+.*$/i, '').trim();
    cleaned = cleaned.replace(/\s*[#(]?\d+[)]?\s*$/, '').trim();
    cleaned = cleaned.replace(/\s+(?:MCQ\s+)?Quiz$/i, '').trim();
    cleaned = cleaned.replace(/\s*[-–—:]\s*$/, '').trim();

    return cleaned || null;
}

function extractChapterFromModuleUrl(url) {
    if (!url) return null;
    const match = url.match(/chapterTitle=([^&]+)/);
    if (match) {
        let raw = match[1].replace(/\+/g, ' ');
        try {
            raw = decodeURIComponent(raw);
        } catch (e) {}
        return raw.trim();
    }
    return null;
}

let activeWidgetSubject = null;
let activeWidgetChapter = null;
let activeQuestionStates = {};
let refreshWidgetQuestionUI = null;

chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
    if (result.vinyasSyncId) syncId = result.vinyasSyncId;
    if (result.vinyasApiUrl) apiUrl = result.vinyasApiUrl;
    console.log("[Vinyas Tracker] Loaded config:", { syncId: maskSyncId(syncId), apiUrl });
    
    // Temporary connection test
    logActivity('CONNECTION_TEST', { 
        url: window.location.href,
        message: "Testing connection from Extension to App"
    });
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.vinyasSyncId) syncId = changes.vinyasSyncId.newValue;
        if (changes.vinyasApiUrl) apiUrl = changes.vinyasApiUrl.newValue;
        console.log("[Vinyas Tracker] Config updated via storage change:", { syncId: maskSyncId(syncId), apiUrl });
    }
});

// Helper to send activity to Vinyas API
async function logActivity(type, details) {
    if (!syncId) {
        console.warn("[Vinyas Tracker] No Sync ID configured. Skipping log.");
        return;
    }

    console.log(`[Vinyas Tracker] Logging ${type}:`, details);

    try {
        // Send message to background script to bypass CORS
        const response = await chrome.runtime.sendMessage({
            action: "logActivity",
            data: {
                syncId,
                apiUrl,
                type,
                details
            }
        });
        
        if (chrome.runtime.lastError) {
            console.warn("[Vinyas Tracker] Runtime error:", chrome.runtime.lastError.message);
        } else {
            console.log("[Vinyas Tracker] Background response:", response);
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error sending message to background script:", err);
    }
}

// ----------------------------------------------------
// 1. VIDEO TRACKING
// ----------------------------------------------------
let trackedVideo = null;
let videoIntervalId = null;
let lastLogTime = -1;

function handleVideoEvent(eventName) {
    if (!trackedVideo) return;
    
    // Throttle to avoid spamming if pause/play triggered rapidly
    if (Math.abs(trackedVideo.currentTime - lastLogTime) < 2 && eventName === 'timeupdate') {
        return;
    }

    logActivity('VIDEO_PROGRESS', {
        title: document.title || window.location.hostname + " Video",
        url: window.location.href,
        event: eventName,
        currentTime: formatTime(trackedVideo.currentTime),
        duration: formatTime(trackedVideo.duration),
        currentTimeSeconds: Math.floor(trackedVideo.currentTime),
        durationSeconds: Math.floor(trackedVideo.duration || 0)
    });
    lastLogTime = trackedVideo.currentTime;
}

function observeVideos() {
    // Also look for videos inside iframes if accessible
    const video = document.querySelector('video');
    if (video && video !== trackedVideo) {
        console.log("[Vinyas Tracker] Found video element, attaching listeners.");
        
        // Clear previous video tracking interval to prevent memory leaks
        if (videoIntervalId) {
            clearInterval(videoIntervalId);
            videoIntervalId = null;
        }

        trackedVideo = video;
        lastLogTime = video.currentTime;
        
        video.addEventListener('play', () => handleVideoEvent('play'));
        video.addEventListener('pause', () => handleVideoEvent('pause'));
        video.addEventListener('ended', () => handleVideoEvent('ended'));
        
        // Log periodically while playing (e.g., every 60 seconds)
        videoIntervalId = setInterval(() => {
            if (!video.paused && video.currentTime > 0) {
                handleVideoEvent('playing_update');
            }
        }, 60000);
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}


// ----------------------------------------------------
// 2. DPP TRACKING
// ----------------------------------------------------
let dppLogged = false;
let lastLoggedTitle = "";
let lastLoggedMetricsStr = "";
let missingResultsCount = 0;

function parseDppResultsFromDOM() {
    try {
        let metrics = {};
        const spans = document.querySelectorAll('span');
        
        for (const span of spans) {
            const text = span.innerText ? span.innerText.trim() : "";
            const targetLabels = ["Accuracy", "Completed", "Correct", "Incorrect", "Skipped", "Time Taken", "SCORE"];
            
            if (targetLabels.includes(text)) {
                if (text === "SCORE") {
                    const scoreDiv = span.nextElementSibling;
                    if (scoreDiv && scoreDiv.tagName.toLowerCase() === 'div') {
                        metrics.score = scoreDiv.innerText.replace(/\n/g, '').trim();
                    }
                } else {
                    const parentDiv = span.parentElement;
                    if (parentDiv && parentDiv.classList.contains('gap-2')) {
                        const valueSpan = parentDiv.nextElementSibling;
                        if (valueSpan && valueSpan.tagName.toLowerCase() === 'span') {
                            let rawValue = valueSpan.innerText.trim().replace(/\n/g, ''); 
                            
                            if (text === "Accuracy") metrics.accuracy = parseFloat(rawValue) || 0;
                            else if (text === "Completed") metrics.completion = parseFloat(rawValue) || 0;
                            else if (text === "Correct") metrics.correct = rawValue;
                            else if (text === "Incorrect") metrics.incorrect = rawValue;
                            else if (text === "Skipped") metrics.skipped = rawValue;
                            else if (text === "Time Taken") metrics.timeTaken = rawValue;
                        }
                    }
                }
            }
            
            if (span.classList.contains('font-bold') && span.classList.contains('truncate')) {
                const lowerText = text.toLowerCase();
                const blacklist = ["home", "batches", "study", "chats", "doubts", "profile", "library", "test series", "results", "analytics", "schedule", "performance", "leaderboard", "bookmark", "offline downloads", "help & support", "notification", "logout"];
                
                const isBlacklisted = blacklist.some(word => lowerText === word || lowerText.includes(word));
                if (!isBlacklisted && text.length > 2) {
                    const isHighPriority = lowerText.includes("dpp") || lowerText.includes("exercise") || lowerText.includes("module") || lowerText.includes("practice") || lowerText.includes("test");
                    if (isHighPriority || !metrics.quizTitle) {
                        metrics.quizTitle = text;
                    }
                }
            }
        }

        if (metrics.accuracy !== undefined && metrics.completion !== undefined) {
            let type = "UNKNOWN";
            const titleToSearch = (metrics.quizTitle || document.title || document.body.innerText).toUpperCase();
            if (titleToSearch.includes("DPP")) {
                type = "DPP";
            } else if (titleToSearch.includes("EXERCISE") || titleToSearch.includes("EXCERCISE")) {
                type = "MODULE";
            }
            
            let finalTitle = metrics.quizTitle || document.title || "PW Result";
            if (type === "MODULE") {
                const match = window.location.href.match(/chapterTitle=([^&]+)/);
                if (match) {
                    let raw = match[1].replace(/\+/g, ' ');
                    try { raw = decodeURIComponent(raw); } catch (e) {}
                    finalTitle = `Module - ${raw.trim()}`;
                }
            }

            return {
                title: finalTitle,
                url: window.location.href,
                quizType: type,
                ...metrics
            };
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error parsing DOM manual:", e);
    }
    return null;
}

function checkDppScore() {
    try {
        const activityData = parseDppResultsFromDOM();
        if (activityData) {
            const currentTitle = activityData.title;
            const currentMetricsStr = JSON.stringify(activityData);

            if (dppLogged && lastLoggedTitle === currentTitle && lastLoggedMetricsStr === currentMetricsStr) return;

            console.log(`[Vinyas Tracker] DPP detected! Checking if already logged...`);
            
            if (syncId && apiUrl) {
                chrome.runtime.sendMessage({
                    action: "checkUrl",
                    data: { syncId, apiUrl, url: window.location.href }
                }, (response) => {
                    const alreadyExists = !!(response && response.exists);
                    console.log(`[Vinyas Tracker] URL existence check: ${alreadyExists}`);
                    if (!alreadyExists) {
                        // Only show overlay if this URL has NOT been logged before
                        showConfirmOverlay(activityData, false);
                    } else {
                        console.log(`[Vinyas Tracker] Silent bypass: URL already logged.`);
                    }
                });
            } else {
                console.log("[Vinyas Tracker] DPP detected but Sync ID or API URL not set. Skipping overlay.");
            }
            
            dppLogged = true;
            lastLoggedTitle = currentTitle;
            lastLoggedMetricsStr = currentMetricsStr;
            missingResultsCount = 0;
        } else {
            missingResultsCount++;
            if (missingResultsCount > 2) {
                // If results UI is absent for more than ~4 seconds (e.g. taking a reattempt), reset state
                dppLogged = false;
                lastLoggedTitle = "";
                lastLoggedMetricsStr = "";
            }
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error parsing DPP DOM:", err);
    }
}


// ----------------------------------------------------
// CONFIRMATION OVERLAY (Shadow DOM)
// ----------------------------------------------------
function showConfirmOverlay(activityData, alreadyExists = false) {
    // Remove any existing overlay
    const existing = document.getElementById('vinyas-overlay-host');
    if (existing) existing.remove();

    // Create a host element with Shadow DOM to isolate styles
    const host = document.createElement('div');
    host.id = 'vinyas-overlay-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const accColor = activityData.accuracy > 80 ? '#34d399' : activityData.accuracy > 50 ? '#fbbf24' : '#fb7185';
    const typeLabel = activityData.quizType === 'DPP' ? 'DPP' : activityData.quizType === 'MODULE' ? 'MODULE' : 'QUIZ';
    const typeBg = activityData.quizType === 'DPP' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)';
    const typeColor = activityData.quizType === 'DPP' ? '#60a5fa' : '#fbbf24';
    const logoUrl = chrome.runtime.getURL('favicon.ico');

    const titleLabel = alreadyExists ? 'Duplicate Detected' : 'Submission Detected';
    const sendBtnLabel = alreadyExists ? 'Update Again' : 'Send to Vinyas';
    const cancelBtnLabel = alreadyExists ? 'Cancel' : 'Dismiss';
    const isDuplicateText = alreadyExists 
        ? `<div style="background:rgba(244,63,94,0.08); border:1px solid rgba(244,63,94,0.15); border-radius:12px; padding:10px; color:#fb7185; font-size:11px; font-weight:700; margin-bottom:12px; text-align:center;">
             ⚠️ This DPP/Module is already logged. Do you want to update it or cancel?
           </div>`
        : '';

    shadow.innerHTML = `
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .backdrop {
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(5, 8, 16, 0.65); backdrop-filter:blur(10px);
            display:flex; align-items:flex-start; justify-content:flex-end;
            padding:24px; pointer-events:all;
            animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .card {
            background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:24px;
            width:350px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,0.65), 0 0 25px rgba(59,130,246,0.08);
            animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            backdrop-filter: blur(16px);
        }
        .header {
            padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.06);
            display:flex; align-items:center; gap:12px;
        }
        .logo { width:32px; height:32px; border-radius:10px; border:none; background:none; padding:0; display:block; }
        .brand { font-size:14px; font-weight:800; color:#f8fafc; letter-spacing:0.5px; }
        .subtitle { font-size:9px; color:#64748b; font-weight:750; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
        .body { padding:18px 22px; }
        .title-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
        .type-badge {
            font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px;
            padding:4px 9px; border-radius:8px; background:${typeBg}; color:${typeColor};
            border: 1px solid rgba(255,255,255,0.03);
        }
        .quiz-title { font-size:13px; font-weight:750; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
        .stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:16px; }
        .stat {
            background:rgba(0, 0, 0, 0.3); border:1px solid rgba(255,255,255,0.04); border-radius:14px; padding:10px;
            display:flex; flex-direction:column; align-items:center;
        }
        .stat-label { font-size:8px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; font-weight:750; margin-bottom:4px; }
        .stat-value { font-size:18px; font-weight:800; }
        .stat-value.score { color:#60a5fa; }
        .stat-value.acc { color:${accColor}; }
        .stat-value.correct { color:#34d399; }
        .stat-value.incorrect { color:#fb7185; }
        .footer { padding:14px 22px 18px; display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.03); }
        .btn {
            flex:1; padding:12px 0; border:none; border-radius:12px; font-size:12px;
            font-weight:800; cursor:pointer; transition:all 0.2s;
        }
        .btn-dismiss { background:rgba(255,255,255,0.03); color:#94a3b8; border:1px solid rgba(255,255,255,0.06); }
        .btn-dismiss:hover { background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.12); }
        .btn-send { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:white;
            box-shadow:0 4px 15px rgba(59,130,246,0.35); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(59,130,246,0.55); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="Vinyas Logo" />
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">${titleLabel}</div>
                </div>
            </div>
            <div class="body">
                ${isDuplicateText}
                <div class="title-row">
                    <span class="type-badge">${typeLabel}</span>
                    <span class="quiz-title" title="${escapeHTML(activityData.title)}">${escapeHTML(activityData.title)}</span>
                </div>
                <div class="stats">
                    <div class="stat">
                        <span class="stat-label">Score</span>
                        <span class="stat-value score">${escapeHTML(activityData.score || 'N/A')}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Accuracy</span>
                        <span class="stat-value acc">${activityData.accuracy}%</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Correct</span>
                        <span class="stat-value correct">${escapeHTML(activityData.correct || '—')}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Incorrect</span>
                        <span class="stat-value incorrect">${escapeHTML(activityData.incorrect || '—')}</span>
                    </div>
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-dismiss" id="btn-dismiss">${cancelBtnLabel}</button>
                <button class="btn btn-send" id="btn-send">${sendBtnLabel}</button>
            </div>
        </div>
    </div>`;

    // Event handlers
    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] User cancelled/dismissed submission.');
    });

    shadow.getElementById('btn-send').addEventListener('click', async () => {
        const btn = shadow.getElementById('btn-send');
        btn.textContent = '...';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';

        let chapterSearch = null;
        if (activityData.quizType === 'DPP') {
            chapterSearch = extractChapterFromDppTitle(activityData.title);
        } else if (activityData.quizType === 'MODULE') {
            chapterSearch = extractChapterFromModuleUrl(activityData.url);
        }

        if (!chapterSearch) {
            const payload = { ...activityData };
            if (alreadyExists) {
                payload.forceUpdate = true;
            }
            logActivity('DPP_SCORE', payload);
            btn.textContent = alreadyExists ? 'Updated!' : 'Sent!';
            setTimeout(() => host.remove(), 800);
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: "fetchSyllabus",
                data: { syncId, apiUrl }
            });

            if (response && response.success && response.data) {
                const subjects = response.data.data || [];
                const matches = findChapterMatchesInSyllabus(subjects, chapterSearch);

                if (matches.length === 1) {
                    const payload = { ...activityData };
                    if (alreadyExists) {
                        payload.forceUpdate = true;
                    }
                    logActivity('DPP_SCORE', payload);
                    btn.textContent = alreadyExists ? 'Updated!' : 'Sent!';
                    setTimeout(() => host.remove(), 800);
                } else {
                    host.remove();
                    showResolveMismatchOverlay(chapterSearch, subjects, syncId, apiUrl, {
                        type: 'DPP_SCORE',
                        details: activityData
                    });
                }
            } else {
                const payload = { ...activityData };
                if (alreadyExists) {
                    payload.forceUpdate = true;
                }
                logActivity('DPP_SCORE', payload);
                btn.textContent = alreadyExists ? 'Updated!' : 'Sent!';
                setTimeout(() => host.remove(), 800);
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error checking syllabus match for DPP:", e);
            const payload = { ...activityData };
            if (alreadyExists) {
                payload.forceUpdate = true;
            }
            logActivity('DPP_SCORE', payload);
            btn.textContent = alreadyExists ? 'Updated!' : 'Sent!';
            setTimeout(() => host.remove(), 800);
        }
    });

    // backdrop click to dismiss removed
}


// ----------------------------------------------------
// 3. STUDY GOALS TRACKING (UPCOMING EVENTS)
// ----------------------------------------------------
let extractedGoals = new Set();

function checkStudyGoals() {
    try {
        const url = window.location.href;
        if (!url.includes("pw.live/study") && !url.includes("physicswallah.live/study")) return;

        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(el => 
            el.innerText && el.innerText.includes("Upcoming Events")
        );
        const upcomingHeading = headings[0];
        if (!upcomingHeading) return;

        let upcomingSection = document.querySelector('[data-coachmark="upcoming-events"]');
        if (!upcomingSection) {
            upcomingSection = upcomingHeading.parentElement.parentElement;
        }
        if (!upcomingSection) return;

        const cards = Array.from(upcomingSection.querySelectorAll('div[class*="cardContainer"]'));

        cards.forEach(card => {
            const cardText = card.innerText;
            if (!cardText || (!cardText.includes("Lecture") && !cardText.includes("PM") && !cardText.includes("AM"))) return;

            const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, null, false);
            let node;
            const textLines = [];
            while ((node = walker.nextNode())) {
                const text = node.textContent.trim();
                if (text && !textLines.includes(text)) {
                    textLines.push(text);
                }
            }

            if (textLines.length < 3) return;

            let time = textLines[0];
            let subjectLine = textLines[1];
            let topic = textLines[2];
            let faculty = textLines.length > 3 ? textLines[3] : '';

            let dppStatus = "Unknown";
            const fullTextUpper = cardText.toUpperCase();
            if (fullTextUpper.includes("NO DPP")) {
                dppStatus = "No DPP";
            } else if (fullTextUpper.includes("DPP WILL BE PROVIDED") || fullTextUpper.includes("DPP")) {
                dppStatus = "DPP will be provided";
            }

            const titleKey = `${topic} - ${subjectLine}`;
            if (extractedGoals.has(titleKey)) return; 
            extractedGoals.add(titleKey);

            const activityData = {
                title: topic,
                subject: subjectLine,
                time: time,
                faculty: faculty,
                dppStatus: dppStatus,
                rawText: cardText
            };

            logActivity('STUDY_GOALS', activityData);
        });

    } catch (err) {
        console.error("[Vinyas Tracker] Error parsing Study Goals:", err);
    }
}

// ----------------------------------------------------
// ----------------------------------------------------
// 4. PW BOOKS QUESTIONS TRACKING
// ----------------------------------------------------
let lastLoggedBooksUrl = "";
let lastLoggedPracticeV2Url = "";

function showBooksConfirmOverlay(booksData) {
    const existing = document.getElementById('vinyas-overlay-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-overlay-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const logoUrl = chrome.runtime.getURL('favicon.ico');

    let exercisesHtml = '';
    Object.entries(booksData.exercises).forEach(([exKey, qCount]) => {
        const displayName = (booksData.displayNames && booksData.displayNames[exKey]) || exKey;
        exercisesHtml += `
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:12px; font-weight:700; color:#e2e8f0;">${escapeHTML(displayName)}</span>
                <span style="font-size:12px; font-weight:800; color:#60a5fa; background:rgba(59,130,246,0.15); padding:3px 8px; border-radius:6px;">${qCount} Qs</span>
            </div>
        `;
    });

    shadow.innerHTML = `
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .backdrop {
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(5, 8, 16, 0.65); backdrop-filter:blur(10px);
            display:flex; align-items:flex-start; justify-content:flex-end;
            padding:24px; pointer-events:all;
            animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .card {
            background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:24px;
            width:350px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,0.65), 0 0 25px rgba(59,130,246,0.08);
            animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            backdrop-filter: blur(16px);
        }
        .header {
            padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.06);
            display:flex; align-items:center; gap:12px;
        }
        .logo { width:32px; height:32px; border-radius:10px; border:none; background:none; padding:0; display:block; }
        .brand { font-size:14px; font-weight:800; color:#f8fafc; letter-spacing:0.5px; }
        .subtitle { font-size:9px; color:#64748b; font-weight:750; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
        .body { padding:18px 22px; }
        .title-row { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
        .type-badge {
            font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px;
            padding:4px 9px; border-radius:8px; background:rgba(245,158,11,0.15); color:#fbbf24;
            border: 1px solid rgba(255,255,255,0.03);
        }
        .chapter-title { font-size:13px; font-weight:750; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
        .exercises-container { margin-bottom:16px; max-height:220px; overflow-y:auto; }
        .footer { padding:14px 22px 18px; display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.03); }
        .btn {
            flex:1; padding:12px 0; border:none; border-radius:12px; font-size:12px;
            font-weight:800; cursor:pointer; transition:all 0.2s;
        }
        .btn-dismiss { background:rgba(255,255,255,0.03); color:#94a3b8; border:1px solid rgba(255,255,255,0.06); }
        .btn-dismiss:hover { background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.12); }
        .btn-send { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:white;
            box-shadow:0 4px 15px rgba(59,130,246,0.35); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(59,130,246,0.55); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="Vinyas Logo" />
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">Syllabus Discovery</div>
                </div>
            </div>
            <div class="body">
                <div class="title-row">
                    <span class="type-badge">MODULE</span>
                    <span class="chapter-title" title="${escapeHTML(booksData.chapterName)}">${escapeHTML(booksData.chapterName)}</span>
                </div>
                <div class="exercises-container">
                    ${exercisesHtml}
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-dismiss" id="btn-dismiss">Dismiss</button>
                <button class="btn btn-send" id="btn-send">Sync Exercises</button>
            </div>
        </div>
    </div>`;

    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] User cancelled/dismissed books config sync.');
    });

    shadow.getElementById('btn-send').addEventListener('click', () => {
        const btn = shadow.getElementById('btn-send');
        btn.textContent = '...';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';
        
        logActivity('PW_BOOKS_QUESTIONS', booksData);
        btn.textContent = 'Synced!';
        setTimeout(() => host.remove(), 800);
    });

    // backdrop click to dismiss removed
}

function parseBooksQuestionsFromDOM() {
    try {
        const url = window.location.href;
        const isBooksDomain = url.includes("books.pw.live") || url.includes("books.physicswallah.live");
        if (!isBooksDomain) return null;

        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        if (!pathname.includes("/practice")) return null;
        if (!pathname.endsWith("/practice") && !pathname.endsWith("/practice/")) {
            return null;
        }

        const cardsGrid = document.querySelector('div[class*="cardsGrid"]');
        if (!cardsGrid) return null;

        const cards = cardsGrid.querySelectorAll('div[class*="card-"]');
        if (cards.length === 0) return null;

        // Extract chapter name
        const titleHeader = document.querySelector('div[class*="subHeader"] div, div[class*="header"] div, h1, h2');
        let chapterName = "";
        if (titleHeader) {
            chapterName = titleHeader.innerText ? titleHeader.innerText.trim() : "";
            chapterName = chapterName.replace(/^[←\s\-\u2190]+/, '').trim();
        }

        if (!chapterName || chapterName.toLowerCase() === "pw books" || chapterName.toLowerCase().includes("practice")) {
            const subHeader = document.querySelector('div[class*="subHeader"]');
            if (subHeader) {
                chapterName = subHeader.innerText.replace(/^[←\s\-\u2190]+/, '').trim();
            }
        }

        if (!chapterName || chapterName.toLowerCase() === "pw books") return null;

        const exercises = {};
        const displayNames = {};

        cards.forEach(card => {
            const cardHeader = card.querySelector('div[class*="cardHeader"]');
            if (!cardHeader) return;

            const titleDiv = cardHeader.querySelector('div[class*="titleWrapper"]');
            const titleText = titleDiv ? titleDiv.innerText.trim() : "";

            const spans = cardHeader.querySelectorAll('span');
            let qCount = 0;
            spans.forEach(span => {
                const text = span.innerText || "";
                if (text.includes("Questions")) {
                    const match = text.match(/(\d+)/);
                    if (match) {
                        qCount = parseInt(match[1]);
                    }
                }
            });

            if (titleText && qCount > 0) {
                // Parse exercise number (e.g. Exercise-1 -> Exercise 1)
                const match = titleText.match(/Exercise[- ]*(\d+)/i);
                if (match) {
                    const exNum = match[1];
                    const exKey = `Exercise ${exNum}`;
                    exercises[exKey] = qCount;
                    
                    let cleanedDisplayName = titleText;
                    if (chapterName) {
                        const escapedChName = chapterName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp('^' + escapedChName + '\\s*[:\\-]?\\s*', 'i');
                        cleanedDisplayName = cleanedDisplayName.replace(regex, '');
                    }
                    displayNames[exKey] = cleanedDisplayName || titleText;
                }
            }
        });

        if (Object.keys(exercises).length > 0) {
            return {
                chapterName,
                url,
                exercises,
                displayNames
            };
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error parsing books DOM manual:", e);
    }
    return null;
}

function checkPwBooksQuestions() {
    try {
        const url = window.location.href;
        if (lastLoggedBooksUrl === url) return;

        const booksData = parseBooksQuestionsFromDOM();
        if (booksData) {
            if (syncId && apiUrl) {
                chrome.runtime.sendMessage({
                    action: "checkUrl",
                    data: { syncId, apiUrl, url }
                }, (response) => {
                    const alreadyExists = !!(response && response.exists);
                    console.log(`[Vinyas Tracker] Books URL existence check: ${alreadyExists}`);
                    if (!alreadyExists) {
                        showBooksConfirmOverlay(booksData);
                    } else {
                        console.log(`[Vinyas Tracker] Silent bypass: Books exercises already configured.`);
                    }
                });
            } else {
                console.log("[Vinyas Tracker] Books Practice detected but Sync ID or API URL not set. Skipping overlay.");
            }
            
            lastLoggedBooksUrl = url;
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error parsing PW Books Questions:", err);
    }
}

function parsePracticeV2QuestionsFromDOM() {
    try {
        const url = window.location.href;
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        const practiceV2Pattern = /^\/practice-v2\/dpp\/[a-f0-9]{24}\/?$/i;
        if (!practiceV2Pattern.test(pathname)) return null;
        if (url.includes('?')) return null; // Only parse trimmed index pages
        
        // Find all text elements that contain "exercise" (case-insensitive)
        const candidates = Array.from(document.querySelectorAll('div, span, p, h3, h4, button')).filter(el => {
            if (el.children.length > 0) return false;
            const text = el.innerText?.trim() || '';
            return /exercise[- ]*\d+/i.test(text);
        });
        
        if (candidates.length === 0) return null;
        
        const exercises = {};
        const displayNames = {};
        
        candidates.forEach(el => {
            const titleText = el.innerText.trim();
            const match = titleText.match(/exercise[- ]*(\d+)/i);
            if (!match) return;
            const exNum = match[1];
            const exKey = `Exercise ${exNum}`;
            
            // Try to find the question count near this title
            // We search in the parent container for text like "X Questions" or "Questions: X"
            let qCount = 0;
            let parent = el.parentElement;
            let depth = 0;
            while (parent && parent !== document.body && depth < 5) {
                const text = parent.innerText || '';
                const qMatch = text.match(/(\d+)\s*questions/i) || text.match(/questions\s*:\s*(\d+)/i);
                if (qMatch) {
                    qCount = parseInt(qMatch[1], 10);
                    break;
                }
                parent = parent.parentElement;
                depth++;
            }
            
            if (qCount > 0) {
                exercises[exKey] = qCount;
                displayNames[exKey] = titleText;
            }
        });
        
        if (Object.keys(exercises).length > 0) {
            // Extract chapter name from query/params or page title
            const urlParams = new URLSearchParams(window.location.search);
            let chapterName = urlParams.get('chapterTitle') || '';
            if (!chapterName) {
                const header = document.querySelector('h1, h2, div[class*="header"], div[class*="subHeader"]');
                if (header) chapterName = header.innerText?.trim() || '';
            }
            
            return {
                chapterName: chapterName || 'Unknown Chapter',
                url,
                exercises,
                displayNames
            };
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error parsing practice-v2 DOM:", e);
    }
    return null;
}

function checkPwPracticeV2Questions() {
    try {
        const url = window.location.href;
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        const practiceV2Pattern = /^\/practice-v2\/dpp\/[a-f0-9]{24}\/?$/i;
        if (!practiceV2Pattern.test(pathname)) return;
        if (url.includes('?')) return; // Ignore pages with query parameters (which are quizzes)
        if (lastLoggedPracticeV2Url === url) return;

        const practiceData = parsePracticeV2QuestionsFromDOM();
        if (practiceData) {
            console.log("[Vinyas Tracker] Scraped practice-v2 exercise config successfully:", practiceData);
            
            // If there's a pending redirect target, map to that chapter name
            const targetChapterName = sessionStorage.getItem('vinyasTargetChapterName');
            const originalQuizUrl = sessionStorage.getItem('vinyasOriginalQuizUrl');
            
            const chapterName = targetChapterName || practiceData.chapterName;

            if (syncId && apiUrl) {
                // Sync data to MongoDB immediately
                chrome.runtime.sendMessage({
                    action: "logActivity",
                    data: {
                        syncId,
                        apiUrl,
                        type: "PW_BOOKS_QUESTIONS",
                        details: {
                            chapterName,
                            exercises: practiceData.exercises,
                            displayNames: practiceData.displayNames,
                            url
                        }
                    }
                }, (response) => {
                    console.log("[Vinyas Tracker] Synced practice-v2 exercises to database:", response);
                    
                    if (originalQuizUrl) {
                        console.log("[Vinyas Tracker] Auto-sync completed. Redirecting back to quiz:", originalQuizUrl);
                        sessionStorage.removeItem('vinyasOriginalQuizUrl');
                        sessionStorage.removeItem('vinyasTargetChapterName');
                        window.location.href = originalQuizUrl;
                    }
                });
            }
            
            lastLoggedPracticeV2Url = url;
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error checking PW practice-v2 questions:", err);
    }
}

function showRedirectIndexPrompt(chapter, syncId, apiUrl) {
    const existing = document.getElementById('vinyas-tracker-widget-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-tracker-widget-host';
    host.style.cssText = `position:fixed;top:16px;left:${window.innerWidth / 2 - 315}px;width:630px;height:46px;z-index:2147483647;pointer-events:none;`;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    const logoUrl = chrome.runtime.getURL('favicon.ico');

    const css = `
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .pill {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 0 16px 0 20px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(249, 115, 22, 0.35);
            border-radius: 23px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(249, 115, 22, 0.08);
            pointer-events: all;
            color: #f8fafc;
            user-select: none;
            width: 630px;
            height: 46px;
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .left-content {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 11px;
            font-weight: 700;
            color: #f1f5f9;
        }
        .logo-img {
            width: 22px;
            height: 22px;
            border-radius: 6px;
        }
        .buttons-row {
            display: flex;
            gap: 8px;
        }
        .btn {
            border: none;
            outline: none;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .btn-dismiss {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
        }
        .btn-dismiss:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #f1f5f9;
        }
        .btn-action {
            background: linear-gradient(135deg, #f97316, #ea580c);
            color: white;
            box-shadow: 0 4px 12px rgba(249, 115, 22, 0.2);
        }
        .btn-action:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(249, 115, 22, 0.35);
        }
    `;

    shadow.innerHTML = `
        <style>${css}</style>
        <div class="pill">
            <div class="left-content">
                <img class="logo-img" src="${logoUrl}" alt="Vinyas Logo" />
                <span>Chapter config required to enable interactive tracking.</span>
            </div>
            <div class="buttons-row">
                <button class="btn btn-dismiss" id="btn-dismiss">Skip</button>
                <button class="btn btn-action" id="btn-redirect">Index Chapter</button>
            </div>
        </div>
    `;

    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        trackerFailed = true;
        showPwSubmitButton();
        showPwLeaveButton();
        console.log('[Vinyas Tracker] User skipped chapter indexing prompt.');
    });

    shadow.getElementById('btn-redirect').addEventListener('click', () => {
        try {
            sessionStorage.setItem('vinyasOriginalQuizUrl', window.location.href);
            sessionStorage.setItem('vinyasTargetChapterName', chapter.name);
            let trimmedUrl = window.location.origin + window.location.pathname;
            if (trimmedUrl.includes('/practice-v2/dpp/')) {
                const match = trimmedUrl.match(/^(.+?\/practice-v2\/dpp\/[a-f0-9]{24})/i);
                if (match) {
                    trimmedUrl = match[1];
                }
            }
            console.log(`[Vinyas Tracker] Redirecting to trimmed URL for auto-indexing: ${trimmedUrl}`);
            window.location.href = trimmedUrl;
        } catch (err) {
            console.error('[Vinyas Tracker] Redirect handler error:', err);
        }
    });
}

// ----------------------------------------------------
// MESSAGE LISTENER (For Popup Trigger)
// ----------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "syllabusUpdated") {
        const subjects = request.data || [];
        if (activeWidgetChapter) {
            const matches = findChapterMatchesInSyllabus(subjects, activeWidgetChapter.name);
            if (matches.length === 1) {
                const newChapter = matches[0].chapter;
                activeWidgetChapter.moduleQuestionStates = newChapter.moduleQuestionStates || {};
                activeQuestionStates = newChapter.moduleQuestionStates || {};
                if (typeof refreshWidgetQuestionUI === 'function') {
                    refreshWidgetQuestionUI();
                }
            }
        }
        sendResponse({ success: true });
        return true;
    }

    if (request.action === "toggleWidgetState") {
        if (request.hidden) {
            const existing = document.getElementById('vinyas-tracker-widget-host');
            if (existing) existing.remove();
        } else {
            lastCheckedPdfUrl = '';
            lastCheckedTrackerUrl = '';
            checkPdfAssignment();
            checkInteractiveModuleTracker();
        }
        sendResponse({ success: true });
        return true;
    }

    if (request.action === "detectDppResults") {
        const activityData = parseDppResultsFromDOM();
        if (activityData) {
            sendResponse({ success: true, type: "DPP", activityData });
        } else {
            const booksData = parseBooksQuestionsFromDOM();
            if (booksData) {
                sendResponse({ success: true, type: "MODULE_CONFIG", activityData: booksData });
            } else {
                sendResponse({ success: false, error: "No DPP results or Books Practice detected on this page." });
            }
        }
        return true;
    }
});

// ----------------------------------------------------
// 5. EVENT-DRIVEN & LOCATION-AWARE SCANNERS (Optimized URL Router)
// ----------------------------------------------------
let lastCheckedPdfUrl = '';
let isCheckingPdfAssignment = false;

function checkPdfAssignment() {
    if (window.self !== window.top) return; // Only run in the top-level frame

    const url = window.location.href;
    if (!url.toLowerCase().includes('/notes?pdf=')) return;

    const normUrl = normalizeUrl(url);
    const widgetExists = document.getElementById('vinyas-tracker-widget-host');

    // Return if already checking or if the normalized URL matches what is currently loaded/displayed
    if (isCheckingPdfAssignment || (normUrl === normalizeUrl(lastCheckedPdfUrl) && widgetExists)) {
        return;
    }

    lastCheckedPdfUrl = url;
    isCheckingPdfAssignment = true;

    console.log("[Vinyas Tracker] PDF URL detected:", url);

    chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl', 'clickHistory', 'customAssignmentTypes'], (result) => {
        const syncId = result.vinyasSyncId;
        const apiUrl = result.vinyasApiUrl;
        const customAssignmentTypes = result.customAssignmentTypes || [];
        if (!syncId || !apiUrl) {
            console.warn("[Vinyas Tracker] Sync ID or API URL not configured. Skipping assignment check.");
            isCheckingPdfAssignment = false;
            return;
        }

        try {
            chrome.runtime.sendMessage({
                action: "checkAssignmentUrl",
                data: { syncId, apiUrl, url: normUrl } // Pass the normalized URL to checkAssignmentUrl
            }, (response) => {
                isCheckingPdfAssignment = false;

                // Stale request protection: if the page URL has changed during the async API call, drop this result
                if (normalizeUrl(window.location.href) !== normUrl) {
                    return;
                }

                const clickHistory = result.clickHistory || [];
                
                // Fallback default assignment name if none exists
                let defaultAssignmentName = clickHistory.length > 0 ? clickHistory[0].assignmentName : '';
                if (!defaultAssignmentName) {
                    try {
                        const filename = url.split('/').pop().split('?')[0];
                        if (filename && filename.toLowerCase().includes('pdf')) {
                            defaultAssignmentName = decodeURIComponent(filename.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' '));
                        }
                    } catch (e) {}
                }
                if (!defaultAssignmentName) {
                    defaultAssignmentName = document.title ? document.title.replace(/\.pdf$/i, '').trim() : 'Assignment';
                }

                const defaultChapterName = clickHistory.length > 0 ? clickHistory[0].chapterName : '';
                
                // Generate dummy assignmentData if it doesn't exist to pre-fill the form
                let assignmentData = response?.assignmentData || null;
                if (!assignmentData && !response?.exists) {
                    assignmentData = {
                        name: defaultAssignmentName,
                        chapterName: defaultChapterName,
                        type: 'DPP'
                    };
                }

                // Call the globally injected widget function with the normalized URL
                if (typeof injectFloatingTrackerWidget === 'function') {
                    injectFloatingTrackerWidget(syncId, apiUrl, normUrl, !!response?.exists, assignmentData, clickHistory, customAssignmentTypes);
                } else {
                    console.error("[Vinyas Tracker] Error: injectFloatingTrackerWidget is not defined. Ensure tracker_ui.js is loaded.");
                }
            });
        } catch (e) {
            console.error("[Vinyas Tracker] Error sending message checkAssignmentUrl:", e);
            isCheckingPdfAssignment = false;
        }
    });
}

let lastCheckedBookUrl = '';

function parseBookNameFromDOM() {
    try {
        const titleHeader = document.querySelector('div[class*="bookTitleWrapper"] h3, div[class*="bookDetails"] h3, h3[class*="heading3"]');
        if (titleHeader && titleHeader.innerText) {
            const text = titleHeader.innerText.trim();
            if (text.toLowerCase() !== "pw books") return text;
        }
        // Fallback
        const h3s = Array.from(document.querySelectorAll('h3'));
        for (const h3 of h3s) {
            if (h3.className && (h3.className.includes('heading3') || h3.className.includes('Title') || h3.className.includes('title'))) {
                const text = h3.innerText.trim();
                if (text.toLowerCase() !== "pw books") return text;
            }
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error parsing book title:", e);
    }
    return null;
}

function checkPwBookLoad() {
    try {
        const url = window.location.href;
        if (lastCheckedBookUrl === url) return;

        // Validate URL structure: books/<encrypted-text> without any trailing sub-path
        const lowerUrl = url.toLowerCase();
        const bookIdx = lowerUrl.indexOf('/books/');
        if (bookIdx === -1) return;
        const afterBooks = lowerUrl.substring(bookIdx + '/books/'.length);
        const pathPart = afterBooks.split('?')[0].split('#')[0];
        if (pathPart.includes('/')) return;

        const bookName = parseBookNameFromDOM();
        if (bookName) {
            chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
                const syncId = result.vinyasSyncId;
                const apiUrl = result.vinyasApiUrl;
                if (!syncId || !apiUrl) {
                    console.warn("[Vinyas Tracker] Sync ID or API URL not configured. Skipping book check.");
                    return;
                }

                chrome.runtime.sendMessage({
                    action: "checkUrl",
                    data: { syncId, apiUrl, url }
                }, (response) => {
                    const alreadyExists = !!(response && response.exists);
                    console.log(`[Vinyas Tracker] Book URL existence check: ${alreadyExists}`);
                    if (!alreadyExists) {
                        showSyncBookOverlay(bookName, url, syncId, apiUrl);
                    } else {
                        console.log(`[Vinyas Tracker] Silent bypass: Book already synced.`);
                    }
                });
            });
            lastCheckedBookUrl = url;
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error checking PW Book page:", err);
    }
}

let lastCheckedChapterUrl = '';

function parseChapterNameFromDOM() {
    try {
        // 1. Try to find the back button and get its next sibling, which is the chapter title container
        const backBtn = document.querySelector('button[aria-label="Back"], button[class*="back" i], a[class*="back" i]');
        if (backBtn) {
            const sibling = backBtn.nextElementSibling;
            if (sibling && sibling.innerText) {
                const text = sibling.innerText.trim();
                const lowerText = text.toLowerCase();
                // Validate that the sibling is actually the chapter title (not generic)
                if (text && 
                    lowerText !== "pw books" && 
                    lowerText !== "books" && 
                    lowerText !== "pw" &&
                    lowerText.length > 1) {
                    return text.replace(/^[←\s\-\u2190]+/, '').trim();
                }
            }
        }

        // 2. Fallback: list of selectors we can query to find the actual chapter header
        const selectors = [
            'div[class*="_subHeading_"]',
            'div[class*="subHeading"]',
            'div[class*="subHeader"] div',
            'div[class*="header"] div',
            'h1',
            'h2',
            'h3'
        ];

        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const el of elements) {
                if (el && el.innerText) {
                    const text = el.innerText.trim();
                    const lowerText = text.toLowerCase();
                    // Ignore empty, generic logo branding, navigation links, etc.
                    if (text && 
                        lowerText !== "pw books" && 
                        lowerText !== "books" && 
                        lowerText !== "pw" &&
                        !lowerText.includes("my books") &&
                        !lowerText.includes("home") &&
                        !lowerText.includes("practice") &&
                        lowerText.length > 1) {
                        
                        // Clean leading arrows/dashes
                        return text.replace(/^[←\s\-\u2190]+/, '').trim();
                    }
                }
            }
        }

        // 3. Fallback to root elements with subHeading in class
        const rootElements = Array.from(document.querySelectorAll('div[class*="_root_"]'));
        for (const el of rootElements) {
            if (el.className && el.className.includes('subHeading') && el.innerText) {
                const text = el.innerText.trim();
                const lowerText = text.toLowerCase();
                if (text && 
                    lowerText !== "pw books" && 
                    lowerText !== "books" && 
                    lowerText !== "pw" &&
                    lowerText.length > 1) {
                    return text.replace(/^[←\s\-\u2190]+/, '').trim();
                }
            }
        }

        // 4. Fallback to document.title if DOM parsing didn't yield a valid name
        if (document.title) {
            let title = document.title;
            // Remove common suffixes/prefixes like "- PW Books", "| PW Books", "PW Books"
            title = title.replace(/[-|•·]\s*PW\s*Books/i, '')
                         .replace(/PW\s*Books\s*[-|•·]/i, '')
                         .replace(/PW\s*Books/i, '')
                         .trim();
            const lowerTitle = title.toLowerCase();
            if (title && 
                lowerTitle !== "pw books" && 
                lowerTitle !== "books" && 
                lowerTitle !== "pw" &&
                lowerTitle.length > 1) {
                return title;
            }
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error parsing chapter name:", e);
    }
    return null;
}

function checkPwBookChapterLoad() {
    try {
        const url = window.location.href;
        if (lastCheckedChapterUrl === url) return;

        // Validate URL structure: chapters/<encrypted-text-2> without any trailing sub-path
        const lowerUrl = url.toLowerCase();
        const chapterIdx = lowerUrl.indexOf('/chapters/');
        if (chapterIdx === -1) return;
        const afterChapters = lowerUrl.substring(chapterIdx + '/chapters/'.length);
        const pathPart = afterChapters.split('?')[0].split('#')[0];
        if (pathPart.includes('/')) return;

        const chapterName = parseChapterNameFromDOM();
        if (chapterName) {
            chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
                const syncId = result.vinyasSyncId;
                const apiUrl = result.vinyasApiUrl;
                if (!syncId || !apiUrl) {
                    console.warn("[Vinyas Tracker] Sync ID or API URL not configured. Skipping chapter check.");
                    return;
                }

                chrome.runtime.sendMessage({
                    action: "checkUrl",
                    data: { syncId, apiUrl, url }
                }, (response) => {
                    const alreadyExists = !!(response && response.exists);
                    console.log(`[Vinyas Tracker] Chapter URL existence check: ${alreadyExists}`);
                    if (!alreadyExists) {
                        const chapterIdx = url.toLowerCase().indexOf('/chapters/');
                        const bookUrl = url.substring(0, chapterIdx);
                        showSyncChapterOverlay(chapterName, bookUrl, url, syncId, apiUrl);
                    } else {
                        console.log(`[Vinyas Tracker] Silent bypass: Chapter already synced.`);
                    }
                });
            });
            lastCheckedChapterUrl = url;
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error checking PW Book Chapter page:", err);
    }
}

function showSyncChapterOverlay(detectedChapter, bookUrl, chapterUrl, syncId, apiUrl) {
    const existing = document.getElementById('vinyas-overlay-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-overlay-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const logoUrl = chrome.runtime.getURL('favicon.ico');

    shadow.innerHTML = `
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .backdrop {
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(5, 8, 16, 0.65); backdrop-filter:blur(10px);
            display:flex; align-items:flex-start; justify-content:flex-end;
            padding:24px; pointer-events:all;
            animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .card {
            background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:24px;
            width:350px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,0.65), 0 0 25px rgba(59,130,246,0.08);
            animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            backdrop-filter: blur(16px);
        }
        .header {
            padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.06);
            display:flex; align-items:center; gap:12px;
        }
        .logo { width:32px; height:32px; border-radius:10px; border:none; background:none; padding:0; display:block; }
        .brand { font-size:14px; font-weight:800; color:#f8fafc; letter-spacing:0.5px; }
        .subtitle { font-size:9px; color:#64748b; font-weight:750; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
        .body { padding:18px 22px; }
        .input-group { margin-bottom:14px; }
        .input-label { display:block; font-size:9px; font-weight:750; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
        .input-field {
            width:100%; padding:10px 14px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08);
            border-radius:12px; color:#e2e8f0; font-size:13px; font-weight:600; outline:none; transition:all 0.2s;
        }
        .input-field:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.15); }
        .footer { padding:14px 22px 18px; display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.03); }
        .btn {
            flex:1; padding:12px 0; border:none; border-radius:12px; font-size:12px;
            font-weight:800; cursor:pointer; transition:all 0.2s;
        }
        .btn-dismiss { background:rgba(255,255,255,0.03); color:#94a3b8; border:1px solid rgba(255,255,255,0.06); }
        .btn-dismiss:hover { background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.12); }
        .btn-send { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:white;
            box-shadow:0 4px 15px rgba(59,130,246,0.35); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(59,130,246,0.55); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="Vinyas Logo" />
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">Sync Book Chapter</div>
                </div>
            </div>
            <div class="body">
                <div class="input-group">
                    <label class="input-label">Chapter Name</label>
                    <input type="text" class="input-field" id="input-chapter" value="${escapeHTML(detectedChapter)}" placeholder="e.g. Units and Dimension" />
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-dismiss" id="btn-dismiss">Dismiss</button>
                <button class="btn btn-send" id="btn-send">Sync Chapter</button>
            </div>
        </div>
    </div>`;

    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] Chapter overlay dismissed by user.');
    });

    shadow.getElementById('btn-send').addEventListener('click', async () => {
        const editedChapter = shadow.getElementById('input-chapter').value.trim();
        if (!editedChapter) return;

        const btn = shadow.getElementById('btn-send');
        btn.textContent = '...';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';

        try {
            const syllabusRes = await chrome.runtime.sendMessage({
                action: "fetchSyllabus",
                data: { syncId, apiUrl }
            });

            if (syllabusRes && syllabusRes.success && syllabusRes.data) {
                const subjects = syllabusRes.data.data || [];
                const matches = findChapterMatchesInSyllabus(subjects, editedChapter);

                if (matches.length === 1) {
                    btn.textContent = '...';
                    const response = await chrome.runtime.sendMessage({
                        action: "logActivity",
                        data: {
                            syncId,
                            apiUrl,
                            type: "BOOK_CHAPTER_SUBMISSION",
                            details: {
                                chapterName: editedChapter,
                                chapterUrl: chapterUrl,
                                bookUrl: bookUrl
                            }
                        }
                    });

                    if (response && response.success) {
                        btn.textContent = 'Synced!';
                        setTimeout(() => host.remove(), 1200);
                    } else {
                        btn.textContent = 'Failed!';
                        btn.style.pointerEvents = 'auto';
                        btn.style.opacity = '1';
                        setTimeout(() => { btn.textContent = 'Sync Chapter'; }, 2000);
                    }
                } else {
                    host.remove();
                    showResolveMismatchOverlay(editedChapter, subjects, syncId, apiUrl, {
                        type: "BOOK_CHAPTER_SUBMISSION",
                        details: {
                            chapterName: editedChapter,
                            chapterUrl: chapterUrl,
                            bookUrl: bookUrl
                        }
                    });
                }
            } else {
                btn.textContent = '...';
                const response = await chrome.runtime.sendMessage({
                    action: "logActivity",
                    data: {
                        syncId,
                        apiUrl,
                        type: "BOOK_CHAPTER_SUBMISSION",
                        details: {
                            chapterName: editedChapter,
                            chapterUrl: chapterUrl,
                            bookUrl: bookUrl
                        }
                    }
                });

                if (response && response.success) {
                    btn.textContent = 'Synced!';
                    setTimeout(() => host.remove(), 1200);
                } else {
                    btn.textContent = 'Failed!';
                    btn.style.pointerEvents = 'auto';
                    btn.style.opacity = '1';
                    setTimeout(() => { btn.textContent = 'Sync Chapter'; }, 2000);
                }
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error checking match for book chapter:", e);
            btn.textContent = 'Error!';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            setTimeout(() => { btn.textContent = 'Sync Chapter'; }, 2000);
        }
    });

    // backdrop click to dismiss removed
}

function showResolveMismatchOverlay(chapterTitle, subjects, syncId, apiUrl, pendingActivity = null) {
    const existing = document.getElementById('vinyas-overlay-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-overlay-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const logoUrl = chrome.runtime.getURL('favicon.ico');

    const defaultSubject = subjects[0]?.name || '';
    const initialChapters = subjects[0]?.chapters || [];

    const overlayTitle = pendingActivity ? "Resolve Mismatch & Sync" : "Resolve Chapter Mismatch";
    const overlaySubtitle = pendingActivity ? "Syllabus mapping required to sync" : "Link this practice page to your syllabus";
    const submitBtnLabel = pendingActivity ? "Resolve & Sync" : "Link Tracker";

    shadow.innerHTML = `
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .backdrop {
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(5, 8, 16, 0.65); backdrop-filter:blur(10px);
            display:flex; align-items:flex-start; justify-content:flex-end;
            padding:24px; pointer-events:all;
            animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .card {
            background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:24px;
            width:360px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,0.65), 0 0 25px rgba(59,130,246,0.08);
            animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            backdrop-filter: blur(16px);
        }
        .header {
            padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.06);
            display:flex; align-items:center; gap:12px;
        }
        .logo { width:32px; height:32px; border-radius:10px; border:none; background:none; padding:0; display:block; }
        .brand { font-size:14px; font-weight:800; color:#f8fafc; letter-spacing:0.5px; }
        .subtitle { font-size:9px; color:#64748b; font-weight:750; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
        .body { padding:18px 22px; }
        
        .mismatch-banner {
            background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.2); border-radius:14px;
            padding:12px 14px; margin-bottom:16px;
        }
        .mismatch-label { font-size:9px; font-weight:800; color:#f87171; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; display:block; }
        .mismatch-val { font-size:12px; font-weight:700; color:#e2e8f0; word-break:break-all; }

        .tabs { display:flex; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.04); border-radius:14px; padding:4px; margin-bottom:16px; }
        .tab-btn { flex:1; padding:8px 0; border:none; background:none; color:#64748b; font-size:11px; font-weight:750; cursor:pointer; border-radius:10px; transition:all 0.2s; }
        .tab-btn.active { background:rgba(255,255,255,0.06); color:#f8fafc; }

        .input-group { margin-bottom:14px; }
        .input-label { display:block; font-size:9px; font-weight:750; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
        .input-field {
            width:100%; padding:10px 14px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08);
            border-radius:12px; color:#e2e8f0; font-size:13px; font-weight:600; outline:none; transition:all 0.2s;
        }
        .input-field:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.15); }
        select.input-field { cursor:pointer; }
        select.input-field option { background:#0f172a; color:#e2e8f0; }

        .sub-toggle-group { display:flex; gap:8px; margin-bottom:12px; }
        .sub-toggle-btn { flex:1; padding:6px 0; border:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.2); color:#64748b; font-size:10px; font-weight:750; cursor:pointer; border-radius:10px; transition:all 0.2s; }
        .sub-toggle-btn.active { border-color:#3b82f6; background:rgba(59,130,246,0.1); color:#60a5fa; }

        .footer { padding:14px 22px 18px; display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.03); }
        .btn {
            flex:1; padding:12px 0; border:none; border-radius:12px; font-size:12px;
            font-weight:800; cursor:pointer; transition:all 0.2s;
        }
        .btn-dismiss { background:rgba(255,255,255,0.03); color:#94a3b8; border:1px solid rgba(255,255,255,0.06); }
        .btn-dismiss:hover { background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.12); }
        .btn-send { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:white;
            box-shadow:0 4px 15px rgba(59,130,246,0.35); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(59,130,246,0.55); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="Vinyas Logo" />
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">${escapeHTML(overlaySubtitle)}</div>
                </div>
            </div>
            <div class="body">
                <div class="mismatch-banner">
                    <span class="mismatch-label">Mismatched Chapter Name</span>
                    <span class="mismatch-val">${escapeHTML(chapterTitle)}</span>
                </div>

                <div class="tabs">
                    <button class="tab-btn active" id="tab-link">Link to Subject</button>
                    <button class="tab-btn" id="tab-create">Create New Subject</button>
                </div>

                <div id="section-link">
                    <div class="input-group">
                        <label class="input-label">Select Subject</label>
                        <select class="input-field" id="select-subject">
                            ${subjects.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="input-group">
                        <label class="input-label">Chapter Mode</label>
                        <div class="sub-toggle-group">
                            <button class="sub-toggle-btn active" id="toggle-mode-existing">Existing Chapter</button>
                            <button class="sub-toggle-btn" id="toggle-mode-new">Create New Chapter</button>
                        </div>
                    </div>

                    <div class="input-group" id="group-existing-chapter">
                        <label class="input-label">Select Chapter</label>
                        <select class="input-field" id="select-chapter">
                            ${initialChapters.map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="input-group" id="group-new-chapter" style="display:none;">
                        <label class="input-label">New Chapter Name</label>
                        <input type="text" class="input-field" id="input-new-chapter" value="${escapeHTML(chapterTitle)}" placeholder="e.g. Kinematics" />
                    </div>
                </div>

                <div id="section-create" style="display:none;">
                    <div class="input-group">
                        <label class="input-label">New Subject Name</label>
                        <input type="text" class="input-field" id="input-new-subject" placeholder="e.g. BITSAT Physics" />
                    </div>
                    <div class="input-group">
                        <label class="input-label">Chapter Name</label>
                        <input type="text" class="input-field" id="input-create-chapter" value="${escapeHTML(chapterTitle)}" placeholder="e.g. Kinematics" />
                    </div>
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-dismiss" id="btn-dismiss">Dismiss</button>
                <button class="btn btn-send" id="btn-send">${escapeHTML(submitBtnLabel)}</button>
            </div>
        </div>
    </div>`;

    let activeTab = 'link'; // 'link' or 'create'
    let chapterMode = 'existing'; // 'existing' or 'new'

    const tabLink = shadow.getElementById('tab-link');
    const tabCreate = shadow.getElementById('tab-create');
    const sectionLink = shadow.getElementById('section-link');
    const sectionCreate = shadow.getElementById('section-create');

    const toggleModeExisting = shadow.getElementById('toggle-mode-existing');
    const toggleModeNew = shadow.getElementById('toggle-mode-new');
    const groupExistingChapter = shadow.getElementById('group-existing-chapter');
    const groupNewChapter = shadow.getElementById('group-new-chapter');

    const selectSubject = shadow.getElementById('select-subject');
    const selectChapter = shadow.getElementById('select-chapter');
    const inputNewChapter = shadow.getElementById('input-new-chapter');

    const inputNewSubject = shadow.getElementById('input-new-subject');
    const inputCreateChapter = shadow.getElementById('input-create-chapter');

    const btnDismiss = shadow.getElementById('btn-dismiss');
    const btnSend = shadow.getElementById('btn-send');

    // Tab switcher
    tabLink.addEventListener('click', () => {
        activeTab = 'link';
        tabLink.classList.add('active');
        tabCreate.classList.remove('active');
        sectionLink.style.display = 'block';
        sectionCreate.style.display = 'none';
    });

    tabCreate.addEventListener('click', () => {
        activeTab = 'create';
        tabCreate.classList.add('active');
        tabLink.classList.remove('active');
        sectionLink.style.display = 'none';
        sectionCreate.style.display = 'block';
    });

    // Chapter mode switcher
    toggleModeExisting.addEventListener('click', () => {
        chapterMode = 'existing';
        toggleModeExisting.classList.add('active');
        toggleModeNew.classList.remove('active');
        groupExistingChapter.style.display = 'block';
        groupNewChapter.style.display = 'none';
    });

    toggleModeNew.addEventListener('click', () => {
        chapterMode = 'new';
        toggleModeNew.classList.add('active');
        toggleModeExisting.classList.remove('active');
        groupExistingChapter.style.display = 'none';
        groupNewChapter.style.display = 'block';
    });

    // Dynamic chapters list based on subject select
    selectSubject.addEventListener('change', () => {
        const subName = selectSubject.value;
        const subObj = subjects.find(s => s.name === subName);
        const chapters = subObj ? subObj.chapters || [] : [];
        
        selectChapter.innerHTML = '';
        if (chapters.length === 0) {
            toggleModeNew.click();
            toggleModeExisting.style.display = 'none';
        } else {
            toggleModeExisting.style.display = 'block';
            chapters.forEach(ch => {
                const opt = document.createElement('option');
                opt.value = ch.name;
                opt.textContent = ch.name;
                selectChapter.appendChild(opt);
            });
        }
    });

    btnDismiss.addEventListener('click', () => {
        host.remove();
        trackerFailed = true;
        showPwSubmitButton();
        showPwLeaveButton();
    });

    // backdrop click to dismiss removed

    btnSend.addEventListener('click', async () => {
        let payloadDetails = {
            chapterTitle: chapterTitle
        };

        if (activeTab === 'link') {
            const subjectName = selectSubject.value;
            if (!subjectName) return;

            if (chapterMode === 'existing') {
                const chapterName = selectChapter.value;
                if (!chapterName) return;
                payloadDetails.mode = 'link_chapter';
                payloadDetails.subjectName = subjectName;
                payloadDetails.chapterName = chapterName;
            } else {
                const chapterName = inputNewChapter.value.trim();
                if (!chapterName) return;
                payloadDetails.mode = 'create_chapter';
                payloadDetails.subjectName = subjectName;
                payloadDetails.chapterName = chapterName;
            }
        } else {
            const newSubjectName = inputNewSubject.value.trim();
            const chapterName = inputCreateChapter.value.trim();
            if (!newSubjectName || !chapterName) return;
            payloadDetails.mode = 'create_subject';
            payloadDetails.newSubjectName = newSubjectName;
            payloadDetails.chapterName = chapterName;
        }

        if (pendingActivity) {
            payloadDetails.pendingActivity = pendingActivity;
        }

        btnSend.textContent = '...';
        btnSend.style.pointerEvents = 'none';
        btnSend.style.opacity = '0.7';

        try {
            const response = await chrome.runtime.sendMessage({
                action: "logActivity",
                data: {
                    syncId,
                    apiUrl,
                    type: "RESOLVE_MAPPING",
                    details: payloadDetails
                }
            });

            if (response && response.success) {
                btnSend.textContent = 'Resolved!';
                setTimeout(() => {
                    host.remove();
                    if (!pendingActivity) {
                        lastCheckedPdfUrl = '';
                        checkPdfAssignment();
                        initInteractiveModuleTracker();
                    } else {
                        console.log("[Vinyas Tracker] Resolve and sync completed successfully.");
                    }
                }, 1200);
            } else {
                btnSend.textContent = 'Failed!';
                btnSend.style.pointerEvents = 'auto';
                btnSend.style.opacity = '1';
                setTimeout(() => { btnSend.textContent = submitBtnLabel; }, 2000);
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error resolving mismatch:", e);
            btnSend.textContent = 'Error!';
            btnSend.style.pointerEvents = 'auto';
            btnSend.style.opacity = '1';
            setTimeout(() => { btnSend.textContent = submitBtnLabel; }, 2000);
        }
    });
}
window.showResolveMismatchOverlay = showResolveMismatchOverlay;

function showSyncBookOverlay(detectedBook, bookUrl, syncId, apiUrl) {
    const existing = document.getElementById('vinyas-overlay-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-overlay-host';
    host.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'closed' });

    const logoUrl = chrome.runtime.getURL('favicon.ico');

    shadow.innerHTML = `
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .backdrop {
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(5, 8, 16, 0.65); backdrop-filter:blur(10px);
            display:flex; align-items:flex-start; justify-content:flex-end;
            padding:24px; pointer-events:all;
            animation: fadeIn 0.25s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .card {
            background:rgba(15, 23, 42, 0.85); border:1px solid rgba(255,255,255,0.08); border-radius:24px;
            width:350px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,0.65), 0 0 25px rgba(59,130,246,0.08);
            animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            backdrop-filter: blur(16px);
        }
        .header {
            padding:18px 22px; border-bottom:1px solid rgba(255,255,255,0.06);
            display:flex; align-items:center; gap:12px;
        }
        .logo { width:32px; height:32px; border-radius:10px; border:none; background:none; padding:0; display:block; }
        .brand { font-size:14px; font-weight:800; color:#f8fafc; letter-spacing:0.5px; }
        .subtitle { font-size:9px; color:#64748b; font-weight:750; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }
        .body { padding:18px 22px; }
        .input-group { margin-bottom:14px; }
        .input-label { display:block; font-size:9px; font-weight:750; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; }
        .input-field {
            width:100%; padding:10px 14px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08);
            border-radius:12px; color:#e2e8f0; font-size:13px; font-weight:600; outline:none; transition:all 0.2s;
        }
        .input-field:focus { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.15); }
        .footer { padding:14px 22px 18px; display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.03); }
        .btn {
            flex:1; padding:12px 0; border:none; border-radius:12px; font-size:12px;
            font-weight:800; cursor:pointer; transition:all 0.2s;
        }
        .btn-dismiss { background:rgba(255,255,255,0.03); color:#94a3b8; border:1px solid rgba(255,255,255,0.06); }
        .btn-dismiss:hover { background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.12); }
        .btn-send { background:linear-gradient(135deg,#3b82f6,#1d4ed8); color:white;
            box-shadow:0 4px 15px rgba(59,130,246,0.35); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(59,130,246,0.55); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="Vinyas Logo" />
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">Sync Module Book</div>
                </div>
            </div>
            <div class="body">
                <div class="input-group">
                    <label class="input-label">Book Name</label>
                    <input type="text" class="input-field" id="input-book" value="${escapeHTML(detectedBook)}" placeholder="e.g. Arjuna JEE Physics Module" />
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-dismiss" id="btn-dismiss">Dismiss</button>
                <button class="btn btn-send" id="btn-send">Sync to Vinyas</button>
            </div>
        </div>
    </div>`;

    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] Book overlay dismissed by user.');
    });

    shadow.getElementById('btn-send').addEventListener('click', async () => {
        const editedBook = shadow.getElementById('input-book').value.trim();
        if (!editedBook) return;

        const btn = shadow.getElementById('btn-send');
        btn.textContent = '...';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.7';

        try {
            const response = await chrome.runtime.sendMessage({
                action: "logActivity",
                data: {
                    syncId,
                    apiUrl,
                    type: "BOOK_SUBMISSION",
                    details: {
                        bookName: editedBook,
                        url: bookUrl
                    }
                }
            });

            if (response && response.success) {
                btn.textContent = 'Synced!';
                setTimeout(() => host.remove(), 1200);
            } else {
                btn.textContent = 'Failed!';
                btn.style.pointerEvents = 'auto';
                btn.style.opacity = '1';
                setTimeout(() => { btn.textContent = 'Sync to Vinyas'; }, 2000);
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error syncing book:", e);
            btn.textContent = 'Error!';
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
            setTimeout(() => { btn.textContent = 'Sync to Vinyas'; }, 2000);
        }
    });

    // backdrop click to dismiss removed
}

// ----------------------------------------------------
// 5. EVENT-DRIVEN & LOCATION-AWARE SCANNERS (Optimized URL Router)
// ----------------------------------------------------
setInterval(() => {
    try {
        const url = window.location.href;

        // 1. Run video observer ONLY on watch/batch learning pages
        if (url.includes("/watch") || url.includes("/lectures") || url.includes("/batch")) {
            observeVideos();
        }
        
        // 2. Check DPP scores ONLY when visiting result or quiz pages
        if (url.includes("/results") || url.includes("/dpp") || url.includes("/test")) {
            checkDppScore();
        }
        
        // 3. Extract study goals ONLY on the central study hub path
        if (url.includes("/study")) {
            checkStudyGoals();
        }
        
        // 4. Parse PW book exercises ONLY on the practice portal sub-path (disabled)
        if (url.includes("/practice") || url.includes("/books")) {
            // checkPwBooksQuestions();
            // checkPwPracticeV2Questions();
        }

        // 5. Check if PDF is loaded
        if (!isWidgetHiddenByUser && url.toLowerCase().includes("/notes?pdf=")) {
            checkPdfAssignment();
        }

        // 6. Check if Book details page or Book chapter reader page is loaded
        if (url.toLowerCase().includes("/books/")) {
            if (url.toLowerCase().includes("/chapters/")) {
                checkPwBookChapterLoad();
            } else {
                checkPwBookLoad();
            }
        }

        // 7. Check if PW practice module page is loaded
        if (!isWidgetHiddenByUser && url.toLowerCase().includes('/practice-v2/') && url.toLowerCase().includes('chaptertitle=')) {
            checkInteractiveModuleTracker();
            if (!trackerFailed) {
                hidePwSubmitButton();
                hidePwLeaveButton();
            } else {
                showPwSubmitButton();
                showPwLeaveButton();
            }
        } else if (!url.toLowerCase().includes('/notes?pdf=')) {
            const existing = document.getElementById('vinyas-tracker-widget-host');
            if (existing) {
                existing.remove();
                lastCheckedTrackerUrl = '';
            }
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error in scanner routing loop:", e);
    }
}, 2000);

let lastCheckedTrackerUrl = '';
let trackerFailed = false;

function findPwSubmitButton() {
    const submitKeywords = ['submit', 'end test', 'submit test', 'finish', 'end'];
    let foundSubmitBtn = null;
    
    const clickables = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    for (const kw of submitKeywords) {
        foundSubmitBtn = clickables.find(el => {
            const text = el.innerText?.trim().toLowerCase() || '';
            return text === kw || text.includes(kw);
        });
        if (foundSubmitBtn) break;
    }

    if (!foundSubmitBtn) {
        const divs = Array.from(document.querySelectorAll('div, span'));
        for (const kw of submitKeywords) {
            foundSubmitBtn = divs.find(el => {
                const text = el.innerText?.trim().toLowerCase() || '';
                return text.length > 0 && text.length <= 15 && text.includes(kw);
            });
            if (foundSubmitBtn) break;
        }
    }
    return foundSubmitBtn;
}

function findPwLeaveButton() {
    // 1. Try to find the specific PW back button from the header (with class mr-3, cursor-pointer and containing an svg)
    const specificDiv = Array.from(document.querySelectorAll('div.cursor-pointer')).find(el => {
        const classStr = typeof el.className === 'string' ? el.className : '';
        if (el.id && el.id.includes('vinyas')) return false;
        return classStr.includes('mr-3') && classStr.includes('w-full') && el.querySelector('svg');
    });
    if (specificDiv) return specificDiv;

    const specificDiv2 = document.querySelector('div.flex.justify-between.flex-col.w-full.mr-3.py-\\[6px\\].px-1.cursor-pointer');
    if (specificDiv2) return specificDiv2;

    const leaveKeywords = ['leave', 'exit', 'quit', 'go back', 'back', 'close'];
    let foundLeaveBtn = null;
    
    const clickables = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
    for (const kw of leaveKeywords) {
        foundLeaveBtn = clickables.find(el => {
            const text = el.innerText?.trim().toLowerCase() || '';
            if (el.id && el.id.includes('vinyas')) return false;
            return text === kw || text.includes(kw);
        });
        if (foundLeaveBtn) break;
    }

    if (!foundLeaveBtn) {
        const backSelectors = [
            'button[aria-label*="back" i]', 
            'button[aria-label*="exit" i]', 
            'button[aria-label*="close" i]', 
            'a[aria-label*="back" i]',
            '[class*="exit" i]',
            '[class*="leave" i]',
            '[class*="close" i]'
        ];
        for (const sel of backSelectors) {
            const elements = Array.from(document.querySelectorAll(sel));
            foundLeaveBtn = elements.find(el => {
                const text = el.innerText?.trim().toLowerCase() || '';
                if (el.id && el.id.includes('vinyas')) return false;
                return el.getBoundingClientRect().width > 0;
            });
            if (foundLeaveBtn) break;
        }
    }

    if (!foundLeaveBtn) {
        const divs = Array.from(document.querySelectorAll('div, span'));
        for (const kw of leaveKeywords) {
            foundLeaveBtn = divs.find(el => {
                const text = el.innerText?.trim().toLowerCase() || '';
                if (el.id && el.id.includes('vinyas')) return false;
                return text.length > 0 && text.length <= 15 && text.includes(kw);
            });
            if (foundLeaveBtn) break;
        }
    }
    return foundLeaveBtn;
}

function hidePwSubmitButton() {
    try {
        const btn = findPwSubmitButton();
        if (btn && btn.style.display !== 'none') {
            btn.style.setProperty('display', 'none', 'important');
            console.log("[Vinyas Tracker] Hidden native PW submit button:", btn);
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error hiding PW submit button:", e);
    }
}

function showPwSubmitButton() {
    try {
        const btn = findPwSubmitButton();
        if (btn && btn.style.display === 'none') {
            btn.style.removeProperty('display');
            console.log("[Vinyas Tracker] Restored/Unhidden native PW submit button:", btn);
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error showing PW submit button:", e);
    }
}

function hidePwLeaveButton() {
    try {
        const btn = findPwLeaveButton();
        if (btn && btn.style.display !== 'none') {
            btn.style.setProperty('display', 'none', 'important');
            console.log("[Vinyas Tracker] Hidden native PW leave button:", btn);
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error hiding PW leave button:", e);
    }
}

function showPwLeaveButton() {
    try {
        const btn = findPwLeaveButton();
        if (btn && btn.style.display === 'none') {
            btn.style.removeProperty('display');
            console.log("[Vinyas Tracker] Restored/Unhidden native PW leave button:", btn);
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error showing PW leave button:", e);
    }
}

function checkInteractiveModuleTracker() {
    if (window.self !== window.top) return; // Only run in the top-level frame
    try {
        const url = window.location.href;
        if (lastCheckedTrackerUrl === url) return;
        lastCheckedTrackerUrl = url;
        trackerFailed = false;
        initInteractiveModuleTracker();
    } catch (e) {
        console.error("[Vinyas Tracker] Error checking interactive module tracker:", e);
    }
}

function renderLoadingWidget() {
    const existing = document.getElementById('vinyas-tracker-widget-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-tracker-widget-host';
    host.style.cssText = `position:fixed;top:16px;left:${window.innerWidth / 2 - 315}px;width:630px;height:46px;z-index:2147483647;pointer-events:none;`;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    const logoUrl = chrome.runtime.getURL('favicon.ico');

    const css = `
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .pill {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 0 20px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 23px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.08);
            pointer-events: all;
            color: #f8fafc;
            user-select: none;
            width: 630px;
            height: 46px;
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .logo-img {
            width: 22px;
            height: 22px;
            border-radius: 6px;
        }
        .loading-text {
            font-size: 11px;
            font-weight: 700;
            color: #94a3b8;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
    `;

    shadow.innerHTML = `
        <style>${css}</style>
        <div class="pill">
            <img class="logo-img" src="${logoUrl}" alt="Vinyas Logo" />
            <div class="spinner"></div>
            <span class="loading-text">Loading Vinyas Tracker...</span>
        </div>
    `;
}

function waitForExerciseLayout(callback) {
    let attempts = 0;
    const maxAttempts = 12; // 6 seconds total
    const interval = setInterval(() => {
        attempts++;
        let scrapedExKey = null;
        let scrapedQCount = 0;

        const activeExElement = Array.from(document.querySelectorAll('span, div, h1, h2, h3, p')).find(el => {
            const text = el.innerText?.trim() || '';
            if (!text.toLowerCase().includes('exercise-') && !text.toLowerCase().includes('exercise ')) return false;
            const hasMatchingChild = Array.from(el.children).some(child => {
                const childText = child.innerText?.trim() || '';
                return childText.toLowerCase().includes('exercise-') || childText.toLowerCase().includes('exercise ');
            });
            return !hasMatchingChild;
        });

        if (activeExElement) {
            const scrapedExName = activeExElement.innerText.trim();
            const matchScraped = scrapedExName.match(/exercise[- ]*(\d+)/i);
            if (matchScraped && matchScraped[1]) {
                scrapedExKey = `Exercise ${matchScraped[1]}`;
            }
        }

        const leafDigits = Array.from(document.querySelectorAll('div, button, span'))
            .filter(el => el.children.length === 0 && /^\d+$/.test(el.innerText?.trim() || ''))
            .map(el => parseInt(el.innerText.trim(), 10));
        if (leafDigits.length > 0) {
            const maxQ = Math.max(...leafDigits);
            if (maxQ > 0 && maxQ <= 150) {
                scrapedQCount = maxQ;
            }
        }

        if ((scrapedExKey && scrapedQCount > 0) || attempts >= maxAttempts) {
            clearInterval(interval);
            callback();
        }
    }, 500);
}

function initInteractiveModuleTracker() {
    const urlParams = new URLSearchParams(window.location.search);
    let chapterTitleRaw = urlParams.get('chapterTitle') || '';
    if (!chapterTitleRaw) return;
    let chapterTitle = decodeURIComponent(chapterTitleRaw.replace(/\+/g, ' ')).trim();
    if (!chapterTitle) return;

    renderLoadingWidget();

    waitForExerciseLayout(() => {
        chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
            const syncId = result.vinyasSyncId;
            const apiUrl = result.vinyasApiUrl;
            if (!syncId || !apiUrl) {
                console.warn("[Vinyas Tracker] Sync ID or API URL not configured. Skipping tracker widget.");
                const existing = document.getElementById('vinyas-tracker-widget-host');
                if (existing) existing.remove();
                trackerFailed = true;
                showPwSubmitButton();
                showPwLeaveButton();
                return;
            }

            chrome.runtime.sendMessage({
                action: "fetchSyllabus",
                data: { syncId, apiUrl }
            }, (response) => {
                if (response && response.success && response.data) {
                    const subjects = response.data.data || [];
                    const matches = findChapterMatchesInSyllabus(subjects, chapterTitle);
                    if (matches.length === 1) {
                        renderTrackerWidget(matches[0].subject, matches[0].chapter, syncId, apiUrl);
                    } else {
                        console.log(`[Vinyas Tracker] Mismatch or ambiguous syllabus chapter match for "${chapterTitle}"`);
                        const existing = document.getElementById('vinyas-tracker-widget-host');
                        if (existing) existing.remove();
                        trackerFailed = true;
                        showPwSubmitButton();
                        showPwLeaveButton();
                        showResolveMismatchOverlay(chapterTitle, subjects, syncId, apiUrl);
                    }
                } else {
                    console.error("[Vinyas Tracker] Failed to fetch syllabus data:", response?.error);
                    const existing = document.getElementById('vinyas-tracker-widget-host');
                    if (existing) existing.remove();
                    trackerFailed = true;
                    showPwSubmitButton();
                    showPwLeaveButton();
                }
            });
        });
    });
}

function renderTrackerWidget(subject, chapter, syncId, apiUrl) {
    const existing = document.getElementById('vinyas-tracker-widget-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-tracker-widget-host';
    host.style.cssText = `position:fixed;top:16px;left:${window.innerWidth / 2 - 340}px;width:680px;height:46px;z-index:2147483647;pointer-events:none;`;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    const logoUrl = chrome.runtime.getURL('favicon.ico');

    const customExerciseConfig = chapter.customExerciseConfig || {};
    const exerciseDisplayNames = chapter.exerciseDisplayNames || {};
    
    activeWidgetSubject = subject;
    activeWidgetChapter = chapter;
    activeQuestionStates = chapter.moduleQuestionStates || {};

    // 1. Run dynamic scraper to find current active exercise and question count on load
    let scrapedExKey = null;
    let scrapedExDisplayName = null;
    let scrapedQCount = 0;
    let scraped = false;

    // A. Scrape active exercise name from DOM (find the deepest element containing "exercise" to avoid containers with chapter titles)
    const activeExElement = Array.from(document.querySelectorAll('span, div, h1, h2, h3, p')).find(el => {
        const text = el.innerText?.trim() || '';
        if (!text.toLowerCase().includes('exercise-') && !text.toLowerCase().includes('exercise ')) return false;
        const hasMatchingChild = Array.from(el.children).some(child => {
            const childText = child.innerText?.trim() || '';
            return childText.toLowerCase().includes('exercise-') || childText.toLowerCase().includes('exercise ');
        });
        return !hasMatchingChild;
    });
    if (activeExElement) {
        const scrapedExName = activeExElement.innerText.trim();
        const matchScraped = scrapedExName.match(/exercise[- ]*(\d+)/i);
        const scrapedNum = matchScraped ? matchScraped[1] : '';
        if (scrapedNum) {
            scrapedExKey = `Exercise ${scrapedNum}`;
            let cleanedDisplayName = scrapedExName.split('\n')[0].trim();
            if (chapter && chapter.name) {
                const escapedChName = chapter.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp('^' + escapedChName + '\\s*[:\\-]?\\s*', 'i');
                cleanedDisplayName = cleanedDisplayName.replace(regex, '');
            }
            scrapedExDisplayName = cleanedDisplayName || scrapedExName.split('\n')[0].trim();
            scraped = true;
        }
    }

    // B. Scrape total questions count from DOM (grid digit buttons)
    const leafDigits = Array.from(document.querySelectorAll('div, button, span'))
        .filter(el => el.children.length === 0 && /^\d+$/.test(el.innerText?.trim() || ''))
        .map(el => parseInt(el.innerText.trim(), 10));
    if (leafDigits.length > 0) {
        const maxQ = Math.max(...leafDigits);
        if (maxQ > 0 && maxQ <= 150) {
            scrapedQCount = maxQ;
        }
    }

    let exerciseKeys = Object.keys(customExerciseConfig);

    if (scraped && scrapedExKey && scrapedQCount > 0) {
        console.log(`[Vinyas Tracker] Scraped exercise details: "${scrapedExKey}" with ${scrapedQCount} questions.`);
        
        const isAlreadyConfigured = customExerciseConfig[scrapedExKey] === scrapedQCount && 
                                    exerciseDisplayNames[scrapedExKey] === scrapedExDisplayName;
        
        if (!isAlreadyConfigured) {
            console.log(`[Vinyas Tracker] Appending/updating "${scrapedExKey}" config to database.`);
            customExerciseConfig[scrapedExKey] = scrapedQCount;
            exerciseDisplayNames[scrapedExKey] = scrapedExDisplayName;
            exerciseKeys = Object.keys(customExerciseConfig);
            
            // Sync new configuration to database immediately
            logActivity('PW_BOOKS_QUESTIONS', {
                chapterName: chapter.name,
                exercises: customExerciseConfig,
                displayNames: exerciseDisplayNames,
                url: window.location.href,
                forceUpdate: true
            });
        }
    } else {
        console.log("[Vinyas Tracker] Scraper did not detect layout from active page. Relying on database config.");
    }

    if (exerciseKeys.length === 0) {
        console.log("[Vinyas Tracker] No exercise config found and failed to scrape layout. Checking if redirect index prompt can be shown.");
        if (window.location.search) {
            showRedirectIndexPrompt(chapter, syncId, apiUrl);
        } else {
            console.warn("[Vinyas Tracker] No custom exercise configuration found for chapter:", chapter.name);
            lastCheckedTrackerUrl = '';
            host.remove();
            trackerFailed = true;
            showPwSubmitButton();
            showPwLeaveButton();
        }
        return;
    }

    let activeExercise = scrapedExKey && customExerciseConfig[scrapedExKey] ? scrapedExKey : exerciseKeys[0];
    let activeQuestion = 1;

    const normalizeSubName = (name) => {
        const s = (name || '').toLowerCase().trim();
        if (s.includes('math')) return 'Maths';
        if (s.includes('phys')) return 'Physics';
        if (s.includes('chem')) return 'Chem';
        return name || '';
    };
    const normSub = normalizeSubName(subject.name);
    
    const cIdx = subject.chapters ? subject.chapters.findIndex(c => c.name === chapter.name) : -1;
    const isChapter1 = (() => {
        if (cIdx === 0) return true;
        const c = (chapter.name || '').toLowerCase();
        if (normSub === 'Maths' && c.includes('sets')) return true;
        if (normSub === 'Physics' && c.includes('units')) return true;
        if (normSub === 'Chem' && c.includes('mole')) return true;
        return false;
    })();

    const getQuestionKey = (exName, qNum) => {
        if (isChapter1) {
            return `${normSub}-${exName}-${qNum}`;
        } else {
            return `${normSub}-${chapter.name}-${exName}-${qNum}`;
        }
    };

    const css = `
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .pill {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 0 14px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 23px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(59, 130, 246, 0.08);
            pointer-events: all;
            color: #f8fafc;
            user-select: none;
            width: 680px;
            height: 46px;
            animation: fadeIn 0.3s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .drag-handle {
            display: flex;
            align-items: center;
            cursor: grab;
            color: #64748b;
            padding-right: 2px;
            height: 100%;
        }
        .drag-handle:active {
            cursor: grabbing;
        }
        .logo-img {
            width: 24px;
            height: 24px;
            border-radius: 6px;
        }
        .info-sec {
            display: flex;
            flex-direction: column;
            min-width: 0;
            max-width: 90px;
            line-height: 1.2;
        }
        .brand {
            font-size: 8px;
            font-weight: 850;
            color: #3b82f6;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .chapter-name {
            font-size: 11px;
            font-weight: 700;
            color: #e2e8f0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .divider {
            width: 1px;
            height: 20px;
            background: rgba(255, 255, 255, 0.1);
        }
        .select-field {
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            color: #e2e8f0;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            outline: none;
            cursor: pointer;
            max-width: 110px;
            text-overflow: ellipsis;
            transition: border-color 0.2s;
        }
        .select-field:focus {
            border-color: #3b82f6;
        }
        .nav-wrapper {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .nav-btn {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #94a3b8;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            outline: none;
        }
        .nav-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #f8fafc;
            border-color: rgba(255, 255, 255, 0.15);
            transform: scale(1.05);
        }
        .nav-btn:active {
            transform: scale(0.95);
        }
        .q-label {
            font-size: 12px;
            font-weight: 900;
            color: #f8fafc;
            min-width: 32px;
            text-align: center;
        }
        .status-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s;
            border: 1px solid transparent;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            min-width: 100px;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .status-todo { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.08); color: #94a3b8; }
        .status-todo:hover { background: rgba(255, 255, 255, 0.08); color: #e2e8f0; }
        .status-completed { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #34d399; }
        .status-completed:hover { background: rgba(16, 185, 129, 0.25); }
        .status-difficult { background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.3); color: #f87171; }
        .status-difficult:hover { background: rgba(239, 68, 68, 0.25); }
        .status-later { background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); color: #fbbf24; }
        .status-later:hover { background: rgba(245, 158, 11, 0.25); }
        .leave-btn {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94a3b8;
            padding: 5px 14px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            white-space: nowrap;
        }
        .leave-btn:hover {
            background: rgba(239, 68, 68, 0.15);
            border-color: rgba(239, 68, 68, 0.35);
            color: #f87171;
            transform: scale(1.03);
        }
        .leave-btn:active {
            transform: scale(0.97);
        }
        .submit-btn {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border: 1px solid rgba(239, 68, 68, 0.4);
            color: white;
            padding: 5px 14px;
            border-radius: 20px;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
            white-space: nowrap;
        }
        .submit-btn:hover {
            box-shadow: 0 4px 16px rgba(239, 68, 68, 0.4);
            transform: scale(1.03);
        }
        .submit-btn:active {
            transform: scale(0.97);
        }
    `;

    shadow.innerHTML = `
        <style>${css}</style>
        <div class="pill">
            <div class="drag-handle" id="drag-handle" title="Drag Widget">
                <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor">
                    <circle cx="3" cy="3" r="1.2"/>
                    <circle cx="3" cy="9" r="1.2"/>
                    <circle cx="3" cy="15" r="1.2"/>
                    <circle cx="9" cy="3" r="1.2"/>
                    <circle cx="9" cy="9" r="1.2"/>
                    <circle cx="9" cy="15" r="1.2"/>
                </svg>
            </div>
            <img class="logo-img" src="${logoUrl}" alt="Vinyas Logo" />
            <div class="info-sec">
                <span class="brand">Vinyas</span>
                <span class="chapter-name" title="${escapeHTML(chapter.name)}">${escapeHTML(chapter.name)}</span>
            </div>
            <div class="divider"></div>
            <select class="select-field" id="select-exercise">
                ${exerciseKeys.map(k => {
                    let dispName = exerciseDisplayNames[k] || k;
                    if (chapter && chapter.name) {
                        const escapedChName = chapter.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp('^' + escapedChName + '\\s*[:\\-]?\\s*', 'i');
                        dispName = dispName.replace(regex, '');
                    }
                    return `
                        <option value="${k}" ${k === activeExercise ? 'selected' : ''}>
                            ${escapeHTML(dispName || k)}
                        </option>
                    `;
                }).join('')}
            </select>
            <div class="divider"></div>
            <div class="nav-wrapper">
                <button class="nav-btn" id="btn-prev" title="Previous Question">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span class="q-label" id="label-question">Q${activeQuestion} / ${customExerciseConfig[activeExercise] || 1}</span>
                <button class="nav-btn" id="btn-next" title="Next Question">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </div>
            <div class="divider"></div>
            <button class="status-toggle status-todo" id="btn-status">
                <span>To Do</span>
            </button>
            <div class="divider"></div>
            <button class="leave-btn" id="btn-leave-vinyas" title="Save Progress and Leave">
                <span>Leave</span>
            </button>
            <div class="divider"></div>
            <button class="submit-btn" id="btn-submit-pw" title="Submit PW Quiz/Practice">
                <span>Submit</span>
            </button>
        </div>
    `;

    const selectExercise = shadow.getElementById('select-exercise');
    const btnPrev = shadow.getElementById('btn-prev');
    const btnNext = shadow.getElementById('btn-next');
    const labelQuestion = shadow.getElementById('label-question');
    const btnStatus = shadow.getElementById('btn-status');
    const btnLeaveVinyas = shadow.getElementById('btn-leave-vinyas');
    const btnSubmitPw = shadow.getElementById('btn-submit-pw');
    const dragHandle = shadow.getElementById('drag-handle');

    // Dragging Logic
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(host.style.left) || 0;
        initialTop = parseInt(host.style.top) || 0;
        dragHandle.style.cursor = 'grabbing';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        
        const minLeft = 10;
        const maxLeft = window.innerWidth - 640;
        const minTop = 10;
        const maxTop = window.innerHeight - 56;
        
        if (newLeft < minLeft) newLeft = minLeft;
        if (newLeft > maxLeft) newLeft = maxLeft;
        if (newTop < minTop) newTop = minTop;
        if (newTop > maxTop) newTop = maxTop;

        host.style.left = newLeft + 'px';
        host.style.top = newTop + 'px';
    }

    function onMouseUp() {
        isDragging = false;
        dragHandle.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    const updateStatusButtonUI = (state) => {
        btnStatus.className = 'status-toggle';
        if (state === 'completed') {
            btnStatus.classList.add('status-completed');
            btnStatus.innerHTML = `<span>✓ Completed</span>`;
        } else if (state === 'difficult') {
            btnStatus.classList.add('status-difficult');
            btnStatus.innerHTML = `<span>! Difficult</span>`;
        } else if (state === 'later') {
            btnStatus.classList.add('status-later');
            btnStatus.innerHTML = `<span>⌛ Later</span>`;
        } else {
            btnStatus.classList.add('status-todo');
            btnStatus.innerHTML = `<span>To Do</span>`;
        }
    };

    const getActiveQuestionState = () => {
        const key = getQuestionKey(activeExercise, activeQuestion);
        return activeQuestionStates[key] || 'none';
    };

    const updateQuestionUI = () => {
        const maxQ = customExerciseConfig[activeExercise] || 1;
        labelQuestion.textContent = `Q${activeQuestion} / ${maxQ}`;
        const state = getActiveQuestionState();
        updateStatusButtonUI(state);
    };

    updateQuestionUI();
    refreshWidgetQuestionUI = updateQuestionUI;

    selectExercise.addEventListener('change', (e) => {
        activeExercise = e.target.value;
        activeQuestion = 1;
        updateQuestionUI();
    });

    btnPrev.addEventListener('click', () => {
        if (activeQuestion > 1) {
            activeQuestion--;
            updateQuestionUI();
            syncNavigationToPage();
        }
    });

    btnNext.addEventListener('click', () => {
        const maxQ = customExerciseConfig[activeExercise] || 1;
        if (activeQuestion < maxQ) {
            activeQuestion++;
            updateQuestionUI();
            syncNavigationToPage();
        }
    });

    btnStatus.addEventListener('click', () => {
        const currentState = getActiveQuestionState();
        let newState = 'none';

        if (currentState === 'none') newState = 'completed';
        else if (currentState === 'completed') newState = 'difficult';
        else if (currentState === 'difficult') newState = 'later';

        const key = getQuestionKey(activeExercise, activeQuestion);
        if (newState === 'none') {
            activeQuestionStates[key] = 'none';
        } else {
            activeQuestionStates[key] = newState;
        }

        updateStatusButtonUI(newState);

        chrome.runtime.sendMessage({
            action: "logActivity",
            data: {
                syncId,
                apiUrl,
                type: "INTERACTIVE_QUESTION_UPDATE",
                details: {
                    subjectName: subject.name,
                    chapterName: chapter.name,
                    exerciseName: activeExercise,
                    questionNumber: activeQuestion,
                    state: newState
                }
            }
        });
    });

    btnLeaveVinyas.addEventListener('click', () => {
        const currentState = getActiveQuestionState();
        
        const span = btnLeaveVinyas.querySelector('span');
        if (span) span.textContent = "Saving...";
        btnLeaveVinyas.style.pointerEvents = "none";

        chrome.runtime.sendMessage({
            action: "logActivity",
            data: {
                syncId,
                apiUrl,
                type: "INTERACTIVE_QUESTION_UPDATE",
                details: {
                    subjectName: subject.name,
                    chapterName: chapter.name,
                    exerciseName: activeExercise,
                    questionNumber: activeQuestion,
                    state: currentState
                }
            }
        }, () => {
            if (span) span.textContent = "Leave";
            btnLeaveVinyas.style.pointerEvents = "";

            const foundLeaveBtn = findPwLeaveButton();
            if (foundLeaveBtn) {
                console.log("[Vinyas Tracker] Clicking native PW leave/exit button:", foundLeaveBtn);
                foundLeaveBtn.click();
            } else {
                console.warn("[Vinyas Tracker] Native PW leave/exit button not found. Using history.back() as fallback.");
                window.history.back();
            }
        });
    });

    btnSubmitPw.addEventListener('click', () => {
        const foundSubmitBtn = findPwSubmitButton();
        if (foundSubmitBtn) {
            console.log("[Vinyas Tracker] Clicking hidden PW submit button:", foundSubmitBtn);
            foundSubmitBtn.click();
        } else {
            // Inline toast instead of native alert()
            const existing = shadow.getElementById('vinyas-widget-toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.id = 'vinyas-widget-toast';
            toast.textContent = '⚠️ Submit button not found on page. Please locate and click the page submit button manually.';
            toast.setAttribute('style', 'position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1e293b;color:#fbbf24;border:1px solid #f59e0b44;padding:8px 14px;border-radius:12px;font-size:11px;font-weight:700;z-index:999999;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:vinyasToastIn 0.3s ease;max-width:340px;white-space:normal;text-align:center;');
            const widgetContainer = shadow.querySelector('.vinyas-widget') || shadow.firstElementChild;
            if (widgetContainer) {
                widgetContainer.style.position = widgetContainer.style.position || 'relative';
                widgetContainer.appendChild(toast);
            } else {
                shadow.appendChild(toast);
            }
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
        }
    });

    const syncNavigationToPage = () => {
        const qNumStr = String(activeQuestion);
        let found = Array.from(document.querySelectorAll('button, a, div[class*="question"], span[class*="question"]')).find(el => {
            return el.innerText?.trim() === qNumStr;
        });

        if (found) {
            console.log(`[Vinyas Tracker] Found target question element on page: clicking it.`);
            found.click();
        } else {
            console.log(`[Vinyas Tracker] Did not find direct question element on page.`);
        }
    };

    const syncPageToWidget = () => {
        try {
            const activeQBox = Array.from(document.querySelectorAll('div[class*="subHeading"]')).find(el => {
                const text = el.innerText?.trim() || '';
                return /^\d+$/.test(text) && text.length > 0 && text.length <= 3;
            });
            if (activeQBox) {
                const parsedQNum = parseInt(activeQBox.innerText.trim(), 10);
                if (parsedQNum > 0 && parsedQNum !== activeQuestion) {
                    activeQuestion = parsedQNum;
                    updateQuestionUI();
                }
            }

            const activeExElement = Array.from(document.querySelectorAll('span, div, h1, h2, h3, p')).find(el => {
                const text = el.innerText?.trim() || '';
                if (!text.toLowerCase().includes('exercise-') && !text.toLowerCase().includes('exercise ')) return false;
                const hasMatchingChild = Array.from(el.children).some(child => {
                    const childText = child.innerText?.trim() || '';
                    return childText.toLowerCase().includes('exercise-') || childText.toLowerCase().includes('exercise ');
                });
                return !hasMatchingChild;
            });

            if (activeExElement) {
                const scrapedExName = activeExElement.innerText.trim();
                const matchScraped = scrapedExName.match(/exercise[- ]*(\d+)/i);
                const scrapedNum = matchScraped ? matchScraped[1] : '';

                if (scrapedNum) {
                    const scrapedExKey = `Exercise ${scrapedNum}`;
                    let scrapedQCount = 0;
                    
                    // Scrape total questions count from DOM (grid digit buttons)
                    const leafDigits = Array.from(document.querySelectorAll('div, button, span'))
                        .filter(el => el.children.length === 0 && /^\d+$/.test(el.innerText?.trim() || ''))
                        .map(el => parseInt(el.innerText.trim(), 10));
                    if (leafDigits.length > 0) {
                        const maxQ = Math.max(...leafDigits);
                        if (maxQ > 0 && maxQ <= 150) {
                            scrapedQCount = maxQ;
                        }
                    }

                    if (scrapedQCount > 0) {
                        // Check if we need to add/update this exercise configuration
                        const hasEx = customExerciseConfig[scrapedExKey] !== undefined;
                        const isAlreadyConfigured = hasEx && 
                                                    customExerciseConfig[scrapedExKey] === scrapedQCount;
                        
                        if (!isAlreadyConfigured) {
                            console.log(`[Vinyas Tracker] Dynamically detected new exercise layout in SPA: "${scrapedExKey}" with ${scrapedQCount} questions.`);
                            customExerciseConfig[scrapedExKey] = scrapedQCount;
                            
                            let cleanedDisplayName = scrapedExName.split('\n')[0].trim();
                            if (chapter && chapter.name) {
                                const escapedChName = chapter.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                const regex = new RegExp('^' + escapedChName + '\\s*[:\\-]?\\s*', 'i');
                                cleanedDisplayName = cleanedDisplayName.replace(regex, '');
                            }
                            exerciseDisplayNames[scrapedExKey] = cleanedDisplayName || scrapedExName.split('\n')[0].trim();
                            
                            // Re-render select options in dropdown
                            selectExercise.innerHTML = Object.keys(customExerciseConfig).map(k => {
                                let dispName = exerciseDisplayNames[k] || k;
                                if (chapter && chapter.name) {
                                    const escapedChName = chapter.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                                    const regex = new RegExp('^' + escapedChName + '\\s*[:\\-]?\\s*', 'i');
                                    dispName = dispName.replace(regex, '');
                                }
                                const option = document.createElement('option');
                                option.value = k;
                                option.textContent = dispName || k;
                                if (k === scrapedExKey) option.selected = true;
                                return option.outerHTML;
                            }).join('');

                            // Sync new configuration to database immediately
                            logActivity('PW_BOOKS_QUESTIONS', {
                                chapterName: chapter.name,
                                exercises: customExerciseConfig,
                                displayNames: exerciseDisplayNames,
                                url: window.location.href,
                                forceUpdate: true
                            });
                        }
                    }

                    const matchedKey = Object.keys(customExerciseConfig).find(k => {
                        const matchKey = k.match(/exercise[- ]*(\d+)/i);
                        return matchKey && matchKey[1] === scrapedNum;
                    });
                    if (matchedKey && matchedKey !== activeExercise) {
                        activeExercise = matchedKey;
                        selectExercise.value = matchedKey;
                        updateQuestionUI();
                    }
                }
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error in passive page-to-widget sync observer:", e);
        }
    };

    const passiveSyncInterval = setInterval(() => {
        if (!document.getElementById('vinyas-tracker-widget-host')) {
            clearInterval(passiveSyncInterval);
            return;
        }
        syncPageToWidget();
        hidePwSubmitButton();
        hidePwLeaveButton();
    }, 1000);
}

// ----------------------------------------------------
// 6. CLICK INTERCEPTOR (Saves metadata to local storage)
// ----------------------------------------------------
document.addEventListener('click', (event) => {
    try {
        const target = event.target;
        if (!target) return;

        const anchor = target.closest('a');
        const href = anchor ? anchor.getAttribute('href') : null;
        const targetUrl = href || target.getAttribute('data-url') || target.getAttribute('href') || window.location.href || '';
        const triggerText = target.innerText ? target.innerText.trim() : (anchor ? anchor.innerText.trim() : '');

        // Trace up to find parent container with a colon
        let parent = target;
        let containerWithColon = null;
        let index = 0;
        while (parent && parent !== document.body && index < 10) {
            const text = parent.innerText || '';
            if (text.includes(':') && !containerWithColon) {
                containerWithColon = parent;
            }
            parent = parent.parentElement;
            index++;
        }

        let containerText = containerWithColon ? containerWithColon.innerText : '';
        let chapterName = '';
        if (containerText) {
            const lines = containerText.split('\n').map(l => l.trim()).filter(Boolean);
            const lineWithColon = lines.find(l => l.includes(':'));
            if (lineWithColon) {
                chapterName = lineWithColon.split(':')[0].trim();
            } else if (containerText.includes(':')) {
                chapterName = containerText.split(':')[0].trim();
            }
        }

        if (!chapterName) {
            let textParent = target;
            let textToUse = '';
            while (textParent && textParent !== document.body) {
                if (textParent.innerText?.trim()) {
                    textToUse = textParent.innerText.trim();
                    break;
                }
                textParent = textParent.parentElement;
            }
            if (textToUse) {
                const firstLine = textToUse.split('\n')[0].trim();
                if (firstLine.length > 1 && firstLine.length < 150) {
                    chapterName = firstLine;
                }
            }
        }

        if (chapterName && chapterName !== 'General Click') {
            const cleanedAssignmentName = (triggerText || '')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            chrome.storage.local.get(['clickHistory'], (result) => {
                let history = result.clickHistory || [];
                
                // Construct new click record
                const newClick = {
                    chapterName: chapterName,
                    assignmentName: cleanedAssignmentName,
                    timestamp: Date.now()
                };

                // Remove duplicate chapter names to prioritize the latest click
                history = history.filter(item => item.chapterName !== chapterName);
                
                // Add to start of history
                history.unshift(newClick);

                // Keep only the latest 5 items
                if (history.length > 5) {
                    history = history.slice(0, 5);
                }

                chrome.storage.local.set({ 
                    clickHistory: history,
                    // Keep lastChapterName & lastAssignmentName pointing to the latest one for fallback compatibility
                    lastChapterName: chapterName,
                    lastAssignmentName: cleanedAssignmentName
                }, () => {
                    console.log("[Vinyas Tracker] Saved click metadata to history (max 5):", history);
                });
            });
        }
    } catch (e) {
        console.error("[Vinyas Tracker] Error in click listener:", e);
    }
}, true); // useCapture = true
})();
