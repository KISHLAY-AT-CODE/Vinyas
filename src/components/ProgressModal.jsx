import React, { useState, useEffect, useMemo } from 'react';
import { normalizeChapterName, normalizeUrl } from '../shared/normalize.js';

const truncateWords = (str, maxWords = 8) => {
    if (!str) return '';
    const words = str.split(/\s+/);
    if (words.length <= maxWords) return str;
    return words.slice(0, maxWords).join(' ') + '...';
};

const formatDetailedTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const p = (num) => String(num).padStart(2, '0');
    return hrs > 0 ? `${p(hrs)}:${p(mins)}:${p(secs)}` : `${p(mins)}:${p(secs)}`;
};

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

const hasDuplicateChaptersInSyllabus = (data, searchName) => {
    if (!data || !Array.isArray(data) || !searchName) return false;
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return false;
    
    // Priority 1: Exact matches
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
    
    if (exactMatches.length > 1) {
        return true;
    }
    if (exactMatches.length === 1) {
        return false;
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
        const topCandidates = candidates.filter(c => c.length === maxLen);
        return topCandidates.length > 1;
    }
    
    return false;
};

const ProgressModal = ({ 
    isOpen, 
    onClose, 
    chapterData, 
    chapterName,
    onSave,
    activities,
    onOpenTracker,
    data = [],
    sIdx,
    cIdx,
    requestConfirm,
    showToast,
    onUpdateAssignments,
    onOpenAssignmentTracker,
    deletedAssignmentUrls = [],
    setDeletedAssignmentUrls
}) => {
    // Local state for the modal
    const [activeTab, setActiveTab] = useState('overview');
    const [comp, setComp] = useState(0);
    const [acc, setAcc] = useState(0);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newAssignmentName, setNewAssignmentName] = useState('');
    const [newAssignmentLink, setNewAssignmentLink] = useState('');
    const [newAssignmentType, setNewAssignmentType] = useState('DPP');
    const [newCustomAssignmentType, setNewCustomAssignmentType] = useState('');
    // Inline edit state: tracks which assignment URL is being edited and the draft name
    const [editingAssignmentUrl, setEditingAssignmentUrl] = useState(null);
    const [editDraftName, setEditDraftName] = useState('');
    const [editDraftLink, setEditDraftLink] = useState('');
    const [editDraftType, setEditDraftType] = useState('DPP');
    const [editDraftCustomType, setEditDraftCustomType] = useState('');

    const handleSaveNewAssignment = () => {
        if (!newAssignmentName.trim()) {
            if (showToast) showToast("Please enter an assignment name.", "error");
            return;
        }
        if (!newAssignmentLink.trim()) {
            if (showToast) showToast("Please enter an assignment PDF link.", "error");
            return;
        }
        try {
            new URL(newAssignmentLink.trim());
        } catch (e) {
            if (showToast) showToast("Please enter a valid URL (e.g. https://...).", "error");
            return;
        }

        const currentAssignments = chapterData?.assignments || [];
        const newUrlNormalized = normalizeUrl(newAssignmentLink);
        if (currentAssignments.some(a => normalizeUrl(a.url) === newUrlNormalized)) {
            if (showToast) showToast("An assignment with this link already exists.", "error");
            return;
        }

        if (setDeletedAssignmentUrls) {
            setDeletedAssignmentUrls(prev => prev.filter(url => normalizeUrl(url) !== newUrlNormalized));
        }

        let finalType = newAssignmentType;
        if (newAssignmentType === 'Custom') {
            finalType = newCustomAssignmentType.trim() || 'DPP';
        }

        const updatedAssignments = [...currentAssignments, { 
            name: newAssignmentName.trim(), 
            type: finalType,
            url: newAssignmentLink.trim(),
            questionCount: 0,
            questionStates: {}
        }];

        if (onUpdateAssignments) {
            onUpdateAssignments(updatedAssignments);
        }

        setNewAssignmentName('');
        setNewAssignmentLink('');
        setNewAssignmentType('DPP');
        setNewCustomAssignmentType('');
        setShowAddForm(false);
        if (showToast) showToast("Manual assignment added successfully!", "success");
    };

    const handleAssignmentCardClick = (idx) => {
        if (onOpenAssignmentTracker) {
            onOpenAssignmentTracker(idx);
            onClose();
        }
    };

    const handleStartEdit = (assignment, e) => {
        e.stopPropagation();
        setEditingAssignmentUrl(normalizeUrl(assignment.url));
        setEditDraftName(assignment.name);
        setEditDraftLink(assignment.url);
        const typeUpper = (assignment.type || 'DPP').toUpperCase();
        if (['DPP', 'MODULE', 'PYQ', 'TEST'].includes(typeUpper)) {
            setEditDraftType(typeUpper);
            setEditDraftCustomType('');
        } else {
            setEditDraftType('Custom');
            setEditDraftCustomType(assignment.type || '');
        }
    };

    const handleSaveEdit = (assignment, e, typeOverride) => {
        if (e) e.stopPropagation();
        if (!editDraftName.trim()) {
            if (showToast) showToast("Assignment name cannot be empty.", "error");
            return;
        }
        if (!editDraftLink.trim()) {
            if (showToast) showToast("Assignment link cannot be empty.", "error");
            return;
        }
        try {
            new URL(editDraftLink.trim());
        } catch (err) {
            if (showToast) showToast("Please enter a valid URL.", "error");
            return;
        }
        
        let finalType = typeOverride || editDraftType;
        if (finalType === 'Custom') {
            finalType = editDraftCustomType.trim() || 'DPP';
        }
        
        const currentAssignments = chapterData?.assignments || [];
        const targetNormUrl = normalizeUrl(assignment.url);
        const newNormUrl = normalizeUrl(editDraftLink.trim());

        if (targetNormUrl !== newNormUrl && currentAssignments.some(a => normalizeUrl(a.url) === newNormUrl)) {
            if (showToast) showToast("An assignment with this link already exists.", "error");
            return;
        }

        const updatedAssignments = currentAssignments.map(a => {
            if (normalizeUrl(a.url) === targetNormUrl) {
                return { ...a, name: editDraftName.trim(), url: editDraftLink.trim(), type: finalType };
            }
            return a;
        });
        if (onUpdateAssignments) {
            onUpdateAssignments(updatedAssignments);
        }
        setEditingAssignmentUrl(null);
        setEditDraftName('');
        setEditDraftLink('');
        setEditDraftType('DPP');
        setEditDraftCustomType('');
        if (showToast) showToast("Assignment updated!", "success");
    };

    const handleCancelEdit = (e) => {
        if (e) e.stopPropagation();
        setEditingAssignmentUrl(null);
        setEditDraftName('');
        setEditDraftLink('');
        setEditDraftType('DPP');
        setEditDraftCustomType('');
    };

    const handleDeleteAssignment = (assignment, e) => {
        e.stopPropagation();
        if (requestConfirm) {
            requestConfirm(
                "Delete Assignment",
                `Are you sure you want to delete the assignment "${assignment.name}"? This will permanently delete it and its question tracking data.`,
                () => {
                    // Delete by URL match instead of fragile index
                    const targetNormUrl = normalizeUrl(assignment.url);
                    const updatedAssignments = (chapterData?.assignments || []).filter(a => normalizeUrl(a.url) !== targetNormUrl);
                    if (onUpdateAssignments) {
                        onUpdateAssignments(updatedAssignments);
                    }
                    if (setDeletedAssignmentUrls) {
                        setDeletedAssignmentUrls(prev => [...prev, targetNormUrl]);
                    }
                    if (showToast) {
                        showToast("Assignment deleted successfully!", "success");
                    }
                }
            );
        }
    };

    // Load initial values when tab or chapter changes
    useEffect(() => {
        if (chapterData && chapterData[activeTab]) {
            setComp(chapterData[activeTab].comp || 0);
            setAcc(chapterData[activeTab].acc || 0);
        } else {
            setComp(0);
            setAcc(0);
        }
    }, [activeTab, chapterData]);

    // Filter activities that match this chapter (deduplicated by activity ID)
    const chapterActivities = useMemo(() => {
        if (!activities || !chapterName) return [];
        const chNameNormalized = normalizeChapterName(chapterName);
        const seenIds = new Set();
        
        return activities.filter(act => {
            if (act.type !== 'DPP_SCORE') return false;
            // Deduplicate by ID
            if (seenIds.has(act.id)) return false;
            seenIds.add(act.id);
            
            // 1. Direct match by resolved ID inside chapterData.dppLogs or chapterData.moduleLogs
            const isDirectDppMatch = !!(chapterData && chapterData.dppLogs && chapterData.dppLogs[act.id]);
            const isDirectModuleMatch = !!(chapterData && chapterData.moduleLogs && chapterData.moduleLogs[act.id]);
            if (isDirectDppMatch || isDirectModuleMatch) {
                return true;
            }
            
            const details = act.details || {};
            
            // 2. Fuzzy match by DPP title or module URL chapter title param
            let chapterSearch = null;
            if (details.quizType === 'DPP') {
                chapterSearch = extractChapterFromDppTitle(details.title);
            } else if (details.quizType === 'MODULE') {
                chapterSearch = extractChapterFromModuleUrl(details.url);
            }
            
            if (chapterSearch) {
                // If the submitted chapter search maps to multiple chapters with the same name,
                // we ONLY allow showing this activity if it was directly matched/resolved to this chapter.
                if (hasDuplicateChaptersInSyllabus(data, chapterSearch)) {
                    return false;
                }

                const qNormalized = normalizeChapterName(chapterSearch);
                if (qNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                    return true;
                }
            }
            
            // 3. Fallback to basic substring matching
            // If the current chapter name has duplicates, skip fallback to avoid displaying duplicate-named activities.
            if (hasDuplicateChaptersInSyllabus(data, chapterName)) {
                return false;
            }

            const chNameLower = chapterName.toLowerCase().trim();
            if (details.title && details.title.toLowerCase().includes(chNameLower)) return true;
            
            return false;
        });
    }, [activities, chapterName, chapterData, data]);

    // Filter activities for the active tab
    const tabActivities = useMemo(() => {
        return chapterActivities.filter(act => {
            const quizType = act.details?.quizType || 'DPP';
            if (activeTab === 'dpp') {
                return quizType === 'DPP';
            } else {
                return quizType === 'MODULE';
            }
        });
    }, [chapterActivities, activeTab]);

    // Compute averages from detected activities
    const activityAverages = useMemo(() => {
        if (tabActivities.length === 0) return null;
        let totalAcc = 0, totalScore = 0, scoreCount = 0;
        let totalCorrect = 0, totalIncorrect = 0, ratioCount = 0;
        
        tabActivities.forEach(act => {
            const d = act.details || {};
            totalAcc += (d.accuracy || 0);
            if (d.score) {
                const parts = String(d.score).split('/').map(s => parseFloat(s.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] > 0) {
                    totalScore += (parts[0] / parts[1]) * 100;
                    scoreCount++;
                }
            }
            if (d.correct !== undefined && d.incorrect !== undefined) {
                totalCorrect += parseInt(d.correct) || 0;
                totalIncorrect += parseInt(d.incorrect) || 0;
                ratioCount++;
            }
        });
        
        const count = tabActivities.length;
        return {
            avgAcc: Math.round(totalAcc / count),
            avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : null,
            totalCorrect,
            totalIncorrect,
            hasRatio: ratioCount > 0,
            count
        };
    }, [tabActivities]);

    const nonDeletedAssignments = useMemo(() => {
        if (!chapterData || !chapterData.assignments) return [];
        return chapterData.assignments.map((assignment, originalIdx) => ({
            ...assignment,
            originalIdx
        })).filter(a => {
            const normalized = normalizeUrl(a.url);
            return !(deletedAssignmentUrls || []).some(delUrl => normalizeUrl(delUrl) === normalized);
        });
    }, [chapterData, deletedAssignmentUrls]);

    // Calculate Master Score
    const masterScoreData = useMemo(() => {
        const dppComp = chapterData?.dpp?.comp || 0;
        const dppAcc = chapterData?.dpp?.acc || 0;

        const moduleComp = chapterData?.module?.comp || 0;
        const moduleAcc = chapterData?.module?.acc || 0;

        const hasAssignments = nonDeletedAssignments.length > 0;
        let assComp = 0;
        let assAcc = 0;
        let submittedAssCount = 0;

        if (hasAssignments) {
            let totalAssComp = 0;
            let totalAssAcc = 0;
            
            nonDeletedAssignments.forEach(a => {
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
            
            assComp = totalAssComp / nonDeletedAssignments.length;
            if (submittedAssCount > 0) {
                assAcc = totalAssAcc / submittedAssCount;
            }
        }

        // Base Weights: DPP 30%, Module 40%, Assignments 30%
        let weights = {
            dpp: 0.3,
            module: 0.4,
            assignments: 0.3
        };

        // Redistribution if no assignments exist
        if (!hasAssignments) {
            weights.assignments = 0;
        }

        const totalWeight = weights.dpp + weights.module + weights.assignments;

        // Overall Completion
        const overallComp = totalWeight > 0 ? (
            (weights.dpp * dppComp + weights.module * moduleComp + weights.assignments * assComp) / totalWeight
        ) : 0;

        // Overall Accuracy (only dynamic weighting of components with completion > 0)
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

        // Final Master Score: Comp * (0.3 + 0.7 * (Acc / 100))
        const rawMasterScore = overallComp > 0 ? overallComp * (0.3 + 0.7 * (overallAcc / 100)) : 0;
        const masterScore = Math.round(rawMasterScore);

        // Standing & visual color code
        let standing = 'Needs Attention ⚠️';
        let colorClass = 'text-rose-455';
        let strokeColor = '#f43f5e'; // rose-500
        let bgGradient = 'from-rose-500/10 to-red-500/5';
        let borderGlow = 'border-rose-500/20 shadow-rose-950/20';
        let recommendation = 'Start solving questions in DPPs and Interactive Module to establish your chapter progress.';

        if (masterScore >= 90) {
            standing = 'Mastered 👑';
            colorClass = 'text-violet-400 font-extrabold';
            strokeColor = '#a78bfa'; // violet-400
            bgGradient = 'from-violet-500/15 to-indigo-500/5';
            borderGlow = 'border-violet-500/30 shadow-violet-950/30';
            recommendation = 'Exceptional standing! You have complete domain over this chapter. Try taking a timed mock test.';
        } else if (masterScore >= 75) {
            standing = 'Strong 🌟';
            colorClass = 'text-emerald-400';
            strokeColor = '#34d399'; // emerald-400
            bgGradient = 'from-emerald-500/15 to-teal-500/5';
            borderGlow = 'border-emerald-500/30 shadow-emerald-950/30';
            recommendation = 'Great progress and high accuracy! Clear remaining assignments or module exercises to push for full mastery.';
        } else if (masterScore >= 55) {
            standing = 'Proficient 🏆';
            colorClass = 'text-blue-450';
            strokeColor = '#60a5fa'; // blue-400
            bgGradient = 'from-blue-500/15 to-indigo-500/5';
            borderGlow = 'border-blue-500/30 shadow-blue-950/30';
            recommendation = 'Solid performance. Dedicate time to solve complex module questions or clear pending assignments to build confidence.';
        } else if (masterScore >= 30) {
            standing = 'Developing 📈';
            colorClass = 'text-amber-455';
            strokeColor = '#fbbf24'; // amber-400
            bgGradient = 'from-amber-500/15 to-orange-500/5';
            borderGlow = 'border-amber-500/30 shadow-amber-950/30';
            recommendation = 'Chapter coverage is growing. Review conceptual details and double-check wrong answers on completed exercises.';
        } else if (overallComp > 0 && overallAcc < 40) {
            recommendation = 'Your progress is logged, but accuracy is low. Focus on reviewing theory before attempting more questions.';
        }

        return {
            masterScore,
            overallComp: Math.round(overallComp),
            overallAcc: Math.round(overallAcc),
            standing,
            colorClass,
            strokeColor,
            bgGradient,
            borderGlow,
            recommendation,
            details: {
                dpp: { 
                    comp: dppComp, 
                    acc: dppAcc, 
                    weight: Math.round((weights.dpp / totalWeight) * 100),
                    correct: Math.round(dppComp * (dppAcc / 100)),
                    incorrect: Math.round(dppComp * (1 - dppAcc / 100)),
                    get notAttempted() { return 100 - this.correct - this.incorrect; }
                },
                module: { 
                    comp: moduleComp, 
                    acc: moduleAcc, 
                    weight: Math.round((weights.module / totalWeight) * 100),
                    correct: Math.round(moduleComp * (moduleAcc / 100)),
                    incorrect: Math.round(moduleComp * (1 - moduleAcc / 100)),
                    get notAttempted() { return 100 - this.correct - this.incorrect; }
                },
                assignments: hasAssignments ? { 
                    comp: Math.round(assComp), 
                    acc: Math.round(assAcc), 
                    weight: Math.round((weights.assignments / totalWeight) * 100),
                    correct: Math.round(assComp * ((assAcc || 0) / 100)),
                    incorrect: Math.round(assComp * (1 - (assAcc || 0) / 100)),
                    get notAttempted() { return 100 - this.correct - this.incorrect; }
                } : null
            }
        };
    }, [chapterData, nonDeletedAssignments]);

    const handleSave = () => {
        onSave(activeTab, { comp: parseInt(comp), acc: parseInt(acc) });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md modal-animate">
            <div className="bg-slate-800/90 border border-slate-600 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)] max-w-md w-full overflow-hidden backdrop-blur-xl max-h-[90vh] flex flex-col">
              <div className="overflow-y-auto custom-scrollbar flex-1">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-700/50 flex justify-between items-start relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="relative z-10">
                        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">Log Progress</h3>
                        <h2 className="text-xl font-black text-white leading-tight pr-8" title={chapterName}>{truncateWords(chapterName, 8)}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white bg-slate-700/50 p-2 rounded-full transition-colors relative z-10">
                        <i className="ph-bold ph-x"></i>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Tabs */}
                    <div className="flex gap-2 p-1 bg-slate-900/50 rounded-xl mb-8 border border-slate-700/50">
                        {['overview', 'dpp', 'module', 'assignments'].map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all
                                    ${activeTab === tab ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}
                                `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <div className="space-y-5 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Radial/Circular Gauge & standing */}
                            <div className={`p-5 rounded-2xl bg-gradient-to-br ${masterScoreData.bgGradient} border ${masterScoreData.borderGlow} flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                                
                                {/* SVG Circular Gauge */}
                                <div className="relative w-32 h-32 flex items-center justify-center mb-3">
                                    <svg className="w-full h-full transform -rotate-90">
                                        {/* Background ring */}
                                        <circle 
                                            cx="64" 
                                            cy="64" 
                                            r="52" 
                                            stroke="#1e293b" 
                                            strokeWidth="8" 
                                            fill="transparent"
                                        />
                                        {/* Progress ring */}
                                        <circle 
                                            cx="64" 
                                            cy="64" 
                                            r="52" 
                                            stroke={masterScoreData.strokeColor} 
                                            strokeWidth="8" 
                                            fill="transparent"
                                            strokeDasharray={2 * Math.PI * 52}
                                            strokeDashoffset={(2 * Math.PI * 52) * (1 - masterScoreData.masterScore / 100)}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                        />
                                    </svg>
                                    {/* Text in center */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-black text-white leading-none">
                                            {masterScoreData.masterScore}%
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            Master Score
                                        </span>
                                    </div>
                                </div>

                                {/* Standing Badge */}
                                <div className="flex flex-col items-center">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                        Overall Standing
                                    </span>
                                    <span className={`text-sm font-black px-3.5 py-1 rounded-full bg-slate-900/80 border border-slate-700 shadow-md ${masterScoreData.colorClass} tracking-wide`}>
                                        {masterScoreData.standing}
                                    </span>
                                </div>
                            </div>

                            {/* Aggregated Stats (Completion and Accuracy) */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-900/40 border border-slate-750 rounded-xl p-3 flex flex-col items-center text-center">
                                    <span className="text-lg">📊</span>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                        Overall Comp
                                    </span>
                                    <span className="text-lg font-black text-white mt-0.5">
                                        {masterScoreData.overallComp}%
                                    </span>
                                </div>
                                <div className="bg-slate-900/40 border border-slate-750 rounded-xl p-3 flex flex-col items-center text-center">
                                    <span className="text-lg">🎯</span>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                                        Overall Acc
                                    </span>
                                    <span className="text-lg font-black text-white mt-0.5">
                                        {masterScoreData.overallAcc}%
                                    </span>
                                </div>
                            </div>

                            {/* Component Breakdown list */}
                            <div className="bg-slate-900/40 border border-slate-750 rounded-xl p-4 space-y-3">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">
                                    Component Breakdown
                                </h4>
                                
                                {/* DPP Row */}
                                <div className="flex items-center justify-between text-xs">
                                    <div className="min-w-0 flex-1 pr-4">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="font-bold text-slate-300">DPPs</span>
                                            <span className="text-[8px] px-1 py-0.5 bg-slate-800 text-slate-400 rounded">
                                                Weight: {masterScoreData.details.dpp.weight}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex relative z-10">
                                            {masterScoreData.details.dpp.correct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${masterScoreData.details.dpp.correct}%` }} />}
                                            {masterScoreData.details.dpp.incorrect > 0 && <div className="bg-red-500 h-full" style={{ width: `${masterScoreData.details.dpp.incorrect}%` }} />}
                                            {masterScoreData.details.dpp.notAttempted > 0 && <div className="bg-slate-600 h-full" style={{ width: `${masterScoreData.details.dpp.notAttempted}%` }} />}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="font-bold text-slate-200">
                                            Comp: {masterScoreData.details.dpp.comp}%
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            Acc: {masterScoreData.details.dpp.acc}%
                                        </div>
                                    </div>
                                </div>

                                {/* Module Row */}
                                <div className="flex items-center justify-between text-xs border-t border-slate-800/50 pt-2.5">
                                    <div className="min-w-0 flex-1 pr-4">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="font-bold text-slate-300">Interactive Module</span>
                                            <span className="text-[8px] px-1 py-0.5 bg-slate-800 text-slate-400 rounded">
                                                Weight: {masterScoreData.details.module.weight}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex relative z-10">
                                            {masterScoreData.details.module.correct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${masterScoreData.details.module.correct}%` }} />}
                                            {masterScoreData.details.module.incorrect > 0 && <div className="bg-red-500 h-full" style={{ width: `${masterScoreData.details.module.incorrect}%` }} />}
                                            {masterScoreData.details.module.notAttempted > 0 && <div className="bg-slate-600 h-full" style={{ width: `${masterScoreData.details.module.notAttempted}%` }} />}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="font-bold text-slate-200">
                                            Comp: {masterScoreData.details.module.comp}%
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            Acc: {masterScoreData.details.module.acc}%
                                        </div>
                                    </div>
                                </div>

                                {/* Assignments Row */}
                                {masterScoreData.details.assignments && (
                                    <div className="flex items-center justify-between text-xs border-t border-slate-800/50 pt-2.5">
                                        <div className="min-w-0 flex-1 pr-4">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="font-bold text-slate-300">Assignments</span>
                                                <span className="text-[8px] px-1 py-0.5 bg-slate-800 text-slate-400 rounded">
                                                    Weight: {masterScoreData.details.assignments.weight}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex relative z-10">
                                                {masterScoreData.details.assignments.correct > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${masterScoreData.details.assignments.correct}%` }} />}
                                                {masterScoreData.details.assignments.incorrect > 0 && <div className="bg-red-500 h-full" style={{ width: `${masterScoreData.details.assignments.incorrect}%` }} />}
                                                {masterScoreData.details.assignments.notAttempted > 0 && <div className="bg-slate-600 h-full" style={{ width: `${masterScoreData.details.assignments.notAttempted}%` }} />}
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="font-bold text-slate-200">
                                                Comp: {masterScoreData.details.assignments.comp}%
                                            </div>
                                            <div className="text-[10px] text-slate-400">
                                                Acc: {masterScoreData.details.assignments.acc}%
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'module' && (
                        <div className="mb-6 bg-slate-900/60 border border-slate-700/60 rounded-2xl p-5 text-center flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-bitsat-500/10 border border-bitsat-500/20 flex items-center justify-center text-bitsat-400 mb-3 text-xl">
                                🎯
                            </div>
                            <h4 className="text-sm font-bold text-slate-200 mb-1">
                                Interactive Question Tracker
                            </h4>
                            <p className="text-xs text-slate-400 mb-4 max-w-[280px] mx-auto leading-relaxed">
                                Track completion status, difficulty, and bookmarks chapterwise. All progress is automatically synced to your cloud database.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    onOpenTracker();
                                    onClose();
                                }}
                                className="w-full py-3 bg-gradient-to-r from-bitsat-600 to-indigo-650 hover:from-bitsat-500 hover:to-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-950/30 transition-all flex items-center justify-center gap-2"
                            >
                                <i className="ph-bold ph-grid-nine text-sm"></i>
                                Open Interactive Tracker
                            </button>
                        </div>
                    )}

                    {activeTab === 'dpp' && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {/* Completion Stat Card */}
                            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-xl pointer-events-none"></div>
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-2">
                                    <i className="ph-bold ph-chart-pie-slice text-lg"></i>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Completion
                                </span>
                                <span className="text-3xl font-black text-white">
                                    {comp}%
                                </span>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                                    <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${comp}%` }}></div>
                                </div>
                            </div>

                            {/* Accuracy Stat Card */}
                            <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative overflow-hidden backdrop-blur-md">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-2">
                                    <i className="ph-bold ph-target text-lg"></i>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    Avg Accuracy
                                </span>
                                <span className="text-3xl font-black text-white">
                                    {acc}%
                                </span>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${acc}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Manual & Synced</span>
                                <button 
                                    onClick={() => setShowAddForm(!showAddForm)}
                                    className="py-1.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-650 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-emerald-950/20"
                                >
                                    <i className={`ph-bold ${showAddForm ? 'ph-minus' : 'ph-plus'} text-sm`}></i>
                                    {showAddForm ? 'Cancel' : 'Add Assignment'}
                                </button>
                            </div>

                            {showAddForm && (
                                <div className="p-4 bg-slate-900/60 border border-slate-700/60 rounded-2xl space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-200 mb-2">
                                    <h4 className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Add Manual Assignment</h4>
                                    <div className="space-y-2">
                                        <input 
                                            type="text" 
                                            placeholder="Assignment Name (e.g. DPP 01)" 
                                            value={newAssignmentName} 
                                            onChange={(e) => setNewAssignmentName(e.target.value)} 
                                            className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 transition-all"
                                        />
                                        <div className="flex gap-2">
                                            <select 
                                                value={newAssignmentType} 
                                                onChange={(e) => setNewAssignmentType(e.target.value)} 
                                                className="w-1/3 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 transition-all"
                                            >
                                                <option value="DPP">DPP</option>
                                                <option value="Module">Module</option>
                                                <option value="Test">Test</option>
                                                <option value="Notes">Notes</option>
                                                <option value="Custom">+ Custom</option>
                                            </select>
                                            {newAssignmentType === 'Custom' ? (
                                                <input 
                                                    type="text" 
                                                    placeholder="Custom Type" 
                                                    value={newCustomAssignmentType} 
                                                    onChange={(e) => setNewCustomAssignmentType(e.target.value)} 
                                                    className="w-2/3 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 transition-all"
                                                />
                                            ) : (
                                                <input 
                                                    type="url" 
                                                    placeholder="Assignment PDF Link (https://...)" 
                                                    value={newAssignmentLink} 
                                                    onChange={(e) => setNewAssignmentLink(e.target.value)} 
                                                    className="w-2/3 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 transition-all"
                                                />
                                            )}
                                        </div>
                                        {newAssignmentType === 'Custom' && (
                                            <input 
                                                type="url" 
                                                placeholder="Assignment PDF Link (https://...)" 
                                                value={newAssignmentLink} 
                                                onChange={(e) => setNewAssignmentLink(e.target.value)} 
                                                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 text-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 transition-all"
                                            />
                                        )}
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button 
                                            onClick={() => setShowAddForm(false)} 
                                            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={handleSaveNewAssignment} 
                                            className="py-1.5 px-3 bg-gradient-to-r from-emerald-650 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-extrabold rounded-lg transition-all"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {nonDeletedAssignments.length === 0 ? (
                                <div className="text-center bg-slate-900/40 border border-slate-700/50 rounded-2xl p-8 flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3 text-lg">
                                        📄
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-300 mb-1">No Sync'd Assignments</h4>
                                    <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                                        Sync assignments automatically by opening assignment PDFs on PW batches or add manually.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                                    {nonDeletedAssignments.map((assignment) => {
                                        const isEditing = editingAssignmentUrl === normalizeUrl(assignment.url);
                                        return (
                                        <div 
                                            key={assignment.url} 
                                            onClick={() => !isEditing && handleAssignmentCardClick(assignment.originalIdx)}
                                            className={`p-4 bg-slate-950/40 border border-slate-700/50 rounded-2xl hover:bg-slate-900/60 hover:border-slate-600 transition-all backdrop-blur-md relative overflow-hidden ${isEditing ? '' : 'cursor-pointer'}`}
                                            title={isEditing ? '' : 'Click to open Interactive Assignment Question Tracker'}
                                        >
                                            {isEditing ? (
                                                /* Edit Mode: Vertical stacked layout */
                                                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-400 text-base">
                                                            ✏️
                                                        </div>
                                                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Editing Assignment</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={editDraftName}
                                                        onChange={(e) => setEditDraftName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEdit(assignment, e);
                                                            if (e.key === 'Escape') handleCancelEdit(e);
                                                        }}
                                                        className="w-full bg-slate-950/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-200 outline-none focus:border-emerald-500 transition-all"
                                                        placeholder="Assignment Name"
                                                        autoFocus
                                                    />
                                                    <div className="flex gap-2 items-center">
                                                        <select
                                                            value={editDraftType}
                                                            onChange={(e) => setEditDraftType(e.target.value)}
                                                            className="bg-slate-950/60 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500 transition-all"
                                                        >
                                                            <option value="DPP">DPP</option>
                                                            <option value="MODULE">MODULE</option>
                                                            <option value="PYQ">PYQ</option>
                                                            <option value="TEST">TEST</option>
                                                            <option value="Custom">+ Custom</option>
                                                        </select>
                                                        {editDraftType === 'Custom' ? (
                                                            <input
                                                                type="text"
                                                                value={editDraftCustomType}
                                                                onChange={(e) => setEditDraftCustomType(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleSaveEdit(assignment, e);
                                                                    if (e.key === 'Escape') handleCancelEdit(e);
                                                                }}
                                                                placeholder="Custom Type"
                                                                className="bg-slate-950/60 border border-slate-600 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500 transition-all flex-1"
                                                            />
                                                        ) : null}
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={editDraftLink}
                                                        onChange={(e) => setEditDraftLink(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleSaveEdit(assignment, e);
                                                            if (e.key === 'Escape') handleCancelEdit(e);
                                                        }}
                                                        placeholder="PDF Link (https://...)"
                                                        className="w-full bg-slate-950/60 border border-slate-600 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 outline-none focus:border-emerald-500 transition-all"
                                                    />
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={(e) => handleSaveEdit(assignment, e)}
                                                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <i className="ph-bold ph-check text-sm"></i>
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <i className="ph-bold ph-x text-sm"></i>
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Normal Mode: Horizontal layout */
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0 text-orange-400 text-base">
                                                            📄
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-sm font-bold text-slate-200 truncate" title={assignment.name}>
                                                                    {assignment.name}
                                                                </h4>
                                                                {assignment.type && (
                                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex-shrink-0">
                                                                        {assignment.type}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]" title={assignment.url}>
                                                                {assignment.url}
                                                            </p>
                                                            {assignment.selfAnalysis?.isSubmitted ? (
                                                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                        ✓ Report Ready
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700/50">
                                                                        Score: {assignment.selfAnalysis.correctCount * 3 - assignment.selfAnalysis.incorrectCount} / {assignment.questionCount * 3}
                                                                    </span>
                                                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700/50">
                                                                        Time: {formatDetailedTime(assignment.selfAnalysis.elapsedTimeSec || 0)}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                assignment.questionCount > 0 ? (
                                                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                                            ⌛ In Progress
                                                                        </span>
                                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700/50">
                                                                            {Object.values(assignment.questionStates || {}).filter(s => s === 'completed').length} / {assignment.questionCount} Solved
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 mt-1.5">
                                                                        <span className="text-[9px] font-black uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-md">
                                                                            Not Started
                                                                        </span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                        <a 
                                                            href={assignment.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="py-2 px-3 bg-gradient-to-r from-orange-600 to-red-650 hover:from-orange-500 hover:to-red-600 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-orange-950/20"
                                                        >
                                                            <i className="ph-bold ph-arrow-square-out text-sm"></i>
                                                            Open
                                                        </a>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => handleStartEdit(assignment, e)}
                                                            className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800/80 rounded-xl transition-all duration-200"
                                                            title="Edit assignment name"
                                                        >
                                                            <i className="ph-bold ph-pencil-simple text-sm"></i>
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => handleDeleteAssignment(assignment, e)}
                                                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-800/80 rounded-xl transition-all duration-200"
                                                            title="Delete assignment"
                                                        >
                                                            <i className="ph-bold ph-trash text-sm"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chapter-Specific Activity Feed with Averages */}
                    {tabActivities.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i className="ph-fill ph-activity text-sm"></i>
                                Detected {activeTab === 'dpp' ? 'DPP' : 'Module'} Activity ({tabActivities.length})
                            </h4>

                            {/* Average Stats */}
                            {activityAverages && (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {/* Correct : Incorrect ratio */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Correct / Wrong</span>
                                        {activityAverages.hasRatio ? (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-lg font-black text-emerald-400">{activityAverages.totalCorrect}</span>
                                                <span className="text-sm font-bold text-slate-500">/</span>
                                                <span className="text-lg font-black text-rose-400">{activityAverages.totalIncorrect}</span>
                                            </div>
                                        ) : (
                                            <span className="text-lg font-black text-slate-500">N/A</span>
                                        )}
                                    </div>
                                    {/* Avg Accuracy */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Avg Acc</span>
                                        <span className={`text-lg font-black ${activityAverages.avgAcc > 80 ? 'text-emerald-400' : activityAverages.avgAcc > 50 ? 'text-amber-400' : 'text-rose-400'}`}>{activityAverages.avgAcc}%</span>
                                        <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all ${activityAverages.avgAcc > 80 ? 'bg-emerald-500' : activityAverages.avgAcc > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${activityAverages.avgAcc}%` }}></div>
                                        </div>
                                    </div>
                                    {/* Avg Score */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex flex-col items-center">
                                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Avg Score</span>
                                        <span className="text-lg font-black text-blue-400">{activityAverages.avgScore !== null ? `${activityAverages.avgScore}%` : 'N/A'}</span>
                                        {activityAverages.avgScore !== null && (
                                            <div className="w-full bg-slate-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${activityAverages.avgScore}%` }}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Activity Items (clickable) */}
                            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                                {tabActivities.map((act, i) => {
                                    const d = act.details || {};
                                    const isDpp = d.quizType === 'DPP';
                                    return (
                                        <div 
                                            key={act.id || i} 
                                            className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex items-start gap-3 cursor-pointer hover:bg-slate-800 transition-colors"
                                            onClick={() => setSelectedActivity(act)}
                                        >
                                            <div className="mt-0.5 w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 text-sm border border-slate-600">
                                                {isDpp ? '📝' : '⚡'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${isDpp ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                        {d.quizType || 'SCORE'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-medium">
                                                        {new Date(act.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {d.url && (
                                                        <a 
                                                            href={d.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            onClick={(e) => e.stopPropagation()} 
                                                            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 hover:underline ml-auto"
                                                            title={`Go to PW ${d.quizType || 'DPP'}`}
                                                        >
                                                            <i className="ph-bold ph-link"></i> Open PW
                                                        </a>
                                                    )}
                                                    {!d.url && <i className="ph-bold ph-arrow-up-right text-slate-500 text-xs ml-auto"></i>}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-slate-400">Acc: <span className={`font-bold ${d.accuracy > 80 ? 'text-emerald-400' : d.accuracy > 50 ? 'text-amber-400' : 'text-rose-400'}`}>{d.accuracy}%</span></span>
                                                    <span className="text-slate-400">Comp: <span className="font-bold text-slate-200">{d.completion}%</span></span>
                                                    {d.score && <span className="text-slate-400">Score: <span className="font-bold text-blue-400">{d.score}</span></span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
              </div>

                {/* Footer */}
                <div className="p-6 pt-3 pb-5 border-t border-slate-700/50 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] transition-all flex items-center justify-center gap-2"
                    >
                        <i className="ph-bold ph-check-circle"></i> Close
                    </button>
                </div>
            </div>

            {/* Activity Details Popup (same style as GamifiedDashboard) */}
            {selectedActivity && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div 
                        className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-100">{selectedActivity.details.quizType || 'Activity'} Details</h2>
                                    <p className="text-sm text-slate-400 mt-1">{new Date(selectedActivity.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                                </div>
                                <button 
                                    onClick={() => setSelectedActivity(null)}
                                    className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-600 transition-colors"
                                >
                                    <i className="ph-bold ph-x"></i>
                                </button>
                            </div>

                            <div className="bg-slate-900 rounded-xl p-4 mb-6 border border-slate-700">
                                <h3 className="text-sm font-bold text-slate-300 mb-1">Title</h3>
                                <p className="text-slate-100 font-medium leading-snug">{selectedActivity.details.title}</p>
                            </div>

                            {selectedActivity.details.url && (
                                <div className="mb-6">
                                    <a 
                                        href={selectedActivity.details.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-[1.01]"
                                    >
                                        <i className="ph-bold ph-link-simple"></i> Open PW Specific {selectedActivity.details.quizType || 'DPP'}
                                    </a>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Score</span>
                                    <span className="text-2xl font-black text-blue-400">{selectedActivity.details.score || 'N/A'}</span>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Accuracy</span>
                                    <span className={`text-2xl font-black ${selectedActivity.details.accuracy > 80 ? 'text-emerald-400' : selectedActivity.details.accuracy > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                        {selectedActivity.details.accuracy}%
                                    </span>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Correct</span>
                                    <span className="text-xl font-bold text-emerald-400">{selectedActivity.details.correct || 'N/A'}</span>
                                </div>
                                <div className="bg-slate-700/50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-600/50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Incorrect</span>
                                    <span className="text-xl font-bold text-rose-400">{selectedActivity.details.incorrect || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-slate-900 px-5 py-4 rounded-xl border border-slate-700">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Time Taken</span>
                                    <span className="font-mono text-slate-300 font-bold">{selectedActivity.details.timeTaken || 'N/A'}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-700"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Completion</span>
                                    <span className="text-slate-300 font-bold">{selectedActivity.details.completion}%</span>
                                </div>
                            </div>

                            {/* Action Buttons for Activity Details */}
                            <div className="mt-6">
                                <button 
                                    onClick={() => setSelectedActivity(null)}
                                    className="w-full py-3.5 bg-slate-700/50 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-sm border border-slate-600/50"
                                >
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressModal;
