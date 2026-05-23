import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateGeminiContent } from './services/gemini';
import debounce from 'lodash.debounce';
import { logEvent } from './services/logger';

import { initialSyllabus, YogiLogo, generateEmptyChapter } from './data/constants';
import Header from './components/Header';
import GamifiedDashboard from './components/GamifiedDashboard';
import SubjectTable, { getEffectiveStatusInfo } from './components/SubjectTable';
import ConfirmationModal from './components/ConfirmationModal';
import Modals from './components/Modals';
import SearchOverlay from './components/SearchOverlay';
import ProgressModal from './components/ProgressModal';
import ModuleQuestionTrackerModal from './components/ModuleQuestionTrackerModal';
import MorningPlannerModal from './components/MorningPlannerModal';
import NightlyWrapUpModal from './components/NightlyWrapUpModal';
import AchievementToast from './components/AchievementToast';
import { useAchievements } from './hooks/useAchievements';
import CohortSetupModal from './components/CohortSetupModal';
import ActivityConsole from './components/ActivityConsole';
import ResolveSubmissionsModal from './components/ResolveSubmissionsModal';
import { AI_SYSTEM_PROMPT } from './data/ai_instructions';
import DevToolsOverlay from './components/DevToolsOverlay';
import { useToast } from './components/ToastContext';

// Utility: normalize chapter names to handle plurals, special chars, and minor variations
const normalizeChapterName = (name) => {
    if (!name) return "";
    return name
        .toLowerCase()
        .replace(/&/g, ' and ') // replace & with 'and'
        .replace(/[^a-z0-9\s]/g, ' ') // replace special characters with spaces
        .split(/\s+/)
        .map(word => {
            // Singularize words ending in 's' (length > 3, e.g. haloalkanes -> haloalkane)
            if (word.length > 3 && word.endsWith('s')) {
                return word.slice(0, -1);
            }
            return word;
        })
        .filter(Boolean)
        .join(' ');
};

// Utility: fuzzy-match a search string against all chapter names in the syllabus
const findChapterByName = (data, searchName) => {
    if (!searchName) return null;
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return null;
    
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                return { sIdx, cIdx };
            }
        }
    }
    return null;
};

