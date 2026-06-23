import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { YogiLogo, generateEmptyChapter } from './data/constants';
import { normalizeUrl } from './shared/normalize.js';
import Header from './components/Header';
import GamifiedDashboard from './components/GamifiedDashboard';
import SubjectTable from './components/SubjectTable';
import ConfirmationModal from './components/ConfirmationModal';
import Modals from './components/Modals';
import SearchOverlay from './components/SearchOverlay';
import ProgressModal from './components/ProgressModal';
import ModuleQuestionTrackerModal from './components/ModuleQuestionTrackerModal';
import AssignmentQuestionTrackerModal from './components/AssignmentQuestionTrackerModal';
import MorningPlannerModal from './components/MorningPlannerModal';
import NightlyWrapUpModal from './components/NightlyWrapUpModal';
import AchievementToast from './components/AchievementToast';
import CohortSetupModal from './components/CohortSetupModal';
import ExtensionPage from './components/ExtensionPage';
import VinyasLivedPage from './components/VinyasLivedPage';
import BackupSettingsModal from './components/BackupSettingsModal';
import ResolveSubmissionsModal from './components/ResolveSubmissionsModal';
import ThemeModal from './components/ThemeModal';
import { useToast } from './components/ToastContext';
import WhatsNewModal from './components/WhatsNewModal';
import ProfileModal from './components/ProfileModal';
import { VINYAS_APP_VERSION, VINYAS_EXTENSION_VERSION, WHATS_NEW_CHANGELOG } from './data/version';
import DevToolsOverlay from './components/DevToolsOverlay';

// Timezone-safe Indian Standard Time (IST) Helpers
import { getISTDateString } from './shared/time.js';
import { logEvent } from './services/logger';

// Custom Hooks & Modular Utilities
import { useThemeSettings } from './hooks/useThemeSettings';
import { useExtensionConnection } from './hooks/useExtensionConnection';
import { useDatabaseSync } from './hooks/useDatabaseSync';
import { useActivityProcessor } from './hooks/useActivityProcessor';
import { useAchievements } from './hooks/useAchievements';

