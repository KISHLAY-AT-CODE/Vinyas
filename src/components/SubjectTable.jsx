import React, { useState } from 'react';
import { normalizeUrl } from '../shared/normalize.js';

export const getEffectiveStatusInfo = (chapter) => {
    let sumComp = 0, sumAcc = 0, validCount = 0;
    [chapter.dpp, chapter.module].forEach(sec => {
        if (sec && (sec.acc > 0 || sec.comp > 0)) {
            sumComp += sec.comp;
            sumAcc += sec.acc;
            validCount++;
        }
    });

    const avgAcc = validCount > 0 ? sumAcc / validCount : 0;

    if (chapter.status === 'Under Revision') return { text: 'Under Revision', isDone: false, style: 'bg-purple-500/20 text-purple-400 border-purple-500/30', type: 'revision' };
    if (chapter.status === 'Current') return { text: 'Current', isDone: false, style: 'bg-blue-500/20 text-blue-400 border-blue-500/30', type: 'current' };
    
    if (chapter.status === 'Done') { 
        if (avgAcc >= 80) return { text: 'Done', isDone: true, style: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', type: 'done_green' };
        if (avgAcc >= 50) return { text: 'Done', isDone: true, style: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', type: 'done_yellow' };
        return { text: 'Done', isDone: true, style: 'bg-red-500/20 text-red-400 border-red-500/30', type: 'done_red' };
    }

    return { text: 'To Do', isDone: false, style: 'bg-slate-700 text-slate-400 border-slate-600', type: 'none' };
};

export const getAccuracyTheme = (score) => {
    if (score >= 80) return {
        color: 'emerald',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
        border: 'border-emerald-500/30 hover:border-emerald-400/50',
        glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:shadow-[0_0_18px_rgba(16,185,129,0.4)]',
        shimmerBg: 'from-emerald-500/0 via-emerald-400/30 to-emerald-500/0',
        rowClass: 'chapter-row-emerald'
    };
    if (score >= 60) return {
        color: 'yellow',
        text: 'text-yellow-400',
        bg: 'bg-yellow-500/10 hover:bg-yellow-500/20',
        border: 'border-yellow-500/30 hover:border-yellow-400/50',
        glow: 'shadow-[0_0_12px_rgba(234,179,8,0.25)] hover:shadow-[0_0_18px_rgba(234,179,8,0.4)]',
        shimmerBg: 'from-yellow-500/0 via-yellow-400/30 to-yellow-500/0',
        rowClass: 'chapter-row-yellow'
    };
    if (score > 0) return {
        color: 'red',
        text: 'text-red-400',
        bg: 'bg-red-500/10 hover:bg-red-500/20',
        border: 'border-red-500/30 hover:border-red-400/50',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.25)] hover:shadow-[0_0_18px_rgba(239,68,68,0.4)]',
        shimmerBg: 'from-red-500/0 via-red-400/30 to-red-500/0',
        rowClass: 'chapter-row-red'
    };
    // Default: not mentioned (white)
    return {
        color: 'white',
        text: 'text-slate-200',
        bg: 'bg-white/5 hover:bg-white/10',
        border: 'border-white/20 hover:border-white/40',
        glow: 'shadow-[0_0_10px_rgba(255,255,255,0.15)] hover:shadow-[0_0_15px_rgba(255,255,255,0.25)]',
        shimmerBg: 'from-white/0 via-white/20 to-white/0',
        rowClass: 'chapter-row-white'
    };
};

export const getSubjectGlassTheme = (colorClass, subjectName, isStuck) => {
    const colorLower = (colorClass || '').toLowerCase();
    const nameLower = (subjectName || '').toLowerCase();

    const isBlue = colorLower.includes('blue') || colorLower.includes('cyan') || colorLower.includes('indigo') || nameLower.includes('physic');
    const isGreen = colorLower.includes('emerald') || colorLower.includes('green') || nameLower.includes('chem');
    const isPurple = colorLower.includes('purple') || nameLower.includes('biolog') || nameLower.includes('botan') || nameLower.includes('zool');
    const isRed = colorLower.includes('rose') || colorLower.includes('red') || colorLower.includes('amber') || colorLower.includes('orange') || nameLower.includes('math') || nameLower.includes('algeb') || nameLower.includes('calculus');

    if (isBlue) {
        return {
            containerClass: `dynamic-glass-subject-header border-b border-blue-500/25 shadow-[0_4px_30px_rgba(59,130,246,0.12)] ${
                isStuck ? 'rounded-none border-t border-blue-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-blue-500/15'
            }`,
            titleColor: 'text-blue-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(56,189,248,0.75)]',
            badgeClass: 'bg-blue-500/10 text-blue-300 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)] hover:bg-blue-500/20',
            spotlightClass: 'bg-blue-500/20',
            iconClass: 'ph-atom'
        };
    }
    if (isGreen) {
        return {
            containerClass: `dynamic-glass-subject-header border-b border-emerald-500/25 shadow-[0_4px_30px_rgba(16,185,129,0.12)] ${
                isStuck ? 'rounded-none border-t border-emerald-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-emerald-500/15'
            }`,
            titleColor: 'text-emerald-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(52,211,153,0.75)]',
            badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20',
            spotlightClass: 'bg-emerald-500/20',
            iconClass: 'ph-flask'
        };
    }
    if (isPurple) {
        return {
            containerClass: `dynamic-glass-subject-header border-b border-purple-500/25 shadow-[0_4px_30px_rgba(168,85,247,0.12)] ${
                isStuck ? 'rounded-none border-t border-purple-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-purple-500/15'
            }`,
            titleColor: 'text-purple-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(192,132,252,0.75)]',
            badgeClass: 'bg-purple-500/10 text-purple-300 border border-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.15)] hover:bg-purple-500/20',
            spotlightClass: 'bg-purple-500/20',
            iconClass: 'ph-dna'
        };
    }
    if (isRed) {
        return {
            containerClass: `dynamic-glass-subject-header border-b border-rose-500/25 shadow-[0_4px_30px_rgba(244,63,94,0.12)] ${
                isStuck ? 'rounded-none border-t border-rose-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-rose-500/15'
            }`,
            titleColor: 'text-rose-400 font-extrabold tracking-wide drop-shadow-[0_0_15px_rgba(251,113,133,0.75)]',
            badgeClass: 'bg-rose-500/10 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)] hover:bg-rose-500/20',
            spotlightClass: 'bg-rose-500/20',
            iconClass: 'ph-compass'
        };
    }

    // Default fallback (beautiful glassy indigo)
    return {
        containerClass: `dynamic-glass-subject-header border-b border-indigo-500/20 shadow-[0_4px_30px_rgba(99,102,241,0.08)] ${
            isStuck ? 'rounded-none border-t border-indigo-500/30 shadow-[0_10px_35px_rgba(0,0,0,0.6)]' : 'rounded-t-2xl border-x border-t border-indigo-500/10'
        }`,
        titleColor: 'text-indigo-400 font-extrabold tracking-wide drop-shadow-[0_0_12px_rgba(129,140,248,0.6)]',
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 shadow-[0_0_10px_rgba(99,102,241,0.1)] hover:bg-indigo-500/20',
        spotlightClass: 'bg-indigo-500/15',
        iconClass: 'ph-books'
    };
};

