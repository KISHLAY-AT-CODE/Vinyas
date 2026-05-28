import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { generateGeminiContent } from './services/gemini';
import debounce from 'lodash.debounce';
import { logEvent } from './services/logger';
import { aesEncrypt, aesDecrypt, hashSyncId } from './services/crypto';

import { initialSyllabus, YogiLogo, generateEmptyChapter } from './data/constants';
import Header from './components/Header';
import GamifiedDashboard from './components/GamifiedDashboard';
import SubjectTable, { getEffectiveStatusInfo } from './components/SubjectTable';
import { motion, AnimatePresence } from 'framer-motion';
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
import ExtensionPage from './components/ExtensionPage';
import BackupSettingsModal from './components/BackupSettingsModal';
import ResolveSubmissionsModal from './components/ResolveSubmissionsModal';
import { AI_SYSTEM_PROMPT } from './data/ai_instructions';
import ThemeModal from './components/ThemeModal';
import { useToast } from './components/ToastContext';
import WhatsNewModal from './components/WhatsNewModal';
import ProfileModal from './components/ProfileModal';
import { VINYAS_APP_VERSION, VINYAS_EXTENSION_VERSION, WHATS_NEW_CHANGELOG } from './data/version';
import DevToolsOverlay from './components/DevToolsOverlay';

// Timezone-safe Indian Standard Time (IST) Helpers
import { getISTDateString, getISTDateStringYYYYMMDD, getISTISOString, getISTTimeString, getISTLogPrefix } from './shared/time.js';
import { normalizeChapterName } from './shared/normalize.js';

// Dynamic default date helper (100 days from today)
const getDefaultTargetDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 100);
    return date.toISOString().split('T')[0];
};

// Framer Motion slide variants for the carousel
const slideVariants = {
    initial: (direction) => ({
        x: direction > 0 ? 55 : -55,
        opacity: 0
    }),
    animate: {
        x: 0,
        opacity: 1
    },
    exit: (direction) => ({
        x: direction > 0 ? -55 : 55,
        opacity: 0
    })
};

// Utility: fuzzy-match a search string against all chapter names in the syllabus
const findChapterByName = (data, searchName) => {
    if (!data || !Array.isArray(data) || !searchName) return null;
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return null;
    
    // Priority 1: Exact normalized match
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            if (!data[sIdx].chapters[cIdx]) continue;
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized === qNormalized) {
                return { sIdx, cIdx };
            }
        }
    }
    
    // Priority 2: Collect substring/fuzzy matches and return the one with the longest normalized name (most specific)
    const candidates = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            if (!data[sIdx].chapters[cIdx]) continue;
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                candidates.push({
                    sIdx,
                    cIdx,
                    length: chNameNormalized.length
                });
            }
        }
    }
    
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        return { sIdx: candidates[0].sIdx, cIdx: candidates[0].cIdx };
    }
    
    return null;
};

// Utility: find all chapters matching a search name (returns an array of { sIdx, cIdx })
const findAllChaptersByName = (data, searchName) => {
    if (!data || !Array.isArray(data) || !searchName) return [];
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return [];
    
    // Priority 1: Exact normalized matches
    const exactMatches = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            if (!data[sIdx].chapters[cIdx]) continue;
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized === qNormalized) {
                exactMatches.push({ sIdx, cIdx });
            }
        }
    }
    
    if (exactMatches.length > 0) {
        return exactMatches;
    }
    
    // Priority 2: Substring/fuzzy matches
    const candidates = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            if (!data[sIdx].chapters[cIdx]) continue;
            const chNameNormalized = normalizeChapterName(data[sIdx].chapters[cIdx].name);
            if (chNameNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                candidates.push({
                    sIdx,
                    cIdx,
                    length: chNameNormalized.length
                });
            }
        }
    }
    
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        const maxLen = candidates[0].length;
        return candidates.filter(c => c.length === maxLen).map(c => ({ sIdx: c.sIdx, cIdx: c.cIdx }));
    }
    
    return [];
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
        throw new Error("Web Crypto API is not available. Please use a modern browser.");
    }
    return `${prefix}${randomHex}`;
};

