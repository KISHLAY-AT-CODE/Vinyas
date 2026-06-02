import { useState, useEffect, useRef, useCallback } from 'react';
import { logEvent } from '../services/logger';
import { aesEncrypt, aesDecrypt, hashSyncId } from '../services/crypto';
import { initialSyllabus, generateEmptyChapter } from '../data/constants';
import { VINYAS_APP_VERSION } from '../data/version';
import { getISTDateString, getISTDateStringYYYYMMDD, getISTISOString, getISTTimeString } from '../shared/time.js';
import { getDefaultTargetDate, generateSecureSyncId, rc4DecryptHex } from '../shared/utils.js';

export const useDatabaseSync = ({
    showToast,
    requestConfirm,
    achievements,
    loadAchievements,
    resetAchievements,
    installedExtVersion,
    setShowWhatsNew,
    triggerPageLoading
}) => {
    const [syncId, setSyncId] = useState(() => localStorage.getItem('vinyasBitsatSyncId') || '');
    const [userName, setUserName] = useState(() => localStorage.getItem('vinyasUserName') || '');
    const [cohort, setCohort] = useState(() => localStorage.getItem('vinyasCohort') || 'BITSAT');
    const [isSyncIdSet, setIsSyncIdSet] = useState(!!localStorage.getItem('vinyasBitsatSyncId'));
    const [welcomeTab, setWelcomeTab] = useState('create'); // 'create' | 'link'
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [loadErrorMessage, setLoadErrorMessage] = useState('');
    const [retryTrigger, setRetryTrigger] = useState(0);

    const [data, setData] = useState(initialSyllabus);
    const [routines, setRoutines] = useState([]);
    const [targetDate, setTargetDate] = useState(getDefaultTargetDate());
    const [testLogs, setTestLogs] = useState([]);
    const [email, setEmail] = useState('');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [backupSettingsOpen, setBackupSettingsOpen] = useState(false);

    const [lastSeenAppVersion, setLastSeenAppVersion] = useState(null);
    const [lastSeenExtVersion, setLastSeenExtVersion] = useState(null);
    const [resolvedActivityIds, setResolvedActivityIds] = useState([]);
    const [activities, setActivities] = useState([]);

    const resetAppState = useCallback(() => {
        localStorage.clear();
        window.postMessage({ type: 'VINYAS_LOGOUT_EVENT' }, '*');
        setSyncId('');
        setUserName('');
        setCohort('BITSAT');
        setIsSyncIdSet(false);
        setIsLoaded(false);
        setData([...initialSyllabus]);
        setRoutines([]);
        setTestLogs([]);
        resetAchievements();
    }, [resetAchievements]);

    // --- Load Data Effect (MongoDB via Vercel API) ---
    useEffect(() => {
        if (!isSyncIdSet || !syncId) return;
        
        setIsLoaded(false);
        setLoadError(false);
        setLoadErrorMessage('');
        let active = true;

        const loadData = async () => {
            try {
                logEvent('DB_LOAD', { message: 'Fetching user profile data from MongoDB', syncId });
                const response = await fetch(`/api/data?syncId=${encodeURIComponent(syncId)}`);
                if (!response.ok) {
                    let errMsg = 'Failed to load data';
                    try {
                        const errData = await response.json();
                        if (errData && errData.error) errMsg = errData.error;
                    } catch (e) {}
                    throw new Error(errMsg);
                }
                
                const serverData = await response.json();
                if (!active) return;
                
                if (serverData && serverData.exists === false) {
                    logEvent('DB_LOAD_NOT_FOUND', { message: 'Sync session not found or deleted from database' }, 'warning');
                    resetAppState();
                    showToast("This Sync session does not exist or has been deleted.", "error");
                    return;
                } else if (serverData) {
                    let parsedData = [];
                    if (serverData.data) {
                        parsedData = typeof serverData.data === 'string' ? JSON.parse(serverData.data) : serverData.data;
                        
                        // MIGRATION: pyq and book to module
                        parsedData = parsedData.map(sub => {
                            sub.chapters = sub.chapters.map(ch => {
                                if (!ch.module) {
                                    const oldComp = Math.max(ch.book?.comp || 0, ch.pyq?.comp || 0);
                                    const oldAcc = Math.max(ch.book?.acc || 0, ch.pyq?.acc || 0);
                                    ch.module = { comp: oldComp, acc: oldAcc };
                                }
                                return ch;
                            });
                            return sub;
                        });
                    } else {
                        parsedData = [...initialSyllabus];
                    }
                    
                    setData(parsedData);
                    
                    // Initialize localStorage vinyas_interactive_module_progress from MongoDB question states on load
                    try {
                        const storedGlobal = {};
                        parsedData.forEach(sub => {
                            const normalizeSub = (name) => {
                                const s = (name || '').toLowerCase().trim();
                                if (s.includes('math')) return 'Maths';
                                if (s.includes('phys')) return 'Physics';
                                if (s.includes('chem')) return 'Chem';
                                return name || '';
                            };
                            const normSubName = normalizeSub(sub.name);
                            
                            sub.chapters?.forEach((ch, cIdx) => {
                                if (ch.moduleQuestionStates) {
                                    Object.entries(ch.moduleQuestionStates).forEach(([key, state]) => {
                                        storedGlobal[key] = state;
                                    });
                                }
                            });
                        });
                        localStorage.setItem('vinyas_interactive_module_progress', JSON.stringify(storedGlobal));
                        console.log("[Vinyas App] Initialized interactive module tracker progress in local storage:", storedGlobal);
                    } catch (e) {
                        console.error("[Vinyas App] Error initializing local storage from DB question states:", e);
                    }
                    
                    if (serverData.routines) {
                        setRoutines(typeof serverData.routines === 'string' ? JSON.parse(serverData.routines) : serverData.routines);
                    } else {
                        setRoutines([]);
                    }
                    
                    if (serverData.testLogs) {
                        setTestLogs(typeof serverData.testLogs === 'string' ? JSON.parse(serverData.testLogs) : serverData.testLogs);
                    } else {
                        setTestLogs([]);
                    }
                    
                    loadAchievements(serverData);
                    
                    if (serverData.targetDate) {
                        setTargetDate(serverData.targetDate);
                    } else {
                        setTargetDate(getDefaultTargetDate());
                    }
                    
                    if (serverData.resolvedActivityIds) {
                        setResolvedActivityIds(serverData.resolvedActivityIds || []);
                    } else {
                        setResolvedActivityIds([]);
                    }
                    
                    if (serverData.activities) {
                        setActivities(serverData.activities);
                    } else {
                        setActivities([]);
                    }
                    
                    if (serverData.cohort) {
                        setCohort(serverData.cohort);
                        localStorage.setItem('vinyasCohort', serverData.cohort);
                    } else {
                        setCohort('BITSAT');
                        localStorage.setItem('vinyasCohort', 'BITSAT');
                    }

                    if (serverData.email) {
                        setEmail(serverData.email);
                    } else {
                        setEmail('');
                    }

                    if (serverData.autoBackupEnabled !== undefined) {
                        setAutoBackupEnabled(serverData.autoBackupEnabled);
                    } else {
                        setAutoBackupEnabled(false);
                    }

                    if (serverData.lastSeenAppVersion) {
                        setLastSeenAppVersion(serverData.lastSeenAppVersion);
                    }
                    if (serverData.lastSeenExtVersion) {
                        setLastSeenExtVersion(serverData.lastSeenExtVersion);
                    }
                    if (serverData.userName) {
                        setUserName(serverData.userName);
                        localStorage.setItem('vinyasUserName', serverData.userName);
                    }
                    
                    setIsLoaded(true);
                    logEvent('DB_LOAD_SUCCESS', { 
                        message: 'Syllabus and state loaded successfully from MongoDB',
                        subjectsCount: parsedData.length,
                        chaptersCount: parsedData.reduce((acc, sub) => acc + (sub.chapters?.length || 0), 0)
                    }, 'success');

                    if (serverData.lastSeenAppVersion !== VINYAS_APP_VERSION) {
                        setShowWhatsNew(true);
                        const sessionKey = `whats_new_notified_${VINYAS_APP_VERSION}`;
                        if (!sessionStorage.getItem(sessionKey)) {
                            sessionStorage.setItem(sessionKey, 'true');
                            triggerWhatsNewUpdateNotification(serverData.email);
                        }
                    }
                }
            } catch (error) {
                console.error("Data Load Error:", error);
                logEvent('DB_LOAD_ERROR', { error: error.message }, 'error');
                if (active) {
                    setLoadError(true);
                    setLoadErrorMessage(error.message);
                }
            }
        };

        loadData();
        return () => {
            active = false;
        };
    }, [isSyncIdSet, syncId, retryTrigger, resetAppState, showToast, loadAchievements, setLastSeenExtVersion, setShowWhatsNew]);

    // --- Debounced Save to MongoDB (Promise-Backed & Flushable) ---
    const saveTimeoutRef = useRef(null);
    const savePromiseRef = useRef(null);
    const saveResolveRef = useRef(null);
    const stateRef = useRef({});

    const triggerWhatsNewUpdateNotification = useCallback(async (targetEmail) => {
        // 1. Browser Notification
        if (typeof window !== 'undefined' && 'Notification' in window) {
            const showNotification = () => {
                try {
                    new Notification("Check out Vinyas new features!", {
                        body: `Vinyas has been updated to v${VINYAS_APP_VERSION}! Tap here to see the new changes.`,
                        icon: "/favicon.ico"
                    });
                } catch (e) {
                    console.error("Browser notification failed:", e);
                }
            };

            if (Notification.permission === "granted") {
                showNotification();
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        showNotification();
                    }
                });
            }
        }

        // 2. Email Update (if email is set)
        if (targetEmail && targetEmail.trim() && syncId) {
            try {
                await fetch('/api/test-backup-mail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        syncId,
                        email: targetEmail.trim(),
                        action: 'whats_new'
                    })
                });
                logEvent('AUTO_WHATS_NEW_EMAIL_SUCCESS', { message: `Automatically dispatched What's New email to ${targetEmail}` }, 'success');
            } catch (err) {
                console.error("Auto What's New email failed:", err);
            }
        }
    }, [syncId]);

    const saveCompleteSyllabus = useCallback(async (payload) => {
        if (!payload.syncId) return;
        try {
            logEvent('DB_SAVE', { message: 'Syncing syllabus and state changes to MongoDB...' });
            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                let errMsg = 'Failed to save data';
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errMsg = errData.error;
                } catch (e) {}
                throw new Error(errMsg);
            }
            const resData = await response.json();
            logEvent('DB_SAVE_SUCCESS', { message: 'Successfully synced all changes to MongoDB' }, 'success');
            loadAchievements(resData); // Handled by useAchievements
        } catch (error) {
            console.error("Save Error:", error);
            logEvent('DB_SAVE_ERROR', { error: error.message }, 'error');
        }
    }, [loadAchievements]);

    const triggerSave = useCallback(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        if (!savePromiseRef.current) {
            savePromiseRef.current = new Promise((resolve) => {
                saveResolveRef.current = resolve;
            });
        }
        saveTimeoutRef.current = setTimeout(async () => {
            const currentPayload = {
                syncId: stateRef.current.syncId,
                data: stateRef.current.data,
                routines: stateRef.current.routines,
                testLogs: stateRef.current.testLogs,
                achievements: stateRef.current.achievements,
                targetDate: stateRef.current.targetDate,
                cohort: stateRef.current.cohort,
                resolvedActivityIds: stateRef.current.resolvedActivityIds,
                email: stateRef.current.email,
                autoBackupEnabled: stateRef.current.autoBackupEnabled,
                lastSeenAppVersion: stateRef.current.lastSeenAppVersion,
                lastSeenExtVersion: stateRef.current.lastSeenExtVersion,
                userName: stateRef.current.userName,
                themeSettings: stateRef.current.themeSettings
            };
            await saveCompleteSyllabus(currentPayload);
            const resolve = saveResolveRef.current;
            savePromiseRef.current = null;
            saveResolveRef.current = null;
            if (resolve) resolve();
        }, 3000);
    }, [saveCompleteSyllabus]);

    const flushSave = useCallback(async (themeSettings) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
            const currentPayload = {
                syncId: stateRef.current.syncId,
                data: stateRef.current.data,
                routines: stateRef.current.routines,
                testLogs: stateRef.current.testLogs,
                achievements: stateRef.current.achievements,
                targetDate: stateRef.current.targetDate,
                cohort: stateRef.current.cohort,
                resolvedActivityIds: stateRef.current.resolvedActivityIds,
                email: stateRef.current.email,
                autoBackupEnabled: stateRef.current.autoBackupEnabled,
                lastSeenAppVersion: stateRef.current.lastSeenAppVersion,
                lastSeenExtVersion: stateRef.current.lastSeenExtVersion,
                userName: stateRef.current.userName,
                themeSettings: themeSettings || stateRef.current.themeSettings
            };
            const promise = saveCompleteSyllabus(currentPayload);
            const resolve = saveResolveRef.current;
            savePromiseRef.current = null;
            saveResolveRef.current = null;
            if (resolve) resolve();
            await promise;
        } else if (savePromiseRef.current) {
            await savePromiseRef.current;
        }
    }, [saveCompleteSyllabus]);

    // Expose a function to update local stateRef for activity processors
    const updateStateRef = useCallback((updatedFields) => {
        stateRef.current = {
            ...stateRef.current,
            ...updatedFields
        };
    }, []);

    const handleWhatsNewDismiss = async () => {
        setShowWhatsNew(false);
        setLastSeenAppVersion(VINYAS_APP_VERSION);
        setLastSeenExtVersion(installedExtVersion);
        
        const payload = {
            syncId: stateRef.current.syncId,
            data: stateRef.current.data,
            routines: stateRef.current.routines,
            testLogs: stateRef.current.testLogs,
            achievements: stateRef.current.achievements,
            targetDate: stateRef.current.targetDate,
            cohort: stateRef.current.cohort,
            resolvedActivityIds: stateRef.current.resolvedActivityIds,
            email: stateRef.current.email,
            autoBackupEnabled: stateRef.current.autoBackupEnabled,
            lastSeenAppVersion: VINYAS_APP_VERSION,
            lastSeenExtVersion: installedExtVersion,
            userName: stateRef.current.userName,
            themeSettings: stateRef.current.themeSettings
        };
        await saveCompleteSyllabus(payload);

        if (!email || !email.trim()) {
            setTimeout(() => {
                requestConfirm(
                    "Configure Backup Email",
                    "You have not configured a backup email yet. We highly recommend adding one to enable automatic weekly backups and inactivity deletion protection. Would you like to set it up now?",
                    () => {
                        setBackupSettingsOpen(true);
                    }
                );
            }, 600);
        }
    };

    const handleSaveTargetDate = async (newDate) => {
        if (!syncId) {
            setTargetDate(newDate);
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        const resolve = saveResolveRef.current;
        savePromiseRef.current = null;
        saveResolveRef.current = null;
        if (resolve) resolve();

        try {
            logEvent('DB_SAVE', { message: 'Syncing target date change to MongoDB immediately...', targetDate: newDate });
            const payload = {
                syncId,
                data,
                routines,
                testLogs,
                achievements,
                targetDate: newDate,
                cohort,
                resolvedActivityIds,
                email,
                autoBackupEnabled,
                userName,
                themeSettings: stateRef.current.themeSettings
            };

            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                let errMsg = 'Failed to save data';
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errMsg = errData.error;
                } catch (e) {}
                throw new Error(errMsg);
            }
            const resData = await response.json();
            logEvent('DB_SAVE_SUCCESS', { message: 'Successfully synced all changes to MongoDB' }, 'success');
            
            setTargetDate(newDate);
            loadAchievements(resData);
        } catch (error) {
            console.error("Save Target Date Error:", error);
            logEvent('DB_SAVE_ERROR', { error: error.message }, 'error');
            throw error;
        }
    };

    const handleSaveUsername = async (newUsername) => {
        const trimmed = newUsername.trim();
        if (!trimmed) {
            showToast("Username cannot be empty", "error");
            return;
        }

        if (!syncId) {
            setUserName(trimmed);
            localStorage.setItem('vinyasUserName', trimmed);
            showToast("Username updated locally!", "success");
            return;
        }

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        const resolve = saveResolveRef.current;
        savePromiseRef.current = null;
        saveResolveRef.current = null;
        if (resolve) resolve();

        try {
            logEvent('DB_SAVE', { message: 'Syncing username change to MongoDB immediately...', userName: trimmed });
            const payload = {
                syncId,
                data,
                routines,
                testLogs,
                achievements,
                targetDate,
                cohort,
                resolvedActivityIds,
                email,
                autoBackupEnabled,
                userName: trimmed,
                themeSettings: stateRef.current.themeSettings
            };

            const response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                let errMsg = 'Failed to save data';
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errMsg = errData.error;
                } catch (e) {}
                throw new Error(errMsg);
            }
            const resData = await response.json();
            logEvent('DB_SAVE_SUCCESS', { message: 'Successfully synced all changes to MongoDB' }, 'success');
            
            setUserName(trimmed);
            localStorage.setItem('vinyasUserName', trimmed);
            loadAchievements(resData);
            showToast("Profile username updated and synced successfully!", "success");
        } catch (error) {
            console.error("Save Username Error:", error);
            logEvent('DB_SAVE_ERROR', { error: error.message }, 'error');
            showToast("Failed to sync username: " + error.message, "error");
            throw error;
        }
    };

    const handleLogout = async () => {
        if (syncId) {
            try {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ syncId })
                });
            } catch (err) {
                console.error("Failed to notify backend on logout:", err);
            }
        }
        resetAppState();
        showToast("Logged out successfully.", "success");
    };

    const handleDeleteAccount = () => {
        requestConfirm(
            "Permanently Delete Account",
            "Are you sure you want to permanently delete your account and all syllabus progress? This will nuke your database record and cannot be undone.",
            async () => {
                try {
                    if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                        saveTimeoutRef.current = null;
                    }
                    savePromiseRef.current = null;
                    saveResolveRef.current = null;

                    const response = await fetch(`/api/activity?syncId=${encodeURIComponent(syncId)}&fullDelete=true`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        resetAppState();
                        showToast("Account deleted and reset successfully.", "success");
                    } else {
                        throw new Error("Failed to delete account from server.");
                    }
                } catch (err) {
                    showToast("Error deleting account: " + err.message, "error");
                }
            }
        );
    };

    const handleNukeDatabase = async () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
        }
        savePromiseRef.current = null;
        saveResolveRef.current = null;

        const response = await fetch('/api/dev-nuke', {
            method: 'POST'
        });

        if (response.ok) {
            const resData = await response.json();
            resetAppState();
            return { success: true, details: resData.details };
        } else {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to wipe entire database.');
        }
    };

    const handleSetSyncId = async (isGenerating = false, tempUserNameVal, tempSyncIdVal, tempCohortVal) => {
        const name = tempUserNameVal.trim();
        const cohortVal = isGenerating ? 'BITSAT' : tempCohortVal.trim() || 'BITSAT';
        
        if (!name) {
            showToast("Please enter your name.", "error");
            return;
        }

        let targetSyncId = '';
        if (isGenerating) {
            targetSyncId = generateSecureSyncId();
        } else {
            targetSyncId = tempSyncIdVal.trim();
            if (!targetSyncId) {
                showToast("Please enter a valid Device Sync ID to connect.", "error");
                return;
            }
            if (!targetSyncId.startsWith('vny_sec_')) {
                showToast("Linking to legacy/unsecured Sync ID. Auto-generating a secure key is highly recommended.", "warning");
            }
        }

        if (!isGenerating) {
            // Verify that the Sync ID exists in the database
            try {
                const checkResponse = await fetch(`/api/data?syncId=${encodeURIComponent(targetSyncId)}`);
                if (!checkResponse.ok) {
                    throw new Error("Failed to verify Sync ID");
                }
                const checkData = await checkResponse.json();
                if (checkData && checkData.exists === false) {
                    showToast("This Sync ID does not exist or has been deleted.", "error");
                    return;
                }
            } catch (err) {
                showToast("Verification failed: " + err.message, "error");
                return;
            }
        } else {
            // Save clean new profile immediately to DB before setting state to avoid "not found" checks
            try {
                const cleanPayload = {
                    syncId: targetSyncId,
                    data: [...initialSyllabus],
                    routines: [],
                    testLogs: [],
                    achievements: [],
                    targetDate: getDefaultTargetDate(),
                    cohort: cohortVal,
                    resolvedActivityIds: [],
                    email: '',
                    autoBackupEnabled: false,
                    lastSeenAppVersion: VINYAS_APP_VERSION,
                    lastSeenExtVersion: installedExtVersion,
                    userName: name,
                    themeSettings: stateRef.current.themeSettings
                };
                
                const response = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(cleanPayload)
                });
                
                if (!response.ok) {
                    throw new Error("Failed to initialize profile in cloud database");
                }
            } catch (err) {
                showToast("Profile generation failed: " + err.message, "error");
                return;
            }
        }

        localStorage.setItem('vinyasBitsatSyncId', targetSyncId);
        localStorage.setItem('vinyasUserName', name);
        localStorage.setItem('vinyasCohort', cohortVal);
        
        window.postMessage({ 
            type: 'VINYAS_LOGIN_EVENT', 
            syncId: targetSyncId, 
            userName: name, 
            cohort: cohortVal,
            apiUrl: window.location.origin
        }, '*');

        setSyncId(targetSyncId);
        setUserName(name);
        setCohort(cohortVal);
        setIsSyncIdSet(true);
        
        showToast(isGenerating ? "Secure Sync ID Generated!" : "Device Linked Successfully!", "success");

        if (isGenerating) {
            return true; // Tells App to open Cohort setup modal
        } else {
            setRetryTrigger(prev => prev + 1);
            return false;
        }
    };

    const handleInitializeCohort = (newCohort, subjectsArray, overwrite = false) => {
        setCohort(newCohort);
        localStorage.setItem('vinyasCohort', newCohort);
        
        const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
        
        const newSyllabusData = subjectsArray.map((subName, idx) => {
            if (!overwrite) {
                const oldSub = data.find(s => {
                    const sn = s.name.toLowerCase();
                    const nn = subName.toLowerCase();
                    return sn.includes(nn) || nn.includes(sn);
                });
                
                if (oldSub) {
                    return { ...oldSub, name: subName };
                }
            }
            
            return {
                name: subName,
                color: COLORS[idx % COLORS.length],
                chapters: []
            };
        });
        
        setData(newSyllabusData);
    };

    const handleAppendSyllabus = (generatedSyllabus, overwrite = false) => {
        if (!generatedSyllabus || !Array.isArray(generatedSyllabus)) return;
        
        setData(prevData => {
            if (overwrite) {
                const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
                return generatedSyllabus.map((sub, idx) => ({
                    name: sub.name,
                    color: COLORS[idx % COLORS.length],
                    chapters: sub.chapters.map(ch => ({
                        ...generateEmptyChapter(ch.name),
                        status: ch.status || 'None',
                        lectures: ch.lectures || 0,
                        log: ch.log || '',
                        dpp: ch.dpp || { acc: 0, comp: 0 },
                        module: ch.module || { acc: 0, comp: 0 }
                    }))
                }));
            }

            const newSyllabusData = [...prevData];
            
            generatedSyllabus.forEach(newSub => {
                if (!newSub.name || !Array.isArray(newSub.chapters)) return;
                
                const sIdx = newSyllabusData.findIndex(s => {
                    const sn = s.name.toLowerCase();
                    const nn = newSub.name.toLowerCase();
                    return sn.includes(nn) || nn.includes(sn);
                });
                
                if (sIdx !== -1) {
                    const oldSub = newSyllabusData[sIdx];
                    const mergedChapters = [...oldSub.chapters];
                    newSub.chapters.forEach(newCh => {
                        if (!newCh.name) return;
                        const matchIdx = mergedChapters.findIndex(c => {
                            const n = newCh.name.toLowerCase();
                            const o = c.name.toLowerCase();
                            return n.includes(o) || o.includes(n);
                        });
                        if (matchIdx !== -1) {
                            const oldCh = mergedChapters[matchIdx];
                            mergedChapters[matchIdx] = { ...newCh, status: oldCh.status, lectures: oldCh.lectures, log: oldCh.log, dpp: oldCh.dpp, module: oldCh.module, dppLogs: oldCh.dppLogs };
                        } else {
                            mergedChapters.push(newCh);
                        }
                    });
                    newSyllabusData[sIdx] = { ...oldSub, chapters: mergedChapters };
                } else {
                    newSyllabusData.push({
                        name: newSub.name,
                        color: "bg-indigo-600",
                        chapters: newSub.chapters.map(ch => generateEmptyChapter(ch.name))
                    });
                }
            });
            return newSyllabusData;
        });
    };

    const handleExportData = async () => {
        try {
            let encryptionKey = localStorage.getItem('vinyasBackupKey') || (syncId && !syncId.startsWith('vny_sess_') ? syncId : '');
            
            if (!encryptionKey) {
                const password = prompt("You are not logged in / do not have a Device Sync ID configured.\n\nPlease enter a custom password to secure your backup file:");
                if (password === null) return;
                if (!password.trim()) {
                    showToast("Backup export cancelled: A non-empty password is required to secure the backup.", "error");
                    return;
                }
                encryptionKey = password.trim();
            }

            const exportObj = {
                syncId,
                userName,
                cohort,
                targetDate,
                data,
                routines,
                testLogs,
                resolvedActivityIds
            };
            
            const jsonString = JSON.stringify(exportObj);
            logEvent('BACKUP_ENCRYPT', { message: 'Performing secure AES-256-GCM backup encryption...' });
            
            const encryptedBundle = await aesEncrypt(encryptionKey, jsonString);
            
            const backupWrapper = {
                vinyasBackup: true,
                encrypted: true,
                encryptionVersion: "AES-GCM",
                payload: encryptedBundle
            };
            
            const wrapperString = JSON.stringify(backupWrapper, null, 2);
            const blob = new Blob([wrapperString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `vinyas_secure_backup_${syncId || 'anonymous'}_${getISTDateStringYYYYMMDD(new Date())}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast("Secure backup exported successfully!", "success");
            logEvent('BACKUP_EXPORT', { message: 'Successfully exported encrypted user sync backup' }, 'success');
        } catch (err) {
            console.error("Export Error:", err);
            showToast("Failed to export backup: " + err.message, "error");
            logEvent('BACKUP_ERROR', { error: err.message, message: 'Backup export failed' }, 'error');
        }
    };

    const handleImportData = async (importedWrapper) => {
        if (!importedWrapper || typeof importedWrapper !== 'object') {
            showToast("Invalid backup file: Format must be a JSON object", "error");
            logEvent('IMPORT_ERROR', { error: 'Backup is not a JSON object', message: 'Backup import parsing failed' }, 'error');
            return;
        }

        let importedObj = null;

        try {
            if (importedWrapper.vinyasBackup && importedWrapper.encrypted) {
                if (importedWrapper.encryptionVersion === "AES-GCM" && importedWrapper.payload) {
                    let decryptedStr = null;
                    let decryptedSuccess = false;
                    
                    const plainBackupKey = localStorage.getItem('vinyasBackupKey') || (syncId && !syncId.startsWith('vny_sess_') ? syncId : '');
                    if (plainBackupKey) {
                        try {
                            logEvent('BACKUP_DECRYPT', { message: 'Attempting to decrypt manual backup with current backup key...' });
                            decryptedStr = await aesDecrypt(plainBackupKey, importedWrapper.payload);
                            decryptedSuccess = true;
                        } catch (e) {
                            try {
                                logEvent('BACKUP_DECRYPT', { message: 'Attempting to decrypt weekly backup with hashed backup key...' });
                                const hashedKey = await hashSyncId(plainBackupKey);
                                decryptedStr = await aesDecrypt(hashedKey, importedWrapper.payload);
                                decryptedSuccess = true;
                            } catch (ee) {}
                        }
                    }
                    
                    if (!decryptedSuccess) {
                        const password = prompt("Enter the password or Device Sync ID used to encrypt this backup file:");
                        if (password === null) return;
                        if (!password.trim()) {
                            showToast("Backup decryption cancelled: Password is required.", "error");
                            return;
                        }
                        
                        logEvent('BACKUP_DECRYPT', { message: 'Decrypting secure AES-GCM backup with user-provided key...' });
                        try {
                            decryptedStr = await aesDecrypt(password.trim(), importedWrapper.payload);
                            decryptedSuccess = true;
                        } catch (e) {
                            try {
                                const hashedKey = await hashSyncId(password.trim());
                                decryptedStr = await aesDecrypt(hashedKey, importedWrapper.payload);
                                decryptedSuccess = true;
                            } catch (ee) {}
                        }
                    }
                    
                    importedObj = JSON.parse(decryptedStr);
                } else if (importedWrapper.payload && typeof importedWrapper.payload === 'string') {
                    logEvent('BACKUP_DECRYPT', { message: 'Legacy RC4 encrypted backup detected. Decrypting...' });
                    let decryptedStr = null;
                    let decryptedSuccess = false;
                    
                    if (syncId) {
                        try {
                            decryptedStr = rc4DecryptHex(syncId, importedWrapper.payload);
                            importedObj = JSON.parse(decryptedStr);
                            decryptedSuccess = true;
                        } catch (e) {}
                    }
                    
                    if (!decryptedSuccess) {
                        const password = prompt("Legacy backup decryption failed. Please enter the legacy Device Sync ID or password used for this backup:");
                        if (password === null) return;
                        decryptedStr = rc4DecryptHex(password.trim(), importedWrapper.payload);
                        importedObj = JSON.parse(decryptedStr);
                    }
                    showToast("This backup uses legacy RC4 encryption. Please re-export your backup to upgrade it to secure AES-256-GCM.", "warning");
                } else {
                    throw new Error("Unsupported or unrecognized encrypted Vinyas backup payload.");
                }
            } else {
                throw new Error("This is not a valid encrypted Vinyas backup file.");
            }
        } catch (err) {
            console.error("Decryption/Parsing Error:", err);
            showToast("Backup decryption failed: Please ensure this is a valid secure backup file and password.", "error");
            logEvent('IMPORT_ERROR', { error: err.message, message: 'Backup decryption or JSON parsing failed' }, 'error');
            return;
        }

        if (!importedObj || (!importedObj.data && !importedObj.routines)) {
            showToast("Invalid backup data: Missing key syllabus progress states", "error");
            logEvent('IMPORT_ERROR', { error: 'Missing core tracking states', message: 'Backup syllabus import verification failed' }, 'error');
            return;
        }

        requestConfirm(
            "Import Secure Backup",
            `Are you sure you want to import this secure backup? This will completely overwrite your current progress and configuration for sync ID: ${syncId}.`,
            async () => {
                try {
                    if (importedObj.data) setData(importedObj.data);
                    if (importedObj.routines) setRoutines(importedObj.routines);
                    if (importedObj.testLogs) setTestLogs(importedObj.testLogs);
                    if (importedObj.targetDate) setTargetDate(importedObj.targetDate);
                    if (importedObj.cohort) {
                        setCohort(importedObj.cohort);
                        localStorage.setItem('vinyasCohort', importedObj.cohort);
                    }
                    if (importedObj.resolvedActivityIds) setResolvedActivityIds(importedObj.resolvedActivityIds);
                    if (importedObj.userName) {
                        setUserName(importedObj.userName);
                        localStorage.setItem('vinyasUserName', importedObj.userName);
                    }

                    const payload = {
                        syncId: syncId,
                        data: importedObj.data || data,
                        routines: importedObj.routines || routines,
                        testLogs: importedObj.testLogs || testLogs,
                        achievements: achievements,
                        targetDate: importedObj.targetDate || targetDate,
                        cohort: importedObj.cohort || cohort,
                        resolvedActivityIds: importedObj.resolvedActivityIds || resolvedActivityIds,
                        email: email,
                        autoBackupEnabled: autoBackupEnabled,
                        userName: importedObj.userName || userName,
                        themeSettings: stateRef.current.themeSettings
                    };

                    logEvent('DB_SAVE', { message: 'Importing and syncing decrypted syllabus/state to MongoDB immediately...' });
                    const response = await fetch('/api/data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    if (!response.ok) throw new Error('Server returned error response');
                    
                    const resData = await response.json();
                    loadAchievements(resData);
                    
                    showToast("Backup successfully decrypted, imported, and synced to database!", "success");
                    logEvent('BACKUP_IMPORT_SUCCESS', { message: 'Successfully imported and synced secure backup to MongoDB' }, 'success');
                } catch (err) {
                    console.error("Import Error:", err);
                    showToast("Failed to import decrypted backup to database: " + err.message, "error");
                    logEvent('DB_SAVE_ERROR', { error: err.message, message: 'MongoDB state override failed during backup import' }, 'error');
                }
            }
        );
    };

    const handleSendTestBackupMail = async (targetEmail, actionOrIsTest = true) => {
        if (!targetEmail || !targetEmail.trim()) {
            showToast("Backup email address is required.", "error");
            return;
        }

        const isStringAction = typeof actionOrIsTest === 'string';
        const action = isStringAction ? actionOrIsTest : 'backup';
        const isTest = isStringAction ? true : actionOrIsTest;

        try {
            logEvent('BACKUP_TEST_MAIL', { message: `Simulating email action: ${action}`, email: targetEmail, action });
            
            let backupWrapper = null;
            if (action === 'backup') {
                const exportObj = {
                    syncId,
                    userName,
                    cohort,
                    targetDate,
                    data,
                    routines,
                    testLogs,
                    resolvedActivityIds
                };
                
                const jsonString = JSON.stringify(exportObj);
                
                const plainBackupKey = localStorage.getItem('vinyasBackupKey') || (syncId && !syncId.startsWith('vny_sess_') ? syncId : '');
                let encryptionKey = plainBackupKey;
                if (plainBackupKey) {
                    encryptionKey = await hashSyncId(plainBackupKey);
                } else {
                    encryptionKey = syncId;
                }
                
                const encryptedBundle = await aesEncrypt(encryptionKey, jsonString);
                
                backupWrapper = {
                    vinyasBackup: true,
                    encrypted: true,
                    encryptionVersion: "AES-GCM",
                    payload: encryptedBundle
                };
            }

            const response = await fetch('/api/test-backup-mail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    syncId,
                    email: targetEmail.trim(),
                    backupWrapper,
                    isTest,
                    action
                })
            });

            if (response.ok) {
                const resData = await response.json();
                showToast(resData.message || "Simulated email dispatched successfully!", "success");
                logEvent('BACKUP_TEST_MAIL_SUCCESS', { message: resData.message }, 'success');
            } else {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to dispatch email.");
            }
        } catch (err) {
            console.error("Backup simulation error:", err);
            showToast(err.message, "error");
            logEvent('BACKUP_TEST_MAIL_ERROR', { error: err.message }, 'error');
        }
    };

    return {
        // States
        syncId, setSyncId,
        userName, setUserName,
        cohort, setCohort,
        isSyncIdSet, setIsSyncIdSet,
        welcomeTab, setWelcomeTab,
        isLoaded, setIsLoaded,
        loadError, setLoadError,
        loadErrorMessage, setLoadErrorMessage,
        retryTrigger, setRetryTrigger,
        data, setData,
        routines, setRoutines,
        targetDate, setTargetDate,
        testLogs, setTestLogs,
        email, setEmail,
        autoBackupEnabled, setAutoBackupEnabled,
        backupSettingsOpen, setBackupSettingsOpen,
        lastSeenAppVersion, setLastSeenAppVersion,
        lastSeenExtVersion, setLastSeenExtVersion,
        resolvedActivityIds, setResolvedActivityIds,
        activities, setActivities,
        
        // Functions
        resetAppState,
        handleWhatsNewDismiss,
        handleSaveTargetDate,
        handleSaveUsername,
        handleLogout,
        handleDeleteAccount,
        handleNukeDatabase,
        handleSetSyncId,
        handleInitializeCohort,
        handleAppendSyllabus,
        handleExportData,
        handleImportData,
        handleSendTestBackupMail,
        
        // Auto-save control
        triggerSave,
        flushSave,
        updateStateRef,
        saveTimeoutRef,
        savePromiseRef,
        saveResolveRef,
        stateRef
    };
};
