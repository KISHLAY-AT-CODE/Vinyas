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

  // 💎 Captured Card Elements 💎
  const capturedCard = document.getElementById('capturedCard');
  const capturedMainTitle = document.getElementById('capturedMainTitle');
  const capturedBadge = document.getElementById('capturedBadge');
  const capturedName = document.getElementById('capturedName');
  const capturedBookNameInput = document.getElementById('capturedBookNameInput');
  const capturedSubjectSelect = document.getElementById('capturedSubjectSelect');
  const capturedSubjectGroup = document.getElementById('capturedSubjectGroup');
  const capturedChapterGroup = document.getElementById('capturedChapterGroup');
  const capturedChapterTargetText = document.getElementById('capturedChapterTargetText');
  const discardCapturedBtn = document.getElementById('discardCapturedBtn');
  const syncCapturedBtn = document.getElementById('syncCapturedBtn');
  const capturedNameLabel = document.getElementById('capturedNameLabel');
  const capturedChapterSelect = document.getElementById('capturedChapterSelect');
  const capturedChapterSelectGroup = document.getElementById('capturedChapterSelectGroup');

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

  // 7. Check active tab and toggle widget display
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const activeTab = tabs[0];
    const url = activeTab.url || '';
    const isPwPage = url.includes("books.pw.live") || url.includes("books.physicswallah.live") || url.includes("pw.live") || url.toLowerCase().includes("/notes?pdf=");

    if (isPwPage) {
      const widgetControlCard = document.getElementById('widgetControlCard');
      const toggleWidgetBtn = document.getElementById('toggleWidgetBtn');
      if (widgetControlCard && toggleWidgetBtn) {
        chrome.storage.local.get(['widgetHiddenByUser'], (res) => {
          const isHidden = !!res.widgetHiddenByUser;
          toggleWidgetBtn.textContent = isHidden ? "Show Widget" : "Hide Widget";
          toggleWidgetBtn.className = isHidden ? "btn btn-save" : "btn btn-test";
          widgetControlCard.style.display = "block";
        });

        toggleWidgetBtn.addEventListener('click', () => {
          chrome.storage.local.get(['widgetHiddenByUser'], (res) => {
            const willHide = !res.widgetHiddenByUser;
            chrome.storage.local.set({ widgetHiddenByUser: willHide }, () => {
              toggleWidgetBtn.textContent = willHide ? "Show Widget" : "Hide Widget";
              toggleWidgetBtn.className = willHide ? "btn btn-save" : "btn btn-test";
              
              // Send message to active tab's content script to toggle widget state
              chrome.tabs.sendMessage(activeTab.id, { action: "toggleWidgetState", hidden: willHide }, () => {
                if (chrome.runtime.lastError) {}
              });
            });
          });
        });
      }
    }
  });

  // 8. Handle Captured Links for Book/Chapter Sync
  function populateSubjectSelect(subjects) {
    capturedSubjectSelect.innerHTML = '';
    if (subjects.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No subjects in syllabus';
      capturedSubjectSelect.appendChild(opt);
      return;
    }
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      capturedSubjectSelect.appendChild(opt);
    });
  }

  function setupSyncCapturedListener(type, data, syncId, apiUrl, selectEl = null) {
    const parent = syncCapturedBtn.parentNode;
    const newBtn = syncCapturedBtn.cloneNode(true);
    parent.replaceChild(newBtn, syncCapturedBtn);
    
    newBtn.addEventListener('click', () => {
      let nameVal = '';
      if (type === 'chapter') {
        if (selectEl && selectEl.value !== '__new_chapter__') {
          nameVal = selectEl.value;
        } else {
          nameVal = capturedBookNameInput.value.trim();
        }
      } else {
        nameVal = capturedBookNameInput.value.trim();
      }
      
      if (!nameVal) return;
      
      newBtn.textContent = '...';
      newBtn.disabled = true;
      
      if (type === 'chapter') {
        chrome.runtime.sendMessage({
          action: "logActivity",
          data: {
            syncId,
            apiUrl,
            type: "BOOK_CHAPTER_SUBMISSION",
            details: {
              chapterName: nameVal,
              chapterUrl: data.url,
              bookUrl: data.bookUrl
            }
          }
        }, (res) => {
          if (res && res.success) {
            newBtn.textContent = 'Synced! ✨';
            chrome.storage.local.remove(['capturedChapterLink'], () => {
              setTimeout(() => {
                capturedCard.style.display = 'none';
              }, 1000);
            });
          } else {
            newBtn.textContent = 'Failed';
            newBtn.disabled = false;
          }
        });
      } else {
        const subjectVal = capturedSubjectSelect.value;
        if (!subjectVal) {
          newBtn.textContent = 'Select Subject';
          newBtn.disabled = false;
          return;
        }
        
        chrome.runtime.sendMessage({
          action: "logActivity",
          data: {
            syncId,
            apiUrl,
            type: "BOOK_SUBMISSION",
            details: {
              bookName: nameVal,
              url: data.url,
              subjectName: subjectVal
            }
          }
        }, (res) => {
          if (res && res.success) {
            newBtn.textContent = 'Synced! ✨';
            chrome.storage.local.remove(['capturedBookLink', 'capturedChapterLink'], () => {
              setTimeout(() => {
                capturedCard.style.display = 'none';
              }, 1000);
            });
          } else {
            newBtn.textContent = 'Failed';
            newBtn.disabled = false;
          }
        });
      }
    });
  }

  discardCapturedBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['capturedBookLink', 'capturedChapterLink'], () => {
      capturedCard.style.display = 'none';
    });
  });

  chrome.storage.local.get(['vinyasSyncId', 'vinyasApiUrl', 'capturedBookLink', 'capturedChapterLink'], (result) => {
    const syncId = result.vinyasSyncId;
    const apiUrl = result.vinyasApiUrl;
    const capturedBook = result.capturedBookLink;
    const capturedChapter = result.capturedChapterLink;

    if (!syncId || !apiUrl) return;

    if (capturedChapter) {
      chrome.runtime.sendMessage({
        action: "fetchSyllabus",
        data: { syncId, apiUrl }
      }, (syllabusRes) => {
        const subjects = (syllabusRes && syllabusRes.success) ? (syllabusRes.data?.data || []) : [];
        
        let matchingSubjectName = '';
        let matchingBookName = '';
        const bookUrl = capturedChapter.bookUrl;
        
        const bookExists = subjects.some(s => {
          const books = s.books || [];
          const matchedBook = books.find(b => b.url === bookUrl);
          if (matchedBook) {
            matchingSubjectName = s.name;
            matchingBookName = matchedBook.name;
            return true;
          }
          if (s.bookUrl === bookUrl) {
            matchingSubjectName = s.name;
            matchingBookName = s.bookName || "Book";
            return true;
          }
          return false;
        });

        if (bookExists) {
          capturedCard.style.display = 'block';
          capturedMainTitle.textContent = '📥 Captured Link for Sync';
          capturedBadge.textContent = 'Chapter';
          capturedBadge.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
          capturedBadge.style.color = '#10b981';
          capturedBadge.style.borderColor = 'rgba(16, 185, 129, 0.25)';
          
          capturedName.textContent = matchingBookName;
          capturedNameLabel.textContent = 'Chapter Name';
          capturedBookNameInput.value = capturedChapter.title;
          
          capturedSubjectGroup.style.display = 'none';
          capturedChapterGroup.style.display = 'block';
          capturedChapterTargetText.textContent = `${matchingSubjectName} -> ${matchingBookName}`;

          // Locate subject chapters to populate select dropdown
          const matchedSubject = subjects.find(s => s.name === matchingSubjectName);
          const chList = matchedSubject ? matchedSubject.chapters || [] : [];
          
          // Populate select
          capturedChapterSelect.innerHTML = '';
          chList.forEach(ch => {
            const opt = document.createElement('option');
            opt.value = ch.name;
            opt.textContent = ch.name;
            capturedChapterSelect.appendChild(opt);
          });
          
          // Add custom new chapter option
          const optNew = document.createElement('option');
          optNew.value = '__new_chapter__';
          optNew.textContent = '+ Create New Chapter';
          capturedChapterSelect.appendChild(optNew);
          
          // Pre-select matched or closest chapter
          let selectedName = '';
          const normDetected = capturedChapter.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedCh = chList.find(ch => {
            const normCh = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normCh === normDetected || normCh.includes(normDetected) || normDetected.includes(normCh);
          });
          if (matchedCh) {
            selectedName = matchedCh.name;
            capturedChapterSelect.value = selectedName;
            // Hide the text field if matching existing
            capturedBookNameGroup.style.display = 'none';
          } else {
            capturedChapterSelect.value = '__new_chapter__';
            capturedBookNameGroup.style.display = 'block';
          }
          
          // Display select dropdown group
          capturedChapterSelectGroup.style.display = 'block';
          
          // Re-bind change listener
          const newSelect = capturedChapterSelect.cloneNode(true);
          capturedChapterSelect.parentNode.replaceChild(newSelect, capturedChapterSelect);
          
          newSelect.addEventListener('change', () => {
            if (newSelect.value === '__new_chapter__') {
              capturedBookNameGroup.style.display = 'block';
              capturedBookNameInput.value = capturedChapter.title;
            } else {
              capturedBookNameGroup.style.display = 'none';
            }
          });

          const syncBtn = document.getElementById('syncCapturedBtn');
          syncBtn.textContent = 'Add Chapter';
          syncBtn.style.background = 'linear-gradient(135deg, var(--color-accent), #059669)';
          syncBtn.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.2)';
          
          setupSyncCapturedListener('chapter', capturedChapter, syncId, apiUrl, newSelect);
        } else {
          capturedCard.style.display = 'block';
          capturedMainTitle.textContent = '📥 Captured Link for Sync';
          capturedBadge.textContent = 'Book Sync Required';
          capturedBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
          capturedBadge.style.color = '#f59e0b';
          capturedBadge.style.borderColor = 'rgba(245, 158, 11, 0.25)';
          
          capturedName.textContent = 'Book Sync Required (for this chapter)';
          capturedNameLabel.textContent = 'Book Name';
          capturedBookNameInput.value = 'PW Book';
          
          capturedChapterSelectGroup.style.display = 'none';
          capturedBookNameGroup.style.display = 'block';
          capturedSubjectGroup.style.display = 'block';
          capturedChapterGroup.style.display = 'none';
          populateSubjectSelect(subjects);
          
          const syncBtn = document.getElementById('syncCapturedBtn');
          syncBtn.textContent = 'Sync Book';
          syncBtn.style.background = 'linear-gradient(135deg, var(--color-amber), #d97706)';
          syncBtn.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.2)';
          
          setupSyncCapturedListener('book', { url: bookUrl, title: 'PW Book' }, syncId, apiUrl);
        }
      });
    } else if (capturedBook) {
      chrome.runtime.sendMessage({
        action: "fetchSyllabus",
        data: { syncId, apiUrl }
      }, (syllabusRes) => {
        const subjects = (syllabusRes && syllabusRes.success) ? (syllabusRes.data?.data || []) : [];
        
        capturedCard.style.display = 'block';
        capturedMainTitle.textContent = '📥 Captured Link for Sync';
        capturedBadge.textContent = 'Book';
        capturedBadge.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
        capturedBadge.style.color = '#f59e0b';
        capturedBadge.style.borderColor = 'rgba(245, 158, 11, 0.25)';
        
        capturedName.textContent = capturedBook.title;
        capturedNameLabel.textContent = 'Book Name';
        capturedBookNameInput.value = capturedBook.title;
        
        capturedChapterSelectGroup.style.display = 'none';
        capturedBookNameGroup.style.display = 'block';
        capturedSubjectGroup.style.display = 'block';
        capturedChapterGroup.style.display = 'none';
        populateSubjectSelect(subjects);
        
        const syncBtn = document.getElementById('syncCapturedBtn');
        syncBtn.textContent = 'Sync Book';
        syncBtn.style.background = 'linear-gradient(135deg, var(--color-amber), #d97706)';
        syncBtn.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.2)';
        
        setupSyncCapturedListener('book', capturedBook, syncId, apiUrl);
      });
    }
  });
});
