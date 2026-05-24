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

function checkDppScore() {

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
            missingResultsCount = 0;
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

            const currentTitle = finalTitle;
            const currentMetricsStr = JSON.stringify(metrics);

            if (dppLogged && lastLoggedTitle === currentTitle && lastLoggedMetricsStr === currentMetricsStr) return;

            const activityData = {
                title: finalTitle,
                url: window.location.href,
                quizType: type,
                ...metrics
            };

            console.log(`[Vinyas Tracker] DPP detected! Type: ${type}. Showing confirmation overlay.`);
            showConfirmOverlay(activityData);
            
            dppLogged = true;
            lastLoggedTitle = currentTitle;
            lastLoggedMetricsStr = currentMetricsStr;
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
function showConfirmOverlay(activityData) {
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
    const typeBg = activityData.quizType === 'DPP' ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)';
    const typeColor = activityData.quizType === 'DPP' ? '#60a5fa' : '#fbbf24';

    shadow.innerHTML = `
    <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .backdrop {
            position:fixed; top:0; left:0; width:100%; height:100%;
            background:rgba(0,0,0,0.5); backdrop-filter:blur(4px);
            display:flex; align-items:flex-start; justify-content:flex-end;
            padding:20px; pointer-events:all;
            animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .card {
            background:#1e293b; border:1px solid #334155; border-radius:20px;
            width:340px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);
            animation: slideIn 0.25s ease;
        }
        .header {
            padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.06);
            display:flex; align-items:center; gap:10px;
        }
        .logo { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,#f97316,#ef4444);
            display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:900; color:white; }
        .brand { font-size:13px; font-weight:800; color:#f1f5f9; letter-spacing:0.5px; }
        .subtitle { font-size:10px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:1px; margin-top:1px; }
        .body { padding:16px 20px; }
        .title-row { display:flex; align-items:center; gap:8px; margin-bottom:14px; }
        .type-badge {
            font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:1px;
            padding:3px 8px; border-radius:6px; background:${typeBg}; color:${typeColor};
        }
        .quiz-title { font-size:13px; font-weight:700; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
        .stats { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
        .stat {
            background:#0f172a; border:1px solid #1e293b; border-radius:12px; padding:10px;
            display:flex; flex-direction:column; align-items:center;
        }
        .stat-label { font-size:9px; color:#64748b; text-transform:uppercase; letter-spacing:1px; font-weight:700; margin-bottom:3px; }
        .stat-value { font-size:18px; font-weight:900; }
        .stat-value.score { color:#60a5fa; }
        .stat-value.acc { color:${accColor}; }
        .stat-value.correct { color:#34d399; }
        .stat-value.incorrect { color:#fb7185; }
        .footer { padding:12px 20px 16px; display:flex; gap:10px; }
        .btn {
            flex:1; padding:11px 0; border:none; border-radius:12px; font-size:13px;
            font-weight:800; cursor:pointer; transition:all 0.15s;
        }
        .btn-dismiss { background:#334155; color:#94a3b8; }
        .btn-dismiss:hover { background:#475569; color:#e2e8f0; }
        .btn-send { background:linear-gradient(135deg,#f97316,#ef4444); color:white;
            box-shadow:0 4px 15px rgba(239,68,68,0.3); }
        .btn-send:hover { box-shadow:0 4px 20px rgba(239,68,68,0.5); transform:translateY(-1px); }
    </style>
    <div class="backdrop" id="backdrop">
        <div class="card">
            <div class="header">
                <div class="logo">V</div>
                <div>
                    <div class="brand">Vinyas Tracker</div>
                    <div class="subtitle">Submission Detected</div>
                </div>
            </div>
            <div class="body">
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
                <button class="btn btn-dismiss" id="btn-dismiss">Dismiss</button>
                <button class="btn btn-send" id="btn-send">🔥 Send to Vinyas</button>
            </div>
        </div>
    </div>`;

    // Event handlers
    shadow.getElementById('btn-dismiss').addEventListener('click', () => {
        host.remove();
        console.log('[Vinyas Tracker] User dismissed submission.');
    });

    shadow.getElementById('btn-send').addEventListener('click', () => {
        logActivity('DPP_SCORE', activityData);
        // Brief success feedback
        const btn = shadow.getElementById('btn-send');
        btn.textContent = '✅ Sent!';
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

function checkPwBooksQuestions() {
    try {
        const url = window.location.href;
        const isBooksDomain = url.includes("books.pw.live") || url.includes("books.physicswallah.live");
        if (!isBooksDomain || !url.includes("/practice")) return;

        if (lastLoggedBooksUrl === url) return;

        const cardsGrid = document.querySelector('div[class*="cardsGrid"]');
        if (!cardsGrid) return;

        const cards = cardsGrid.querySelectorAll('div[class*="card-"]');
        if (cards.length === 0) return;

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

        if (!chapterName) return;

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
            lastLoggedBooksUrl = url;
            logActivity('PW_BOOKS_QUESTIONS', {
                chapterName,
                url,
                exercises,
                displayNames
            });
        }
    } catch (err) {
        console.error("[Vinyas Tracker] Error parsing PW Books Questions:", err);
    }
}

// ----------------------------------------------------
// START OBSERVERS
// ----------------------------------------------------
setInterval(() => {
    observeVideos();
    checkDppScore();
    checkStudyGoals();
    checkPwBooksQuestions();
}, 2000);
