import { useState, useEffect, useMemo, useCallback } from 'react';
import { logEvent } from '../services/logger';
import { normalizeChapterName } from '../shared/normalize.js';
import { getISTDateString, getISTDateStringYYYYMMDD, getISTISOString, getISTTimeString } from '../shared/time.js';
import { 
    extractChapterFromDppTitle, 
    extractChapterFromModuleUrl, 
    findChapterByName, 
    findAllChaptersByName, 
    applyActivitiesToChapter,
    getDefaultTargetDate
} from '../shared/utils.js';
import { initialSyllabus, generateEmptyChapter } from '../data/constants';
import { getEffectiveStatusInfo } from '../components/SubjectTable';

export const useActivityProcessor = ({
    data, setData,
    activities, setActivities,
    resolvedActivityIds, setResolvedActivityIds,
    routines, setRoutines,
    testLogs, setTestLogs,
    syncId, isLoaded, cohort, email, autoBackupEnabled, userName,
    loadAchievements, resetAchievements, achievements,
    flushSave, showToast, requestConfirm,
    setActiveSubjectIdx, activeSubjectIdx
}) => {
    // Unresolved submissions states and local settings
    const [dismissedGoalIds, setDismissedGoalIds] = useState(() => {
        try { return JSON.parse(localStorage.getItem('vinyasDismissedGoals') || '[]'); } 
        catch (e) { return []; }
    });

    const [isPollingActivities, setIsPollingActivities] = useState(false);
    const [lastActivitiesFetchTime, setLastActivitiesFetchTime] = useState(null);

    // --- Background Activity Polling ---
    const pollActivities = useCallback(async () => {
        if (!syncId || !isLoaded) return;
        try {
            setIsPollingActivities(true);
            await flushSave();
            const response = await fetch(`/api/data?syncId=${encodeURIComponent(syncId)}&_t=${Date.now()}`);
            if (response.ok) {
                const serverData = await response.json();
                if (serverData && serverData.exists !== false) {
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
                    if (serverData.resolvedActivityIds) {
                        setResolvedActivityIds(serverData.resolvedActivityIds || []);
                    }
                    if (serverData.activities) {
                        setActivities(serverData.activities);
                    }
                    
                    setLastActivitiesFetchTime(getISTTimeString(new Date()));
                    showToast("Database successfully refreshed!", "success");
                }
            }
        } catch (err) {
            console.error("Refresh error:", err);
            showToast("Failed to refresh: " + err.message, "error");
        } finally {
            setIsPollingActivities(false);
        }
    }, [syncId, isLoaded, flushSave, setData, setRoutines, setTestLogs, loadAchievements, setResolvedActivityIds, setActivities, showToast]);

    // --- Reactive Activity Processor & Auto-Matcher ---
    useEffect(() => {
        if (!isLoaded || activities.length === 0) return;

        let syllabusUpdated = false;
        let nextData = [...data];
        let nextResolvedIds = [...resolvedActivityIds];
        let nextResolvedIdsSet = new Set(nextResolvedIds);
        let resolvedIdsUpdated = false;

        activities.forEach(act => {
            if (act.type === 'INTERACTIVE_QUESTION_UPDATE') {
                if (!nextResolvedIdsSet.has(act.id)) {
                    const details = act.details || {};
                    const { subjectName, chapterName, exerciseName, questionNumber, state } = details;
                    
                    if (!subjectName || !chapterName || !exerciseName || !questionNumber) {
                        nextResolvedIds.push(act.id);
                        nextResolvedIdsSet.add(act.id);
                        resolvedIdsUpdated = true;
                        return;
                    }

                    let matchedSubjectIdx = -1;
                    let matchedChapterIdx = -1;
                    
                    for (let sIdx = 0; sIdx < nextData.length; sIdx++) {
                        const sub = nextData[sIdx];
                        const normSubAct = subjectName.toLowerCase().trim();
                        const normSubSyll = sub.name.toLowerCase().trim();
                        if (normSubSyll.includes(normSubAct) || normSubAct.includes(normSubSyll) ||
                            (normSubAct.includes('math') && normSubSyll.includes('math')) ||
                            (normSubAct.includes('phys') && normSubSyll.includes('phys')) ||
                            (normSubAct.includes('chem') && normSubSyll.includes('chem'))
                        ) {
                            const normChAct = normalizeChapterName(chapterName);
                            const cIdx = sub.chapters.findIndex(ch => {
                                if (normalizeChapterName(ch.name) === normChAct) return true;
                                if (Array.isArray(ch.altNames) && ch.altNames.some(alt => normalizeChapterName(alt) === normChAct)) return true;
                                for (const key of Object.keys(ch)) {
                                    if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string' && normalizeChapterName(ch[key]) === normChAct) return true;
                                }
                                return false;
                            });
                            if (cIdx !== -1) {
                                matchedSubjectIdx = sIdx;
                                matchedChapterIdx = cIdx;
                                break;
                            } else {
                                const candidates = [];
                                sub.chapters.forEach((ch, chIdx) => {
                                    const namesToCheck = [ch.name];
                                    if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
                                    for (const key of Object.keys(ch)) {
                                        if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                                            namesToCheck.push(ch[key]);
                                        }
                                    }
                                    for (const nameToCheck of namesToCheck) {
                                        const chNorm = normalizeChapterName(nameToCheck);
                                        if (chNorm.length > 2 && (chNorm.includes(normChAct) || normChAct.includes(chNorm))) {
                                            candidates.push({ chIdx, name: ch.name, length: chNorm.length });
                                            break;
                                        }
                                    }
                                });
                                if (candidates.length > 0) {
                                    candidates.sort((a, b) => b.length - a.length);
                                    matchedSubjectIdx = sIdx;
                                    matchedChapterIdx = candidates[0].chIdx;
                                    break;
                                }
                            }
                        }
                    }

                    if (matchedSubjectIdx !== -1 && matchedChapterIdx !== -1) {
                        const matchedSub = nextData[matchedSubjectIdx];
                        const ch = { ...matchedSub.chapters[matchedChapterIdx] };
                        
                        const normalizeSub = (name) => {
                            const s = (name || '').toLowerCase().trim();
                            if (s.includes('math')) return 'Maths';
                            if (s.includes('phys')) return 'Physics';
                            if (s.includes('chem')) return 'Chem';
                            return name || '';
                        };
                        const normSubName = normalizeSub(matchedSub.name);
                        
                        const isChapter1 = (() => {
                            if (matchedChapterIdx === 0) return true;
                            const c = (ch.name || '').toLowerCase();
                            if (normSubName === 'Maths' && c.includes('sets')) return true;
                            if (normSubName === 'Physics' && c.includes('units')) return true;
                            if (normSubName === 'Chem' && c.includes('mole')) return true;
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
                            delete newStates[key];
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

                        ch.moduleQuestionStates = newStates;
                        ch.module = {
                            ...(ch.module || {}),
                            comp: finalComp,
                            acc: finalAcc
                        };

                        try {
                            const storedGlobal = JSON.parse(localStorage.getItem('vinyas_interactive_module_progress') || '{}');
                            if (state === 'none') {
                                delete storedGlobal[key];
                            } else {
                                storedGlobal[key] = state;
                            }
                            localStorage.setItem('vinyas_interactive_module_progress', JSON.stringify(storedGlobal));
                        } catch (e) {
                            console.error("[Vinyas App] Error updating local storage for interactive module question state:", e);
                        }

                        nextData[matchedSubjectIdx] = { ...matchedSub, chapters: [...matchedSub.chapters] };
                        nextData[matchedSubjectIdx].chapters[matchedChapterIdx] = ch;
                        syllabusUpdated = true;

                        nextResolvedIds.push(act.id);
                        nextResolvedIdsSet.add(act.id);
                        resolvedIdsUpdated = true;
                    }
                }
                return;
            }

            if (act.type === 'RESOLVE_MAPPING') {
                if (!nextResolvedIdsSet.has(act.id)) {
                    const details = act.details || {};
                    const { mode, subjectName, chapterName, chapterTitle, newSubjectName, pendingActivity } = details;
                    
                    if (!mode) {
                        nextResolvedIds.push(act.id);
                        nextResolvedIdsSet.add(act.id);
                        resolvedIdsUpdated = true;
                        return;
                    }

                    let matchedSubjectIdx = -1;
                    let matchedChapterIdx = -1;
                    let updated = false;

                    if (mode === 'link_chapter') {
                        if (subjectName && chapterName && chapterTitle) {
                            const sIdx = nextData.findIndex(s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase());
                            if (sIdx !== -1) {
                                const cIdx = nextData[sIdx].chapters.findIndex(c => c.name.trim().toLowerCase() === chapterName.trim().toLowerCase());
                                if (cIdx !== -1) {
                                    const ch = { ...nextData[sIdx].chapters[cIdx] };
                                    if (!ch.altNames) ch.altNames = [];
                                    if (!ch.altNames.includes(chapterTitle)) {
                                        ch.altNames.push(chapterTitle);
                                    }
                                    nextData[sIdx] = { ...nextData[sIdx], chapters: [...nextData[sIdx].chapters] };
                                    nextData[sIdx].chapters[cIdx] = ch;
                                    matchedSubjectIdx = sIdx;
                                    matchedChapterIdx = cIdx;
                                    updated = true;
                                }
                            }
                        }
                    } else if (mode === 'create_chapter') {
                        if (subjectName && chapterName && chapterTitle) {
                            const sIdx = nextData.findIndex(s => s.name.trim().toLowerCase() === subjectName.trim().toLowerCase());
                            if (sIdx !== -1) {
                                const newCh = {
                                    name: chapterName,
                                    status: 'None',
                                    lectures: 0,
                                    log: '',
                                    dpp: { acc: 0, comp: 0 },
                                    module: { acc: 0, comp: 0 },
                                    dppLogs: {},
                                    moduleLogs: {},
                                    customExerciseConfig: null,
                                    exerciseDisplayNames: null,
                                    moduleQuestionStates: {},
                                    focusTime: 0,
                                    reviewsDone: 0,
                                    nextReview: null,
                                    lastReviewRating: null,
                                    assignments: [],
                                    altNames: [chapterTitle]
                                };
                                nextData[sIdx] = {
                                    ...nextData[sIdx],
                                    chapters: [...nextData[sIdx].chapters, newCh]
                                };
                                matchedSubjectIdx = sIdx;
                                matchedChapterIdx = nextData[sIdx].chapters.length - 1;
                                updated = true;
                            }
                        }
                    } else if (mode === 'create_subject') {
                        if (newSubjectName && chapterName && chapterTitle) {
                            const newCh = {
                                name: chapterName,
                                status: 'None',
                                lectures: 0,
                                log: '',
                                dpp: { acc: 0, comp: 0 },
                                module: { acc: 0, comp: 0 },
                                dppLogs: {},
                                moduleLogs: {},
                                customExerciseConfig: null,
                                exerciseDisplayNames: null,
                                moduleQuestionStates: {},
                                focusTime: 0,
                                reviewsDone: 0,
                                nextReview: null,
                                lastReviewRating: null,
                                assignments: [],
                                altNames: [chapterTitle]
                            };
                            const newSub = {
                                name: newSubjectName,
                                color: newSubjectName.toLowerCase().includes('physic') ? 'bg-blue-600' :
                                       newSubjectName.toLowerCase().includes('chem') ? 'bg-emerald-600' :
                                       newSubjectName.toLowerCase().includes('math') ? 'bg-rose-600' :
                                       newSubjectName.toLowerCase().includes('biolog') ? 'bg-purple-600' : 'bg-indigo-600',
                                books: [],
                                chapters: [newCh]
                            };
                            nextData.push(newSub);
                            matchedSubjectIdx = nextData.length - 1;
                            matchedChapterIdx = 0;
                            updated = true;
                        }
                    }

                    if (updated && matchedSubjectIdx !== -1 && matchedChapterIdx !== -1) {
                        if (pendingActivity) {
                            const actType = pendingActivity.type;
                            const actDetails = pendingActivity.details || {};
                            const ch = { ...nextData[matchedSubjectIdx].chapters[matchedChapterIdx] };

                            if (actType === 'DPP_SCORE') {
                                const section = actDetails.quizType === 'DPP' ? 'dpp' : 'module';
                                if (section === 'dpp') {
                                    ch.dppLogs = { ...(ch.dppLogs || {}) };
                                    ch.dppLogs[act.id + '_dpp'] = {
                                        comp: Math.round(actDetails.completion || 0),
                                        acc: Math.round(actDetails.accuracy || 0)
                                    };
                                    const values = Object.values(ch.dppLogs);
                                    const avgComp = values.reduce((sum, v) => sum + v.comp, 0) / values.length;
                                    const avgAcc = values.reduce((sum, v) => sum + v.acc, 0) / values.length;
                                    ch.dpp = { comp: Math.round(avgComp), acc: Math.round(avgAcc) };

                                    const dateStr = getISTDateString(new Date(act.timestamp));
                                    const logEntry = `[${dateStr} - DPP: ${actDetails.title}]\nCompletion: ${actDetails.completion}%, Accuracy: ${actDetails.accuracy}%`;
                                    ch.log = ch.log ? `${ch.log}\n\n${logEntry}` : logEntry;
                                } else {
                                    ch.module = {
                                        comp: Math.max(ch.module?.comp || 0, Math.round(actDetails.completion || 0)),
                                        acc: Math.max(ch.module?.acc || 0, Math.round(actDetails.accuracy || 0))
                                    };
                                }
                            } else if (actType === 'ASSIGNMENT_SUBMISSION' || actType === 'ADD_ASSIGNMENT') {
                                if (!ch.assignments) ch.assignments = [];
                                if (!ch.assignments.some(a => a.url === actDetails.url)) {
                                    ch.assignments.push({ name: actDetails.assignmentName, url: actDetails.url });
                                }
                            } else if (actType === 'BOOK_CHAPTER_SUBMISSION') {
                                const sub = { ...nextData[matchedSubjectIdx] };
                                if (!sub.books) sub.books = [];
                                let bookIdx = sub.books.findIndex(b => b.url === actDetails.bookUrl);
                                if (bookIdx === -1) {
                                    sub.books.push({
                                        name: sub.bookName || "Module Book",
                                        url: actDetails.bookUrl,
                                        chapters: {}
                                    });
                                    bookIdx = sub.books.length - 1;
                                }
                                const targetBook = { ...sub.books[bookIdx] };
                                if (!targetBook.chapters) targetBook.chapters = {};
                                targetBook.chapters = {
                                    ...targetBook.chapters,
                                    [ch.name]: actDetails.chapterUrl
                                };
                                sub.books = [...sub.books];
                                sub.books[bookIdx] = targetBook;
                                nextData[matchedSubjectIdx] = sub;
                            }

                            nextData[matchedSubjectIdx] = { ...nextData[matchedSubjectIdx], chapters: [...nextData[matchedSubjectIdx].chapters] };
                            nextData[matchedSubjectIdx].chapters[matchedChapterIdx] = ch;
                        }

                        syllabusUpdated = true;
                    }

                    nextResolvedIds.push(act.id);
                    nextResolvedIdsSet.add(act.id);
                    resolvedIdsUpdated = true;
                }
                return;
            }

            if (act.type === 'BOOK_SUBMISSION') {
                if (!nextResolvedIdsSet.has(act.id)) {
                    const details = act.details || {};
                    const bookName = details.bookName;
                    
                    if (!bookName) {
                        nextResolvedIds.push(act.id);
                        nextResolvedIdsSet.add(act.id);
                        resolvedIdsUpdated = true;
                        return;
                    }

                    const cleanedBookName = bookName.toLowerCase();
                    let matchedSubjectIdx = -1;
                    
                    for (let sIdx = 0; sIdx < nextData.length; sIdx++) {
                        const subName = nextData[sIdx].name.toLowerCase();
                        const stem = subName.substring(0, Math.min(subName.length, 5));
                        if (cleanedBookName.includes(subName) || cleanedBookName.includes(stem)) {
                            matchedSubjectIdx = sIdx;
                            break;
                        }
                    }

                    if (matchedSubjectIdx !== -1) {
                        const matchedSub = nextData[matchedSubjectIdx];
                        const isAlreadyResolved = nextResolvedIdsSet.has(act.id);
                        const hasBookUrl = matchedSub.bookUrl === details.url || (matchedSub.books && matchedSub.books.some(b => b.url === details.url));
                        
                        if (!hasBookUrl || !isAlreadyResolved) {
                            const updatedSub = { ...matchedSub };
                            if (!updatedSub.books) updatedSub.books = [];
                            
                            const bookEntryIdx = updatedSub.books.findIndex(b => b.url === details.url);
                            if (bookEntryIdx === -1) {
                                updatedSub.books.push({
                                    name: details.bookName,
                                    url: details.url,
                                    chapters: {}
                                });
                            }
                            
                            updatedSub.bookUrl = details.url;
                            updatedSub.bookName = details.bookName;
                            
                            nextData[matchedSubjectIdx] = updatedSub;
                            syllabusUpdated = true;

                            if (!isAlreadyResolved) {
                                nextResolvedIds.push(act.id);
                                nextResolvedIdsSet.add(act.id);
                                resolvedIdsUpdated = true;
                            }
                        }
                    }
                }
                return;
            }

            if (act.type === 'BOOK_CHAPTER_SUBMISSION') {
                if (!nextResolvedIdsSet.has(act.id)) {
                    const details = act.details || {};
                    const chapterName = details.chapterName;
                    const bookUrl = details.bookUrl;
                    const chapterUrl = details.chapterUrl;

                    if (!chapterName || !bookUrl || !chapterUrl) {
                        nextResolvedIds.push(act.id);
                        nextResolvedIdsSet.add(act.id);
                        resolvedIdsUpdated = true;
                        return;
                    }

                    let matchedSubjectIdx = -1;
                    let matchedBookIdx = -1;

                    for (let sIdx = 0; sIdx < nextData.length; sIdx++) {
                        const sub = nextData[sIdx];
                        const books = sub.books || [];
                        const bIdx = books.findIndex(b => b.url === bookUrl);
                        if (bIdx !== -1) {
                            matchedSubjectIdx = sIdx;
                            matchedBookIdx = bIdx;
                            break;
                        }
                        if (sub.bookUrl === bookUrl) {
                            matchedSubjectIdx = sIdx;
                            break;
                        }
                    }

                    if (matchedSubjectIdx !== -1) {
                        const matchedSub = nextData[matchedSubjectIdx];
                        const normSearchName = normalizeChapterName(chapterName);
                        let matchedChapterIdx = -1;
                        let matchedChapterNameInSyllabus = '';

                        if (normSearchName) {
                            matchedChapterIdx = matchedSub.chapters.findIndex(ch => {
                                if (normalizeChapterName(ch.name) === normSearchName) return true;
                                if (Array.isArray(ch.altNames) && ch.altNames.some(alt => normalizeChapterName(alt) === normSearchName)) return true;
                                for (const key of Object.keys(ch)) {
                                    if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string' && normalizeChapterName(ch[key]) === normSearchName) return true;
                                }
                                return false;
                            });
                            if (matchedChapterIdx !== -1) {
                                matchedChapterNameInSyllabus = matchedSub.chapters[matchedChapterIdx].name;
                            } else {
                                const candidates = [];
                                matchedSub.chapters.forEach((ch, cIdx) => {
                                    const namesToCheck = [ch.name];
                                    if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
                                    for (const key of Object.keys(ch)) {
                                        if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                                            namesToCheck.push(ch[key]);
                                        }
                                    }
                                    for (const nameToCheck of namesToCheck) {
                                        const chNorm = normalizeChapterName(nameToCheck);
                                        if (chNorm.length > 2 && (chNorm.includes(normSearchName) || normSearchName.includes(chNorm))) {
                                            candidates.push({ cIdx, name: ch.name, length: chNorm.length });
                                            break;
                                        }
                                    }
                                });
                                if (candidates.length > 0) {
                                    candidates.sort((a, b) => b.length - a.length);
                                    matchedChapterIdx = candidates[0].cIdx;
                                    matchedChapterNameInSyllabus = candidates[0].name;
                                }
                            }
                        }

                        if (matchedChapterIdx !== -1) {
                            const updatedSub = { ...matchedSub };
                            if (!updatedSub.books) updatedSub.books = [];
                            
                            if (matchedBookIdx === -1) {
                                const existingIdx = updatedSub.books.findIndex(b => b.url === bookUrl);
                                if (existingIdx === -1) {
                                    updatedSub.books.push({
                                        name: updatedSub.bookName || "Module Book",
                                        url: bookUrl,
                                        chapters: {}
                                    });
                                    matchedBookIdx = updatedSub.books.length - 1;
                                } else {
                                    matchedBookIdx = existingIdx;
                                }
                            }

                            const targetBook = { ...updatedSub.books[matchedBookIdx] };
                            if (!targetBook.chapters) targetBook.chapters = {};
                            
                            const isAlreadyMapped = targetBook.chapters[matchedChapterNameInSyllabus] === chapterUrl;
                            const isAlreadyResolved = nextResolvedIdsSet.has(act.id);

                            if (!isAlreadyMapped || !isAlreadyResolved) {
                                targetBook.chapters = {
                                    ...targetBook.chapters,
                                    [matchedChapterNameInSyllabus]: chapterUrl
                                };
                                updatedSub.books = [...updatedSub.books];
                                updatedSub.books[matchedBookIdx] = targetBook;
                                
                                nextData[matchedSubjectIdx] = updatedSub;
                                syllabusUpdated = true;

                                if (!isAlreadyResolved) {
                                    nextResolvedIds.push(act.id);
                                    nextResolvedIdsSet.add(act.id);
                                    resolvedIdsUpdated = true;
                                }
                            }
                        }
                    }
                }
                return;
            }

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

            if (act.type === 'ASSIGNMENT_SUBMISSION') {
                if (!nextResolvedIdsSet.has(act.id)) {
                    const details = act.details || {};
                    const chapterSearch = details.chapterName;
                    
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
                        const ch = nextData[sIdx].chapters[cIdx];
                        const isAlreadyResolved = nextResolvedIdsSet.has(act.id);
                        
                        if (!ch.assignments) {
                            ch.assignments = [];
                        }

                        if (!ch.assignments.some(a => a.url === details.url) || !isAlreadyResolved) {
                            const updatedCh = { 
                                ...ch,
                                assignments: ch.assignments ? [...ch.assignments] : []
                            };
                            if (!updatedCh.assignments.some(a => a.url === details.url)) {
                                updatedCh.assignments.push({ name: details.assignmentName, url: details.url });
                            }
                            
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
    }, [activities, isLoaded, data, resolvedActivityIds, setData, setRoutines, setResolvedActivityIds]);

    // --- Dynamic Unresolved Submissions ---
    const unresolvedSubmissions = useMemo(() => {
        const unresolved = [];
        activities.forEach(act => {
            if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS' && act.type !== 'ASSIGNMENT_SUBMISSION' && act.type !== 'BOOK_SUBMISSION' && act.type !== 'BOOK_CHAPTER_SUBMISSION') return;
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
            } else if (act.type === 'ASSIGNMENT_SUBMISSION') {
                chapterSearch = details.chapterName;
                section = 'assignments';
            } else if (act.type === 'BOOK_SUBMISSION') {
                chapterSearch = details.bookName;
                section = 'book';
            } else if (act.type === 'BOOK_CHAPTER_SUBMISSION') {
                chapterSearch = details.chapterName;
                section = 'book_chapter';
            }

            if (act.type === 'BOOK_SUBMISSION') {
                const bookName = details.bookName || '';
                const cleanedBookName = bookName.toLowerCase();
                let hasMatch = false;
                for (const sub of data) {
                    const subName = sub.name.toLowerCase();
                    const stem = subName.substring(0, Math.min(subName.length, 5));
                    if (cleanedBookName.includes(subName) || cleanedBookName.includes(stem)) {
                        hasMatch = true;
                        break;
                    }
                }
                if (!hasMatch) {
                    unresolved.push({ 
                        act, 
                        chapterSearch, 
                        section,
                        isDuplicate: false,
                        message: null
                    });
                }
            } else if (act.type === 'BOOK_CHAPTER_SUBMISSION') {
                const bookUrl = details.bookUrl;
                const chapterName = details.chapterName || '';
                let matchedSub = null;
                for (const sub of data) {
                    const books = sub.books || [];
                    if (books.some(b => b.url === bookUrl) || sub.bookUrl === bookUrl) {
                        matchedSub = sub;
                        break;
                    }
                }

                if (!matchedSub) {
                    unresolved.push({
                        act,
                        chapterSearch,
                        section,
                        isDuplicate: false,
                        message: "Parent book is not linked to any subject."
                    });
                } else {
                    const normSearchName = normalizeChapterName(chapterName);
                    let matchedChapterIdx = -1;
                    if (normSearchName) {
                        matchedChapterIdx = matchedSub.chapters.findIndex(ch => {
                            if (normalizeChapterName(ch.name) === normSearchName) return true;
                            if (Array.isArray(ch.altNames) && ch.altNames.some(alt => normalizeChapterName(alt) === normSearchName)) return true;
                            for (const key of Object.keys(ch)) {
                                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string' && normalizeChapterName(ch[key]) === normSearchName) return true;
                            }
                            return false;
                        });
                        if (matchedChapterIdx === -1) {
                            const candidates = [];
                            matchedSub.chapters.forEach((ch, cIdx) => {
                                const namesToCheck = [ch.name];
                                if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
                                for (const key of Object.keys(ch)) {
                                    if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                                        namesToCheck.push(ch[key]);
                                    }
                                }
                                for (const nameToCheck of namesToCheck) {
                                    const chNorm = normalizeChapterName(nameToCheck);
                                    if (chNorm.length > 2 && (chNorm.includes(normSearchName) || normSearchName.includes(chNorm))) {
                                        candidates.push({ cIdx, name: ch.name });
                                        break;
                                    }
                                }
                            });
                            if (candidates.length === 1) {
                                matchedChapterIdx = candidates[0].cIdx;
                            } else if (candidates.length > 1) {
                                matchedChapterIdx = -2;
                            }
                        }
                    }

                    if (matchedChapterIdx === -1 || matchedChapterIdx === -2) {
                        unresolved.push({
                            act,
                            chapterSearch,
                            section,
                            isDuplicate: matchedChapterIdx === -2,
                            message: matchedChapterIdx === -2 
                                ? "Found multiple matching chapters in the matched subject."
                                : "No matching chapter found in the matched subject."
                        });
                    }
                }
            } else {
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
            }
        });
        return unresolved;
    }, [activities, data, resolvedActivityIds]);

    const handleDiscardGoal = useCallback((goalId, hasDpp = false) => {
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
    }, [dismissedGoalIds]);

    const saveSingleGoal = useCallback((goal) => {
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
    }, [data, setRoutines, handleDiscardGoal]);

    const handleSaveGoal = useCallback((goal, includeLecture, includeDpp) => {
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
    }, [saveSingleGoal, handleDiscardGoal]);

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

    // --- Developer / Simulation Actions ---
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
                    setData([...initialSyllabus]);
                    setRoutines([]);
                    setTestLogs([]);
                    setResolvedActivityIds([]);
                    resetAchievements();

                    const response = await fetch(`/api/activity?syncId=${encodeURIComponent(syncId)}&fullDelete=true`, {
                        method: 'DELETE'
                    });

                    if (response.ok) {
                        console.log('Database records nuked successfully');
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
                        
                        await fetch('/api/data', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(cleanPayload)
                        });

                        pollActivities();
                        showToast("Synced activities and progress reset successfully.", "success");
                    } else {
                        throw new Error("Failed to clear database records");
                    }
                } catch (err) {
                    console.error('Error nuking activities:', err);
                    showToast("Failed to reset synced activities: " + err.message, "error");
                }
            }
        );
    };

    // --- Routine State Toggling & Modals Hooks ---
    const toggleRoutineState = useCallback((index, forceState = null) => {
        const newRoutines = [...routines];
        const r = newRoutines[index];
        r.done = forceState !== null ? forceState : !r.done;
        setRoutines(newRoutines);
        logEvent('ROUTINE_TOGGLE', { title: r.task || r.title || 'Unknown Routine', done: r.done }, 'info');
    }, [routines, setRoutines]);

    const handleRemoveRoutine = useCallback((routineId) => {
        const r = routines.find(x => x.id === routineId);
        setRoutines(prev => prev.filter(r => r.id !== routineId));
        if (r) {
            logEvent('ROUTINE_DELETE', { title: r.task || r.title || 'Unknown Routine' }, 'warning');
        }
    }, [routines, setRoutines]);

    // --- Resolve Submission Helpers ---
    const handleResolveAddChapter = useCallback((sub, subjectName, customChapterName = null) => {
        const targetChapterSearch = sub.chapterSearch;
        const finalChapterName = customChapterName ? customChapterName.trim() : targetChapterSearch;
        let linkedActIds = [];

        setData(prevData => {
            const newData = [...prevData];
            const sIdx = newData.findIndex(s => s.name === subjectName);
            if (sIdx === -1) return prevData;
            
            const emptyCh = generateEmptyChapter(finalChapterName);
            if (finalChapterName.toLowerCase() !== targetChapterSearch.toLowerCase()) {
                emptyCh.altNames = [targetChapterSearch];
            }
            const specificId = sub.isDuplicate ? sub.act.id : null;
            const { updatedChapter, linkedActIds: matchedIds } = applyActivitiesToChapter(emptyCh, activities, targetChapterSearch, specificId);
            linkedActIds = matchedIds;

            newData[sIdx] = { ...newData[sIdx], chapters: [...newData[sIdx].chapters, updatedChapter] };
            return newData;
        });

        setResolvedActivityIds(prev => {
            const next = [...prev];
            linkedActIds.forEach(id => {
                if (!next.includes(id)) next.push(id);
            });
            return next;
        });

        logEvent('RESOLVE_ADD_CHAPTER', { 
            subject: subjectName, 
            chapter: finalChapterName, 
            section: sub.section, 
            linkedCount: linkedActIds.length,
            activityIds: linkedActIds
        }, 'success');
    }, [activities, setData, setResolvedActivityIds]);

    const handleResolveCreateSubjectAndChapter = useCallback((sub, newSubjectName, chapterName) => {
        const targetChapterSearch = sub.chapterSearch;
        let linkedActIds = [];

        const newSubject = {
            name: newSubjectName,
            color: newSubjectName.toLowerCase().includes('physic') ? 'bg-blue-600' :
                   newSubjectName.toLowerCase().includes('chem') ? 'bg-emerald-600' :
                   newSubjectName.toLowerCase().includes('math') ? 'bg-rose-600' :
                   newSubjectName.toLowerCase().includes('biolog') ? 'bg-purple-600' : 'bg-indigo-600',
            books: [],
            chapters: []
        };

        setData(prevData => {
            const emptyCh = generateEmptyChapter(chapterName);
            if (chapterName.toLowerCase() !== targetChapterSearch.toLowerCase()) {
                emptyCh.altNames = [targetChapterSearch];
            }
            const specificId = sub.isDuplicate ? sub.act.id : null;
            const { updatedChapter, linkedActIds: matchedIds } = applyActivitiesToChapter(emptyCh, activities, targetChapterSearch, specificId);
            linkedActIds = matchedIds;

            newSubject.chapters.push(updatedChapter);
            return [...prevData, newSubject];
        });

        setResolvedActivityIds(prev => {
            const next = [...prev];
            linkedActIds.forEach(id => {
                if (!next.includes(id)) next.push(id);
            });
            return next;
        });

        logEvent('RESOLVE_CREATE_SUBJECT_CHAPTER', {
            subject: newSubjectName,
            chapter: chapterName,
            section: sub.section,
            linkedCount: linkedActIds.length,
            activityIds: linkedActIds
        }, 'success');
    }, [activities, setData, setResolvedActivityIds]);

    const handleResolveLinkChapter = useCallback((sub, sIdx, cIdx) => {
        let chName = '';
        const targetChapterSearch = sub.chapterSearch;
        let linkedActIds = [];

        setData(prevData => {
            const newData = [...prevData];
            const ch = newData[sIdx].chapters[cIdx];
            chName = ch.name;

            if (targetChapterSearch && targetChapterSearch.trim().toLowerCase() !== ch.name.trim().toLowerCase()) {
                if (!ch.altNames) ch.altNames = [];
                if (!ch.altNames.includes(targetChapterSearch)) {
                    ch.altNames.push(targetChapterSearch);
                }
            }

            const { updatedChapter, linkedActIds: matchedIds } = applyActivitiesToChapter(ch, activities, targetChapterSearch, sub.isDuplicate ? sub.act.id : null);
            linkedActIds = matchedIds;

            newData[sIdx] = { ...newData[sIdx], chapters: [...newData[sIdx].chapters] };
            newData[sIdx].chapters[cIdx] = updatedChapter;
            return newData;
        });

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
    }, [data, activities, setData, setResolvedActivityIds]);

    const handleResolveDismiss = useCallback((actId) => {
        setResolvedActivityIds(prev => [...prev, actId]);
    }, [setResolvedActivityIds]);

    const handleResolveLinkBookChapter = useCallback((act, subjectName, chapterName) => {
        const details = act.details || {};
        const bookUrl = details.bookUrl;
        const chapterUrl = details.chapterUrl;

        let resolvedBookName = 'Module Book';
        const existingBook = data.flatMap(s => s.books || []).find(b => b.url === bookUrl);
        if (existingBook) {
            resolvedBookName = existingBook.name;
        } else {
            const bookAct = activities.find(a => a.type === 'BOOK_SUBMISSION' && a.details?.url === bookUrl);
            if (bookAct && bookAct.details?.bookName) {
                resolvedBookName = bookAct.details.bookName;
            }
        }

        setData(prevData => {
            return prevData.map(sub => {
                if (sub.name.trim().toLowerCase() !== subjectName.trim().toLowerCase()) return sub;

                const updatedSub = { ...sub };
                if (!updatedSub.books) updatedSub.books = [];

                let bookIdx = updatedSub.books.findIndex(b => b.url === bookUrl);
                if (bookIdx === -1) {
                    updatedSub.books.push({
                        name: resolvedBookName,
                        url: bookUrl,
                        chapters: {}
                    });
                    bookIdx = updatedSub.books.length - 1;
                }

                const targetBook = { ...updatedSub.books[bookIdx] };
                if (!targetBook.chapters) targetBook.chapters = {};

                const normChapter = normalizeChapterName(chapterName);
                let actualChapterName = chapterName;
                let chExists = updatedSub.chapters.some(ch => normalizeChapterName(ch.name) === normChapter);

                if (!chExists) {
                    const newCh = {
                        name: chapterName,
                        status: 'None',
                        lectures: 0,
                        log: '',
                        dpp: { acc: 0, comp: 0 },
                        module: { acc: 0, comp: 0 },
                        dppLogs: {},
                        moduleLogs: {},
                        customExerciseConfig: null,
                        exerciseDisplayNames: null,
                        moduleQuestionStates: {},
                        focusTime: 0,
                        reviewsDone: 0,
                        nextReview: null,
                        lastReviewRating: null,
                        assignments: []
                    };
                    const origChapterName = details.chapterName;
                    if (origChapterName && origChapterName.trim().toLowerCase() !== chapterName.trim().toLowerCase()) {
                        newCh.altNames = [origChapterName];
                    }
                    updatedSub.chapters = [...updatedSub.chapters, newCh];
                } else {
                    const matchedCh = updatedSub.chapters.find(ch => normalizeChapterName(ch.name) === normChapter);
                    if (matchedCh) {
                        actualChapterName = matchedCh.name;
                        const origChapterName = details.chapterName;
                        if (origChapterName && origChapterName.trim().toLowerCase() !== actualChapterName.trim().toLowerCase()) {
                            if (!matchedCh.altNames) matchedCh.altNames = [];
                            if (!matchedCh.altNames.includes(origChapterName)) {
                                matchedCh.altNames.push(origChapterName);
                            }
                        }
                    }
                }

                targetBook.chapters = {
                    ...targetBook.chapters,
                    [actualChapterName]: chapterUrl
                };

                updatedSub.books = [...updatedSub.books];
                updatedSub.books[bookIdx] = targetBook;

                return updatedSub;
            });
        });

        setResolvedActivityIds(prev => {
            if (!prev.includes(act.id)) {
                return [...prev, act.id];
            }
            return prev;
        });

        logEvent('RESOLVE_LINK_BOOK_CHAPTER', {
            subject: subjectName,
            chapter: chapterName,
            book: resolvedBookName,
            url: chapterUrl
        }, 'success');
    }, [data, activities, setData, setResolvedActivityIds]);

    const handleResolveCreateSubjectAndLinkBookChapter = useCallback((act, newSubjectName, chapterName) => {
        const details = act.details || {};
        const bookUrl = details.bookUrl;
        const chapterUrl = details.chapterUrl;

        let resolvedBookName = 'Module Book';
        const bookAct = activities.find(a => a.type === 'BOOK_SUBMISSION' && a.details?.url === bookUrl);
        if (bookAct && bookAct.details?.bookName) {
            resolvedBookName = bookAct.details.bookName;
        }

        const newSubject = {
            name: newSubjectName,
            color: newSubjectName.toLowerCase().includes('physic') ? 'bg-blue-600' :
                   newSubjectName.toLowerCase().includes('chem') ? 'bg-emerald-600' :
                   newSubjectName.toLowerCase().includes('math') ? 'bg-rose-600' :
                   newSubjectName.toLowerCase().includes('biolog') ? 'bg-purple-600' : 'bg-indigo-600',
            books: [{
                name: resolvedBookName,
                url: bookUrl,
                chapters: {
                    [chapterName]: chapterUrl
                }
            }],
            chapters: [{
                name: chapterName,
                status: 'None',
                lectures: 0,
                log: '',
                dpp: { acc: 0, comp: 0 },
                module: { acc: 0, comp: 0 },
                dppLogs: {},
                moduleLogs: {},
                customExerciseConfig: null,
                exerciseDisplayNames: null,
                moduleQuestionStates: {},
                focusTime: 0,
                reviewsDone: 0,
                nextReview: null,
                lastReviewRating: null,
                assignments: []
            }]
        };

        setData(prevData => [...prevData, newSubject]);

        setResolvedActivityIds(prev => {
            if (!prev.includes(act.id)) {
                return [...prev, act.id];
            }
            return prev;
        });

        logEvent('RESOLVE_CREATE_SUBJECT_BOOK_CHAPTER', {
            subject: newSubjectName,
            chapter: chapterName,
            book: resolvedBookName,
            url: chapterUrl
        }, 'success');
    }, [activities, setData, setResolvedActivityIds]);

    const handleLinkChapterBookUrl = useCallback((sIdx, bookUrl, chapterName, chapterUrl) => {
        setData(prevData => prevData.map((sub, idx) => {
            if (idx !== sIdx) return sub;

            const updatedSub = { ...sub };
            if (!updatedSub.books) updatedSub.books = [];

            let bookIdx = updatedSub.books.findIndex(b => b.url === bookUrl);
            if (bookIdx === -1) {
                const legacyUrl = sub.bookUrl || bookUrl;
                const legacyName = sub.bookName || 'Module Book';
                updatedSub.books.push({
                    name: legacyName,
                    url: legacyUrl,
                    chapters: {}
                });
                bookIdx = updatedSub.books.length - 1;
            }

            const targetBook = { ...updatedSub.books[bookIdx] };
            if (!targetBook.chapters) targetBook.chapters = {};
            targetBook.chapters = {
                ...targetBook.chapters,
                [chapterName]: chapterUrl
            };

            updatedSub.books = [...updatedSub.books];
            updatedSub.books[bookIdx] = targetBook;
            return updatedSub;
        }));

        logEvent('CH_BOOK_LINK', {
            subject: data[sIdx]?.name,
            chapter: chapterName,
            bookUrl,
            chapterUrl
        }, 'success');
    }, [data, setData]);

    const handleResolveLinkBook = useCallback((act, subjectName) => {
        setData(prevData => prevData.map(sub => {
            if (sub.name !== subjectName) return sub;
            return {
                ...sub,
                bookUrl: act.details.url,
                bookName: act.details.bookName
            };
        }));

        setResolvedActivityIds(prev => {
            if (!prev.includes(act.id)) {
                return [...prev, act.id];
            }
            return prev;
        });

        logEvent('RESOLVE_LINK_BOOK', { 
            subject: subjectName, 
            bookName: act.details.bookName, 
            url: act.details.url 
        }, 'success');
    }, [setData, setResolvedActivityIds]);

    const handleResolveCreateSubjectAndLinkBook = useCallback((act, newSubjectName) => {
        const newSubject = {
            name: newSubjectName,
            color: newSubjectName.toLowerCase().includes('physic') ? 'bg-blue-600' :
                   newSubjectName.toLowerCase().includes('chem') ? 'bg-emerald-600' :
                   newSubjectName.toLowerCase().includes('math') ? 'bg-rose-600' :
                   newSubjectName.toLowerCase().includes('biolog') ? 'bg-purple-600' : 'bg-indigo-600',
            chapters: [],
            bookUrl: act.details.url,
            bookName: act.details.bookName
        };

        setData(prevData => [...prevData, newSubject]);

        setResolvedActivityIds(prev => {
            if (!prev.includes(act.id)) {
                return [...prev, act.id];
            }
            return prev;
        });

        logEvent('RESOLVE_CREATE_SUBJECT_BOOK', { 
            subject: newSubjectName, 
            bookName: act.details.bookName, 
            url: act.details.url 
        }, 'success');
    }, [setData, setResolvedActivityIds]);

    // --- Streak & focus point metrics ---
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

                if (ch.focusTime) {
                    pts += ch.focusTime * 2;
                }
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

    const calculateGlobalProgress = useCallback(() => {
        let totalCh = 0, doneCh = 0;
        data.forEach(sub => {
            totalCh += sub.chapters.length;
            doneCh += sub.chapters.filter(c => getEffectiveStatusInfo(c).isDone).length;
        });
        if (totalCh === 0) return "0.0";
        return ((doneCh / totalCh) * 100).toFixed(1);
    }, [data]);

    return {
        // Properties
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
        
        // Functions
        pollActivities,
        handleTriggerTestDpp,
        handleNukeActivities,
        toggleRoutineState,
        handleRemoveRoutine,
        handleSaveGoal,
        handleDiscardGoal,
        calculateGlobalProgress,
        
        // Resolve handlers
        handleResolveAddChapter,
        handleResolveCreateSubjectAndChapter,
        handleResolveLinkChapter,
        handleResolveDismiss,
        handleResolveLinkBookChapter,
        handleResolveCreateSubjectAndLinkBookChapter,
        handleLinkChapterBookUrl,
        handleResolveLinkBook,
        handleResolveCreateSubjectAndLinkBook
    };
};
