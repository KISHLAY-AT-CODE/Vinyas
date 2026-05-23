document.addEventListener('DOMContentLoaded', () => {
  const syncIdInput = document.getElementById('syncId');
  const apiUrlInput = document.getElementById('apiUrl');
  const saveBtn = document.getElementById('saveBtn');
  const testBtn = document.getElementById('testBtn');
  const statusDiv = document.getElementById('status');

  // Auto-Detect Elements
  const detectCard = document.getElementById('detectCard');
  const detectUser = document.getElementById('detectUser');
  const detectCohort = document.getElementById('detectCohort');
  const detectBtn = document.getElementById('detectBtn');

  let detectedConfig = null;

  // 1. Load existing settings
  chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl'], (result) => {
    if (result.vinyasSyncId) syncIdInput.value = result.vinyasSyncId;
    if (result.vinyasApiUrl) {
      apiUrlInput.value = result.vinyasApiUrl;
    } else {
      apiUrlInput.value = 'http://localhost:3000';
    }
  });

  // 2. Query the active tab for auto-detection
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const activeTab = tabs[0];
    const url = activeTab.url || '';

    // Check if the page matches our dashboard patterns
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    const isVercel = url.includes('.vercel.app');

    if (isLocalhost || isVercel) {
      // Send a message to the content script dashboard_connector.js
      chrome.tabs.sendMessage(activeTab.id, { action: "getDashboardConfig" }, (response) => {
        // Handle runtime.lastError silently in case script isn't loaded
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && response.success && response.syncId) {
          detectedConfig = response;
          detectUser.textContent = response.userName || "Vinyas User";
          detectCohort.textContent = response.cohort || "Active Syllabus";
          detectCard.style.display = "block";
        }
      });
    }
  });

  // 3. Handle Auto-Pair button click
  detectBtn.addEventListener('click', () => {
    if (detectedConfig) {
      syncIdInput.value = detectedConfig.syncId;
      apiUrlInput.value = detectedConfig.apiUrl;
      
      saveSettings(detectedConfig.syncId, detectedConfig.apiUrl, 'Auto-paired dashboard successfully!');
      detectCard.style.display = "none";
    }
  });

  // 4. Save manually configured settings
  saveBtn.addEventListener('click', () => {
    const syncId = syncIdInput.value.trim();
    let apiUrl = apiUrlInput.value.trim();

    if (!syncId) {
      showStatus('Please enter a Sync ID', '#ef4444');
      return;
    }

    if (!apiUrl) {
      apiUrl = 'http://localhost:3000';
    } else if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }

    saveSettings(syncId, apiUrl, 'Settings saved successfully!');
  });

  // 5. Test Connection to Vercel/Localhost Server
  testBtn.addEventListener('click', async () => {
    const syncId = syncIdInput.value.trim();
    let apiUrl = apiUrlInput.value.trim();

    if (!syncId) {
      showStatus('Please enter a Sync ID to test connection.', '#ef4444');
      return;
    }

    if (!apiUrl) {
      apiUrl = 'http://localhost:3000';
    } else if (apiUrl.endsWith('/')) {
      apiUrl = apiUrl.slice(0, -1);
    }

    showStatus('Testing connection...', '#60a5fa');
    testBtn.disabled = true;

    try {
      // Fetch /api/data?syncId=... to check server response
      const targetUrl = `${apiUrl}/api/data?syncId=${encodeURIComponent(syncId)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      const response = await fetch(targetUrl, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        showStatus('Connection successful! Verified 🟢', '#10b981');
      } else {
        const errorData = await response.json().catch(() => ({}));
        const serverError = errorData.error || `HTTP ${response.status}`;
        showStatus(`Failed: ${serverError} 🔴`, '#ef4444');
      }
    } catch (err) {
      console.error("Connection test failure:", err);
      if (err.name === 'AbortError') {
        showStatus('Connection timed out. 🔴', '#ef4444');
      } else {
        showStatus('Connection failed: Server offline 🔴', '#ef4444');
      }
    } finally {
      testBtn.disabled = false;
    }
  });

  // Shared Helper: Save configuration to Chrome Storage
  function saveSettings(syncId, apiUrl, successMessage) {
    chrome.storage.local.set({
      vinyasSyncId: syncId,
      vinyasApiUrl: apiUrl
    }, () => {
      showStatus(successMessage, '#10b981');
    });
  }

  // Shared Helper: Show animated status text
  function showStatus(text, color) {
    statusDiv.textContent = text;
    statusDiv.style.color = color;
  }
});