export const calculateChapterBreakdown = (chapter) => {
    const dppComp = chapter?.dpp?.comp || 0;
    const dppAcc = chapter?.dpp?.acc || 0;
    
    const moduleComp = chapter?.module?.comp || 0;
    const moduleAcc = chapter?.module?.acc || 0;
    
    const assignments = chapter?.assignments || [];
    const hasAssignments = assignments.length > 0;
    
    let assComp = 0;
    let assAcc = 0;
    let submittedAssCount = 0;
    
    if (hasAssignments) {
        let totalAssComp = 0;
        let totalAssAcc = 0;
        assignments.forEach(a => {
            const questionCount = a.questionCount || 0;
            if (questionCount > 0) {
                if (a.selfAnalysis?.isSubmitted) {
                    const correct = a.selfAnalysis.correctCount || 0;
                    const incorrect = a.selfAnalysis.incorrectCount || 0;
                    const attempted = correct + incorrect;
                    totalAssComp += (attempted / questionCount) * 100;
                    if (attempted > 0) {
                        totalAssAcc += (correct / attempted) * 100;
                        submittedAssCount++;
                    }
                } else {
                    const solvedCount = Object.values(a.questionStates || {}).filter(s => s === 'completed').length;
                    const errorCount = Object.values(a.questionStates || {}).filter(s => s === 'difficult' || s === 'later').length;
                    const attempted = solvedCount + errorCount;
                    totalAssComp += (attempted / questionCount) * 100;
                    if (attempted > 0) {
                        totalAssAcc += (solvedCount / attempted) * 100;
                        submittedAssCount++;
                    }
                }
            } else {
                if (a.selfAnalysis?.isSubmitted) {
                    totalAssComp += 100;
                    const correct = a.selfAnalysis.correctCount || 0;
                    const incorrect = a.selfAnalysis.incorrectCount || 0;
                    const total = correct + incorrect;
                    if (total > 0) {
                        totalAssAcc += (correct / total) * 100;
                        submittedAssCount++;
                    }
                }
            }
        });
        assComp = totalAssComp / assignments.length;
        if (submittedAssCount > 0) {
            assAcc = totalAssAcc / submittedAssCount;
        }
    }
    
    let weights = { dpp: 0.3, module: 0.4, assignments: 0.3 };
    if (!hasAssignments) {
        weights.assignments = 0;
    }
    const totalWeight = weights.dpp + weights.module + weights.assignments;
    
    const overallComp = totalWeight > 0 ? (
        (weights.dpp * dppComp + weights.module * moduleComp + weights.assignments * assComp) / totalWeight
    ) : 0;
    
    let activeAccWeightSum = 0;
    let activeAccScoreSum = 0;
    
    if (dppComp > 0) {
        activeAccWeightSum += weights.dpp;
        activeAccScoreSum += weights.dpp * dppAcc;
    }
    if (moduleComp > 0) {
        activeAccWeightSum += weights.module;
        activeAccScoreSum += weights.module * moduleAcc;
    }
    if (hasAssignments && submittedAssCount > 0) {
        activeAccWeightSum += weights.assignments;
        activeAccScoreSum += weights.assignments * assAcc;
    }
    
    const overallAcc = activeAccWeightSum > 0 ? (activeAccScoreSum / activeAccWeightSum) : 0;
    
    const correct = overallComp * (overallAcc / 100);
    const incorrect = overallComp * (1 - overallAcc / 100);
    const notAttempted = 100 - overallComp;
    
    return {
        correct: Math.round(correct),
        incorrect: Math.round(incorrect),
        notAttempted: Math.round(notAttempted)
    };
};

export const getChapterMasterScore = (chapter) => {
    const breakdown = calculateChapterBreakdown(chapter);
    return Math.round(breakdown.correct + 0.3 * breakdown.incorrect);
};