// Utility: Apply matched activities to a chapter object
const applyActivitiesToChapter = (chapter, activities, targetChapterSearch, specificActivityId = null) => {
    const updatedChapter = { ...chapter };
    const linkedActIds = [];

    activities.forEach(act => {
        if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS') return;
        if (specificActivityId && act.id !== specificActivityId) return;
        
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
                updatedChapter.customExerciseConfig = act.details.exercises;
                updatedChapter.exerciseDisplayNames = act.details.displayNames;
            } else if (actSection === 'dpp') {
                updatedChapter.dppLogs = { ...(updatedChapter.dppLogs || {}) };
                updatedChapter.dppLogs[act.id] = { 
                    comp: Math.round(act.details.completion || 0), 
                    acc: Math.round(act.details.accuracy || 0) 
                };
                
                const values = Object.values(updatedChapter.dppLogs);
                const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;
                updatedChapter.dpp = { comp: Math.round(avgComp), acc: Math.round(avgAcc) };

                const dateStr = getISTDateString(new Date(act.timestamp));
                const logEntry = `[${dateStr} - DPP: ${act.details.title}]\nCompletion: ${act.details.completion}%, Accuracy: ${act.details.accuracy}%`;
                updatedChapter.log = updatedChapter.log ? `${updatedChapter.log}\n\n${logEntry}` : logEntry;
            } else if (actSection === 'module') {
                updatedChapter.moduleLogs = { ...(updatedChapter.moduleLogs || {}) };
                updatedChapter.moduleLogs[act.id] = { 
                    comp: Math.round(act.details.completion || 0), 
                    acc: Math.round(act.details.accuracy || 0) 
                };
                
                const values = Object.values(updatedChapter.moduleLogs);
                const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;
                updatedChapter.module = { comp: Math.round(avgComp), acc: Math.round(avgAcc) };

                const dateStr = getISTDateString(new Date(act.timestamp));
                const logEntry = `[${dateStr} - Module: ${act.details.title}]\nCompletion: ${act.details.completion}%, Accuracy: ${act.details.accuracy}%`;
                updatedChapter.log = updatedChapter.log ? `${updatedChapter.log}\n\n${logEntry}` : logEntry;
            } else {
                updatedChapter[actSection] = {
                    comp: Math.max(updatedChapter[actSection]?.comp || 0, Math.round(act.details.completion || 0)),
                    acc: Math.max(updatedChapter[actSection]?.acc || 0, Math.round(act.details.accuracy || 0))
                };
            }
        }
    });

    return { updatedChapter, linkedActIds };
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
    const [activeSubjectIdx, setActiveSubjectIdx] = useState(0);
    const [direction, setDirection] = useState(0);

    // Page loading animation state (only for app boot & dev testing)
    const [isLoadingPage, setIsLoadingPage] = useState(false);

    const triggerPageLoading = useCallback(() => {
        setIsLoadingPage(true);
        setTimeout(() => {
            setIsLoadingPage(false);
        }, 2000); // 2 seconds for testing in dev overlay
    }, []);

    const handleNextSubject = useCallback(() => {
        if (activeSubjectIdx < data.length - 1) {
            setDirection(1);
            setActiveSubjectIdx(prev => prev + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [activeSubjectIdx, data.length]);

    const handlePrevSubject = useCallback(() => {
        if (activeSubjectIdx > 0) {
            setDirection(-1);
            setActiveSubjectIdx(prev => prev - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [activeSubjectIdx]);

    const [routines, setRoutines] = useState([]);
    const [targetDate, setTargetDate] = useState(getDefaultTargetDate());
    const [testLogs, setTestLogs] = useState([]);
    const [email, setEmail] = useState('');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
    const [backupSettingsOpen, setBackupSettingsOpen] = useState(false);

    // Dashboard card visibility state (lifted)
    const [isCardHidden, setIsCardHidden] = useState(() => {
        return localStorage.getItem('vinyas_dashboard_card_hidden') === 'true';
    });

    const handleToggleCardHidden = (hiddenValue) => {
        setIsCardHidden(hiddenValue);
        localStorage.setItem('vinyas_dashboard_card_hidden', String(hiddenValue));
    };

    // Versioning & Extension states
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [installedExtVersion, setInstalledExtVersion] = useState(null);
    const [showExtWarningHeader, setShowExtWarningHeader] = useState(false);
    const [extensionChecked, setExtensionChecked] = useState(false);
    const [lastSeenAppVersion, setLastSeenAppVersion] = useState(null);
    const [lastSeenExtVersion, setLastSeenExtVersion] = useState(null);
    
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

    // Theme Customizer States
    const [themeSettings, setThemeSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('vinyasThemeSettings');
            return saved ? { performanceMode: false, ...JSON.parse(saved) } : {
                preset: 'default',
                accentColor: '#f97316',
                secondaryColor: '#ef4444',
                bodyBg: '#110b05',
                headerBackdrop: 'rgba(28, 18, 10, 0.65)',
                cardBackdrop: 'rgba(20, 12, 6, 0.4)',
                hoverBorderGlow: '#f97316',
                bgStyle: 'gradient',
                svgMeshCoords: null,
                bgOpacity: 0.25,
                bgBlur: 0,
                bgScale: 100,
                bgPositionX: 50,
                bgPositionY: 0,
                performanceMode: false
            };
        } catch (e) {
            return {
                preset: 'default',
                accentColor: '#f97316',
                secondaryColor: '#ef4444',
                bodyBg: '#110b05',
                headerBackdrop: 'rgba(28, 18, 10, 0.65)',
                cardBackdrop: 'rgba(20, 12, 6, 0.4)',
                hoverBorderGlow: '#f97316',
                bgStyle: 'gradient',
                svgMeshCoords: null,
                bgOpacity: 0.25,
                bgBlur: 100,
                performanceMode: false
            };
        }
    });
    const [themeModalOpen, setThemeModalOpen] = useState(false);
    const [backdropImage, setBackdropImage] = useState(() => {
        try { return localStorage.getItem('vinyasCustomLocalBg') || ''; }
        catch (e) { return ''; }
    });

    useEffect(() => {
        const handleStorageChange = () => {
            try { setBackdropImage(localStorage.getItem('vinyasCustomLocalBg') || ''); }
            catch (e) {}
        };
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('vinyas-bg-update', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('vinyas-bg-update', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        const hexToRgb = (hex) => {
            const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
            const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const activePresetId = themeSettings.preset || 'default';
        const defaultsByPreset = {
            default: {
                bodyBg: '#110b05',
                headerBackdrop: 'rgba(28, 18, 10, 0.65)',
                cardBackdrop: 'rgba(20, 12, 6, 0.4)',
                hoverBorderGlow: '#f97316',
                primary: '#f97316',
                secondary: '#ef4444'
            },
            emerald: {
                bodyBg: '#020c08',
                headerBackdrop: 'rgba(8, 30, 20, 0.65)',
                cardBackdrop: 'rgba(4, 20, 12, 0.45)',
                hoverBorderGlow: '#10b981',
                primary: '#10b981',
                secondary: '#059669'
            },
            blue: {
                bodyBg: '#020c1b',
                headerBackdrop: 'rgba(4, 20, 40, 0.65)',
                cardBackdrop: 'rgba(2, 12, 28, 0.42)',
                hoverBorderGlow: '#0ea5e9',
                primary: '#0ea5e9',
                secondary: '#3b82f6'
            },
            purple: {
                bodyBg: '#0f0219',
                headerBackdrop: 'rgba(28, 6, 44, 0.7)',
                cardBackdrop: 'rgba(18, 3, 30, 0.48)',
                hoverBorderGlow: '#ec4899',
                primary: '#a855f7',
                secondary: '#ec4899'
            },
            slate: {
                bodyBg: '#090a0c',
                headerBackdrop: 'rgba(20, 22, 26, 0.85)',
                cardBackdrop: 'rgba(14, 15, 18, 0.65)',
                hoverBorderGlow: '#94a3b8',
                primary: '#e2e8f0',
                secondary: '#94a3b8'
            },
            custom: {
                bodyBg: '#090a0f',
                headerBackdrop: 'rgba(15, 23, 42, 0.65)',
                cardBackdrop: 'rgba(10, 15, 30, 0.4)',
                hoverBorderGlow: '#f97316',
                primary: '#f97316',
                secondary: '#ec4899'
            }
        };

        const presetDefaults = defaultsByPreset[activePresetId] || defaultsByPreset.default;

        const root = document.documentElement;
        const primary = themeSettings.accentColor || presetDefaults.primary;
        const secondary = themeSettings.secondaryColor || presetDefaults.secondary;
        const rgb = hexToRgb(primary);
        
        root.style.setProperty('--primary-accent', primary);
        root.style.setProperty('--secondary-accent', secondary);
        root.style.setProperty('--glass-opacity', themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25);
        root.style.setProperty('--glass-blur', `${themeSettings.bgBlur !== undefined ? themeSettings.bgBlur : 100}px`);

        if (themeSettings.performanceMode) {
            root.classList.add('performance-mode');
        } else {
            root.classList.remove('performance-mode');
        }

        const bodyBg = themeSettings.bodyBg || presetDefaults.bodyBg;
        const headerBackdrop = themeSettings.headerBackdrop || presetDefaults.headerBackdrop;
        const cardBackdrop = themeSettings.cardBackdrop || presetDefaults.cardBackdrop;
        const hoverBorderGlow = themeSettings.hoverBorderGlow || presetDefaults.hoverBorderGlow;
        const hoverRgb = hexToRgb(hoverBorderGlow);

        root.style.setProperty('--body-bg-color', bodyBg);
        root.style.setProperty('--header-backdrop', headerBackdrop);
        root.style.setProperty('--card-backdrop', cardBackdrop);
        root.style.setProperty('--hover-border-glow', hoverBorderGlow);
        if (hoverRgb) {
            root.style.setProperty('--hover-border-glow-rgb', `${hoverRgb.r}, ${hoverRgb.g}, ${hoverRgb.b}`);
        }

        if (rgb) {
            root.style.setProperty('--primary-accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            root.style.setProperty('--primary-accent-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
            const hoverR = Math.max(0, rgb.r - 20);
            const hoverG = Math.max(0, rgb.g - 20);
            const hoverB = Math.max(0, rgb.b - 20);
            root.style.setProperty('--primary-accent-hover', `rgb(${hoverR}, ${hoverG}, ${hoverB})`);
        }
        localStorage.setItem('vinyasThemeSettings', JSON.stringify(themeSettings));
    }, [themeSettings]);

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
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    
    // Unresolved Submissions State
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [fabOpen, setFabOpen] = useState(false);
    const fabRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (fabRef.current && !fabRef.current.contains(event.target)) {
                setFabOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Change Log & Bug Report Modals States
    const [changeLogOpen, setChangeLogOpen] = useState(false);
    const [bugReportOpen, setBugReportOpen] = useState(false);

    // SPA Routing
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    const resolvedActivityIdsRef = useRef(resolvedActivityIds);
    useEffect(() => {
        resolvedActivityIdsRef.current = resolvedActivityIds;
    }, [resolvedActivityIds]);

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
        setActiveProgressChapter(null);
        setActiveModuleTracker(null);
        setProgressModalOpen(false);
    }, []);

    useEffect(() => {
        const handlePopState = () => {
            setCurrentPath(window.location.pathname);
            setBugReportOpen(false);
        };
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
                    if (serverData.themeSettings) {
                        setThemeSettings(typeof serverData.themeSettings === 'string' ? JSON.parse(serverData.themeSettings) : serverData.themeSettings);
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
    }, [isSyncIdSet, syncId, retryTrigger]);

    // --- Debounced Save to MongoDB (Promise-Backed & Flushable) ---
    const saveTimeoutRef = useRef(null);
    const savePromiseRef = useRef(null);
    const saveResolveRef = useRef(null);
    const stateRef = useRef({});

    useEffect(() => {
        stateRef.current = {
            data,
            routines,
            testLogs,
            achievements,
            targetDate,
            cohort,
            resolvedActivityIds,
            syncId,
            email,
            autoBackupEnabled,
            lastSeenAppVersion,
            lastSeenExtVersion,
            userName,
            themeSettings
        };
    }, [data, routines, testLogs, achievements, targetDate, cohort, resolvedActivityIds, syncId, email, autoBackupEnabled, lastSeenAppVersion, lastSeenExtVersion, userName, themeSettings]);

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
            handleSaveResponse(resData);
        } catch (error) {
            console.error("Save Error:", error);
            logEvent('DB_SAVE_ERROR', { error: error.message }, 'error');
        }
    }, [handleSaveResponse]);

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

    const flushSave = useCallback(async () => {
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
                themeSettings: stateRef.current.themeSettings
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

    useEffect(() => {
        if (isLoaded && isSyncIdSet && syncId) {
            triggerSave();
        }
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [data, routines, testLogs, achievements, targetDate, cohort, resolvedActivityIds, syncId, isSyncIdSet, isLoaded, email, autoBackupEnabled, themeSettings, triggerSave]);

    // --- Versioning and Extension Detection Logic ---
    const pingExtension = useCallback(() => {
        window.postMessage({ type: 'VINYAS_REQUEST_EXT_VERSION' }, '*');
    }, []);

    // Handle extension messaging
    useEffect(() => {
        const handleExtensionMessage = (event) => {
            if (event.data && event.data.type === 'VINYAS_EXT_VERSION_RESPONSE') {
                const extVer = event.data.version;
                console.log("[Vinyas App] Detected extension version:", extVer);
                setInstalledExtVersion(extVer);
                setExtensionChecked(true);
            }
        };
        window.addEventListener('message', handleExtensionMessage);
        return () => window.removeEventListener('message', handleExtensionMessage);
    }, []);

    // Ping extension on load and periodically
    useEffect(() => {
        if (isLoaded) {
            pingExtension();
            // Fallback timeout to assume extension is missing
            const timer = setTimeout(() => {
                setExtensionChecked(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isLoaded, pingExtension]);

    // Update alert header banner based on extension version match
    useEffect(() => {
        if (isLoaded && extensionChecked) {
            const isOutdated = installedExtVersion !== VINYAS_EXTENSION_VERSION;
            if (!showWhatsNew && isOutdated) {
                setShowExtWarningHeader(true);
            } else {
                setShowExtWarningHeader(false);
            }
        }
    }, [isLoaded, extensionChecked, installedExtVersion, showWhatsNew]);

    const handleWhatsNewDismiss = async () => {
        setShowWhatsNew(false);
        setLastSeenAppVersion(VINYAS_APP_VERSION);
        setLastSeenExtVersion(installedExtVersion);
        
        // Save immediately to persist version seen
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
            userName: stateRef.current.userName
        };
        await saveCompleteSyllabus(payload);

        // Prompt user to add a backup email if it is not configured yet
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

    // --- Background Activity Polling ---
    const [isPollingActivities, setIsPollingActivities] = useState(false);
    const [lastActivitiesFetchTime, setLastActivitiesFetchTime] = useState(null);

    const pollActivities = useCallback(async () => {
        if (!syncId || !isLoaded) return;
        try {
            setIsPollingActivities(true);
            await flushSave();
            const response = await fetch(`/api/data?syncId=${encodeURIComponent(syncId)}&_t=${Date.now()}`);
            if (response.ok) {
                const serverData = await response.json();
                if (serverData) {
                    if (serverData.exists !== false) {
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
                        }
                        if (serverData.testLogs) {
                            setTestLogs(typeof serverData.testLogs === 'string' ? JSON.parse(serverData.testLogs) : serverData.testLogs);
                        }
                        loadAchievements(serverData);
                        if (serverData.targetDate) {
                            setTargetDate(serverData.targetDate);
                        }
                        if (serverData.resolvedActivityIds) {
                            setResolvedActivityIds(serverData.resolvedActivityIds || []);
                        }
                        if (serverData.activities) {
                            setActivities(serverData.activities);
                        }
                        if (serverData.cohort) {
                            setCohort(serverData.cohort);
                            localStorage.setItem('vinyasCohort', serverData.cohort);
                        }
                        
                        setLastActivitiesFetchTime(getISTTimeString(new Date()));
                        showToast("Console & database logs successfully refreshed!", "success");
                    }
                }
            }
        } catch (err) {
            console.error("Refresh error:", err);
            showToast("Failed to refresh: " + err.message, "error");
        } finally {
            setIsPollingActivities(false);
        }
    }, [syncId, isLoaded, loadAchievements, showToast, flushSave]);

    // --- Reactive Activity Processor & Auto-Matcher ---
    const dataRef = useRef(data);
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    useEffect(() => {
        if (!isLoaded || activities.length === 0) return;

        let syllabusUpdated = false;
        let nextData = [...dataRef.current];
        let nextResolvedIds = [...resolvedActivityIdsRef.current];
        let nextResolvedIdsSet = new Set(nextResolvedIds);
        let resolvedIdsUpdated = false;

        activities.forEach(act => {
            if (act.type === 'PW_BOOKS_QUESTIONS') {
                const details = act.details || {};
                const chapterSearch = details.chapterName;
                
                if (!chapterSearch) {
                    if (!nextResolvedIdsSet.has(act.id)) {
                        nextResolvedIds.push(act.id);
                        nextResolvedIdsSet.add(act.id);
                        resolvedIdsUpdated = true;
                    }
                    return;
                }

                const matches = findAllChaptersByName(nextData, chapterSearch);
                const match = matches.length === 1 ? matches[0] : null;
                
                if (match) {
                    const { sIdx, cIdx } = match;
                    const ch = nextData[sIdx].chapters[cIdx];
                    
                    // Force update if config is missing in syllabus or if it hasn't been resolved yet
                    const hasConfig = ch.customExerciseConfig && Object.keys(ch.customExerciseConfig).length > 0;
                    const isAlreadyResolved = nextResolvedIdsSet.has(act.id);
                    
                    if (!hasConfig || !isAlreadyResolved) {
                        const updatedCh = { 
                            ...ch,
                            customExerciseConfig: details.exercises,
                            exerciseDisplayNames: details.displayNames
                        };
                        nextData[sIdx] = { ...nextData[sIdx], chapters: [...nextData[sIdx].chapters] };
                        nextData[sIdx].chapters[cIdx] = updatedCh;
                        syllabusUpdated = true;

                        if (!isAlreadyResolved) {
                            nextResolvedIds.push(act.id);
                            nextResolvedIdsSet.add(act.id);
                            resolvedIdsUpdated = true;
                        }
                    }
                }
                return;
            }

            if (act.type !== 'DPP_SCORE') return;
            if (nextResolvedIdsSet.has(act.id)) return;

            const details = act.details || {};
            let chapterSearch = null;
            if (details.quizType === 'DPP') {
                chapterSearch = extractChapterFromDppTitle(details.title);
            } else if (details.quizType === 'MODULE') {
                chapterSearch = extractChapterFromModuleUrl(details.url);
            }

            if (!chapterSearch) {
                nextResolvedIds.push(act.id);
                nextResolvedIdsSet.add(act.id);
                resolvedIdsUpdated = true;
                return;
            }

            const matches = findAllChaptersByName(nextData, chapterSearch);
            const match = matches.length === 1 ? matches[0] : null;
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

                    const dateStr = getISTDateString(new Date(act.timestamp));
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
                nextResolvedIdsSet.add(act.id);
                resolvedIdsUpdated = true;
            }
        });

        if (syllabusUpdated) {
            setData(nextData);
        }
        if (resolvedIdsUpdated) {
            setResolvedActivityIds(nextResolvedIds);
        }
    }, [activities, isLoaded]);

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

            const matches = findAllChaptersByName(data, chapterSearch);
            const isDuplicate = matches.length > 1;
            if (matches.length === 0 || isDuplicate) {
                unresolved.push({ 
                    act, 
                    chapterSearch, 
                    section,
                    isDuplicate,
                    message: isDuplicate ? "Search found more than one chapter with same names which you are refferring to ?" : null
                });
            }
        });
        return unresolved;
    }, [activities, data, resolvedActivityIds]);

    // Note: Auto-save is handled reactively by triggerSave and flushSave.

    // --- Developer / Testing Mode Functions ---
    const handleTriggerTestDpp = async () => {
        try {
            const dummyActivity = {
                id: 'test_dpp_' + Date.now(),
                syncId: syncId,
                type: 'DPP_SCORE',
                timestamp: getISTISOString(),
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
                    // Reset client-side state first
                    setData([...initialSyllabus]);
                    setRoutines([]);
                    setTestLogs([]);
                    setResolvedActivityIds([]);
                    resetAchievements();

                    // Cancel any pending debounced saves of the old state
                    if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                        saveTimeoutRef.current = null;
                    }
                    const resolve = saveResolveRef.current;
                    savePromiseRef.current = null;
                    saveResolveRef.current = null;
                    if (resolve) resolve();

                    // Delete activities and database record completely
                    const response = await fetch(`/api/activity?syncId=${encodeURIComponent(syncId)}&fullDelete=true`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        console.log('Database records nuked successfully');
                        
                        // Immediately sync the clean initial state back to database
                        const cleanPayload = {
                            syncId,
                            data: [...initialSyllabus],
                            routines: [],
                            testLogs: [],
                            achievements: [],
                            targetDate: getDefaultTargetDate(),
                            cohort: cohort,
                            resolvedActivityIds: [],
                            email: email,
                            autoBackupEnabled: autoBackupEnabled,
                            userName
                        };
                        await saveCompleteSyllabus(cleanPayload);

                        setRetryTrigger(prev => prev + 1);
                        showToast("Synced activities and progress reset successfully.", "success");
                    } else {
                        throw new Error("Failed to clear database records");
                    }
                } catch (err) {
                    console.error('Error nuking activities:', err);
                    showToast("Failed to reset synced activities: " + err.message, "error");
                    logEvent('DB_SAVE_ERROR', { error: err.message, message: 'Database activities purge failed' }, 'error');
                }
            }
        );
    };

    const handleExportData = async () => {
        try {
            let encryptionKey = localStorage.getItem('vinyasBackupKey') || (syncId && !syncId.startsWith('vny_sess_') ? syncId : '');
            
            if (!encryptionKey) {
                const password = prompt("You are not logged in / do not have a Device Sync ID configured.\n\nPlease enter a custom password to secure your backup file:");
                if (password === null) return; // User cancelled
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
                            } catch (ee) {
                                // Sync ID decryption failed, will prompt user
                            }
                        }
                    }
                    
                    if (!decryptedSuccess) {
                        const password = prompt("Enter the password or Device Sync ID used to encrypt this backup file:");
                        if (password === null) return; // User cancelled
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
                            } catch (ee) {
                                // Decryption error will be handled by catch block
                            }
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
                        } catch (e) {
                            // Current sync ID legacy decryption failed
                        }
                    }
                    
                    if (!decryptedSuccess) {
                        const password = prompt("Legacy backup decryption failed. Please enter the legacy Device Sync ID or password used for this backup:");
                        if (password === null) return; // User cancelled
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
                        userName: importedObj.userName || userName
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

    const handleSaveTargetDate = async (newDate) => {
        if (!syncId) {
            setTargetDate(newDate);
            return;
        }

        // Cancel any pending debounced save to avoid duplicate saves or race conditions
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
                autoBackupEnabled
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
            handleSaveResponse(resData);
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
                userName: trimmed
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
            handleSaveResponse(resData);
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

    const handleSetSyncId = async (isGenerating = false) => {
        const name = tempUserName.trim();
        const cohortVal = isGenerating ? 'BITSAT' : tempCohort.trim() || 'BITSAT';
        
        if (!name) {
            showToast("Please enter your name.", "error");
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
                    userName: name
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

    const handleDiscardGoal = (goalId, hasDpp = false) => {
        let newDismissed = [...dismissedGoalIds];
        if (goalId.startsWith('lecture_') || goalId.startsWith('dpp_')) {
            newDismissed.push(goalId);
        } else {
            const baseKey = goalId;
            newDismissed.push(`lecture_${baseKey}`);
            if (hasDpp) {
                newDismissed.push(`dpp_${baseKey}`);
            }
        }
        const uniqueDismissed = Array.from(new Set(newDismissed));
        setDismissedGoalIds(uniqueDismissed);
        localStorage.setItem('vinyasDismissedGoals', JSON.stringify(uniqueDismissed));
    };

    const handleSaveGoal = (goal, includeLecture, includeDpp) => {
        const baseKey = goal.id;
        
        if (includeLecture) {
            saveSingleGoal({
                ...goal,
                id: `lecture_${baseKey}`,
                goalType: 'Lecture'
            });
        } else {
            handleDiscardGoal(`lecture_${baseKey}`);
        }
        
        if (goal.hasDpp && includeDpp) {
            saveSingleGoal({
                ...goal,
                id: `dpp_${baseKey}`,
                goalType: 'DPP'
            });
        } else if (goal.hasDpp) {
            handleDiscardGoal(`dpp_${baseKey}`);
        }
    };
    
    const saveSingleGoal = (goal) => {
        let detectedName = goal.title;
        const match = findChapterByName(data, goal.title);
        
        if (match) {
            detectedName = data[match.sIdx].chapters[match.cIdx].name;
        } else {
            detectedName = goal.title.replace(/(?:Lec|Lecture|DPP|Ch)[\s-]*\d+[\s-:]*/i, '').trim();
        }

        const numberMatch = goal.title.match(/\d+/);
        let finalChapterName = detectedName;
        
        if (numberMatch) {
            const num = numberMatch[0].padStart(2, '0');
            const prefix = goal.goalType === 'DPP' ? 'DPP' : 'Lec';
            finalChapterName = `${detectedName} (${prefix} ${num})`;
        }

        const newRoutine = {
            id: 'goal_' + goal.id,
            task: `${goal.subject} - ${finalChapterName}`,
            type: 'routine',
            goalType: goal.goalType,
            chapterTitle: goal.title,
            subjectName: goal.subject,
            chapterName: finalChapterName,
            template: goal.goalType === 'DPP' ? 'DPP' : 'Lecture',
            done: false
        };
        
        setRoutines(prev => {
            if (!prev.find(r => r.id === newRoutine.id)) {
                return [...prev, newRoutine];
            }
            return prev;
        });
        handleDiscardGoal(goal.id);
    };

    const suggestedGoals = useMemo(() => {
        const today = getISTDateStringYYYYMMDD(new Date());
        const goals = [];
        const seenKeys = new Set();
        
        activities.forEach(act => {
            if (act.type === 'STUDY_GOALS') {
                const actDate = getISTDateStringYYYYMMDD(new Date(act.timestamp));
                if (actDate === today) {
                    const baseKey = `${act.details.subject}_${act.details.title}`.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const uniqueKey = `${act.details.subject}-${act.details.title}`;
                    
                    if (!seenKeys.has(uniqueKey)) {
                        seenKeys.add(uniqueKey);
                        
                        const lectureId = `lecture_${baseKey}`;
                        const dppId = `dpp_${baseKey}`;
                        
                        const isLectureDismissed = dismissedGoalIds.includes(lectureId);
                        const isDppDismissed = dismissedGoalIds.includes(dppId);
                        
                        const isLectureAdded = routines.some(r => r.id === `goal_${lectureId}` || (r.subjectName === act.details.subject && r.goalType === 'Lecture' && r.chapterTitle === act.details.title));
                        const isDppAdded = routines.some(r => r.id === `goal_${dppId}` || (r.subjectName === act.details.subject && r.goalType === 'DPP' && r.chapterTitle === act.details.title));
                        
                        const hasDpp = act.details.dppStatus === 'DPP will be provided';
                        
                        const suggestLecture = !isLectureDismissed && !isLectureAdded;
                        const suggestDpp = hasDpp && !isDppDismissed && !isDppAdded;
                        
                        if (suggestLecture || suggestDpp) {
                            goals.push({
                                ...act.details,
                                id: baseKey,
                                parentId: act.id,
                                hasDpp,
                                suggestLecture,
                                suggestDpp
                            });
                        }
                    }
                }
            }
        });
        return goals;
    }, [activities, dismissedGoalIds, routines]);

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
        if (!inorganicChapterInput.trim()) return [];
        const chemIdx = data.findIndex(s => s.name.toLowerCase().includes('chemistry'));
        if (chemIdx === -1 || !data[chemIdx] || !data[chemIdx].chapters) return [];
        
        const q = inorganicChapterInput.toLowerCase();
        const results = [];
        data[chemIdx].chapters.forEach((ch, cIdx) => {
            if (ch.name.toLowerCase().includes(q)) {
                results.push({ sIdx: chemIdx, cIdx, name: ch.name });
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
        let linkedActIds = [];

        setData(prevData => {
            const newData = [...prevData];
            const sIdx = newData.findIndex(s => s.name === subjectName);
            if (sIdx === -1) return prevData;
            
            const emptyCh = generateEmptyChapter(targetChapterSearch);
            const specificId = sub.isDuplicate ? sub.act.id : null;
            const { updatedChapter, linkedActIds: matchedIds } = applyActivitiesToChapter(emptyCh, activities, targetChapterSearch, specificId);
            linkedActIds = matchedIds;

            newData[sIdx] = { ...newData[sIdx], chapters: [...newData[sIdx].chapters, updatedChapter] };
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
        let linkedActIds = [];

        setData(prevData => {
            const newData = [...prevData];
            const ch = newData[sIdx].chapters[cIdx];
            chName = ch.name;

            const { updatedChapter, linkedActIds: matchedIds } = applyActivitiesToChapter(ch, activities, targetChapterSearch, sub.isDuplicate ? sub.act.id : null);
            linkedActIds = matchedIds;

            newData[sIdx] = { ...newData[sIdx], chapters: [...newData[sIdx].chapters] };
            newData[sIdx].chapters[cIdx] = updatedChapter;
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
        if (!noteToSave.trim() && !noTest) return; 
        
        setTestLogs([...testLogs, { 
            date: getISTDateString(), 
            note: noteToSave
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

    const handleLogNightlyTextAndImage = (sIdx, cIdx, template, textLog, resourceNumber) => {
        const resourceText = resourceNumber ? ` #${resourceNumber}` : '';
        if (template === 'mock') {
            setTestLogs([...testLogs, { date: getISTDateString(), note: `[Mock${resourceText}] ${textLog}` }]);
        } else {
            const currentLog = data[sIdx].chapters[cIdx].log || '';
            const newLog = currentLog ? `${currentLog}\n\n[${getISTDateString()} - ${template}${resourceText}]\n${textLog}` : `[${getISTDateString()} - ${template}${resourceText}]\n${textLog}`;
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
                const dateStr = getISTDateStringYYYYMMDD(d);
                dates.add(dateStr);
            }
        });
        
        const today = new Date();
        const getFormattedDate = (d) => getISTDateStringYYYYMMDD(d);
        
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
        if (totalCh === 0) return "0.0";
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
                                    🔒 Cryptographic Sync ID will be auto-generated to secure access to your study database.
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
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#070a13]">
                <div className="flex flex-col items-center select-none">
                    <img 
                        src="/loading.gif" 
                        alt="Loading..." 
                        className="w-36 h-36 object-contain mb-6 drop-shadow-[0_0_20px_rgba(249,115,22,0.35)]" 
                    />
                    <div className="relative w-64 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                        <div className="loading-bar-inner"></div>
                    </div>
                </div>
            </div>
        );
    }

    const activeCustomImg = themeSettings.uploadedImgLocal ? backdropImage : themeSettings.uploadedImgUrl;

    return (
        <div className="h-screen flex flex-col relative overflow-hidden text-slate-100">
            {/* Global Ambient Glassmorphic Background */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none w-full h-full">
                {(themeSettings.bgStyle === 'crisp-image' || themeSettings.bgStyle === 'pixelated-image') && activeCustomImg ? (
                    <div 
                        className="absolute inset-0 w-full h-full animate-fade-in bg-[#070a13]"
                        style={{ 
                            backgroundImage: `url(${activeCustomImg})`,
                            backgroundAttachment: 'fixed',
                            backgroundSize: themeSettings.bgScale && themeSettings.bgScale !== 100 ? `${themeSettings.bgScale}%` : 'cover',
                            backgroundPosition: `${themeSettings.bgPositionX !== undefined ? themeSettings.bgPositionX : 50}% ${themeSettings.bgPositionY !== undefined ? themeSettings.bgPositionY : 0}%`,
                            backgroundRepeat: 'no-repeat',
                            filter: themeSettings.performanceMode ? 'none' : (themeSettings.bgBlur ? `blur(${themeSettings.bgBlur * 0.15}px)` : 'none'), 
                            opacity: themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25,
                            ...(themeSettings.bgStyle === 'pixelated-image' ? { imageRendering: 'pixelated' } : {})
                        }}
                    />
                ) : themeSettings.performanceMode ? (
                    // Flat, high-performance gradient for Performance Mode (no filters/blurs)
                    <div 
                        className="absolute inset-0 bg-[#070a13]"
                        style={{
                            background: `radial-gradient(circle at 10% 10%, ${(themeSettings.accentColor || '#f97316')}15, transparent 60%), radial-gradient(circle at 90% 90%, ${(themeSettings.secondaryColor || '#ec4899')}10, transparent 70%)`
                        }}
                    />
                ) : themeSettings.bgStyle === 'svg-mesh' && themeSettings.svgMeshCoords ? (
                    <svg className="absolute inset-0 w-full h-full animate-fade-in" style={{ filter: `blur(${themeSettings.bgBlur || 100}px)`, opacity: themeSettings.bgOpacity || 0.25 }} xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#0a0f1d" />
                        {themeSettings.svgMeshCoords.map((blob, idx) => (
                            <circle key={idx} cx={blob.cx} cy={blob.cy} r={blob.r} fill={blob.color} opacity="0.85" />
                        ))}
                    </svg>
                ) : (
                    // Default stunning Vinyas mesh gradients
                    <div className="absolute inset-0 bg-[#070a13]">
                        <div 
                            className="absolute w-[500px] h-[500px] rounded-full blur-[130px] opacity-15 -top-40 -left-40"
                            style={{ backgroundColor: themeSettings.accentColor || '#f97316' }}
                        />
                        <div 
                            className="absolute w-[600px] h-[600px] rounded-full blur-[140px] opacity-10 -bottom-40 -right-40"
                            style={{ backgroundColor: themeSettings.secondaryColor || '#ec4899' }}
                        />
                    </div>
                )}
            </div>
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
                themeSettings={themeSettings}
                customBgImage={activeCustomImg}
                onOpenTheme={() => setThemeModalOpen(true)}
                onUpdateThemeSettings={(updated) => setThemeSettings(prev => ({ ...prev, ...updated }))}
                userName={userName} 
                syncId={syncId} 
                cohort={cohort}
                targetDate={targetDate} 
                setTargetDate={setTargetDate} 
                daysLeft={daysLeft} 
                onSaveTargetDate={handleSaveTargetDate}
                openCohortSetup={() => setCohortSetupOpen(true)}
                onOpenProfile={() => setProfileModalOpen(true)}
                pollActivities={pollActivities}
                isPollingActivities={isPollingActivities}
                onTriggerTestDpp={handleTriggerTestDpp}
                onNukeActivities={handleNukeActivities}
                onExportData={handleExportData}
                onImportData={handleImportData}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
                onNavigateToExtension={() => navigate('/extension')}
                onOpenBackupSettings={() => setBackupSettingsOpen(true)}
                onOpenChangeLog={() => setChangeLogOpen(true)}
                showExtensionWarning={showExtWarningHeader}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearchFocused={isSearchFocused}
                setIsSearchFocused={setIsSearchFocused}
                searchResults={searchResults}
                handleInlineSearchSelect={handleInlineSearchSelect}
                activities={activities}
                requestConfirm={requestConfirm}
                onOpenBugReport={() => setBugReportOpen(true)}
            />

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 w-full pb-24">
                <main className={`w-full max-w-none mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8 pt-6 transition-all duration-300 ${isCardHidden ? 'pl-4 xl:pl-28 pr-4 xl:pr-8' : 'pl-4 xl:pl-8 pr-4 xl:pr-8'}`}>
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
                    syncId={syncId}
                    onLogFocusTime={handleLogFocusTime}
                    onUpdateChapter={handleUpdateChapter}
                    streakInfo={streakInfo}
                    onTriggerTestAchievement={triggerTestAchievement}
                    onTriggerSpecificAchievement={triggerSpecificAchievement}
                    requestConfirm={requestConfirm}
                    isCardHidden={isCardHidden}
                    handleToggleCardHidden={handleToggleCardHidden}
                    onTabChange={null}
                    performanceMode={themeSettings.performanceMode}
                />

                <div className={`flex flex-col relative transition-all duration-300 ${isCardHidden ? 'xl:col-span-4' : 'xl:col-span-3'}`}>
                    {data.length > 0 ? (
                        <div className="w-full relative min-h-[400px]">
                            {data[activeSubjectIdx] && (
                                <SubjectTable 
                                    subject={data[activeSubjectIdx]}
                                    sIdx={activeSubjectIdx}
                                    handleUpdate={handleUpdate}
                                    handleNestedUpdate={handleNestedUpdate}
                                    openLogModal={openLogModal}
                                    getChapterAnalysis={getChapterAnalysis}
                                    openProgressModal={openProgressModal}
                                    addChapter={handleAddChapter}
                                    removeChapter={handleRemoveChapter}
                                    requestConfirm={requestConfirm}
                                    onPrevSubject={handlePrevSubject}
                                    onNextSubject={handleNextSubject}
                                    activeSubjectIdx={activeSubjectIdx}
                                    totalSubjects={data.length}
                                    performanceMode={themeSettings.performanceMode}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-slate-900/20 backdrop-blur-md rounded-2xl border border-slate-800/60 text-slate-500 animate-fade-in flex flex-col items-center justify-center gap-3">
                            <i className="ph-bold ph-books text-4xl text-slate-650"></i>
                            <p className="font-bold text-sm text-slate-400">No subjects loaded in syllabus yet.</p>
                            <p className="text-xs text-slate-500">Configure your syllabus card setup above to initialize subjects.</p>
                        </div>
                    )}
                </div>
            </main>
            
            {/* Scrollable Outlined Footer */}
            <footer className="w-full text-center py-12 select-none">
                <span className="text-[14px] sm:text-[15px] font-semibold text-white/75" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Made with ❤️by students for students.
                </span>
            </footer>
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



            <ProgressModal 
                isOpen={progressModalOpen}
                onClose={() => setProgressModalOpen(false)}
                chapterData={activeProgressChapter && data && data[activeProgressChapter.sIdx] && data[activeProgressChapter.sIdx].chapters ? data[activeProgressChapter.sIdx].chapters[activeProgressChapter.cIdx] : null}
                chapterName={activeProgressChapter && data && data[activeProgressChapter.sIdx] && data[activeProgressChapter.sIdx].chapters && data[activeProgressChapter.sIdx].chapters[activeProgressChapter.cIdx] ? data[activeProgressChapter.sIdx].chapters[activeProgressChapter.cIdx].name : ''}
                onSave={handleSaveProgress}
                activities={activities}
                data={data}
                onOpenTracker={() => {
                    if (!activeProgressChapter || !data || !data[activeProgressChapter.sIdx]) return;
                    const { sIdx, cIdx } = activeProgressChapter;
                    const subject = data[sIdx];
                    const chapter = subject.chapters && subject.chapters[cIdx];
                    if (!chapter) return;
                    setActiveModuleTracker({
                        sIdx,
                        cIdx,
                        subjectName: subject.name,
                        chapterName: chapter.name,
                        chapterIndex: cIdx,
                        currentModuleComp: chapter.module?.comp || 0,
                        currentModuleAcc: chapter.module?.acc || 0
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
                questionStates={activeModuleTracker && data && data[activeModuleTracker.sIdx] && data[activeModuleTracker.sIdx].chapters && data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx] ? (data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx].moduleQuestionStates || {}) : {}}
                customExerciseConfig={activeModuleTracker && data && data[activeModuleTracker.sIdx] && data[activeModuleTracker.sIdx].chapters && data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx] ? (data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx].customExerciseConfig || null) : null}
                exerciseDisplayNames={activeModuleTracker && data && data[activeModuleTracker.sIdx] && data[activeModuleTracker.sIdx].chapters && data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx] ? (data[activeModuleTracker.sIdx].chapters[activeModuleTracker.cIdx].exerciseDisplayNames || null) : null}
                onSaveProgress={async ({ comp, acc, questionStates }) => {
                    if (!activeModuleTracker) return { success: false, error: 'No active tracker context' };
                    const { sIdx, cIdx, subjectName, chapterName } = activeModuleTracker;

                    // 1. Get stored global progress from localStorage
                    let storedGlobal = {};
                    try {
                        storedGlobal = JSON.parse(localStorage.getItem('vinyas_interactive_module_progress') || '{}');
                    } catch (e) {}

                    // 2. Normalize subject name to check keys
                    const normalizeSub = (name) => {
                        const s = (name || '').toLowerCase().trim();
                        if (s.includes('math')) return 'Maths';
                        if (s.includes('phys')) return 'Physics';
                        if (s.includes('chem')) return 'Chem';
                        return name || '';
                    };
                    const normalizedSubName = normalizeSub(subjectName);
                    const isChapter1 = (() => {
                        if (cIdx === 0) return true;
                        const c = (chapterName || '').toLowerCase();
                        if (normalizedSubName === 'Maths' && c.includes('sets')) return true;
                        if (normalizedSubName === 'Physics' && c.includes('units')) return true;
                        if (normalizedSubName === 'Chem' && c.includes('mole')) return true;
                        return false;
                    })();

                    const getQuestionKey = (exName, qNum) => {
                        if (isChapter1) {
                            return `${normalizedSubName}-${exName}-${qNum}`;
                        } else {
                            return `${normalizedSubName}-${chapterName}-${exName}-${qNum}`;
                        }
                    };

                    const chapter = data[sIdx]?.chapters[cIdx];
                    const exercisesConfig = chapter?.customExerciseConfig || {};

                    // 3. Collect keys for this chapter
                    const chapterKeys = [];
                    Object.entries(exercisesConfig).forEach(([exName, qCount]) => {
                        for (let q = 1; q <= qCount; q++) {
                            chapterKeys.push(getQuestionKey(exName, q));
                        }
                    });

                    // 4. Compare localProgress (questionStates) vs localStorage (storedGlobal)
                    let matches = true;
                    for (const key of chapterKeys) {
                        if ((questionStates[key] || null) !== (storedGlobal[key] || null)) {
                            matches = false;
                            break;
                        }
                    }

                    let finalQuestionStates = { ...questionStates };
                    let finalComp = comp;
                    let finalAcc = acc;
                    let isUsingBackup = false;

                    if (!matches) {
                        // Rebuild using localStorage data (modified for MongoDB submit)
                        isUsingBackup = true;
                        const resolvedProgress = {};
                        let completed = 0;
                        let difficult = 0;
                        let later = 0;
                        let total = 0;

                        Object.entries(exercisesConfig).forEach(([exName, qCount]) => {
                            total += qCount;
                            for (let q = 1; q <= qCount; q++) {
                                const key = getQuestionKey(exName, q);
                                if (storedGlobal[key]) {
                                    resolvedProgress[key] = storedGlobal[key];
                                    if (storedGlobal[key] === 'completed') completed++;
                                    else if (storedGlobal[key] === 'difficult') difficult++;
                                    else if (storedGlobal[key] === 'later') later++;
                                }
                            }
                        });

                        finalQuestionStates = resolvedProgress;
                        finalComp = total > 0 ? Math.round((completed / total) * 100) : 0;
                        const totalTracked = completed + difficult + later;
                        finalAcc = totalTracked > 0 ? Math.round((completed / totalTracked) * 100) : 0;
                    }

                    // 5. Update local React state data
                    const updatedData = data.map((sub, subIdx) => {
                        if (subIdx !== sIdx) return sub;
                        return {
                            ...sub,
                            chapters: sub.chapters.map((ch, chIdx) => {
                                if (chIdx !== cIdx) return ch;
                                return {
                                    ...ch,
                                    moduleQuestionStates: finalQuestionStates,
                                    module: {
                                        ...ch.module,
                                        comp: finalComp,
                                        acc: finalAcc
                                    }
                                };
                            })
                        };
                    });

                    // Update React state instantly
                    setData(updatedData);

                    // 6. Send payload directly to MongoDB immediately to guarantee save success
                    const payload = {
                        ...stateRef.current,
                        data: updatedData
                    };

                    try {
                        const response = await fetch('/api/data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) {
                            throw new Error('Failed to save to database');
                        }

                        const resData = await response.json();
                        handleSaveResponse(resData);

                        if (isUsingBackup) {
                            logEvent('DB_SAVE_WARNING', { 
                                message: 'Mismatch detected! Restored and saved chapter question states from local storage backup.',
                                chapter: chapterName
                            }, 'warning');
                            return { success: true, isUsingBackup: true, comp: finalComp, acc: finalAcc, restoredQuestionStates: finalQuestionStates };
                        } else {
                            logEvent('DB_SAVE_SUCCESS', { 
                                message: 'Successfully saved and synced module questions to MongoDB.',
                                chapter: chapterName
                            }, 'success');
                            return { success: true, isUsingBackup: false, comp: finalComp, acc: finalAcc };
                        }
                    } catch (err) {
                        console.error('Error saving module progress directly:', err);
                        logEvent('DB_SAVE_ERROR', { error: err.message }, 'error');
                        return { success: false, error: err.message };
                    }
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
                        const newLog = currentLog ? `${currentLog}\n\n[${getISTDateString()} - DPP #${resourceNum}]\nCompletion: ${comp}%, Accuracy: ${acc}%` : `[${getISTDateString()} - DPP #${resourceNum}]\nCompletion: ${comp}%, Accuracy: ${acc}%`;
                        handleUpdate(sIdx, cIdx, 'log', newLog);
                    }
                }}
                onLogModule={(sIdx, cIdx, comp, acc, resourceNum) => { 
                    const chapter = data[sIdx].chapters[cIdx];
                    const newLogs = { ...(chapter.moduleLogs || {}) };
                    const resId = resourceNum ? String(resourceNum) : Date.now().toString();
                    newLogs[resId] = { comp, acc };
                    
                    const values = Object.values(newLogs);
                    const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                    const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;

                    handleUpdate(sIdx, cIdx, 'moduleLogs', newLogs);
                    handleNestedUpdate(sIdx, cIdx, 'module', 'comp', Math.round(avgComp)); 
                    handleNestedUpdate(sIdx, cIdx, 'module', 'acc', Math.round(avgAcc)); 
                    
                    if (resourceNum) {
                        const currentLog = chapter.log || '';
                        const newLog = currentLog ? `${currentLog}\n\n[${getISTDateString()} - Module #${resourceNum}]\nCompletion: ${comp}%, Accuracy: ${acc}%` : `[${getISTDateString()} - Module #${resourceNum}]\nCompletion: ${comp}%, Accuracy: ${acc}%`;
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



            <BackupSettingsModal 
                isOpen={backupSettingsOpen}
                onClose={() => setBackupSettingsOpen(false)}
                email={email}
                setEmail={setEmail}
                autoBackupEnabled={autoBackupEnabled}
                setAutoBackupEnabled={setAutoBackupEnabled}
                onSendTestMail={handleSendTestBackupMail}
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

                    {/* Unified Floating Action Button (FAB) Menu */}
                    <div ref={fabRef} className="fixed bottom-6 right-6 z-[100] flex flex-col items-center gap-3">
                        {/* Expanded Menu Actions */}
                        {fabOpen && (
                            <div className="flex flex-col items-center gap-3 animate-fade-in mb-1">
                                {isScrolledPastSearch && (
                                    <button
                                        onClick={() => {
                                            handleScrollToTop();
                                            setFabOpen(false);
                                        }}
                                        className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full shadow-lg border border-slate-650 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                                        title="Scroll to Top"
                                    >
                                        <i className="ph-bold ph-arrow-up text-lg text-slate-300"></i>
                                    </button>
                                )}
                                
                                <button
                                    onClick={() => {
                                        setOverlaySearchOpen(true);
                                        setFabOpen(false);
                                    }}
                                    className="w-12 h-12 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full shadow-lg border border-slate-650 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                                    title="Spotlight Search"
                                >
                                    <i className="ph-bold ph-magnifying-glass text-lg text-slate-300"></i>
                                </button>

                                <button
                                    onClick={() => {
                                        pollActivities();
                                        setFabOpen(false);
                                    }}
                                    disabled={isPollingActivities}
                                    className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg border border-blue-400 flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
                                    title="Refresh Cloud Data"
                                >
                                    <i className={`ph-bold ph-arrows-clockwise text-lg ${isPollingActivities ? 'animate-spin' : ''}`}></i>
                                </button>
                            </div>
                        )}

                        {/* Main FAB Trigger Button */}
                        <button
                            onClick={() => setFabOpen(!fabOpen)}
                            className="w-14 h-14 bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 text-white rounded-full shadow-[0_4px_25px_rgba(249,115,22,0.4)] border border-orange-400 transition-all flex items-center justify-center hover:scale-105 active:scale-95"
                            title="Quick Actions Menu"
                        >
                            <i className={`ph-bold ${fabOpen ? 'ph-x text-xl rotate-90' : 'ph-compass text-2xl'} transition-transform duration-300`}></i>
                        </button>
                    </div>
                </>
            ) : currentPath === '/extension' ? (
                <ExtensionPage 
                    onBack={() => navigate('/')}
                />
            ) : null}

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
                saveTestLog={saveTestLog}
                logModalOpen={logModalOpen}
                activeLog={activeLog}
                setActiveLog={setActiveLog}
                saveLog={saveLog}
                setLogModalOpen={setLogModalOpen}
                currentLevel={currentLevel}
                changeLogOpen={changeLogOpen}
                setChangeLogOpen={setChangeLogOpen}
                bugReportOpen={bugReportOpen}
                setBugReportOpen={setBugReportOpen}
                syncId={syncId}
            />

            <ConfirmationModal 
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={confirmModal.onCancel}
            />

            <WhatsNewModal 
                isOpen={showWhatsNew}
                changelog={WHATS_NEW_CHANGELOG}
                currentExtVersion={VINYAS_EXTENSION_VERSION}
                installedExtVersion={installedExtVersion}
                onDismiss={handleWhatsNewDismiss}
                onExport={handleExportData}
            />

            <ThemeModal 
                isOpen={themeModalOpen}
                onClose={() => setThemeModalOpen(false)}
                themeSettings={themeSettings}
                onUpdateThemeSettings={(updated) => setThemeSettings(prev => ({ ...prev, ...updated }))}
                showToast={showToast}
            />

            <ProfileModal 
                isOpen={profileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                currentUsername={userName}
                onSave={handleSaveUsername}
            />

            {((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') || localStorage.getItem('devMode') === 'true') && (
                <DevToolsOverlay 
                    syncId={syncId}
                    allAchievements={allAchievements}
                    setActiveAchievement={setActiveAchievement}
                    pollActivities={pollActivities}
                    setRetryTrigger={setRetryTrigger}
                    data={data}
                    requestConfirm={requestConfirm}
                    email={email}
                    onSendTestBackupMail={handleSendTestBackupMail}
                    triggerPageLoading={triggerPageLoading}
                />
            )}

            {isLoadingPage && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-955/90 backdrop-blur-md transition-all duration-300">
                    <div className="flex flex-col items-center select-none">
                        <img 
                            src="/loading.gif" 
                            alt="Loading..." 
                            className="w-36 h-36 object-contain mb-6 drop-shadow-[0_0_20px_rgba(249,115,22,0.35)]" 
                        />
                        <div className="relative w-64 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                            <div className="loading-bar-inner"></div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;
