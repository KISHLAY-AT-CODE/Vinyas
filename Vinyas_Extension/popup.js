document.addEventListener('DOMContentLoaded', () => {
  const syncIdInput = document.getElementById('syncId');
  const apiUrlInput = document.getElementById('apiUrl');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const statusDiv = document.getElementById('status');
  const connStatus = document.getElementById('connStatus');
  const statusDot = document.getElementById('statusDot');
  const connText = document.getElementById('connText');

  // Auto-Pair Elements
  const detectCard = document.getElementById('detectCard');
  const detectUser = document.getElementById('detectUser');
  const detectCohort = document.getElementById('detectCohort');
  const detectBtn = document.getElementById('detectBtn');

  // 💎 Results Card Elements 💎
  const resultsCard = document.getElementById('resultsCard');
  const resultsMainTitle = document.getElementById('resultsMainTitle');
  const resultsBadge = document.getElementById('resultsBadge');
  const resultsName = document.getElementById('resultsName');
  const resultsNotice = document.getElementById('resultsNotice');
  const statsGrid = document.getElementById('statsGrid');
  const resScore = document.getElementById('resScore');
  const resAccuracy = document.getElementById('resAccuracy');
  const resCorrect = document.getElementById('resCorrect');
  const resIncorrect = document.getElementById('resIncorrect');
  const exercisesContainer = document.getElementById('exercisesContainer');
  const discardResultsBtn = document.getElementById('discardResultsBtn');
  const sendResultsBtn = document.getElementById('sendResultsBtn');

  let detectedConfig = null;
  let activeDppData = null;
  let detectedType = null; // 'DPP' or 'MODULE_CONFIG'
  let isRedundant = false;

  // 1. Load existing settings and check active connection
  chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
    const syncId = result.vinyasSyncId || '';
    const apiUrl = result.vinyasApiUrl || 'http://localhost:3000';
    
    syncIdInput.value = syncId;
    apiUrlInput.value = apiUrl;
    
    if (syncId && apiUrl) {
      testConnectionSilent(syncId, apiUrl);
    }
  });

  // 2. Query the active tab for auto-pairing dashboard OR manual DPP results extraction
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const activeTab = tabs[0];
    const url = activeTab.url || '';

    // Check if we are on our own study tracker dashboard to auto-pair settings
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    const isVercel = url.includes('.vercel.app');

    if (isLocalhost || isVercel) {
      chrome.tabs.sendMessage(activeTab.id, { action: "getDashboardConfig" }, (response) => {
        if (chrome.runtime.lastError) return; // Silent in case content script not present
        if (response && response.success && response.syncId) {
          detectedConfig = response;
          detectUser.textContent = response.userName || "Vinyas User";
          detectCohort.textContent = response.cohort || "Active Syllabus";
          detectCard.style.display = "block";
        }
      });
    }

    // Now, query the active tab's content script to check for DPP/Module results!
    chrome.tabs.sendMessage(activeTab.id, { action: "detectDppResults" }, (response) => {
      if (chrome.runtime.lastError) {
        // Content script might not be injected/active on this non-PW domain
        return;
      }
      if (response && response.success && response.activityData) {
        activeDppData = response.activityData;
        detectedType = response.type || "DPP";

        // Fetch sync settings to perform redundant precheck
        chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
          const syncId = result.vinyasSyncId || '';
          const apiUrl = result.vinyasApiUrl || 'http://localhost:3000';
          const targetUrl = activeDppData.url || '';

          if (syncId && apiUrl && targetUrl) {
            chrome.runtime.sendMessage({
              action: "checkUrl",
              data: { syncId, apiUrl, url: targetUrl }
            }, (checkResponse) => {
              isRedundant = !!(checkResponse && checkResponse.exists);
              renderResultsCard(isRedundant);
            });
          } else {
            renderResultsCard(false);
          }
        });
      }
    });
  });

  // 3. Handle Auto-Pair button click
  detectBtn.addEventListener('click', () => {
    if (detectedConfig) {
      syncIdInput.value = detectedConfig.syncId;
      apiUrlInput.value = detectedConfig.apiUrl;
      
      saveSettings(detectedConfig.syncId, detectedConfig.apiUrl, 'Auto-paired dashboard successfully! ✨');
      detectCard.style.display = "none";
      testConnectionSilent(detectedConfig.syncId, detectedConfig.apiUrl);
    }
  });

  // 4. Save manually configured settings
  saveBtn.addEventListener('click', () => {
    const syncId = syncIdInput.value.trim();
    let apiUrl = apiUrlInput.value.trim();

    if (!syncId) {
      showStatus('Sync ID is required.', '#f43f5e');
      return;
    }

    if (!apiUrl) {
      apiUrl = 'http://localhost:3000';
    } else if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }

    saveSettings(syncId, apiUrl, 'Config saved! ⚙️');
    testConnectionSilent(syncId, apiUrl);
  });

  // 5. Test Connection to Vercel/Localhost Server
  testBtn.addEventListener('click', async () => {
    const syncId = syncIdInput.value.trim();
    let apiUrl = apiUrlInput.value.trim();

    if (!syncId) {
      showStatus('Please enter a Sync ID to test.', '#f43f5e');
      return;
    }

    if (!apiUrl) {
      apiUrl = 'http://localhost:3000';
    } else if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }

    showStatus('Verifying server link...', '#3b82f6');
    testBtn.disabled = true;

    try {
      const targetUrl = `${apiUrl}/api/data?syncId=${encodeURIComponent(syncId)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(targetUrl, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        showStatus('Verified connected! 🟢', '#10b981');
        updateConnectionUI(true);
      } else {
        const errorData = await response.json().catch(() => ({}));
        const serverError = errorData.error || `HTTP ${response.status}`;
        showStatus(`Rejected: ${serverError} 🔴`, '#f43f5e');
        updateConnectionUI(false, true);
      }
    } catch (err) {
      console.error("Link test failure:", err);
      updateConnectionUI(false);
      if (err.name === 'AbortError') {
        showStatus('Timed out. Server asleep? 😴', '#f59e0b');
      } else {
        showStatus('Offline: Verify dev server is run 🔴', '#f43f5e');
      }
    } finally {
      testBtn.disabled = false;
    }
  });

  // 6. Handle Manual "Send to Vinyas" from Results Card
  sendResultsBtn.addEventListener('click', () => {
    const syncId = syncIdInput.value.trim();
    const apiUrl = apiUrlInput.value.trim();

    if (!syncId || !apiUrl) {
      showStatus('Save your connection details first!', '#f43f5e');
      return;
    }

    if (!activeDppData) {
      showStatus('No parsed data to send.', '#f43f5e');
      return;
    }

    sendResultsBtn.disabled = true;
    sendResultsBtn.textContent = "Sending... ⚡";

    const payloadType = detectedType === 'MODULE_CONFIG' ? 'PW_BOOKS_QUESTIONS' : 'DPP_SCORE';
    const payloadDetails = { ...activeDppData };
    if (isRedundant) {
      payloadDetails.forceUpdate = true;
    }

    // Send logActivity message to background script to bypass CORS and submit
    chrome.runtime.sendMessage({
      action: "logActivity",
      data: {
        syncId,
        apiUrl,
        type: payloadType,
        details: payloadDetails
      }
    }, (response) => {
      sendResultsBtn.disabled = false;
      if (response && response.success) {
        sendResultsBtn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        
        const successLabel = isRedundant ? "Updated! 🔄" : "Sent! 🚀";
        sendResultsBtn.textContent = successLabel;
        
        const successMsg = detectedType === 'MODULE_CONFIG'
          ? (isRedundant ? 'Module exercises updated in Vinyas!' : 'Module exercises synced to Vinyas!')
          : (isRedundant ? 'DPP score updated in Vinyas!' : 'DPP score recorded in Vinyas successfully!');
        
        showStatus(successMsg, '#10b981');
        setTimeout(() => {
          resultsCard.style.display = "none";
          sendResultsBtn.style.background = "";
          sendResultsBtn.textContent = "🚀 Send to Vinyas";
        }, 1500);
      } else {
        sendResultsBtn.textContent = isRedundant ? "🔄 Force Update" : "🚀 Send to Vinyas";
        const errMsg = (response && response.error) || 'Failed to dispatch results.';
        showStatus(`Failed to send: ${errMsg} 🔴`, '#f43f5e');
      }
    });
  });

  // Handle Discard Button click
  discardResultsBtn.addEventListener('click', () => {
    resultsCard.style.display = "none";
    showStatus('Submission discarded.', '#94a3b8');
  });

  // Helper to render the results card dynamically
  function renderResultsCard(redundant) {
    if (!activeDppData) return;

    if (redundant) {
      resultsNotice.style.display = "block";
      sendResultsBtn.textContent = "🔄 Force Update";
    } else {
      resultsNotice.style.display = "none";
      sendResultsBtn.textContent = "🚀 Send to Vinyas";
    }

    if (detectedType === "MODULE_CONFIG") {
      resultsMainTitle.textContent = "📥 Exercises Detected";
      resultsName.textContent = activeDppData.chapterName || "PW Module Exercises";

      resultsBadge.textContent = "MODULE";
      resultsBadge.className = "results-badge module";

      statsGrid.style.display = "none";
      exercisesContainer.style.display = "block";
      exercisesContainer.innerHTML = "";

      Object.entries(activeDppData.exercises || {}).forEach(([exKey, qCount]) => {
        const displayName = (activeDppData.displayNames && activeDppData.displayNames[exKey]) || exKey;
        const exItem = document.createElement('div');
        exItem.style.cssText = "background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.04); border-radius:10px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;";
        exItem.innerHTML = `
          <span style="font-size:11px; font-weight:700; color:#e2e8f0;">${escapeHTML(displayName)}</span>
          <span style="font-size:11px; font-weight:800; color:#60a5fa; background:rgba(59,130,246,0.15); padding:2px 6px; border-radius:4px;">${qCount} Qs</span>
        `;
        exercisesContainer.appendChild(exItem);
      });
    } else {
      resultsMainTitle.textContent = "📥 Results Detected on Page";
      resultsName.textContent = activeDppData.title || "PW DPP / Module Result";

      resScore.textContent = activeDppData.score || "N/A";
      resAccuracy.textContent = `${activeDppData.accuracy}%`;
      resCorrect.textContent = activeDppData.correct || "—";
      resIncorrect.textContent = activeDppData.incorrect || "—";

      const type = activeDppData.quizType || "DPP";
      resultsBadge.textContent = type;
      if (type === "MODULE") {
        resultsBadge.className = "results-badge module";
      } else {
        resultsBadge.className = "results-badge dpp";
      }

      statsGrid.style.display = "grid";
      exercisesContainer.style.display = "none";
    }

    resultsCard.style.display = "block";
  }

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

  // Shared Helper: Silent connection checking on popup load
  async function testConnectionSilent(syncId, apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/api/data?syncId=${encodeURIComponent(syncId)}`, { method: 'GET' });
      if (response.ok) {
        updateConnectionUI(true);
      } else {
        updateConnectionUI(false, true);
      }
    } catch (e) {
      updateConnectionUI(false);
    }
  }

  // Shared Helper: Update Header connection dots
  function updateConnectionUI(connected, isRejected = false) {
    if (connected) {
      statusDot.className = "status-dot active";
      connText.textContent = "CONNECTED";
      connText.style.color = "var(--color-accent)";
    } else if (isRejected) {
      statusDot.className = "status-dot error";
      connText.textContent = "REJECTED";
      connText.style.color = "var(--color-rose)";
    } else {
      statusDot.className = "status-dot";
      connText.textContent = "OFFLINE";
      connText.style.color = "var(--color-text-muted)";
    }
  }

  // Shared Helper: Save config to local Chrome storage
  function saveSettings(syncId, apiUrl, successMessage) {
    chrome.storage.local.set({
      vinyasSyncId: syncId,
      vinyasApiUrl: apiUrl
    }, () => {
      showStatus(successMessage, '#10b981');
    });
  }

  // Shared Helper: Animated status feedback
  function showStatus(text, color) {
    statusDiv.textContent = text;
    statusDiv.style.color = color;
  }
});
