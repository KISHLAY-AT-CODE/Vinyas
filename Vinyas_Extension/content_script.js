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
    const sendBtnLabel = alreadyExists ? '🔄 Update Again' : '🔥 Send to Vinyas';
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

    shadow.getElementById('btn-send').addEventListener('click', () => {
        const payload = { ...activityData };
        if (alreadyExists) {
            payload.forceUpdate = true;
        }
        logActivity('DPP_SCORE', payload);
        // Brief success feedback
        const btn = shadow.getElementById('btn-send');
        btn.textContent = alreadyExists ? '✅ Updated!' : '✅ Sent!';
        btn.style.pointerEvents = 'none';
        setTimeout(() => host.remove(), 800);
    });

    shadow.getElementById('backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'backdrop') host.remove();
    });
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
                <button class="btn btn-send" id="btn-send">🔥 Sync Exercises</button>
            </div>
        </div>
    </div>`;

    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] User cancelled/dismissed books config sync.');
    });

    shadow.getElementById('btn-send').addEventListener('click', () => {
        logActivity('PW_BOOKS_QUESTIONS', booksData);
        const btn = shadow.getElementById('btn-send');
        btn.textContent = '✅ Synced!';
        btn.style.pointerEvents = 'none';
        setTimeout(() => host.remove(), 800);
    });

    shadow.getElementById('backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'backdrop') host.remove();
    });
}

function parseBooksQuestionsFromDOM() {
    try {
        const url = window.location.href;
        const isBooksDomain = url.includes("books.pw.live") || url.includes("books.physicswallah.live");
        if (!isBooksDomain || !url.includes("/practice")) return null;

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

        if (!chapterName) return null;

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
                    displayNames[exKey] = titleText;
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

// ----------------------------------------------------
// MESSAGE LISTENER (For Popup Trigger)
// ----------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

function checkPdfAssignment() {
    const url = window.location.href;
    if (!url.toLowerCase().includes('/notes?pdf=')) return;
    if (url === lastCheckedPdfUrl) return;
    lastCheckedPdfUrl = url;

    console.log("[Vinyas Tracker] PDF URL detected:", url);

    chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl', 'clickHistory'], (result) => {
        const syncId = result.vinyasSyncId;
        const apiUrl = result.vinyasApiUrl;
        if (!syncId || !apiUrl) {
            console.warn("[Vinyas Tracker] Sync ID or API URL not configured. Skipping assignment check.");
            return;
        }

        chrome.runtime.sendMessage({
            action: "checkAssignmentUrl",
            data: { syncId, apiUrl, url }
        }, (response) => {
            if (response && response.exists) {
                console.log("[Vinyas Tracker] Silent bypass: PDF URL already exists under assignments.");
            } else {
                console.log("[Vinyas Tracker] PDF URL not found in assignments, displaying sync overlay.");
                
                const clickHistory = result.clickHistory || [];

                // Fallback default assignment name: try parsing filename from URL or document title
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

                showSyncAssignmentOverlay(defaultChapterName, defaultAssignmentName, url, syncId, apiUrl, clickHistory);
            }
        });
    });
}

function showSyncAssignmentOverlay(detectedChapter, detectedAssignment, pdfUrl, syncId, apiUrl, clickHistory = []) {
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
        .dropdown-item {
            padding: 10px 14px;
            font-size: 12px;
            font-weight: 600;
            color: #e2e8f0;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .dropdown-item:hover {
            background: rgba(59,130,246,0.15);
            color: #60a5fa;
        }
        .dropdown-item:last-child {
            border-bottom: none;
        }
        .footer { padding:14px 22px 18px; display:flex; gap:10px; border-top:1px solid rgba(255,255,255,0.03); }
        .btn {
            flex:1; padding:12px 0; border:none; border-radius:12px; font-size:12px;
            font-weight:800; cursor:pointer; transition:all 0.2s;
        }
        .btn-dismiss { background:rgba(255,255,255,0.03); color:#94a3b8; border:1px solid rgba(255,255,255,0.06); }
        .btn-dismiss:hover { background:rgba(255,255,255,0.08); color:#f8fafc; border-color:rgba(255,255,255,0.12); }
        .btn-send { background:linear-gradient(135deg,#e04f16,#c23d0e); color:white;
            box-shadow:0 4px 15px rgba(224,79,22,0.35); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(224,79,22,0.55); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <img class="logo" src="${logoUrl}" alt="Vinyas Logo" />
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">Sync PDF Assignment</div>
                </div>
            </div>
            <div class="body">
                <div class="input-group" style="position: relative;">
                    <label class="input-label">Chapter Name</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="text" class="input-field" id="input-chapter" value="${escapeHTML(detectedChapter)}" placeholder="e.g. Kinematics" style="padding-right: 40px;" />
                        ${clickHistory && clickHistory.length > 0 ? `
                        <button id="btn-chapter-dropdown" type="button" style="position: absolute; right: 10px; background: none; border: none; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; transition: color 0.2s, transform 0.2s; outline: none;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        ` : ''}
                    </div>
                    ${clickHistory && clickHistory.length > 0 ? `
                    <div id="chapter-dropdown-menu" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 2147483647; max-height: 180px; overflow-y: auto; backdrop-filter: blur(12px); animation: fadeIn 0.15s ease;">
                        ${clickHistory.map((item, idx) => `
                        <div class="dropdown-item" data-value="${escapeHTML(item.chapterName)}" data-index="${idx}">
                            <span>${escapeHTML(item.chapterName)}</span>
                            <span style="font-size: 8px; color: #64748b; font-weight: 800; text-transform: uppercase;">${idx === 0 ? 'Latest' : `Click ${idx + 1}`}</span>
                        </div>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
                <div class="input-group">
                    <label class="input-label">Assignment Name</label>
                    <input type="text" class="input-field" id="input-assignment" value="${escapeHTML(detectedAssignment)}" placeholder="e.g. DPP 01" />
                </div>
            </div>
            <div class="footer">
                <button class="btn btn-dismiss" id="btn-dismiss">Dismiss</button>
                <button class="btn btn-send" id="btn-send">🔥 Sync to Vinyas</button>
            </div>
        </div>
    </div>`;

    // Dropdown toggle and selection handling
    const dropdownBtn = shadow.getElementById('btn-chapter-dropdown');
    const dropdownMenu = shadow.getElementById('chapter-dropdown-menu');
    const inputChapter = shadow.getElementById('input-chapter');
    const inputAssignment = shadow.getElementById('input-assignment');

    if (dropdownBtn && dropdownMenu) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = dropdownMenu.style.display === 'block';
            dropdownMenu.style.display = isVisible ? 'none' : 'block';
            dropdownBtn.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        // Close dropdown when clicking outside
        shadow.addEventListener('click', (e) => {
            if (!dropdownMenu.contains(e.target) && e.target !== dropdownBtn) {
                dropdownMenu.style.display = 'none';
                dropdownBtn.style.transform = 'rotate(0deg)';
            }
        });

        // Handle item selection
        const items = shadow.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', (e) => {
                const val = item.getAttribute('data-value');
                const idx = parseInt(item.getAttribute('data-index'), 10);
                inputChapter.value = val;
                
                // If there's an associated assignment name in history, update that too
                if (clickHistory[idx] && clickHistory[idx].assignmentName) {
                    inputAssignment.value = clickHistory[idx].assignmentName;
                }

                dropdownMenu.style.display = 'none';
                dropdownBtn.style.transform = 'rotate(0deg)';
            });
        });
    }

    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] Sync overlay dismissed by user.');
    });

    shadow.getElementById('btn-send').addEventListener('click', async () => {
        const editedChapter = shadow.getElementById('input-chapter').value.trim();
        const editedAssignment = shadow.getElementById('input-assignment').value.trim();
        
        if (!editedChapter || !editedAssignment) return;

        const btn = shadow.getElementById('btn-send');
        btn.textContent = '⏳ Syncing...';
        btn.style.pointerEvents = 'none';

        try {
            const response = await chrome.runtime.sendMessage({
                action: "addAssignment",
                data: {
                    syncId,
                    apiUrl,
                    chapterName: editedChapter,
                    assignmentName: editedAssignment,
                    url: pdfUrl
                }
            });

            if (response && response.success) {
                if (response.unresolved) {
                    btn.textContent = '✅ Queued (Unresolved)';
                } else {
                    btn.textContent = '✅ Synced!';
                }
                setTimeout(() => host.remove(), 1200);
            } else {
                btn.textContent = '❌ Failed!';
                btn.style.pointerEvents = 'auto';
                setTimeout(() => { btn.textContent = '🔥 Sync to Vinyas'; }, 2000);
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error syncing assignment:", e);
            btn.textContent = '❌ Error!';
            btn.style.pointerEvents = 'auto';
            setTimeout(() => { btn.textContent = '🔥 Sync to Vinyas'; }, 2000);
        }
    });

    shadow.getElementById('backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'backdrop') host.remove();
    });
}

let lastCheckedBookUrl = '';

function parseBookNameFromDOM() {
    try {
        const titleHeader = document.querySelector('div[class*="bookTitleWrapper"] h3, div[class*="bookDetails"] h3, h3[class*="heading3"]');
        if (titleHeader && titleHeader.innerText) {
            return titleHeader.innerText.trim();
        }
        // Fallback
        const h3s = Array.from(document.querySelectorAll('h3'));
        for (const h3 of h3s) {
            if (h3.className && (h3.className.includes('heading3') || h3.className.includes('Title') || h3.className.includes('title'))) {
                return h3.innerText.trim();
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
        const header = document.querySelector('div[class*="_subHeading_"], div[class*="subHeading"]');
        if (header && header.innerText) {
            return header.innerText.trim();
        }
        // Fallback
        const rootElements = Array.from(document.querySelectorAll('div[class*="_root_"]'));
        for (const el of rootElements) {
            if (el.className && el.className.includes('subHeading')) {
                return el.innerText.trim();
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
                <button class="btn btn-send" id="btn-send">🔥 Sync Chapter</button>
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
        btn.textContent = '⏳ Syncing...';
        btn.style.pointerEvents = 'none';

        try {
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
                btn.textContent = '✅ Synced!';
                setTimeout(() => host.remove(), 1200);
            } else {
                btn.textContent = '❌ Failed!';
                btn.style.pointerEvents = 'auto';
                setTimeout(() => { btn.textContent = '🔥 Sync Chapter'; }, 2000);
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error syncing chapter:", e);
            btn.textContent = '❌ Error!';
            btn.style.pointerEvents = 'auto';
            setTimeout(() => { btn.textContent = '🔥 Sync Chapter'; }, 2000);
        }
    });

    shadow.getElementById('backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'backdrop') host.remove();
    });
}

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
                <button class="btn btn-send" id="btn-send">🔥 Sync to Vinyas</button>
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
        btn.textContent = '⏳ Syncing...';
        btn.style.pointerEvents = 'none';

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
                btn.textContent = '✅ Synced!';
                setTimeout(() => host.remove(), 1200);
            } else {
                btn.textContent = '❌ Failed!';
                btn.style.pointerEvents = 'auto';
                setTimeout(() => { btn.textContent = '🔥 Sync to Vinyas'; }, 2000);
            }
        } catch (e) {
            console.error("[Vinyas Tracker] Error syncing book:", e);
            btn.textContent = '❌ Error!';
            btn.style.pointerEvents = 'auto';
            setTimeout(() => { btn.textContent = '🔥 Sync to Vinyas'; }, 2000);
        }
    });

    shadow.getElementById('backdrop').addEventListener('click', (e) => {
        if (e.target.id === 'backdrop') host.remove();
    });
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
        
        // 4. Parse PW book exercises ONLY on the practice portal sub-path
        if (url.includes("/practice") || url.includes("/books")) {
            checkPwBooksQuestions();
        }

        // 5. Check if PDF is loaded
        if (url.toLowerCase().includes("/notes?pdf=")) {
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
        if (url.toLowerCase().includes('/practice-v2/') && url.toLowerCase().includes('chaptertitle=')) {
            checkInteractiveModuleTracker();
            hidePwSubmitButton();
        } else {
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

function checkInteractiveModuleTracker() {
    try {
        const url = window.location.href;
        if (lastCheckedTrackerUrl === url) return;
        lastCheckedTrackerUrl = url;
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

function initInteractiveModuleTracker() {
    const urlParams = new URLSearchParams(window.location.search);
    let chapterTitleRaw = urlParams.get('chapterTitle') || '';
    if (!chapterTitleRaw) return;
    let chapterTitle = decodeURIComponent(chapterTitleRaw.replace(/\+/g, ' ')).trim();
    if (!chapterTitle) return;

    renderLoadingWidget();

    chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
        const syncId = result.vinyasSyncId;
        const apiUrl = result.vinyasApiUrl;
        if (!syncId || !apiUrl) {
            console.warn("[Vinyas Tracker] Sync ID or API URL not configured. Skipping tracker widget.");
            const existing = document.getElementById('vinyas-tracker-widget-host');
            if (existing) existing.remove();
            return;
        }

        chrome.runtime.sendMessage({
            action: "fetchSyllabus",
            data: { syncId, apiUrl }
        }, (response) => {
            if (response && response.success && response.data) {
                const subjects = response.data.data || [];
                let matchedSubject = null;
                let matchedChapter = null;

                for (const sub of subjects) {
                    const ch = sub.chapters?.find(c => c.name.trim().toLowerCase() === chapterTitle.trim().toLowerCase());
                    if (ch) {
                        matchedSubject = sub;
                        matchedChapter = ch;
                        break;
                    }
                }

                if (matchedSubject && matchedChapter) {
                    renderTrackerWidget(matchedSubject, matchedChapter, syncId, apiUrl);
                } else {
                    console.log(`[Vinyas Tracker] No matching syllabus chapter found for "${chapterTitle}"`);
                    const existing = document.getElementById('vinyas-tracker-widget-host');
                    if (existing) existing.remove();
                }
            } else {
                console.error("[Vinyas Tracker] Failed to fetch syllabus data:", response?.error);
                const existing = document.getElementById('vinyas-tracker-widget-host');
                if (existing) existing.remove();
            }
        });
    });
}

function renderTrackerWidget(subject, chapter, syncId, apiUrl) {
    const existing = document.getElementById('vinyas-tracker-widget-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'vinyas-tracker-widget-host';
    host.style.cssText = `position:fixed;top:16px;left:${window.innerWidth / 2 - 315}px;width:630px;height:46px;z-index:2147483647;pointer-events:none;`;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });
    const logoUrl = chrome.runtime.getURL('favicon.ico');

    const customExerciseConfig = chapter.customExerciseConfig || {};
    const exerciseDisplayNames = chapter.exerciseDisplayNames || {};
    let questionStates = chapter.moduleQuestionStates || {};

    const exerciseKeys = Object.keys(customExerciseConfig);
    if (exerciseKeys.length === 0) {
        console.warn("[Vinyas Tracker] No custom exercise configuration found for chapter:", chapter.name);
        host.remove();
        return;
    }

    let activeExercise = exerciseKeys[0];
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
            width: 630px;
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
                ${exerciseKeys.map(k => `
                    <option value="${k}" ${k === activeExercise ? 'selected' : ''}>
                        ${escapeHTML(exerciseDisplayNames[k] || k)}
                    </option>
                `).join('')}
            </select>
            <div class="divider"></div>
            <div class="nav-wrapper">
                <button class="nav-btn" id="btn-prev" title="Previous Question">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <span class="q-label" id="label-question">Q${activeQuestion}</span>
                <button class="nav-btn" id="btn-next" title="Next Question">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
            </div>
            <div class="divider"></div>
            <button class="status-toggle status-todo" id="btn-status">
                <span>To Do</span>
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
        return questionStates[key] || 'none';
    };

    const updateQuestionUI = () => {
        labelQuestion.textContent = `Q${activeQuestion}`;
        const state = getActiveQuestionState();
        updateStatusButtonUI(state);
    };

    updateQuestionUI();

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
            delete questionStates[key];
        } else {
            questionStates[key] = newState;
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

    btnSubmitPw.addEventListener('click', () => {
        const foundSubmitBtn = findPwSubmitButton();
        if (foundSubmitBtn) {
            console.log("[Vinyas Tracker] Clicking hidden PW submit button:", foundSubmitBtn);
            foundSubmitBtn.click();
        } else {
            alert("Submit button not found on page. Please locate and click the page submit button manually.");
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

            const activeExElement = Array.from(document.querySelectorAll('span, div')).find(el => {
                const text = el.innerText?.trim() || '';
                return text.toLowerCase().includes('exercise-') || text.toLowerCase().includes('exercise ');
            });
            if (activeExElement) {
                const scrapedExName = activeExElement.innerText.trim();
                const matchScraped = scrapedExName.match(/exercise[- ]*(\d+)/i);
                const scrapedNum = matchScraped ? matchScraped[1] : '';

                if (scrapedNum) {
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