// Utility: extract chapter name from a DPP title (handles formats like "DPP - Thermodynamics #1" or "Haloalkane : DPP 08 MCQ Quiz")
const extractChapterFromDppTitle = (title) => {
    if (!title) return null;
    let cleaned = title.trim();

    // 1. Handle titles with colon/hyphen separator before DPP keyword, e.g. "Chapter - DPP 01" or "Chapter : DPP 01"
    if (/[:\-–—]\s*dpp/i.test(cleaned)) {
        const parts = cleaned.split(/[:\-–—]\s*dpp/i);
        if (parts.length > 1 && parts[0].trim().length > 0) {
            cleaned = parts[0].trim();
        }
    }

    // 2. Remove common prefixes: "DPP - ", "DPP-", "DPP "
    cleaned = cleaned.replace(/^DPP\s*[-–—:]?\s*/i, '').trim();

    // 3. Remove "DPP \d+" or "- DPP \d+" from the end
    cleaned = cleaned.replace(/\s*[-–—:]?\s*DPP\s*\d+.*$/i, '').trim();

    // 4. Remove trailing numbering like "#1", "(1)", etc.
    cleaned = cleaned.replace(/\s*[#(]?\d+[)]?\s*$/, '').trim();

    // 5. Remove trailing "MCQ Quiz" or "Quiz"
    cleaned = cleaned.replace(/\s+(?:MCQ\s+)?Quiz$/i, '').trim();

    // 6. Final cleanup of trailing hyphens/colons/spaces
    cleaned = cleaned.replace(/\s*[-–—:]\s*$/, '').trim();

    return cleaned || null;
};


// Utility: extract chapterTitle from a pw.live module URL
const extractChapterFromModuleUrl = (url) => {
    if (!url) return null;
    const match = url.match(/chapterTitle=([^&]+)/);
    if (match) {
        let raw = match[1].replace(/\+/g, ' ');
        try {
            raw = decodeURIComponent(raw);
        } catch (e) {
            // fallback if decode fails
        }
        return raw.trim();
    }
    return null;
};

const rc4EncryptHex = (keyStr, plainText) => {
    const keyBytes = new TextEncoder().encode(keyStr);
    const plainBytes = new TextEncoder().encode(plainText);
    
    let s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + keyBytes[i % keyBytes.length]) % 256;
        let temp = s[i];
        s[i] = s[j];
        s[j] = temp;
    }
    
    let i = 0;
    j = 0;
    const cipherBytes = new Uint8Array(plainBytes.length);
    for (let y = 0; y < plainBytes.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        let temp = s[i];
        s[i] = s[j];
        s[j] = temp;
        cipherBytes[y] = plainBytes[y] ^ s[(s[i] + s[j]) % 256];
    }
    
    return Array.from(cipherBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const rc4DecryptHex = (keyStr, hexStr) => {
    const keyBytes = new TextEncoder().encode(keyStr);
    const cipherBytes = new Uint8Array(hexStr.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    let s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + keyBytes[i % keyBytes.length]) % 256;
        let temp = s[i];
        s[i] = s[j];
        s[j] = temp;
    }
    
    let i = 0;
    j = 0;
    const plainBytes = new Uint8Array(cipherBytes.length);
    for (let y = 0; y < cipherBytes.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        let temp = s[i];
        s[i] = s[j];
        s[j] = temp;
        plainBytes[y] = cipherBytes[y] ^ s[(s[i] + s[j]) % 256];
    }
    
    return new TextDecoder().decode(plainBytes);
};

const generateSecureSyncId = () => {
    const prefix = 'vny_sec_';
    let randomHex = '';
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        randomHex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
        randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    return `${prefix}${randomHex}`;
};

const App = () => {
    const { showToast } = useToast();
    const [syncId, setSyncId] = useState(() => localStorage.getItem('vinyasBitsatSyncId') || '');
    const [userName, setUserName] = useState(() => localStorage.getItem('vinyasUserName') || '');
    const [cohort, setCohort] = useState(() => localStorage.getItem('vinyasCohort') || 'BITSAT');
    const [isSyncIdSet, setIsSyncIdSet] = useState(!!localStorage.getItem('vinyasBitsatSyncId'));
    const [welcomeTab, setWelcomeTab] = useState('create'); // 'create' | 'link'
    const [isLoaded, setIsLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [loadErrorMessage, setLoadErrorMessage] = useState('');
    const [retryTrigger, setRetryTrigger] = useState(0);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        onCancel: null
    });

    const requestConfirm = useCallback((title, message, onConfirm, onCancel = null) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            },
            onCancel: () => {
                if (onCancel) onCancel();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    }, []);

    // Core States
    const [data, setData] = useState(initialSyllabus);
    const [routines, setRoutines] = useState([]);
    const [targetDate, setTargetDate] = useState('2026-05-23');
    const [testLogs, setTestLogs] = useState([]);
    
    // Isolated Achievements State & Logic
    const {
        achievements,
        allAchievements,
        activeAchievement,
        setAchievements,
        setAllAchievements,
        setActiveAchievement,
        loadAchievements,
        handleSaveResponse,
        resetAchievements,
        triggerTestAchievement,
        triggerSpecificAchievement
    } = useAchievements();
    const [activities, setActivities] = useState([]);
    const [resolvedActivityIds, setResolvedActivityIds] = useState([]);

    // Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isScrolledPastSearch, setIsScrolledPastSearch] = useState(false);

    // Modals and Routine States
    const [logModalOpen, setLogModalOpen] = useState(false);
    const [activeLog, setActiveLog] = useState({ sIdx: null, cIdx: null, name: '', text: '' });
    
    const [overlaySearchOpen, setOverlaySearchOpen] = useState(false);
    const [overlaySearchQuery, setOverlaySearchQuery] = useState('');
    
    const [routineModalType, setRoutineModalType] = useState(null);
    const [activeRoutineIndex, setActiveRoutineIndex] = useState(null);
    const [inorganicChapterInput, setInorganicChapterInput] = useState('');
    const [selectedInorganicChapter, setSelectedInorganicChapter] = useState(null);
    
    const [routineLogInput, setRoutineLogInput] = useState('');
    const [testImagePreview, setTestImagePreview] = useState(null);
    const [tempSyncId, setTempSyncId] = useState('');
    const [tempUserName, setTempUserName] = useState('');
    const [tempCohort, setTempCohort] = useState('BITSAT');

    // Goals State
    const [dismissedGoalIds, setDismissedGoalIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('vinyasDismissedGoals') || '[]'); } 
        catch (e) { return []; }
    });

    // AI State
    // Progress Modal State
    const [progressModalOpen, setProgressModalOpen] = useState(false);
    const [activeProgressChapter, setActiveProgressChapter] = useState(null);
    const [activeModuleTracker, setActiveModuleTracker] = useState(null);

    // Workflow Modals State
    const [morningPlannerOpen, setMorningPlannerOpen] = useState(false);
    const [nightlyWrapUpOpen, setNightlyWrapUpOpen] = useState(false);
    const [nightlyWrapUpTargetId, setNightlyWrapUpTargetId] = useState(null);
    const [cohortSetupOpen, setCohortSetupOpen] = useState(false);
    
    // Unresolved Submissions State
    const [resolveModalOpen, setResolveModalOpen] = useState(false);

    // SPA Routing
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    useEffect(() => {
        const handlePopState = () => setCurrentPath(window.location.pathname);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigate = useCallback((path) => {
        window.history.pushState({}, '', path);
        setCurrentPath(path);
    }, []);

    const searchContainerRef = useRef(null);
    const observerRef = useRef(null);

    const searchContainerCallbackRef = useCallback(node => {
        searchContainerRef.current = node;
        if (observerRef.current) {
            observerRef.current.disconnect();
        }
        if (node) {
            observerRef.current = new IntersectionObserver(
                ([entry]) => { setIsScrolledPastSearch(!entry.isIntersecting); },
                { threshold: 0 }
            );
            observerRef.current.observe(node);
        }
    }, []);

    const overlayInputRef = useRef(null);

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
                    setData([...initialSyllabus]);
                    resetAchievements();
                    setIsLoaded(true);
                    logEvent('DB_LOAD_SUCCESS', { message: 'New user profile, initialized syllabus' }, 'success');
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
                        setTargetDate('2026-05-23');
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
                    
                    setIsLoaded(true);
                    logEvent('DB_LOAD_SUCCESS', { 
                        message: 'Syllabus and state loaded successfully from MongoDB',
                        subjectsCount: parsedData.length,
                        chaptersCount: parsedData.reduce((acc, sub) => acc + (sub.chapters?.length || 0), 0)
                    }, 'success');
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
    }, [isSyncIdSet, syncId, retryTrigger]);

    // --- Background Activity Polling ---
    const [isPollingActivities, setIsPollingActivities] = useState(false);
    const [lastActivitiesFetchTime, setLastActivitiesFetchTime] = useState(null);

    const pollActivities = useCallback(async () => {
        if (!syncId || !isLoaded) return;
        try {
            setIsPollingActivities(true);
            const response = await fetch(`/api/activity?syncId=${encodeURIComponent(syncId)}&_t=${Date.now()}`);
            if (response.ok) {
                const serverData = await response.json();
                if (serverData && serverData.activities) {
                    setActivities(serverData.activities);
                    setLastActivitiesFetchTime(new Date().toLocaleTimeString());
                }
            }
        } catch (err) {
            console.error("Polling activities error:", err);
        } finally {
            setIsPollingActivities(false);
        }
    }, [syncId, isLoaded]);

    useEffect(() => {
        if (!isSyncIdSet || !syncId) return;

        if (isLoaded) {
            pollActivities();
        }
    }, [isSyncIdSet, syncId, pollActivities, isLoaded]);

    // --- Reactive Activity Processor & Auto-Matcher ---
    useEffect(() => {
        if (!isLoaded || activities.length === 0) return;

        let syllabusUpdated = false;
        let nextData = [...data];
        let nextResolvedIds = [...resolvedActivityIds];
        let resolvedIdsUpdated = false;

        activities.forEach(act => {
            if (act.type === 'PW_BOOKS_QUESTIONS') {
                if (nextResolvedIds.includes(act.id)) return;

                const details = act.details || {};
                const chapterSearch = details.chapterName;
                if (!chapterSearch) {
                    nextResolvedIds.push(act.id);
                    resolvedIdsUpdated = true;
                    return;
                }

                const match = findChapterByName(nextData, chapterSearch);
                if (match) {
                    const { sIdx, cIdx } = match;
                    const ch = { ...nextData[sIdx].chapters[cIdx] };
                    ch.customExerciseConfig = details.exercises;
                    ch.exerciseDisplayNames = details.displayNames;

                    nextData[sIdx] = { ...nextData[sIdx], chapters: [...nextData[sIdx].chapters] };
                    nextData[sIdx].chapters[cIdx] = ch;
                    syllabusUpdated = true;

                    nextResolvedIds.push(act.id);
                    resolvedIdsUpdated = true;
                }
                return;
            }

            if (act.type !== 'DPP_SCORE') return;
            if (nextResolvedIds.includes(act.id)) return;

            const details = act.details || {};
            let chapterSearch = null;
            if (details.quizType === 'DPP') {
                chapterSearch = extractChapterFromDppTitle(details.title);
            } else if (details.quizType === 'MODULE') {
                chapterSearch = extractChapterFromModuleUrl(details.url);
            }

            if (!chapterSearch) {
                nextResolvedIds.push(act.id);
                resolvedIdsUpdated = true;
                return;
            }

            const match = findChapterByName(nextData, chapterSearch);
            if (match) {
                const { sIdx, cIdx } = match;
                const section = details.quizType === 'DPP' ? 'dpp' : 'module';
                const ch = { ...nextData[sIdx].chapters[cIdx] };

                if (section === 'dpp') {
                    setRoutines(prev => prev.map(r => {
                        if (r.goalType === 'DPP' && r.chapterTitle && (chapterSearch.toLowerCase().includes(r.chapterTitle.toLowerCase()) || r.chapterTitle.toLowerCase().includes(chapterSearch.toLowerCase()))) {
                            return { ...r, done: true };
                        }
                        return r;
                    }));

                    ch.dppLogs = { ...(ch.dppLogs || {}) };
                    ch.dppLogs[act.id] = { 
                        comp: Math.round(details.completion || 0), 
                        acc: Math.round(details.accuracy || 0) 
                    };
                    
                    const values = Object.values(ch.dppLogs);
                    const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                    const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;
                    ch.dpp = { comp: Math.round(avgComp), acc: Math.round(avgAcc) };

                    const dateStr = new Date(act.timestamp).toLocaleDateString();
                    const logEntry = `[${dateStr} - DPP: ${details.title}]\nCompletion: ${details.completion}%, Accuracy: ${details.accuracy}%`;
                    ch.log = ch.log ? `${ch.log}\n\n${logEntry}` : logEntry;
                } else {
                    ch.module = {
                        comp: Math.max(ch.module?.comp || 0, Math.round(details.completion || 0)),
                        acc: Math.max(ch.module?.acc || 0, Math.round(details.accuracy || 0))
                    };
                }

                nextData[sIdx] = { ...nextData[sIdx], chapters: [...nextData[sIdx].chapters] };
                nextData[sIdx].chapters[cIdx] = ch;
                syllabusUpdated = true;

                nextResolvedIds.push(act.id);
                resolvedIdsUpdated = true;
            }
        });

        if (syllabusUpdated) {
            setData(nextData);
        }
        if (resolvedIdsUpdated) {
            setResolvedActivityIds(nextResolvedIds);
        }
    }, [activities, resolvedActivityIds, data, isLoaded]);

    // --- Dynamic Unresolved Submissions ---
    // --- Dynamic Unresolved Submissions ---
    const unresolvedSubmissions = useMemo(() => {
        const unresolved = [];
        activities.forEach(act => {
            if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS') return;
            if (resolvedActivityIds.includes(act.id)) return;

            const details = act.details || {};
            let chapterSearch = null;
            let section = '';

            if (act.type === 'DPP_SCORE') {
                if (details.quizType === 'DPP') {
                    chapterSearch = extractChapterFromDppTitle(details.title);
                } else if (details.quizType === 'MODULE') {
                    chapterSearch = extractChapterFromModuleUrl(details.url);
                }
                section = details.quizType === 'DPP' ? 'dpp' : 'module';
            } else if (act.type === 'PW_BOOKS_QUESTIONS') {
                chapterSearch = details.chapterName;
                section = 'module_layout';
            }

            if (!chapterSearch) return;

            const match = findChapterByName(data, chapterSearch);
            if (!match) {
                unresolved.push({ act, chapterSearch, section });
            }
        });
        return unresolved;
    }, [activities, data, resolvedActivityIds]);

    // --- Debounced Save to MongoDB ---
    const debouncedSaveRef = useRef(
        debounce(async (newData, newRoutines, newTestLogs, newAchievements, newTargetDate, newCohort, newResolvedIds, sId) => {
            if (!sId) return;
            
            try {
                logEvent('DB_SAVE', { message: 'Syncing syllabus and state changes to MongoDB...' });
                const payload = {
                    syncId: sId,
                    data: newData,
                    routines: newRoutines,
                    testLogs: newTestLogs,
                    achievements: newAchievements,
                    targetDate: newTargetDate,
                    cohort: newCohort,
                    resolvedActivityIds: newResolvedIds
                };

                const response = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) throw new Error('Failed to save data');
                const resData = await response.json();
                console.log("Saved to MongoDB (Debounced)");
                logEvent('DB_SAVE_SUCCESS', { message: 'Successfully synced all changes to MongoDB' }, 'success');

                handleSaveResponse(resData);
            } catch (error) {
                console.error("Save Error:", error);
                logEvent('DB_SAVE_ERROR', { error: error.message }, 'error');
            }
        }, 3000)
    );

    useEffect(() => {
        if (isLoaded && isSyncIdSet && syncId) {
            debouncedSaveRef.current(data, routines, testLogs, achievements, targetDate, cohort, resolvedActivityIds, syncId);
        }
        return () => {
            debouncedSaveRef.current.cancel();
        };
    }, [data, routines, testLogs, achievements, targetDate, cohort, resolvedActivityIds, syncId, isSyncIdSet, isLoaded]);

    // --- Developer / Testing Mode Functions ---
    const handleTriggerTestDpp = async () => {
        try {
            const dummyActivity = {
                id: 'test_dpp_' + Date.now(),
                syncId: syncId,
                type: 'DPP_SCORE',
                timestamp: new Date().toISOString(),
                details: {
                    title: 'Chemical Kinetics : DPP 02 MCQ Quiz',
                    quizType: 'DPP',
                    accuracy: 90,
                    completion: 100,
                    score: '9/10',
                    correct: 9,
                    incorrect: 1,
                    timeTaken: '12m 45s'
                }
            };
            
            const response = await fetch('/api/activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dummyActivity)
            });
            if (response.ok) {
                console.log('Dummy DPP submitted successfully');
                pollActivities();
                setRetryTrigger(prev => prev + 1);
            }
        } catch (err) {
            console.error('Error pushing dummy DPP:', err);
        }
    };

    const handleNukeActivities = async () => {
        requestConfirm(
            "Delete Synced Activities",
            "Are you sure you want to delete all synced activities and reset chapter progress? This action is irreversible.",
            async () => {
                try {
                    const response = await fetch(`/api/activity?syncId=${encodeURIComponent(syncId)}`, {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        console.log('Activities nuked successfully');
                        pollActivities();
                        setRetryTrigger(prev => prev + 1);
                        showToast("Synced activities and progress reset successfully.", "success");
                    } else {
                        throw new Error("Failed to clear activities database");
                    }
                } catch (err) {
                    console.error('Error nuking activities:', err);
                    showToast("Failed to reset synced activities: " + err.message, "error");
                    logEvent('DB_SAVE_ERROR', { error: err.message, message: 'Database activities purge failed' }, 'error');
                }
            }
        );
    };

    const handleExportData = () => {
        try {
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
            
            const encryptionKey = syncId || "vinyas_secure_backup_key";
            const encryptedHex = rc4EncryptHex(encryptionKey, jsonString);
            
            const backupWrapper = {
                vinyasBackup: true,
                encrypted: true,
                payload: encryptedHex
            };
            
            const wrapperString = JSON.stringify(backupWrapper, null, 2);
            const blob = new Blob([wrapperString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `vinyas_secure_backup_${syncId || 'anonymous'}_${new Date().toISOString().slice(0, 10)}.json`);
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
            if (importedWrapper.vinyasBackup && importedWrapper.encrypted && importedWrapper.payload) {
                // Decrypt using dynamic key derived from current syncId
                logEvent('BACKUP_DECRYPT', { message: 'Decrypting secure backup file...' });
                const encryptionKey = syncId || "vinyas_secure_backup_key";
                const decryptedStr = rc4DecryptHex(encryptionKey, importedWrapper.payload);
                importedObj = JSON.parse(decryptedStr);
            } else {
                // Fallback to legacy unencrypted backups (if any) or throw error
                throw new Error("This is not a valid encrypted Vinyas backup file.");
            }
        } catch (err) {
            console.error("Decryption/Parsing Error:", err);
            showToast("Backup decryption failed: Please ensure this is a valid secure backup file.", "error");
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
                        resolvedActivityIds: importedObj.resolvedActivityIds || resolvedActivityIds
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




    // --- UI Interaction Effects ---
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (overlaySearchOpen && overlayInputRef.current) overlayInputRef.current.focus();
    }, [overlaySearchOpen]);

    const handleSetSyncId = (isGenerating = false) => {
        const name = tempUserName.trim();
        const cohortVal = tempCohort.trim();
        
        if (!name || !cohortVal) {
            showToast("Please enter your name and cohort/exam target.", "error");
            return;
        }

        let targetSyncId = '';
        if (isGenerating) {
            targetSyncId = generateSecureSyncId();
        } else {
            targetSyncId = tempSyncId.trim();
            if (!targetSyncId) {
                showToast("Please enter a valid Device Sync ID to connect.", "error");
                return;
            }
            if (!targetSyncId.startsWith('vny_sec_')) {
                showToast("Linking to legacy/unsecured Sync ID. Auto-generating a secure key is highly recommended.", "warning");
            }
        }

        localStorage.setItem('vinyasBitsatSyncId', targetSyncId);
        localStorage.setItem('vinyasUserName', name);
        localStorage.setItem('vinyasCohort', cohortVal);
        setSyncId(targetSyncId);
        setUserName(name);
        setCohort(cohortVal);
        setIsSyncIdSet(true);
        
        showToast(isGenerating ? "Secure Sync ID Generated!" : "Device Linked Successfully!", "success");

        if (isGenerating) {
            setTimeout(() => setCohortSetupOpen(true), 500);
        } else {
            setRetryTrigger(prev => prev + 1);
        }
    };

    const handleInitializeCohort = (newCohort, subjectsArray, overwrite = false) => {
        setCohort(newCohort);
        localStorage.setItem('vinyasCohort', newCohort);
        
        const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
        
        const newSyllabusData = subjectsArray.map((subName, idx) => {
            if (!overwrite) {
                // Check if subject already existed to preserve chapters/xp
                const oldSub = data.find(s => {
                    const sn = s.name.toLowerCase();
                    const nn = subName.toLowerCase();
                    return sn.includes(nn) || nn.includes(sn);
                });
                
                if (oldSub) {
                    return { ...oldSub, name: subName }; // Keep existing chapters and progress
                }
            }
            
            // Otherwise, create empty subject
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
                    // If subject was somehow not in the array, push it entirely
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

    const handleDiscardGoal = (goalId) => {
        const newDismissed = [...dismissedGoalIds, goalId];
        setDismissedGoalIds(newDismissed);
        localStorage.setItem('vinyasDismissedGoals', JSON.stringify(newDismissed));
    };

    const handleSaveGoal = (goal) => {
        let detectedName = goal.title;
        const match = findChapterByName(data, goal.title);
        
        if (match) {
            detectedName = data[match.sIdx].chapters[match.cIdx].name;
        } else {
            // Fallback: strip the prefix to clean up the raw title
            detectedName = goal.title.replace(/(?:Lec|Lecture|DPP|Ch)[\s-]*\d+[\s-:]*/i, '').trim();
        }

        // Extract the number
        const numberMatch = goal.title.match(/\d+/);
        let finalChapterName = detectedName;
        
        if (numberMatch) {
            const num = numberMatch[0].padStart(2, '0'); // ensure '01', '05'
            const prefix = goal.goalType === 'DPP' ? 'DPP' : 'Lec';
            finalChapterName = `${detectedName} (${prefix} ${num})`;
        }

        const newRoutine = {
            id: 'goal_' + goal.id,
            task: `${goal.subject} - ${finalChapterName}`,
            type: 'routine',
            goalType: goal.goalType,
            chapterTitle: goal.title, // keep original for logic mapping
            subjectName: goal.subject,
            chapterName: finalChapterName,
            template: goal.goalType === 'DPP' ? 'DPP' : 'Lecture',
            done: false
        };
        if (!routines.find(r => r.id === newRoutine.id)) {
            setRoutines(prev => [...prev, newRoutine]);
        }
        handleDiscardGoal(goal.id);
    };

    const suggestedGoals = useMemo(() => {
        const today = new Date().toDateString();
        const goals = [];
        const seenKeys = new Set();
        
        activities.forEach(act => {
            if (act.type === 'STUDY_GOALS') {
                const actDate = new Date(act.timestamp).toDateString();
                if (actDate === today) {
                    const uniqueKey = `${act.details.subject}-${act.details.title}`;
                    if (!seenKeys.has(uniqueKey)) {
                        seenKeys.add(uniqueKey);
                        
                        const lectureId = act.id + '_lecture';
                        if (!dismissedGoalIds.includes(lectureId)) {
                            goals.push({ ...act.details, id: lectureId, parentId: act.id, goalType: 'Lecture' });
                        }
                        
                        if (act.details.dppStatus === 'DPP will be provided') {
                            const dppId = act.id + '_dpp';
                            if (!dismissedGoalIds.includes(dppId)) {
                                goals.push({ ...act.details, id: dppId, parentId: act.id, goalType: 'DPP' });
                            }
                        }
                    }
                }
            }
        });
        return goals;
    }, [activities, dismissedGoalIds]);

    const daysLeft = useMemo(() => {
        const diff = new Date(targetDate) - new Date();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }, [targetDate]);

    const getSearchResults = (query) => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        const results = [];
        data.forEach((sub, sIdx) => {
            sub.chapters.forEach((ch, cIdx) => {
                if (ch.name.toLowerCase().includes(q)) {
                    results.push({ sIdx, cIdx, name: ch.name, subject: sub.name, color: sub.color });
                }
            });
        });
        return results.slice(0, 6);
    };

    const searchResults = useMemo(() => getSearchResults(searchQuery), [searchQuery, data]);
    const overlaySearchResults = useMemo(() => getSearchResults(overlaySearchQuery), [overlaySearchQuery, data]);
    
    const inorganicSearchResults = useMemo(() => {
        if (!inorganicChapterInput.trim() || data.length < 2 || !data[1] || !data[1].chapters) return [];
        const q = inorganicChapterInput.toLowerCase();
        const results = [];
        data[1].chapters.forEach((ch, cIdx) => {
            if (ch.name.toLowerCase().includes(q)) {
                results.push({ sIdx: 1, cIdx, name: ch.name });
            }
        });
        return results.slice(0, 5);
    }, [inorganicChapterInput, data]);

    const scrollToAndHighlight = (sIdx, cIdx) => {
        const rowId = `chapter-${sIdx}-${cIdx}`;
        const el = document.getElementById(rowId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.remove('highlight-row');
            void el.offsetWidth;
            el.classList.add('highlight-row');
        }
    };

    const handleInlineSearchSelect = (sIdx, cIdx) => {
        setSearchQuery('');
        setIsSearchFocused(false);
        scrollToAndHighlight(sIdx, cIdx);
    };

    const handleScrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOverlaySearchSelect = (sIdx, cIdx) => {
        setOverlaySearchOpen(false);
        setOverlaySearchQuery('');
        scrollToAndHighlight(sIdx, cIdx);
        if (activeRoutineIndex !== null) {
            toggleRoutineState(activeRoutineIndex, true);
            setActiveRoutineIndex(null);
        }
    };

    const getChapterAnalysis = (chapter) => {
        let sum = 0, validCount = 0;
        [chapter.dpp, chapter.module].forEach(sec => {
            if (sec && (sec.acc > 0 || sec.comp > 0)) { sum += (sec.acc + sec.comp) / 2; validCount++; }
        });
        return validCount > 0 ? (sum / validCount) : 0;
    };

    const handleUpdate = (sIdx, cIdx, field, value) => {
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    return { ...ch, [field]: value };
                })
            };
        }));
        logEvent('CH_UPDATE', { 
            subject: data[sIdx]?.name, 
            chapter: data[sIdx]?.chapters[cIdx]?.name, 
            field, 
            value 
        }, 'success');
    };

    const handleNestedUpdate = (sIdx, cIdx, section, field, value) => {
        let parsedValue = Math.min(100, Math.max(0, Number(value) || 0));
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    const secVal = ch[section] ? { ...ch[section] } : { comp: 0, acc: 0 };
                    secVal[field] = parsedValue;
                    return { ...ch, [section]: secVal };
                })
            };
        }));
        logEvent('CH_SECTION_UPDATE', { 
            subject: data[sIdx]?.name, 
            chapter: data[sIdx]?.chapters[cIdx]?.name, 
            section, 
            field, 
            value: parsedValue 
        }, 'success');
    };

    const handleAddChapter = (sIdx, name) => {
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: [...sub.chapters, generateEmptyChapter(name)]
            };
        }));
        logEvent('CH_ADD', { 
            subject: data[sIdx]?.name, 
            chapter: name 
        }, 'success');
    };

    const handleRemoveChapter = (sIdx, cIdx) => {
        const chName = data[sIdx]?.chapters[cIdx]?.name;
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.filter((_, chIdx) => chIdx !== cIdx)
            };
        }));
        logEvent('CH_DELETE', { 
            subject: data[sIdx]?.name, 
            chapter: chName 
        }, 'warning');
    };

    const handleResolveAddChapter = (sub, subjectName) => {
        const targetChapterSearch = sub.chapterSearch;
        const linkedActIds = [];

        setData(prevData => {
            const newData = [...prevData];
            const sIdx = newData.findIndex(s => s.name === subjectName);
            if (sIdx === -1) return prevData;
            
            const newChapter = generateEmptyChapter(sub.chapterSearch);

            // Find all unresolved activities that match this chapterSearch
            activities.forEach(act => {
                if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS') return;
                
                let actChapterSearch = null;
                let actSection = '';

                if (act.type === 'DPP_SCORE') {
                    const details = act.details || {};
                    if (details.quizType === 'DPP') {
                        actChapterSearch = extractChapterFromDppTitle(details.title);
                    } else if (details.quizType === 'MODULE') {
                        actChapterSearch = extractChapterFromModuleUrl(details.url);
                    }
                    actSection = details.quizType === 'DPP' ? 'dpp' : 'module';
                } else if (act.type === 'PW_BOOKS_QUESTIONS') {
                    actChapterSearch = act.details?.chapterName;
                    actSection = 'module_layout';
                }

                const actNorm = normalizeChapterName(actChapterSearch);
                const targetNorm = normalizeChapterName(targetChapterSearch);

                if (actNorm && targetNorm && actNorm === targetNorm) {
                    linkedActIds.push(act.id);

                    if (act.type === 'PW_BOOKS_QUESTIONS') {
                        newChapter.customExerciseConfig = act.details.exercises;
                        newChapter.exerciseDisplayNames = act.details.displayNames;
                    } else if (actSection === 'dpp') {
                        newChapter.dppLogs = { ...(newChapter.dppLogs || {}) };
                        newChapter.dppLogs[act.id] = { 
                            comp: Math.round(act.details.completion || 0), 
                            acc: Math.round(act.details.accuracy || 0) 
                        };
                        
                        const values = Object.values(newChapter.dppLogs);
                        const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                        const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;
                        newChapter.dpp = { comp: Math.round(avgComp), acc: Math.round(avgAcc) };

                        const dateStr = new Date(act.timestamp).toLocaleDateString();
                        const logEntry = `[${dateStr} - DPP: ${act.details.title}]\nCompletion: ${act.details.completion}%, Accuracy: ${act.details.accuracy}%`;
                        newChapter.log = newChapter.log ? `${newChapter.log}\n\n${logEntry}` : logEntry;
                    } else {
                        newChapter[actSection] = {
                            comp: Math.max(newChapter[actSection]?.comp || 0, Math.round(act.details.completion || 0)),
                            acc: Math.max(newChapter[actSection]?.acc || 0, Math.round(act.details.accuracy || 0))
                        };
                    }
                }
            });

            newData[sIdx] = { ...newData[sIdx], chapters: [...newData[sIdx].chapters, newChapter] };
            return newData;
        });

        // Add all matched activity IDs to resolved list
        setResolvedActivityIds(prev => {
            const next = [...prev];
            linkedActIds.forEach(id => {
                if (!next.includes(id)) next.push(id);
            });
            return next;
        });

        logEvent('RESOLVE_ADD_CHAPTER', { 
            subject: subjectName, 
            chapter: sub.chapterSearch, 
            section: sub.section, 
            linkedCount: linkedActIds.length,
            activityIds: linkedActIds
        }, 'success');
    };

    const handleResolveLinkChapter = (sub, sIdx, cIdx) => {
        let chName = '';
        const targetChapterSearch = sub.chapterSearch;
        const linkedActIds = [];

        setData(prevData => {
            const newData = [...prevData];
            const ch = { ...newData[sIdx].chapters[cIdx] };
            chName = ch.name;

            // Find all unresolved activities that match this chapterSearch
            activities.forEach(act => {
                if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS') return;
                
                let actChapterSearch = null;
                let actSection = '';

                if (act.type === 'DPP_SCORE') {
                    const details = act.details || {};
                    if (details.quizType === 'DPP') {
                        actChapterSearch = extractChapterFromDppTitle(details.title);
                    } else if (details.quizType === 'MODULE') {
                        actChapterSearch = extractChapterFromModuleUrl(details.url);
                    }
                    actSection = details.quizType === 'DPP' ? 'dpp' : 'module';
                } else if (act.type === 'PW_BOOKS_QUESTIONS') {
                    actChapterSearch = act.details?.chapterName;
                    actSection = 'module_layout';
                }

                const actNorm = normalizeChapterName(actChapterSearch);
                const targetNorm = normalizeChapterName(targetChapterSearch);

                if (actNorm && targetNorm && actNorm === targetNorm) {
                    linkedActIds.push(act.id);

                    if (act.type === 'PW_BOOKS_QUESTIONS') {
                        ch.customExerciseConfig = act.details.exercises;
                        ch.exerciseDisplayNames = act.details.displayNames;
                    } else if (actSection === 'dpp') {
                        ch.dppLogs = { ...(ch.dppLogs || {}) };
                        ch.dppLogs[act.id] = { 
                            comp: Math.round(act.details.completion || 0), 
                            acc: Math.round(act.details.accuracy || 0) 
                        };
                        
                        const values = Object.values(ch.dppLogs);
                        const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                        const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;
                        ch.dpp = { comp: Math.round(avgComp), acc: Math.round(avgAcc) };

                        const dateStr = new Date(act.timestamp).toLocaleDateString();
                        const logEntry = `[${dateStr} - DPP: ${act.details.title}]\nCompletion: ${act.details.completion}%, Accuracy: ${act.details.accuracy}%`;
                        ch.log = ch.log ? `${ch.log}\n\n${logEntry}` : logEntry;
                    } else {
                        ch[actSection] = {
                            comp: Math.max(ch[actSection]?.comp || 0, Math.round(act.details.completion || 0)),
                            acc: Math.max(ch[actSection]?.acc || 0, Math.round(act.details.accuracy || 0))
                        };
                    }
                }
            });

            newData[sIdx] = { ...newData[sIdx], chapters: [...newData[sIdx].chapters] };
            newData[sIdx].chapters[cIdx] = ch;
            return newData;
        });

        // Add all matched activity IDs to resolved list
        setResolvedActivityIds(prev => {
            const next = [...prev];
            linkedActIds.forEach(id => {
                if (!next.includes(id)) next.push(id);
            });
            return next;
        });

        logEvent('RESOLVE_LINK_CHAPTER', { 
            subject: data[sIdx].name, 
            chapter: chName || data[sIdx].chapters[cIdx].name, 
            section: sub.section, 
            linkedCount: linkedActIds.length,
            activityIds: linkedActIds
        }, 'success');
    };

    const handleResolveDismiss = (actId) => {
        setResolvedActivityIds(prev => [...prev, actId]);
    };

    const toggleRoutineState = (index, forceState = null) => {
        const newRoutines = [...routines];
        const r = newRoutines[index];
        r.done = forceState !== null ? forceState : !r.done;
        setRoutines(newRoutines);
        logEvent('ROUTINE_TOGGLE', { title: r.task || r.title || 'Unknown Routine', done: r.done }, 'info');
    };

    const handleRemoveRoutine = (routineId) => {
        const r = routines.find(x => x.id === routineId);
        setRoutines(prev => prev.filter(r => r.id !== routineId));
        if (r) {
            logEvent('ROUTINE_DELETE', { title: r.task || r.title || 'Unknown Routine' }, 'warning');
        }
    };

    const handleRoutineClick = (index) => {
        if (routines[index].done) {
            toggleRoutineState(index, false);
            return;
        }

        setActiveRoutineIndex(index);
        const rId = routines[index].id;

        if (rId === 'inorganic') {
            setRoutineModalType('inorganic');
            setSelectedInorganicChapter(null);
            setInorganicChapterInput('');
            setRoutineLogInput('');
        } else if (rId === 'test_log') {
            setRoutineModalType('test');
            setRoutineLogInput('');
            setTestImagePreview(null);
        } else {
            setOverlaySearchOpen(true);
            setOverlaySearchQuery('');
        }
    };

    const saveInorganicRoutineLog = () => {
        if (!selectedInorganicChapter || !routineLogInput.trim()) return;
        const { sIdx, cIdx } = selectedInorganicChapter;
        const existingLog = data[sIdx].chapters[cIdx].log;
        const newLogString = existingLog ? `${existingLog}\n[Revision]: ${routineLogInput}` : `[Revision]: ${routineLogInput}`;
        
        handleUpdate(sIdx, cIdx, 'log', newLogString);
        toggleRoutineState(activeRoutineIndex, true);
        setRoutineModalType(null);
        setActiveRoutineIndex(null);
    };

    const saveTestLog = (noTest = false) => {
        const noteToSave = noTest ? "No tests today." : routineLogInput;
        if (!noteToSave.trim() && !testImagePreview && !noTest) return; 
        
        setTestLogs([...testLogs, { 
            date: new Date().toLocaleDateString(), 
            note: noteToSave,
            image: testImagePreview
        }]);
        toggleRoutineState(activeRoutineIndex, true);
        setRoutineModalType(null);
        setActiveRoutineIndex(null);
    };

    const closeRoutineModal = () => {
        setRoutineModalType(null);
        setOverlaySearchOpen(false);
        setActiveRoutineIndex(null);
    };

    const openLogModal = (sIdx, cIdx, chapterName, currentLog) => {
        setActiveLog({ sIdx, cIdx, name: chapterName, text: currentLog || '' });
        setLogModalOpen(true);
    };
    
    const saveLog = () => {
        handleUpdate(activeLog.sIdx, activeLog.cIdx, 'log', activeLog.text);
        setLogModalOpen(false);
    };

    const openProgressModal = (sIdx, cIdx, chapter) => {
        setActiveProgressChapter({ sIdx, cIdx });
        setProgressModalOpen(true);
    };

    const handleSaveProgress = (section, { comp, acc }) => {
        if (!activeProgressChapter) return;
        const { sIdx, cIdx } = activeProgressChapter;
        handleNestedUpdate(sIdx, cIdx, section, 'comp', comp);
        handleNestedUpdate(sIdx, cIdx, section, 'acc', acc);
    };

    const handleLogNightlyTextAndImage = (sIdx, cIdx, template, textLog, image, resourceNumber) => {
        const resourceText = resourceNumber ? ` #${resourceNumber}` : '';
        if (template === 'mock') {
            setTestLogs([...testLogs, { date: new Date().toLocaleDateString(), note: `[Mock${resourceText}] ${textLog}`, image }]);
        } else {
            const currentLog = data[sIdx].chapters[cIdx].log || '';
            const newLog = currentLog ? `${currentLog}\n\n[${new Date().toLocaleDateString()} - ${template}${resourceText}]\n${textLog}` : `[${new Date().toLocaleDateString()} - ${template}${resourceText}]\n${textLog}`;
            handleUpdate(sIdx, cIdx, 'log', newLog);
        }
    };


    const handleCompleteRoutine = (id, updatedTemplate) => {
        setRoutines(routines.map(r => r.id === id ? { ...r, done: true, template: updatedTemplate || r.template } : r));
    };

    const handleLogFocusTime = (sIdx, cIdx, minutes) => {
        setData(prev => prev.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    return { ...ch, focusTime: (ch.focusTime || 0) + minutes };
                })
            };
        }));
    };

    const handleUpdateChapter = (sIdx, cIdx, fields) => {
        setData(prev => prev.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    return { ...ch, ...fields };
                })
            };
        }));
    };

    const streakInfo = useMemo(() => {
        if (!activities || activities.length === 0) return { currentStreak: 0, maxStreak: 0, multiplier: 1.0 };
        const dates = new Set();
        activities.forEach(act => {
            if (act.timestamp) {
                const d = new Date(act.timestamp);
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                dates.add(dateStr);
            }
        });
        
        const today = new Date();
        const getFormattedDate = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        let currentStreak = 0;
        let checkDate = new Date(today);
        const todayStr = getFormattedDate(checkDate);
        checkDate.setDate(checkDate.getDate() - 1);
        const yesterdayStr = getFormattedDate(checkDate);
        
        let startFromToday = dates.has(todayStr);
        let startFromYesterday = dates.has(yesterdayStr);
        
        if (!startFromToday && !startFromYesterday) {
            currentStreak = 0;
        } else {
            let currentCheck = startFromToday ? new Date(today) : checkDate;
            while (dates.has(getFormattedDate(currentCheck))) {
                currentStreak++;
                currentCheck.setDate(currentCheck.getDate() - 1);
            }
        }
        
        const sortedDates = Array.from(dates).map(d => new Date(d)).sort((a, b) => a - b);
        let maxStreak = 0;
        let tempStreak = 0;
        let prevDate = null;
        
        sortedDates.forEach(currentDate => {
            if (prevDate === null) {
                tempStreak = 1;
            } else {
                const diffTime = Math.abs(currentDate - prevDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    tempStreak++;
                } else if (diffDays > 1) {
                    if (tempStreak > maxStreak) maxStreak = tempStreak;
                    tempStreak = 1;
                }
            }
            prevDate = currentDate;
        });
        if (tempStreak > maxStreak) maxStreak = tempStreak;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        
        const multiplier = currentStreak >= 7 ? 1.5 : currentStreak >= 3 ? 1.2 : 1.0;
        return { currentStreak, maxStreak, multiplier };
    }, [activities]);

    const baseFocusPoints = useMemo(() => {
        let pts = 0;
        routines.forEach(r => { if(r.done) pts += 50; });
        pts += testLogs.length * 100;
        data.forEach(sub => {
            sub.chapters.forEach(ch => {
                const eff = getEffectiveStatusInfo(ch);
                if (eff.type === 'done_green') pts += 200;
                else if (eff.type === 'done_yellow') pts += 150;
                else if (eff.type === 'done_red') pts += 100;
                else if (eff.type === 'current' || eff.type === 'revision') pts += 50;
                
                if (ch.dpp?.comp > 0) pts += 10;
                if (ch.module?.comp > 0) pts += 20;

                // Add Focus Points from Pomodoro Focus sessions: 2 XP per minute
                if (ch.focusTime) {
                    pts += ch.focusTime * 2;
                }
                // Add Focus Points from Spaced Repetition reviews: 15 XP per review
                if (ch.reviewsDone) {
                    pts += ch.reviewsDone * 15;
                }
            });
        });
        return pts;
    }, [routines, testLogs, data]);

    const focusPoints = useMemo(() => {
        return Math.round(baseFocusPoints * streakInfo.multiplier);
    }, [baseFocusPoints, streakInfo.multiplier]);

    const currentLevel = Math.floor(focusPoints / 1000) + 1;
    const xpToNextLevel = focusPoints % 1000;
    const levelProgressPct = (xpToNextLevel / 1000) * 100;


    const calculateGlobalProgress = () => {
        let totalCh = 0, doneCh = 0;
        data.forEach(sub => {
            totalCh += sub.chapters.length;
            doneCh += sub.chapters.filter(c => getEffectiveStatusInfo(c).isDone).length;
        });
        return ((doneCh / totalCh) * 100).toFixed(1);
    };

    if (!isSyncIdSet) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* Visual aesthetic blobs */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-slate-800 text-center animate-pop-in relative z-10">
                    <div className="flex justify-center mb-6">
                        <div className="relative group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-blue-500 rounded-full blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
                            <YogiLogo className="w-20 h-20 relative" />
                        </div>
                    </div>
                    
                    <h1 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mb-1">
                        Welcome to Vinyas
                    </h1>
                    <p className="text-xs text-slate-400 mb-6 uppercase tracking-widest font-semibold">
                        Syllabus & Curriculum Sync Console
                    </p>

                    {/* Premium tab switch */}
                    <div className="flex bg-slate-950 p-1.5 rounded-xl mb-6 border border-slate-800/80">
                        <button 
                            onClick={() => setWelcomeTab('create')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                welcomeTab === 'create' 
                                    ? 'bg-slate-800 text-white shadow shadow-black/40' 
                                    : 'text-slate-500 hover:text-slate-350'
                            }`}
                        >
                            <i className="ph-bold ph-user-plus mr-1.5"></i>
                            New Profile
                        </button>
                        <button 
                            onClick={() => setWelcomeTab('link')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                welcomeTab === 'link' 
                                    ? 'bg-slate-800 text-white shadow shadow-black/40' 
                                    : 'text-slate-500 hover:text-slate-350'
                            }`}
                        >
                            <i className="ph-bold ph-link-simple mr-1.5"></i>
                            Link Device
                        </button>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block text-left mb-1.5 ml-1">Your Name</label>
                            <input 
                                type="text" 
                                value={tempUserName} 
                                onChange={e => setTempUserName(e.target.value)} 
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-semibold" 
                                placeholder="e.g. Kishlay"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block text-left mb-1.5 ml-1">Exam Target (Cohort)</label>
                            <input 
                                type="text" 
                                value={tempCohort} 
                                onChange={e => setTempCohort(e.target.value)} 
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-semibold" 
                                placeholder="e.g. BITSAT 2026, JEE"
                            />
                        </div>

                        {welcomeTab === 'link' && (
                            <div className="animate-fadeIn">
                                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block text-left mb-1.5 ml-1">Device Sync ID Key</label>
                                <input 
                                    type="text" 
                                    value={tempSyncId} 
                                    onChange={e => setTempSyncId(e.target.value)} 
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-emerald-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono text-xs font-semibold text-center" 
                                    placeholder="vny_sec_..."
                                    onKeyDown={e => e.key === 'Enter' && handleSetSyncId(false)}
                                />
                                <span className="text-[9px] text-slate-500 mt-1 block text-left ml-1">Paste the secure sync token from your other connected device.</span>
                            </div>
                        )}

                        {welcomeTab === 'create' && (
                            <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 text-left animate-fadeIn">
                                <span className="text-[10px] font-black text-emerald-450 uppercase tracking-widest block mb-1">
                                    <i className="ph-bold ph-shield-checkered mr-1 text-xs"></i> Cryptographic Security Active
                                </span>
                                <p className="text-[10px] text-slate-450 leading-relaxed">
                                    The system will auto-generate a private, high-entropy Sync Identifier. Only devices configured with this key will have access to read or update your study database.
                                </p>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => handleSetSyncId(welcomeTab === 'create')} 
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-950/30 hover:shadow-emerald-950/50 hover:scale-[1.01] active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                    >
                        <i className={`ph-bold ${welcomeTab === 'create' ? 'ph-sparkle' : 'ph-plugs-connected'} text-base`}></i>
                        {welcomeTab === 'create' ? 'Generate Secure Profile & Sync' : 'Link and Synchronize'}
                    </button>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-6">
                <div className="max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-red-500 text-center animate-pop-in">
                    <div className="flex justify-center mb-6">
                        <i className="ph-bold ph-warning-circle text-5xl text-red-500"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Connection Error</h1>
                    <p className="text-sm text-slate-400 mb-4">Failed to load your progress data from MongoDB. Please check your network connection and try again.</p>
                    {loadErrorMessage && (
                        <div className="bg-slate-900/80 border border-red-500/20 rounded-xl p-4 mb-6 text-left font-mono text-xs text-red-400 max-h-40 overflow-y-auto break-all">
                            <span className="font-bold text-red-500 block mb-1">Details:</span>
                            {loadErrorMessage}
                        </div>
                    )}
                    <button 
                        onClick={() => {
                            setLoadError(false);
                            setLoadErrorMessage('');
                            setRetryTrigger(prev => prev + 1);
                        }} 
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <i className="ph-bold ph-arrows-clockwise text-lg"></i>
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    if (!isLoaded) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-900">
                <i className="ph-bold ph-spinner-gap text-4xl animate-spin text-bitsat-500"></i>
                <p className="text-slate-400 font-medium">Loading {userName || 'Vinyas'}'s Data from MongoDB...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 relative">
            {currentPath === '/' ? (
                <>
            {unresolvedSubmissions.length > 0 && (
                <div className="fixed top-4 right-4 z-50">
                    <button 
                        onClick={() => setResolveModalOpen(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-red-400 font-bold py-2 px-4 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.4)] border border-red-900/50 flex items-center gap-2 transition-all"
                    >
                        <i className="ph-fill ph-warning-circle text-xl text-red-500"></i>
                        Resolve Submissions ({unresolvedSubmissions.length})
                    </button>
                </div>
            )}

            <Header 
                userName={userName} 
                syncId={syncId} 
                cohort={cohort}
                targetDate={targetDate} 
                setTargetDate={setTargetDate} 
                daysLeft={daysLeft} 
                openCohortSetup={() => setCohortSetupOpen(true)}
                pollActivities={pollActivities}
                isPollingActivities={isPollingActivities}
                onTriggerTestDpp={handleTriggerTestDpp}
                onNukeActivities={handleNukeActivities}
                onExportData={handleExportData}
                onImportData={handleImportData}
            />

            {/* Standard Search Bar */}
            <div className="max-w-7xl mx-auto px-4 mb-8" ref={searchContainerCallbackRef}>
                <div className="relative">
                    <div className={`flex items-center bg-slate-800 border ${isSearchFocused ? 'border-bitsat-500 shadow-[0_0_15px_rgba(2,132,199,0.3)]' : 'border-slate-700'} rounded-xl px-4 py-3 transition-all z-20 relative`}>
                        <i className={`ph-bold ph-magnifying-glass text-xl ${isSearchFocused ? 'text-bitsat-400' : 'text-slate-500'} mr-3`}></i>
                        <input 
                            type="text" 
                            placeholder="Search any chapter to instantly scroll and fill..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            className="bg-transparent text-slate-100 w-full outline-none placeholder-slate-500 font-medium"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300 ml-2">
                                <i className="ph-fill ph-x-circle text-lg"></i>
                            </button>
                        )}
                    </div>
                    {isSearchFocused && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden modal-animate">
                            {searchResults.map((res, i) => (
                                <div key={i} onMouseDown={() => handleInlineSearchSelect(res.sIdx, res.cIdx)} className="px-4 py-3 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700/50 last:border-0 transition-colors">
                                    <span className="font-semibold text-slate-200">{res.name}</span>
                                    <span className={`text-xs px-2 py-1 rounded-md font-bold text-white ${res.color}`}>{res.subject}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 grid grid-cols-1 xl:grid-cols-4 gap-8">
                <GamifiedDashboard 
                    currentLevel={currentLevel} 
                    focusPoints={focusPoints} 
                    levelProgressPct={levelProgressPct} 
                    xpToNextLevel={xpToNextLevel}
                    routines={routines}
                    handleRoutineClick={handleRoutineClick}
                    calculateGlobalProgress={calculateGlobalProgress}
                    data={data}
                    achievements={allAchievements}

                    activities={activities}
                    openMorningPlanner={() => setMorningPlannerOpen(true)}
                    openNightlyWrapUp={(id) => {
                        setNightlyWrapUpTargetId(id || null);
                        setNightlyWrapUpOpen(true);
                    }}
                    cohort={cohort}
                    suggestedGoals={suggestedGoals}
                    handleSaveGoal={handleSaveGoal}
                    handleDiscardGoal={handleDiscardGoal}
                    handleRemoveRoutine={handleRemoveRoutine}
                    openActivityConsole={() => navigate('/console')}
                    syncId={syncId}
                    onLogFocusTime={handleLogFocusTime}
                    onUpdateChapter={handleUpdateChapter}
                    streakInfo={streakInfo}
                    onTriggerTestAchievement={triggerTestAchievement}
                    onTriggerSpecificAchievement={triggerSpecificAchievement}
                    requestConfirm={requestConfirm}
                />

                <div className="xl:col-span-3 space-y-8">
                    {data.map((subject, sIdx) => (
                        <SubjectTable 
                            key={sIdx}
                            subject={subject}
                            sIdx={sIdx}
                            handleUpdate={handleUpdate}
                            handleNestedUpdate={handleNestedUpdate}
                            openLogModal={openLogModal}
                            getChapterAnalysis={getChapterAnalysis}
                            openProgressModal={openProgressModal}
                            addChapter={handleAddChapter}
                            removeChapter={handleRemoveChapter}
                            requestConfirm={requestConfirm}
                        />
                    ))}
                </div>
            </main>

            {/* Floating Action Buttons Container */}
            <div className="fixed bottom-24 right-6 flex flex-col gap-4 z-40">
                <button 
                    onClick={handleScrollToTop}
                    className={`w-14 h-14 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 hover:scale-105 transition-all duration-300 ease-out origin-bottom ${isScrolledPastSearch ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-8'}`}
                    title="Scroll to Top"
                >
                    <i className="ph-bold ph-arrow-up text-2xl text-slate-300"></i>
                </button>
                <button 
                    onClick={() => setOverlaySearchOpen(true)}
                    className={`w-14 h-14 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 hover:scale-105 transition-all duration-300 ease-out origin-bottom ${isScrolledPastSearch ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-8'}`}
                    title="Spotlight Search"
                >
                    <i className="ph-bold ph-magnifying-glass text-2xl text-slate-300"></i>
                </button>
            </div>

            <SearchOverlay 
                overlaySearchOpen={overlaySearchOpen}
                closeRoutineModal={closeRoutineModal}
                overlayInputRef={overlayInputRef}
                overlaySearchQuery={overlaySearchQuery}
                setOverlaySearchQuery={setOverlaySearchQuery}
                overlaySearchResults={overlaySearchResults}
                handleOverlaySearchSelect={handleOverlaySearchSelect}
                activeRoutineIndex={activeRoutineIndex}
            />

            <Modals 
                routineModalType={routineModalType}
                closeRoutineModal={closeRoutineModal}
                selectedInorganicChapter={selectedInorganicChapter}
                inorganicChapterInput={inorganicChapterInput}
                setInorganicChapterInput={setInorganicChapterInput}
                inorganicSearchResults={inorganicSearchResults}
                setSelectedInorganicChapter={setSelectedInorganicChapter}
                routineLogInput={routineLogInput}
                setRoutineLogInput={setRoutineLogInput}
                saveInorganicRoutineLog={saveInorganicRoutineLog}
                testImagePreview={testImagePreview}
                setTestImagePreview={setTestImagePreview}
                saveTestLog={saveTestLog}
                logModalOpen={logModalOpen}
                activeLog={activeLog}
                setActiveLog={setActiveLog}
                saveLog={saveLog}
                setLogModalOpen={setLogModalOpen}
                currentLevel={currentLevel}
            />

            <ProgressModal 
                isOpen={progressModalOpen}
                onClose={() => setProgressModalOpen(false)}
                chapterData={activeProgressChapter ? data[activeProgressChapter.sIdx].chapters[activeProgressChapter.cIdx] : null}
                chapterName={activeProgressChapter ? data[activeProgressChapter.sIdx].chapters[activeProgressChapter.cIdx].name : ''}
                onSave={handleSaveProgress}
                activities={activities}
                onOpenTracker={() => {
                    if (!activeProgressChapter) return;
                    const { sIdx, cIdx } = activeProgressChapter;
                    setActiveModuleTracker({
                        sIdx,
                        cIdx,
                        subjectName: data[sIdx].name,
                        chapterName: data[sIdx].chapters[cIdx].name,
                        chapterIndex: cIdx,
                        currentModuleComp: data[sIdx].chapters[cIdx].module?.comp || 0,
                        currentModuleAcc: data[sIdx].chapters[cIdx].module?.acc || 0
                    });
                }}
            />

            <ModuleQuestionTrackerModal 
                isOpen={activeModuleTracker !== null}
                onClose={() => setActiveModuleTracker(null)}
                subjectName={activeModuleTracker ? activeModuleTracker.subjectName : ''}
                chapterName={activeModuleTracker ? activeModuleTracker.chapterName : ''}
                chapterIndex={activeModuleTracker ? activeModuleTracker.chapterIndex : 0}
                currentModuleComp={activeModuleTracker ? activeModuleTracker.currentModuleComp : 0}
                currentModuleAcc={activeModuleTracker ? activeModuleTracker.currentModuleAcc : 0}
                questionStates={activeModuleTracker ? (data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx].moduleQuestionStates || {}) : {}}
                customExerciseConfig={activeModuleTracker ? (data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx].customExerciseConfig || null) : null}
                exerciseDisplayNames={activeModuleTracker ? (data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx].exerciseDisplayNames || null) : null}
                onSaveProgress={({ comp, acc, questionStates }) => {
                    if (!activeModuleTracker) return;
                    const { sIdx, cIdx } = activeModuleTracker;
                    handleNestedUpdate(sIdx, cIdx, 'module', 'comp', comp);
                    handleNestedUpdate(sIdx, cIdx, 'module', 'acc', acc);
                    handleUpdate(sIdx, cIdx, 'moduleQuestionStates', questionStates);
                }}
            />

            <MorningPlannerModal 
                isOpen={morningPlannerOpen}
                onClose={() => setMorningPlannerOpen(false)}
                data={data}
                onAddRoutine={(r) => { setRoutines([...routines, r]); setMorningPlannerOpen(false); }}
            />

            <NightlyWrapUpModal 
                isOpen={nightlyWrapUpOpen}
                onClose={() => setNightlyWrapUpOpen(false)}
                routines={routines}
                data={data}
                onLogDpp={(sIdx, cIdx, comp, acc, resourceNum) => { 
                    const chapter = data[sIdx].chapters[cIdx];
                    const newLogs = { ...(chapter.dppLogs || {}) };
                    const resId = resourceNum ? String(resourceNum) : Date.now().toString();
                    newLogs[resId] = { comp, acc };
                    
                    const values = Object.values(newLogs);
                    const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                    const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;

                    handleUpdate(sIdx, cIdx, 'dppLogs', newLogs);
                    handleNestedUpdate(sIdx, cIdx, 'dpp', 'comp', Math.round(avgComp)); 
                    handleNestedUpdate(sIdx, cIdx, 'dpp', 'acc', Math.round(avgAcc)); 
                    
                    if (resourceNum) {
                        const currentLog = chapter.log || '';
                        const newLog = currentLog ? `${currentLog}\n\n[${new Date().toLocaleDateString()} - DPP #${resourceNum}]\nCompletion: ${comp}%, Accuracy: ${acc}%` : `[${new Date().toLocaleDateString()} - DPP #${resourceNum}]\nCompletion: ${comp}%, Accuracy: ${acc}%`;
                        handleUpdate(sIdx, cIdx, 'log', newLog);
                    }
                }}
                onLogTextAndImage={handleLogNightlyTextAndImage}
                onCompleteRoutine={handleCompleteRoutine}
                initialTargetId={nightlyWrapUpTargetId}
            />

            <AchievementToast 
                key={activeAchievement ? activeAchievement.key || activeAchievement.id : 'empty'}
                achievement={activeAchievement} 
                onClose={() => setActiveAchievement(null)} 
            />



                    <CohortSetupModal 
                        isOpen={cohortSetupOpen}
                        onClose={() => setCohortSetupOpen(false)}
                        currentCohort={cohort}
                        onInitializeCohort={handleInitializeCohort}
                        onAppendSyllabus={handleAppendSyllabus}
                    />

                    <ResolveSubmissionsModal 
                        isOpen={resolveModalOpen}
                        onClose={() => setResolveModalOpen(false)}
                        unresolvedSubmissions={unresolvedSubmissions}
                        data={data}
                        onAddChapter={handleResolveAddChapter}
                        onLinkChapter={handleResolveLinkChapter}
                        onDismiss={handleResolveDismiss}
                    />

                    <ConfirmationModal 
                        isOpen={confirmModal.isOpen}
                        title={confirmModal.title}
                        message={confirmModal.message}
                        onConfirm={confirmModal.onConfirm}
                        onCancel={confirmModal.onCancel}
                    />

                    {/* Sticky Floating Refresh Button */}
                    <button
                        onClick={pollActivities}
                        disabled={isPollingActivities}
                        className="fixed bottom-6 right-6 z-[100] bg-blue-600 hover:bg-blue-500 text-white w-14 h-14 rounded-full shadow-[0_4px_25px_rgba(37,99,235,0.5)] border border-blue-400 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                        title="Refresh Cloud Data"
                    >
                        <i className={`ph-bold ph-arrows-clockwise text-2xl ${isPollingActivities ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}></i>
                    </button>
                </>
            ) : currentPath === '/console' ? (
                <ActivityConsole 
                    isOpen={true}
                    onClose={() => navigate('/')}
                    syncId={syncId}
                    activities={activities}
                    isPolling={isPollingActivities}
                    pollActivities={pollActivities}
                    lastFetchTime={lastActivitiesFetchTime}
                    requestConfirm={requestConfirm}
                />
            ) : null}

            {localStorage.getItem('devMode') === 'true' && (
                <DevToolsOverlay 
                    syncId={syncId}
                    allAchievements={allAchievements}
                    setActiveAchievement={setActiveAchievement}
                    pollActivities={pollActivities}
                    setRetryTrigger={setRetryTrigger}
                    data={data}
                    requestConfirm={requestConfirm}
                />
            )}
        </div>
    );
};

export default App;
