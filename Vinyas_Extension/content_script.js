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
                showConfirmOverlay(activityData, false);
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
    const logoUrl = chrome.runtime.getURL('icon.svg');

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

    const logoUrl = chrome.runtime.getURL('icon.svg');

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
                showBooksConfirmOverlay(booksData);
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
// START OBSERVERS
// ----------------------------------------------------
setInterval(() => {
    observeVideos();
    checkDppScore();
    checkStudyGoals();
    checkPwBooksQuestions();
}, 2000);