const SubjectTable = ({ 
    subject, 
    sIdx, 
    allSubjects = [],
    activities = [],
    onSelectSubject,
    handleUpdate, 
    handleNestedUpdate, 
    openLogModal, 
    getChapterAnalysis, 
    openProgressModal, 
    addChapter, 
    removeChapter, 
    requestConfirm,
    onPrevSubject = () => {},
    onNextSubject = () => {},
    activeSubjectIdx = 0,
    totalSubjects = 1,
    performanceMode = false,
    onLinkChapterBookUrl,
    onUpdateSubjectBooks,
    onBulkLinkChapterBookUrls
}) => {
    const [showAddChapterModal, setShowAddChapterModal] = useState(false);
    const [newChapterName, setNewChapterName] = useState('');
    const headerRef = React.useRef(null);
    const [isStuck, setIsStuck] = useState(false);

    const [showLinkBookModal, setShowLinkBookModal] = useState(false);
    const [linkModalChapter, setLinkModalChapter] = useState('');
    const [linkModalInputUrl, setLinkModalInputUrl] = useState('');
    const [linkModalSelectedBookUrl, setLinkModalSelectedBookUrl] = useState('');
    const [showSubjectBooksModal, setShowSubjectBooksModal] = useState(false);

    const dropdownContainerRef = React.useRef(null);
    const [activeBookUrl, setActiveBookUrl] = useState(() => {
        try {
            const cached = localStorage.getItem(`vinyas_active_book_${subject.name}`);
            if (cached && subject.books && subject.books.some(b => b.url === cached)) {
                return cached;
            }
        } catch (e) {}
        if (subject.books && subject.books.length > 0) {
            return subject.books[0].url;
        }
        return subject.bookUrl || '';
    });
    const [showBooksDropdown, setShowBooksDropdown] = useState(false);
    const [sortBy, setSortBy] = useState(() => {
        try {
            return localStorage.getItem('vinyas_chapter_sort_order') || 'default';
        } catch (e) {
            return 'default';
        }
    });

    const hasChapterData = React.useCallback((ch) => {
        return (ch.dpp?.comp || 0) > 0 ||
               (ch.module?.comp || 0) > 0 ||
               (ch.assignments && ch.assignments.length > 0) ||
               (parseInt(ch.lectures) || 0) > 0 ||
               (ch.log && ch.log.trim().length > 0) ||
               (ch.status && ch.status !== 'None');
    }, []);

    const groupedChapters = React.useMemo(() => {
        const chaptersWithIndex = (subject.chapters || []).map((chapter, cIdx) => ({
            chapter,
            cIdx
        }));

        const activeList = [];
        const noDataList = [];

        chaptersWithIndex.forEach(item => {
            if (hasChapterData(item.chapter)) {
                activeList.push(item);
            } else {
                noDataList.push(item);
            }
        });

        if (sortBy === 'alphabetical') {
            activeList.sort((a, b) => (a.chapter.name || '').localeCompare(b.chapter.name || ''));
            noDataList.sort((a, b) => (a.chapter.name || '').localeCompare(b.chapter.name || ''));
        } else if (sortBy === 'ms_asc') {
            activeList.sort((a, b) => getChapterMasterScore(a.chapter) - getChapterMasterScore(b.chapter));
        } else if (sortBy === 'ms_desc') {
            activeList.sort((a, b) => getChapterMasterScore(b.chapter) - getChapterMasterScore(a.chapter));
        }

        return {
            activeChapters: activeList,
            noDataChapters: noDataList
        };
    }, [subject.chapters, sortBy, hasChapterData]);

    const listItems = React.useMemo(() => {
        const items = [];
        if (groupedChapters.activeChapters.length > 0) {
            items.push({ type: 'header', title: 'Active Chapters', count: groupedChapters.activeChapters.length, isActive: true });
            groupedChapters.activeChapters.forEach(item => {
                items.push({ type: 'row', ...item });
            });
        }
        if (groupedChapters.noDataChapters.length > 0) {
            items.push({ type: 'header', title: 'No Data Available', count: groupedChapters.noDataChapters.length, isActive: false });
            groupedChapters.noDataChapters.forEach(item => {
                items.push({ type: 'row', ...item });
            });
        }
        return items;
    }, [groupedChapters]);



    React.useEffect(() => {
        let setUrl = '';
        try {
            const cached = localStorage.getItem(`vinyas_active_book_${subject.name}`);
            if (cached && subject.books && subject.books.some(b => b.url === cached)) {
                setUrl = cached;
            }
        } catch (e) {}
        
        if (!setUrl) {
            if (subject.books && subject.books.length > 0) {
                setUrl = subject.books[0].url;
            } else {
                setUrl = subject.bookUrl || '';
            }
        }
        
        setActiveBookUrl(setUrl);
        setShowBooksDropdown(false);
        try {
            setSortBy(localStorage.getItem('vinyas_chapter_sort_order') || 'default');
        } catch (e) {
            setSortBy('default');
        }
    }, [subject]);

    React.useEffect(() => {
        if (!showBooksDropdown) return;
        const handleOutsideClick = (e) => {
            if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target)) {
                setShowBooksDropdown(false);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, [showBooksDropdown]);

    const getChapterBookUrl = (chName) => {
        if (activeBookUrl && subject.books) {
            const activeBook = subject.books.find(b => b.url === activeBookUrl);
            if (activeBook && activeBook.chapters && activeBook.chapters[chName]) {
                return { url: activeBook.chapters[chName], bookName: activeBook.name };
            }
        }
        if (subject.books) {
            for (const book of subject.books) {
                if (book.chapters && book.chapters[chName]) {
                    return { url: book.chapters[chName], bookName: book.name };
                }
            }
        }
        return null;
    };

    React.useEffect(() => {
        let ticking = false;
        let cachedNavbarHeight = 72;

        const updateNavbarHeight = () => {
            if (typeof document !== 'undefined') {
                cachedNavbarHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 72;
            }
        };

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (!headerRef.current) {
                        ticking = false;
                        return;
                    }
                    const navbarHeight = cachedNavbarHeight;
                    const rect = headerRef.current.getBoundingClientRect();
                    const parentRect = headerRef.current.parentElement.getBoundingClientRect();
                    
                    const isElementStuck = rect.top <= navbarHeight + 3 && parentRect.bottom > navbarHeight + 15;
                    setIsStuck(isElementStuck);
                    ticking = false;
                });
                ticking = true;
            }
        };

        // Cache initially
        updateNavbarHeight();

        window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
        window.addEventListener('resize', () => {
            updateNavbarHeight();
            handleScroll();
        });
        
        // Dynamic checker interval for layout shifts (e.g. extension banner toggled)
        const intervalId = setInterval(updateNavbarHeight, 1500);

        // Initial check on mount
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll, { capture: true });
            clearInterval(intervalId);
        };
    }, []);
    
    let doneCount = 0;
    subject.chapters.forEach(ch => {
        const eff = getEffectiveStatusInfo(ch);
        if (eff.isDone) doneCount++;
    });

    const glassTheme = getSubjectGlassTheme(subject.color, subject.name, isStuck);

    return (
        <div className={`dynamic-glass-card shadow-2xl flex flex-col relative transition-all duration-300 ${
            isStuck ? 'rounded-none border-x-0' : 'rounded-2xl'
        }`}>
            <div 
                ref={headerRef} 
                className={`${glassTheme.containerClass} px-6 py-4 flex justify-between items-center z-20 sticky top-0 transition-all duration-300 ${showBooksDropdown ? 'overflow-visible' : 'overflow-hidden'} group/header`}
            >
                {/* Modern Specular Highlight & Glow Spotlight */}
                <div className={`absolute -left-12 -top-12 w-28 h-28 rounded-full blur-3xl pointer-events-none opacity-50 ${glassTheme.spotlightClass}`} />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/header:animate-shine pointer-events-none" />

                <div className="flex items-center gap-3 select-none relative z-10">
                    <button 
                        onClick={onPrevSubject}
                        disabled={activeSubjectIdx === 0}
                        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-10 disabled:cursor-not-allowed group/prev shadow-md ${
                            activeSubjectIdx > 0 
                                ? glassTheme.badgeClass 
                                : 'bg-slate-950/20 border-slate-900 text-slate-650'
                        }`}
                        title={activeSubjectIdx > 0 ? "Previous Subject" : ""}
                    >
                        <i className="ph-bold ph-caret-left text-xs group-hover/prev:-translate-x-0.5 transition-transform"></i>
                    </button>

                    <h2 className={`text-xl font-black flex items-center gap-2.5 relative z-10 transition-all duration-300 ${glassTheme.titleColor}`}>
                        <i className={`ph-fill ${glassTheme.iconClass} text-2xl`}></i>
                        <span>{subject.name}</span>
                        {(() => {
                            if (subject.books && subject.books.length > 1) {
                                return (
                                    <div className="relative inline-block" ref={dropdownContainerRef}>
                                        <button 
                                            onClick={() => setShowBooksDropdown(prev => !prev)}
                                            className="ml-1 text-slate-400 hover:text-indigo-400 transition-colors duration-200 flex items-center justify-center p-1 rounded-lg hover:bg-slate-800/50 cursor-pointer"
                                            title="Select Book Module"
                                        >
                                            <i className="ph-bold ph-book-open text-lg"></i>
                                            <i className={`ph-bold ph-caret-down text-[10px] ml-0.5 transition-transform duration-200 ${showBooksDropdown ? 'rotate-180' : ''}`}></i>
                                        </button>
                                        {showBooksDropdown && (
                                            <div className="absolute left-0 mt-1 w-64 bg-slate-900 border border-slate-750 rounded-xl shadow-2xl backdrop-blur-xl z-30 p-1 divide-y divide-slate-800/50 animate-fade-in">
                                                {subject.books.map((book) => (
                                                    <div
                                                        key={book.url}
                                                        onClick={() => {
                                                            setActiveBookUrl(book.url);
                                                            try {
                                                                localStorage.setItem(`vinyas_active_book_${subject.name}`, book.url);
                                                            } catch (e) {}
                                                            setShowBooksDropdown(false);
                                                        }}
                                                        className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                                                            activeBookUrl === book.url 
                                                                ? 'text-indigo-400 bg-indigo-500/10' 
                                                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <i className="ph-fill ph-book-open text-base"></i>
                                                        <span className="truncate flex-1">{book.name}</span>
                                                        {activeBookUrl === book.url && (
                                                            <span className="text-[9px] uppercase tracking-wider bg-indigo-500/20 text-indigo-300 font-extrabold px-1.5 py-0.5 rounded mr-1">Active</span>
                                                        )}
                                                        <a
                                                            href={book.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowBooksDropdown(false);
                                                            }}
                                                            className="text-slate-400 hover:text-indigo-400 p-1 rounded hover:bg-slate-700/50 flex items-center justify-center transition-colors"
                                                            title="Open Book URL"
                                                        >
                                                            <i className="ph-bold ph-arrow-square-out text-sm"></i>
                                                        </a>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            } else if (subject.books && subject.books.length === 1) {
                                return (
                                    <a 
                                        href={subject.books[0].url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="ml-1 text-slate-400 hover:text-indigo-400 transition-colors duration-200 flex items-center justify-center p-1 rounded-lg hover:bg-slate-800/50"
                                        title={`Open Book: ${subject.books[0].name}`}
                                    >
                                        <i className="ph-bold ph-book-open text-lg"></i>
                                    </a>
                                );
                            } else if (subject.bookUrl) {
                                return (
                                    <a 
                                        href={subject.bookUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="ml-1 text-slate-400 hover:text-indigo-400 transition-colors duration-200 flex items-center justify-center p-1 rounded-lg hover:bg-slate-800/50"
                                        title={`Open Book: ${subject.bookName || 'Subject Module'}`}
                                    >
                                        <i className="ph-bold ph-book-open text-lg"></i>
                                    </a>
                                );
                            }
                            return null;
                        })()}

                        {/* Configure Textbooks Button */}
                        <button 
                            onClick={() => setShowSubjectBooksModal(true)} 
                            className="ml-2 text-slate-400 hover:text-indigo-400 transition-colors duration-200 flex items-center justify-center p-1 rounded-lg hover:bg-slate-800/50 cursor-pointer"
                            title={`Configure Books for ${subject.name} (${subject.books ? subject.books.length : 0} configured)`}
                        >
                            <i className="ph-bold ph-gear text-lg"></i>
                        </button>
                    </h2>

                    <button 
                        onClick={onNextSubject}
                        disabled={activeSubjectIdx === totalSubjects - 1}
                        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-10 disabled:cursor-not-allowed group/next shadow-md ${
                            activeSubjectIdx < totalSubjects - 1 
                                ? glassTheme.badgeClass 
                                : 'bg-slate-950/20 border-slate-900 text-slate-650'
                        }`}
                        title={activeSubjectIdx < totalSubjects - 1 ? "Next Subject" : ""}
                    >
                        <i className="ph-bold ph-caret-right text-xs group-hover/next:translate-x-0.5 transition-transform"></i>
                    </button>
                </div>
                
                <div className="flex items-center gap-3 relative z-10">
                    {/* Chapter Sort Select Dropdown */}
                    <div className="relative">
                        <select
                            value={sortBy}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSortBy(val);
                                try {
                                    localStorage.setItem('vinyas_chapter_sort_order', val);
                                } catch (err) {}
                            }}
                            className={`text-xs font-black pl-3.5 pr-8 py-1.5 rounded-xl backdrop-blur-md border cursor-pointer outline-none transition-all shadow-md appearance-none select-none ${glassTheme.badgeClass}`}
                            title="Sort chapters list"
                        >
                            <option value="default" className="bg-slate-900 text-slate-300">Default Order</option>
                            <option value="alphabetical" className="bg-slate-900 text-slate-300">Alphabetical (A-Z)</option>
                            <option value="ms_asc" className="bg-slate-900 text-slate-300">Master Score Ascending</option>
                            <option value="ms_desc" className="bg-slate-900 text-slate-300">Master Score Descending</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <i className="ph-bold ph-caret-down text-[10px]"></i>
                        </div>
                    </div>

                    {/* Compact Glass Custom Chapter Add Button on right dead corner */}
                    <button 
                        onClick={() => setShowAddChapterModal(true)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-md ${glassTheme.badgeClass}`}
                        title="Add Custom Chapter"
                    >
                        <i className="ph-bold ph-plus text-xs"></i>
                    </button>

                    {/* Done Count Badge */}
                    <div className={`text-sm font-black px-3.5 py-1.5 rounded-xl backdrop-blur-md transition-all duration-300 hover:scale-105 cursor-pointer select-none ${glassTheme.badgeClass}`}>
                        {doneCount} / {subject.chapters.length} Done
                    </div>
                </div>
            </div>

            <div className="table-container overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-bold w-1/4">Chapter</th>
                            <th className="px-2 py-3 font-bold text-center border-l border-slate-700/30">Status</th>
                            <th className="px-2 py-3 font-bold text-center border-l border-slate-700/30">Lectures</th>
                            <th className="px-4 py-3 font-bold text-center border-l border-slate-700/30 bg-slate-800/30">Resources Tracking</th>
                            <th className="px-4 py-3 font-bold text-center border-l border-slate-700/30">Analysis</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                        {listItems.map((item, itemIdx) => {
                            if (item.type === 'header') {
                                return (
                                    <tr key={`header-${item.title}`} className="bg-slate-900/45 border-b border-slate-700/60 pointer-events-none select-none">
                                        <td colSpan="5" className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest ${item.isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                                            <div className="flex items-center gap-2">
                                                <i className={`ph-fill ${item.isActive ? 'ph-activity' : 'ph-eye-slash'} text-sm`}></i>
                                                {item.title} ({item.count})
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }

                            const { chapter, cIdx } = item;
                            const analysisScore = getChapterAnalysis(chapter);
                            const eff = getEffectiveStatusInfo(chapter);
                            const theme = getAccuracyTheme(analysisScore);
                            const chapterBookInfo = getChapterBookUrl(chapter.name);
                            const chapterBookUrl = chapterBookInfo ? chapterBookInfo.url : null;

                            return (
                                <tr key={cIdx} id={`chapter-${sIdx}-${cIdx}`} className={`transition-all duration-300 group relative ${theme.rowClass}`}>
                                    <td className="px-4 py-3 font-semibold text-slate-350 flex items-center justify-between" title={chapter.name}>
                                        {/* Dynamic Rising Fill Animation with Sparkles and Crystals */}
                                        {!performanceMode && (
                                            <div className="row-fill-container">
                                                <div className="row-fill-wave" />
                                                <i className={`ph-fill ph-diamond absolute text-[10px] pointer-events-none float-particle-1 ${theme.text} opacity-60 left-[10%]`} />
                                                <i className={`ph-fill ph-sparkle absolute text-[9px] pointer-events-none float-particle-2 ${theme.text} opacity-60 left-[30%]`} />
                                                <i className={`ph-fill ph-diamond absolute text-[8px] pointer-events-none float-particle-3 ${theme.text} opacity-60 left-[50%]`} />
                                                <i className={`ph-fill ph-sparkles absolute text-[11px] pointer-events-none float-particle-4 ${theme.text} opacity-60 left-[70%]`} />
                                                <i className={`ph-fill ph-diamond absolute text-[9px] pointer-events-none float-particle-5 ${theme.text} opacity-60 left-[85%]`} />
                                            </div>
                                        )}

                                        <div className="flex flex-col min-w-0 flex-1 mr-2 relative z-10">
                                            <div className="flex items-center gap-2">
                                                <span className={`truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[220px] md:max-w-[320px] lg:max-w-[420px] xl:max-w-[550px] transition-all duration-300 relative group-hover:${theme.text} font-bold`}>
                                                    {chapter.name}
                                                </span>
                                                {chapterBookUrl && (
                                                    <a 
                                                        href={chapterBookUrl} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center p-0.5 rounded hover:bg-slate-700"
                                                        title="Open Textbook Chapter"
                                                    >
                                                        <i className="ph-fill ph-book-open text-lg"></i>
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-2 group-hover:translate-x-0 relative z-10">
                                            <button 
                                                onClick={() => {
                                                    setLinkModalChapter(chapter.name);
                                                    setLinkModalInputUrl(chapterBookUrl || '');
                                                    setLinkModalSelectedBookUrl(activeBookUrl || '');
                                                    setShowLinkBookModal(true);
                                                }}
                                                className={`transition-colors focus:outline-none p-1 rounded hover:bg-slate-700 ${chapterBookUrl ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-300'}`}
                                                title={chapterBookUrl ? "Edit Link to Textbook" : "Link Chapter to Textbook"}
                                            >
                                                <i className="ph-bold ph-link text-lg"></i>
                                            </button>
                                            <button 
                                                onClick={() => openLogModal(sIdx, cIdx, chapter.name, chapter.log)} 
                                                className={`transition-colors focus:outline-none p-1 rounded hover:bg-slate-700 ${chapter.log ? 'text-indigo-400' : 'text-slate-500 hover:text-indigo-300'}`} 
                                                title={chapter.log ? "Edit your Notes" : "Add prep notes for AI analysis"}
                                            >
                                                <i className="ph-fill ph-notepad text-lg"></i>
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    requestConfirm(
                                                        "Remove Chapter",
                                                        `Are you sure you want to remove "${chapter.name}"? This action is irreversible.`,
                                                        () => removeChapter(sIdx, cIdx)
                                                    );
                                                }} 
                                                className="transition-colors focus:outline-none p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400" 
                                                title="Remove Chapter"
                                            >
                                                <i className="ph-bold ph-trash text-lg"></i>
                                            </button>
                                        </div>

                                        {/* Segmented status bar at bottom of the row */}
                                        {(() => {
                                            const breakdown = calculateChapterBreakdown(chapter);
                                            return (
                                                <div className="absolute bottom-0 left-0 right-0 h-[3.5px] flex z-35 pointer-events-none overflow-hidden border-t border-slate-950/50">
                                                    {breakdown.correct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${breakdown.correct}%` }} />}
                                                    {breakdown.incorrect > 0 && <div className="bg-red-500 h-full" style={{ width: `${breakdown.incorrect}%` }} />}
                                                    {breakdown.notAttempted > 0 && <div className="bg-slate-700 h-full" style={{ width: `${breakdown.notAttempted}%` }} />}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-2 py-3 border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                        <select value={chapter.status || 'None'} onChange={(e) => handleUpdate(sIdx, cIdx, 'status', e.target.value)} className={`text-xs font-bold rounded-full px-3 py-1 w-full text-center border cursor-pointer outline-none transition-all appearance-none ${eff.style} relative z-10`}>
                                            <option value="None" className="bg-slate-800 text-slate-300">To Do</option>
                                            <option value="Current" className="bg-slate-800 text-slate-300">Current</option>
                                            <option value="Under Revision" className="bg-slate-800 text-slate-300">Under Revision</option>
                                            <option value="Done" className="bg-slate-800 text-slate-300">Done</option>
                                        </select>
                                    </td>
                                    <td className="px-2 py-3 border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                        <div className="flex items-center justify-center gap-1 mx-auto w-20 bg-slate-900/80 border border-slate-700 rounded-full overflow-hidden shadow-inner p-0.5 relative z-10">
                                            <button 
                                                onClick={() => handleUpdate(sIdx, cIdx, 'lectures', Math.max(0, (parseInt(chapter.lectures) || 0) - 1))}
                                                className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                            >
                                                <i className="ph-bold ph-minus text-xs"></i>
                                            </button>
                                            <span className="flex-1 text-center font-bold text-slate-200 text-sm tracking-wide">
                                                {chapter.lectures || 0}
                                            </span>
                                            <button 
                                                onClick={() => handleUpdate(sIdx, cIdx, 'lectures', (parseInt(chapter.lectures) || 0) + 1)}
                                                className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                                            >
                                                <i className="ph-bold ph-plus text-xs"></i>
                                            </button>
                                        </div>
                                    </td>
                                    
                                    <td className="px-4 py-3 border-l border-slate-700/20 bg-slate-800/10 text-center transition-all duration-300 group-hover:bg-transparent relative z-10">
                                        <button 
                                            onClick={() => openProgressModal(sIdx, cIdx)}
                                            className={`group/btn relative z-10 inline-flex items-center justify-center px-4 py-1.5 font-black text-xs text-white transition-all duration-300 ${theme.bg} ${theme.border} ${theme.glow} border rounded-xl hover:scale-[1.05] active:scale-[0.97] focus:outline-none shadow-md overflow-hidden cursor-pointer`}
                                        >
                                            <span className={`absolute inset-0 w-full h-full bg-gradient-to-r ${theme.shimmerBg} -translate-x-full group-hover/btn:animate-shine pointer-events-none`}></span>
                                            <span className="relative flex items-center gap-2">
                                                <i className={`ph-fill ph-fire ${theme.text} transition-colors text-sm group-hover/btn:scale-110 transition-transform`}></i>
                                                Log Progress
                                            </span>
                                        </button>
                                    </td>

                                    <td className="px-4 py-3 text-center font-bold border-l border-slate-700/20 transition-all duration-300 relative z-10">
                                        {analysisScore > 0 ? (
                                            <span className={`px-2.5 py-1 rounded-lg transition-all duration-300 border relative z-10 ${
                                                analysisScore >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.25)] group-hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 
                                                analysisScore >= 60 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-[0_0_10px_rgba(234,179,8,0.25)] group-hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]' : 
                                                'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.25)] group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                                            }`}>
                                                {analysisScore.toFixed(1)}%
                                            </span>
                                        ) : <span className="text-slate-600 font-normal relative z-10">-</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Decorative rounded base spacer */}
            <div className="h-4 bg-slate-950/20 rounded-b-2xl border-t border-slate-800/10" />

            {/* Custom Chapter Add Popup Modal */}
            {showAddChapterModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-pop-in relative">
                        {/* Themed background neon glow spotlight */}
                        <div className={`absolute -left-12 -top-12 w-24 h-24 rounded-full blur-3xl pointer-events-none opacity-30 ${glassTheme.spotlightClass}`} />
                        
                        <button 
                            onClick={() => {
                                setShowAddChapterModal(false);
                                setNewChapterName('');
                            }} 
                            className="absolute top-4 right-4 text-slate-450 hover:text-white transition-colors"
                        >
                            <i className="ph-bold ph-x text-lg"></i>
                        </button>
                        
                        <div className="mb-4">
                            <h3 className={`text-base font-black flex items-center gap-2 ${glassTheme.titleColor}`}>
                                <i className="ph-fill ph-plus-circle text-lg"></i>
                                Add Custom Chapter
                            </h3>
                            <p className="text-xs text-slate-450 mt-1">Create a custom syllabus tracker chapter inside {subject.name}.</p>
                        </div>
                        
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const name = newChapterName.trim();
                                if (name) {
                                    addChapter(sIdx, name);
                                    setNewChapterName('');
                                    setShowAddChapterModal(false);
                                }
                            }}
                            className="space-y-4"
                        >
                            <input 
                                type="text"
                                value={newChapterName}
                                onChange={e => setNewChapterName(e.target.value)}
                                placeholder="e.g. Kinetic Theory of Gases"
                                autoFocus
                                required
                                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                            />
                            
                            <div className="flex gap-2 justify-end">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowAddChapterModal(false);
                                        setNewChapterName('');
                                    }}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-750 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className={`px-4 py-2 text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer ${
                                        subject.name.toLowerCase().includes('physic') ? 'bg-blue-600 hover:bg-blue-500' :
                                        subject.name.toLowerCase().includes('chem') ? 'bg-emerald-600 hover:bg-emerald-500' :
                                        subject.name.toLowerCase().includes('math') ? 'bg-rose-600 hover:bg-rose-500' :
                                        subject.name.toLowerCase().includes('biolog') ? 'bg-purple-600 hover:bg-purple-500' : 'bg-indigo-600 hover:bg-indigo-500'
                                    }`}
                                >
                                    Create Chapter
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 🔗 Configure Chapter Links Modal 🔗 */}
            {showLinkBookModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-scale-up flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black text-slate-200 flex items-center gap-2">
                                    <i className="ph-bold ph-link text-indigo-400 text-lg"></i>
                                    Configure Textbook Links
                                </h3>
                                <p className="text-[11px] text-slate-450 mt-0.5">
                                    Map links for chapter: <span className="text-slate-200 font-bold">"{linkModalChapter}"</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowLinkBookModal(false);
                                    setLinkModalChapter('');
                                }}
                                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
                            >
                                <i className="ph-bold ph-x text-lg"></i>
                            </button>
                        </div>
                        
                        {/* Scrollable Body */}
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const mappings = {};
                                (subject.books || []).forEach(book => {
                                    const inputVal = document.getElementById(`chapter-link-input-${book.url.replace(/[^a-z0-9]/gi, '_')}`).value.trim();
                                    mappings[book.url] = inputVal;
                                });
                                onBulkLinkChapterBookUrls(sIdx, linkModalChapter, mappings);
                                setShowLinkBookModal(false);
                                setLinkModalChapter('');
                            }}
                            className="p-6 overflow-y-auto flex-1 space-y-4 flex flex-col"
                        >
                            {(!subject.books || subject.books.length === 0) ? (
                                <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                                    No textbooks configured yet. Configure subject textbooks first using the gear icon.
                                </div>
                            ) : (
                                <div className="space-y-4 flex-1">
                                    {subject.books.map(book => {
                                        const currentLink = (book.chapters && book.chapters[linkModalChapter]) || '';
                                        const inputId = `chapter-link-input-${book.url.replace(/[^a-z0-9]/gi, '_')}`;
                                        return (
                                            <div key={book.url} className="flex flex-col gap-1.5 bg-slate-950/20 border border-slate-800/40 rounded-2xl p-3.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider truncate max-w-[80%]">{book.name}</span>
                                                    {currentLink && (
                                                        <a 
                                                            href={currentLink} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-[9px] text-slate-455 hover:text-indigo-300 transition-colors font-bold flex items-center gap-0.5"
                                                        >
                                                            Open Link <i className="ph-bold ph-arrow-square-out"></i>
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <input 
                                                        type="url"
                                                        id={inputId}
                                                        defaultValue={currentLink}
                                                        placeholder="e.g. https://books.pw.live/..."
                                                        className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                                                    />
                                                    {currentLink && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const inp = document.getElementById(inputId);
                                                                if (inp) inp.value = '';
                                                            }}
                                                            className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-350 transition-colors flex items-center justify-center border border-slate-800/60"
                                                            title="Clear link"
                                                        >
                                                            <i className="ph-bold ph-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            <div className="pt-4 border-t border-slate-800/60 flex gap-3 mt-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowLinkBookModal(false);
                                        setLinkModalChapter('');
                                    }}
                                    className="flex-1 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700/30"
                                >
                                    Cancel
                                </button>
                                {subject.books && subject.books.length > 0 && (
                                    <button
                                        type="submit"
                                        className="flex-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-650/20 cursor-pointer"
                                    >
                                        Save Changes
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 📚 Configure Subject Textbooks Modal 📚 */}
            {showSubjectBooksModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in animate-duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-scale-up flex flex-col max-h-[90vh]">
                        
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-800/80 flex items-center justify-between animate-fade-in">
                            <div>
                                <h3 className="text-base font-black text-slate-200 flex items-center gap-2">
                                    <i className="ph-fill ph-gear text-indigo-400 text-lg"></i>
                                    Configure Books ({subject.name})
                                </h3>
                                <p className="text-[11px] text-slate-450 mt-0.5">
                                    Manage books synced to this subject. Deleting a book also clears its chapter links.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowSubjectBooksModal(false)}
                                className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors"
                            >
                                <i className="ph-bold ph-x text-lg"></i>
                            </button>
                        </div>
                        
                        {/* Modal Scrollable Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            
                            {/* Synced Books List */}
                            <div className="space-y-3">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Configured Books ({subject.books ? subject.books.length : 0}):</label>
                                {(!subject.books || subject.books.length === 0) ? (
                                    <div className="text-center py-6 bg-slate-955/40 rounded-2xl border border-slate-800/60 text-slate-500 text-xs font-semibold">
                                        No textbooks configured for this subject yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {subject.books.map((book, bIdx) => (
                                            <div key={book.url} className="bg-slate-950/40 border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between gap-4 group/book hover:border-slate-700/80 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-slate-200 truncate">{book.name}</div>
                                                    <a 
                                                        href={book.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors truncate block mt-0.5"
                                                    >
                                                        {book.url}
                                                    </a>
                                                    <div className="text-[9px] text-slate-500 mt-1 font-bold uppercase tracking-wider">
                                                        {book.chapters ? Object.keys(book.chapters).length : 0} chapters mapped
                                                    </div>
                                                </div>
                                                
                                                <button
                                                    onClick={() => {
                                                        requestConfirm(
                                                            "Delete Textbook",
                                                            `Are you sure you want to delete "${book.name}"? This will permanently erase all mapped chapter links under this book.`,
                                                            () => {
                                                                const updated = subject.books.filter((_, idx) => idx !== bIdx);
                                                                onUpdateSubjectBooks(sIdx, updated);
                                                                if (activeBookUrl === book.url) {
                                                                    setActiveBookUrl(updated.length > 0 ? updated[0].url : '');
                                                                }
                                                            }
                                                        );
                                                    }}
                                                    className="p-2 rounded-xl bg-red-500/10 border border-red-500/15 text-red-400 hover:bg-red-500/20 hover:border-red-500/30 transition-all flex items-center justify-center cursor-pointer"
                                                    title="Delete Textbook & mappings"
                                                >
                                                    <i className="ph-bold ph-trash text-base"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            <hr className="border-slate-800/60" />
                            
                            {/* Add New Textbook Form */}
                            <div className="space-y-4 bg-slate-950/20 border border-slate-800/50 rounded-2xl p-4">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Add New Textbook:</label>
                                <div className="space-y-3">
                                    <div className="flex flex-col gap-1.5">
                                        <input 
                                            type="text"
                                            id="new-book-name-input"
                                            placeholder="Textbook Name (e.g. HC Verma Vol 1)"
                                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <input 
                                            type="url"
                                            id="new-book-url-input"
                                            placeholder="Textbook URL (e.g. https://books.pw.live/...)"
                                            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-indigo-500 font-semibold"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nameInp = document.getElementById('new-book-name-input');
                                            const urlInp = document.getElementById('new-book-url-input');
                                            const name = nameInp ? nameInp.value.trim() : '';
                                            const url = urlInp ? urlInp.value.trim() : '';
                                            if (name && url) {
                                                const existing = subject.books || [];
                                                if (existing.some(b => b.url === url)) {
                                                    alert("A textbook with this URL is already configured!");
                                                    return;
                                                }
                                                const updated = [
                                                    ...existing,
                                                    { name, url, chapters: {} }
                                                ];
                                                onUpdateSubjectBooks(sIdx, updated);
                                                if (!activeBookUrl) {
                                                    setActiveBookUrl(url);
                                                    try {
                                                        localStorage.setItem(`vinyas_active_book_${subject.name}`, url);
                                                    } catch (e) {}
                                                }
                                                nameInp.value = '';
                                                urlInp.value = '';
                                            } else {
                                                alert("Please enter both Name and URL!");
                                            }
                                        }}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 transition-colors text-white py-2 rounded-xl text-xs font-bold shadow-lg shadow-indigo-650/20 cursor-pointer"
                                    >
                                        + Add Textbook
                                    </button>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubjectTable;