const App = () => {
    const { showToast } = useToast();

    // 1. Theme State & Injection Custom Hook
    const {
        themeSettings,
        setThemeSettings,
        backdropImage,
        setBackdropImage,
        themeModalOpen,
        setThemeModalOpen
    } = useThemeSettings();

    // 2. Achievements Engine Hook
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

    // Lifted states to resolve circular dependency between extension and database hooks
    const [installedExtVersion, setInstalledExtVersion] = useState(null);
    const [showWhatsNew, setShowWhatsNew] = useState(false);

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

    const [activeAssignmentTracker, setActiveAssignmentTracker] = useState(null);

    // Page loading animation state (only for app boot & dev testing)
    const [isLoadingPage, setIsLoadingPage] = useState(false);

    const triggerPageLoading = useCallback(() => {
        setIsLoadingPage(true);
        setTimeout(() => {
            setIsLoadingPage(false);
        }, 2000); // 2 seconds for testing in dev overlay
    }, []);

    // 3. Database Hydration & Synchronization Hook
    const {
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
        triggerSave,
        flushSave,
        updateStateRef,
        saveTimeoutRef,
        savePromiseRef,
        saveResolveRef,
        stateRef,
        deletedAssignmentUrls,
        setDeletedAssignmentUrls
    } = useDatabaseSync({
        showToast,
        requestConfirm,
        achievements,
        loadAchievements,
        resetAchievements,
        installedExtVersion,
        setShowWhatsNew,
        triggerPageLoading
    });

    // Sync callback for real-time question status updates from extension
    const handleSyncQuestionUpdate = useCallback((eventData) => {
        const { subjectName, chapterName, exerciseName, questionNumber, state } = eventData;
        console.log("[Vinyas App] Received real-time question update from extension:", eventData);
        
        setData(prevData => prevData.map(sub => {
            if (sub.name.trim().toLowerCase() !== subjectName.trim().toLowerCase()) return sub;
            
            return {
                ...sub,
                chapters: sub.chapters.map((ch, cIdx) => {
                    const isChapterMatch = (() => {
                        const normCh = ch.name.trim().toLowerCase();
                        const normAct = chapterName.trim().toLowerCase();
                        if (normCh === normAct) return true;
                        if (Array.isArray(ch.altNames) && ch.altNames.some(alt => alt.trim().toLowerCase() === normAct)) return true;
                        for (const key of Object.keys(ch)) {
                            if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string' && ch[key].trim().toLowerCase() === normAct) return true;
                        }
                        return false;
                    })();
                    if (!isChapterMatch) return ch;
                    
                    const normalizeSub = (name) => {
                        const s = (name || '').toLowerCase().trim();
                        if (s.includes('math')) return 'Maths';
                        if (s.includes('phys')) return 'Physics';
                        if (s.includes('chem')) return 'Chem';
                        return name || '';
                    };
                    const normSubName = normalizeSub(sub.name);
                    
                    const isChapter1 = (() => {
                        if (cIdx === 0) return true;
                        const cName = (ch.name || '').toLowerCase();
                        if (normSubName === 'Maths' && cName.includes('sets')) return true;
                        if (normSubName === 'Physics' && cName.includes('units')) return true;
                        if (normSubName === 'Chem' && cName.includes('mole')) return true;
                        return false;
                    })();
                    
                    const getQuestionKey = (exName, qNum) => {
                        if (isChapter1) {
                            return `${normSubName}-${exName}-${qNum}`;
                        } else {
                            return `${normSubName}-${ch.name}-${exName}-${qNum}`;
                        }
                    };
                    
                    const key = getQuestionKey(exerciseName, questionNumber);
                    const newStates = { ...(ch.moduleQuestionStates || {}) };
                    if (state === 'none') {
                        newStates[key] = 'none';
                    } else {
                        newStates[key] = state;
                    }
                    
                    const exercisesConfig = ch.customExerciseConfig || {};
                    let completed = 0;
                    let difficult = 0;
                    let later = 0;
                    let total = 0;

                    Object.entries(exercisesConfig).forEach(([exName, qCount]) => {
                        total += qCount;
                        for (let q = 1; q <= qCount; q++) {
                            const qKey = getQuestionKey(exName, q);
                            if (newStates[qKey]) {
                                if (newStates[qKey] === 'completed') completed++;
                                else if (newStates[qKey] === 'difficult') difficult++;
                                else if (newStates[qKey] === 'later') later++;
                            }
                        }
                    });

                    const finalComp = total > 0 ? Math.round((completed / total) * 100) : 0;
                    const totalTracked = completed + difficult + later;
                    const finalAcc = totalTracked > 0 ? Math.round((completed / totalTracked) * 100) : 0;
                    
                    // Removed localStorage vinyas_interactive_module_progress updates to prevent collisions

                    return {
                        ...ch,
                        moduleQuestionStates: newStates,
                        module: {
                            ...ch.module,
                            comp: finalComp,
                            acc: finalAcc
                        }
                    };
                })
            };
        }));
    }, [setData]);

    const [activeSubjectIdx, setActiveSubjectIdx] = useState(0);
    const [direction, setDirection] = useState(0);

    // 5. Activity Scanner & Resolve Actions Hook
    const {
        unresolvedSubmissions,
        suggestedGoals,
        streakInfo,
        focusPoints,
        currentLevel,
        xpToNextLevel,
        levelProgressPct,
        isPollingActivities,
        lastActivitiesFetchTime,
        dismissedGoalIds,
        pollActivities,
        handleTriggerTestDpp,
        handleNukeActivities,
        toggleRoutineState,
        handleRemoveRoutine,
        handleSaveGoal,
        handleDiscardGoal,
        calculateGlobalProgress,
        handleResolveAddChapter,
        handleResolveCreateSubjectAndChapter,
        handleResolveLinkChapter,
        handleResolveDismiss,
        handleResolveLinkBookChapter,
        handleResolveCreateSubjectAndLinkBookChapter,
        handleLinkChapterBookUrl,
        handleResolveLinkBook,
        handleResolveCreateSubjectAndLinkBook
    } = useActivityProcessor({
        data, setData,
        activities, setActivities,
        resolvedActivityIds, setResolvedActivityIds,
        routines, setRoutines,
        testLogs, setTestLogs,
        syncId, isLoaded, cohort, email, autoBackupEnabled, userName,
        loadAchievements, resetAchievements, achievements,
        flushSave, showToast, requestConfirm,
        setActiveSubjectIdx, activeSubjectIdx,
        deletedAssignmentUrls, setDeletedAssignmentUrls
    });

    // 4. Extension Pairing & Warnings Connection Hook
    const {
        showExtWarningHeader,
        pingExtension
    } = useExtensionConnection({
        isLoaded,
        showWhatsNew,
        lastSeenExtVersion,
        setLastSeenExtVersion,
        onSyncQuestionUpdate: handleSyncQuestionUpdate,
        onSyncRefresh: pollActivities,
        installedExtVersion,
        setInstalledExtVersion
    });

    // Auto-save useEffect to synchronize state and trigger DB updates
    useEffect(() => {
        stateRef.current = {
            syncId, data, routines, testLogs, achievements,
            targetDate, cohort, resolvedActivityIds, email,
            autoBackupEnabled, lastSeenAppVersion, lastSeenExtVersion,
            userName, themeSettings, deletedAssignmentUrls
        };
        if (isLoaded && syncId) {
            triggerSave();
        }
    }, [data, routines, testLogs, achievements, targetDate, cohort,
        resolvedActivityIds, email, autoBackupEnabled,
        lastSeenAppVersion, lastSeenExtVersion, userName,
        syncId, isLoaded, triggerSave, themeSettings, deletedAssignmentUrls]);

    useEffect(() => {
        if (isLoaded && data && data.length > 0) {
            window.postMessage({
                type: 'VINYAS_DASHBOARD_UPDATE',
                data: data
            }, '*');
        }
    }, [data, isLoaded]);

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

    // Dashboard card visibility state (lifted)
    const [isCardHidden, setIsCardHidden] = useState(() => {
        return localStorage.getItem('vinyas_dashboard_card_hidden') === 'true';
    });

    const handleToggleCardHidden = (hiddenValue) => {
        setIsCardHidden(hiddenValue);
        localStorage.setItem('vinyas_dashboard_card_hidden', String(hiddenValue));
    };

    // Sidebar visibility state toggled via YogiLogo click in Header
    const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
        return localStorage.getItem('vinyas_sidebar_visible') !== 'false';
    });

    const handleToggleSidebar = useCallback(() => {
        setIsSidebarVisible(prev => {
            const nextVal = !prev;
            localStorage.setItem('vinyas_sidebar_visible', String(nextVal));
            logEvent('SIDEBAR_TOGGLE', { visible: nextVal }, 'info');
            return nextVal;
        });
    }, []);

    // Search States
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isScrolledPastSearch, setIsScrolledPastSearch] = useState(false);

    // Developer Mode State & Console Polling
    const [devMode, setDevMode] = useState(() => {
        const devModeRaw = localStorage.getItem('devMode');
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        return devModeRaw === 'true' || (devModeRaw === null && isLocal);
    });

    useEffect(() => {
        const interval = setInterval(() => {
            const devModeRaw = localStorage.getItem('devMode');
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const currentDevMode = devModeRaw === 'true' || (devModeRaw === null && isLocal);
            if (currentDevMode !== devMode) {
                setDevMode(currentDevMode);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [devMode]);

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

    const [progressModalOpen, setProgressModalOpen] = useState(false);
    const [activeProgressChapter, setActiveProgressChapter] = useState(null);
    const [activeModuleTracker, setActiveModuleTracker] = useState(null);

    // Workflow Modals State
    const [morningPlannerOpen, setMorningPlannerOpen] = useState(false);
    const [nightlyWrapUpOpen, setNightlyWrapUpOpen] = useState(false);
    const [nightlyWrapUpTargetId, setNightlyWrapUpTargetId] = useState(null);
    const [cohortSetupOpen, setCohortSetupOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);
    
    const [resolveModalOpen, setResolveModalOpen] = useState(false);

    // Change Log & Bug Report Modals States
    const [changeLogOpen, setChangeLogOpen] = useState(false);
    const [bugReportOpen, setBugReportOpen] = useState(false);
    const [suggestFeatureOpen, setSuggestFeatureOpen] = useState(false);

    // SPA Routing
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    useEffect(() => {
        const handlePopState = () => {
            setCurrentPath(window.location.pathname);
            setBugReportOpen(false);
            setSuggestFeatureOpen(false);
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

    const handleSetSyncIdWrapper = async (isGenerating = false) => {
        const isNewGen = await handleSetSyncId(isGenerating, tempUserName, tempSyncId, tempCohort);
        if (isNewGen) {
            setTimeout(() => setCohortSetupOpen(true), 500);
        } else {
            setRetryTrigger(prev => prev + 1);
        }
    };

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
        if (sIdx !== activeSubjectIdx) {
            setActiveSubjectIdx(sIdx);
            setTimeout(() => {
                scrollToAndHighlight(sIdx, cIdx);
            }, 200);
        } else {
            scrollToAndHighlight(sIdx, cIdx);
        }
    };

    const handleScrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOverlaySearchSelect = (sIdx, cIdx) => {
        setOverlaySearchOpen(false);
        setOverlaySearchQuery('');
        if (sIdx !== activeSubjectIdx) {
            setActiveSubjectIdx(sIdx);
            setTimeout(() => {
                scrollToAndHighlight(sIdx, cIdx);
            }, 200);
        } else {
            scrollToAndHighlight(sIdx, cIdx);
        }
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

    const handleUpdateAssignments = (sIdx, cIdx, updatedAssignments) => {
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    return { ...ch, assignments: updatedAssignments };
                })
            };
        }));
    };

    const handleUpdateAssignmentMetadata = (sIdx, cIdx, assignmentIdx, newName, newType) => {
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    const updatedAssignments = [...(ch.assignments || [])];
                    if (updatedAssignments[assignmentIdx]) {
                        updatedAssignments[assignmentIdx] = {
                            ...updatedAssignments[assignmentIdx],
                            name: newName,
                            type: newType
                        };
                    }
                    return { ...ch, assignments: updatedAssignments };
                })
            };
        }));
    };

    const handleResolveAssignmentMovement = (oldSIdx, oldCIdx, assignmentIdx, targetSubjectName, targetChapterName, createNewSubject = false, createNewChapter = false) => {
        setData(prevData => {
            const nextData = [...prevData];
            const oldSubject = { ...nextData[oldSIdx] };
            const oldChapter = { ...oldSubject.chapters[oldCIdx] };
            const oldAssignments = [...(oldChapter.assignments || [])];
            
            const assignmentToMove = oldAssignments[assignmentIdx];
            if (!assignmentToMove) return prevData;

            oldAssignments.splice(assignmentIdx, 1);
            oldChapter.assignments = oldAssignments;
            oldSubject.chapters[oldCIdx] = oldChapter;
            nextData[oldSIdx] = oldSubject;
            
            if (setDeletedAssignmentUrls) {
                setDeletedAssignmentUrls(prev => {
                    const normUrl = normalizeUrl(assignmentToMove.url);
                    if (!prev.includes(normUrl)) return [...prev, normUrl];
                    return prev;
                });
            }

            let tSIdx = nextData.findIndex(s => s.name.trim().toLowerCase() === targetSubjectName.trim().toLowerCase());
            if (createNewSubject || tSIdx === -1) {
                const newSubject = {
                    name: targetSubjectName.trim(),
                    color: targetSubjectName.toLowerCase().includes('physic') ? 'bg-blue-600' :
                           targetSubjectName.toLowerCase().includes('math') ? 'bg-indigo-600' :
                           targetSubjectName.toLowerCase().includes('chem') ? 'bg-emerald-600' :
                           targetSubjectName.toLowerCase().includes('bio') ? 'bg-green-600' : 'bg-slate-700',
                    chapters: []
                };
                nextData.push(newSubject);
                tSIdx = nextData.length - 1;
            }
            
            const targetSubject = { ...nextData[tSIdx] };
            let tCIdx = targetSubject.chapters.findIndex(c => c.name.trim().toLowerCase() === targetChapterName.trim().toLowerCase());
            
            if (createNewChapter || tCIdx === -1) {
                targetSubject.chapters.push({
                    name: targetChapterName.trim(),
                    comp: 0,
                    acc: 0,
                    reviewStatus: 'none',
                    nextReview: null,
                    lastReviewRating: null,
                    assignments: []
                });
                tCIdx = targetSubject.chapters.length - 1;
            }
            
            const targetChapter = { ...targetSubject.chapters[tCIdx] };
            if (!targetChapter.assignments) targetChapter.assignments = [];
            targetChapter.assignments.push(assignmentToMove);
            targetSubject.chapters[tCIdx] = targetChapter;
            nextData[tSIdx] = targetSubject;
            
            return nextData;
        });
        
        setActiveAssignmentTracker(null);
        if (showToast) showToast(`Moved assignment to ${targetSubjectName} > ${targetChapterName}`, 'success');
    };

    const handleSaveAssignmentProgress = (sIdx, cIdx, assignmentIdx, { questionCount, questionStates, questionRemarks, assignmentName, assignmentType, selfAnalysis }) => {
        let finalCount = questionCount;
        let finalStates = { ...questionStates };
        let finalRemarks = { ...questionRemarks };

        const updatedData = data.map((sub, subIdx) => {
            if (subIdx !== sIdx) return sub;
            return {
                ...sub,
                chapters: sub.chapters.map((ch, chIdx) => {
                    if (chIdx !== cIdx) return ch;
                    return {
                        ...ch,
                        assignments: (ch.assignments || []).map((ass, assIdx) => {
                            if (assIdx !== assignmentIdx) return ass;
                            return {
                                ...ass,
                                questionCount: finalCount,
                                questionStates: finalStates,
                                questionRemarks: finalRemarks,
                                ...(assignmentName !== undefined ? { name: assignmentName } : {}),
                                ...(assignmentType !== undefined ? { type: assignmentType } : {}),
                                ...(selfAnalysis !== undefined ? { selfAnalysis } : {})
                            };
                        })
                    };
                })
            };
        });

        setData(updatedData);

        if (updateStateRef) {
            updateStateRef({ data: updatedData });
        }

        triggerSave();
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

    if (!isSyncIdSet) {
        return (
            <div className="min-h-screen bg-slate-955 text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
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
                                    onKeyDown={e => e.key === 'Enter' && handleSetSyncIdWrapper(false)}
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
                        onClick={() => handleSetSyncIdWrapper(welcomeTab === 'create')} 
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
                        className="absolute inset-0 w-full h-full animate-fade-in bg-[#070a13] bg-image-ambient"
                        style={{ 
                            backgroundImage: `url(${activeCustomImg})`,
                            backgroundAttachment: 'fixed',
                            backgroundSize: themeSettings.bgScale && themeSettings.bgScale !== 100 ? `${themeSettings.bgScale}%` : 'cover',
                            backgroundPosition: `${themeSettings.bgPositionX !== undefined ? themeSettings.bgPositionX : 50}% ${themeSettings.bgPositionY !== undefined ? themeSettings.bgPositionY : 0}%`,
                            backgroundRepeat: 'no-repeat',
                            filter: themeSettings.bgBlur ? `blur(${themeSettings.bgBlur * 0.15}px)` : 'none', 
                            opacity: themeSettings.bgOpacity !== undefined ? themeSettings.bgOpacity : 0.25,
                            ...(themeSettings.bgStyle === 'pixelated-image' ? { imageRendering: 'pixelated' } : {})
                        }}
                    />
                ) : themeSettings.performanceMode ? (
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
                onNavigateToVinyasLived={() => navigate('/vinyas-lived')}
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
                onOpenSuggestFeature={() => setSuggestFeatureOpen(true)}
                isSidebarVisible={isSidebarVisible}
                onToggleSidebar={handleToggleSidebar}
            />

            <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 w-full pb-24">
                <main className={`w-full max-w-none mx-auto grid grid-cols-1 xl:grid-cols-4 gap-8 pt-6 transition-all duration-300 pr-4 xl:pr-8 ${isSidebarVisible ? 'pl-4 xl:pl-28' : 'pl-4 xl:pl-8'}`}>
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
                    isSidebarVisible={isSidebarVisible}
                />

                <div className={`flex flex-col relative transition-all duration-300 ${(isCardHidden || !isSidebarVisible) ? 'xl:col-span-4' : 'xl:col-span-3'}`}>
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
                                    onLinkChapterBookUrl={handleLinkChapterBookUrl}
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
                sIdx={activeProgressChapter?.sIdx}
                cIdx={activeProgressChapter?.cIdx}
                requestConfirm={requestConfirm}
                showToast={showToast}
                onUpdateAssignments={(updatedAssignments) => handleUpdateAssignments(activeProgressChapter.sIdx, activeProgressChapter.cIdx, updatedAssignments)}
                onOpenAssignmentTracker={(assignmentIdx) => {
                    if (!activeProgressChapter) return;
                    setActiveAssignmentTracker({
                        sIdx: activeProgressChapter.sIdx,
                        cIdx: activeProgressChapter.cIdx,
                        assignmentIdx
                    });
                }}
                deletedAssignmentUrls={deletedAssignmentUrls}
                setDeletedAssignmentUrls={setDeletedAssignmentUrls}
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
                    const { sIdx, cIdx, chapterName } = activeModuleTracker;

                    let finalQuestionStates = { ...questionStates };
                    let finalComp = comp;
                    let finalAcc = acc;

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

                    setData(updatedData);

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

                        logEvent('DB_SAVE_SUCCESS', { 
                            message: 'Successfully saved and synced module questions to MongoDB.',
                            chapter: chapterName
                        }, 'success');
                        return { success: true, comp: finalComp, acc: finalAcc };
                    } catch (err) {
                        console.error('Error saving module progress directly:', err);
                        logEvent('DB_SAVE_ERROR', { error: err.message }, 'error');
                        return { success: false, error: err.message };
                    }
                }}
            />

            <AssignmentQuestionTrackerModal
                isOpen={activeAssignmentTracker !== null}
                onClose={() => setActiveAssignmentTracker(null)}
                subjectName={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] ? data[activeAssignmentTracker.sIdx].name : ''}
                chapterName={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] ? data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].name : ''}
                assignmentName={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].name : ''}
                assignmentUrl={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].url : ''}
                questionCount={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? (data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].questionCount || 0) : 0}
                questionStates={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? (data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].questionStates || {}) : {}}
                questionRemarks={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? (data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].questionRemarks || {}) : {}}
                assignmentType={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? (data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].type || 'DPP') : 'DPP'}
                selfAnalysis={activeAssignmentTracker && data && data[activeAssignmentTracker.sIdx] && data[activeAssignmentTracker.sIdx].chapters && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx] && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments && data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx] ? (data[activeAssignmentTracker.sIdx].chapters[activeAssignmentTracker.cIdx].assignments[activeAssignmentTracker.assignmentIdx].selfAnalysis || {}) : {}}
                allCustomTypes={Array.from(new Set(data?.flatMap(s => s.chapters?.flatMap(c => c.assignments?.map(a => a.type) || []) || []) || [])).filter(t => t && !['DPP', 'Module', 'Test', 'Notes'].includes(t))}
                data={data}
                onResolveAssignment={(targetSubjectName, targetChapterName, createNewSubject, createNewChapter) => {
                    if (!activeAssignmentTracker) return;
                    const { sIdx, cIdx, assignmentIdx } = activeAssignmentTracker;
                    handleResolveAssignmentMovement(sIdx, cIdx, assignmentIdx, targetSubjectName, targetChapterName, createNewSubject, createNewChapter);
                }}
                onSaveProgress={(progress) => {
                    if (!activeAssignmentTracker) return;
                    const { sIdx, cIdx, assignmentIdx } = activeAssignmentTracker;
                    handleSaveAssignmentProgress(sIdx, cIdx, assignmentIdx, progress);
                }}
                flushSave={flushSave}
                showToast={showToast}
                requestConfirm={requestConfirm}
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
                onCreateSubjectAndChapter={handleResolveCreateSubjectAndChapter}
                onLinkChapter={handleResolveLinkChapter}
                onDismiss={handleResolveDismiss}
                onLinkBookToSubject={handleResolveLinkBook}
                onCreateSubjectAndLinkBook={handleResolveCreateSubjectAndLinkBook}
                activities={activities}
                onLinkBookChapter={handleResolveLinkBookChapter}
                onCreateSubjectAndLinkBookChapter={handleResolveCreateSubjectAndLinkBookChapter}
            />

                </>
            ) : currentPath === '/extension' ? (
                <ExtensionPage 
                    onBack={() => navigate('/')}
                />
            ) : currentPath === '/vinyas-lived' ? (
                <VinyasLivedPage 
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
                suggestFeatureOpen={suggestFeatureOpen}
                setSuggestFeatureOpen={setSuggestFeatureOpen}
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

            {devMode && (
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
                    onNukeDatabase={handleNukeDatabase}
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
