import { normalizeChapterName } from './normalize.js';
import { getISTDateString } from './time.js';

// Dynamic default date helper (100 days from today)
export const getDefaultTargetDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 100);
    return date.toISOString().split('T')[0];
};

// Framer Motion slide variants for the carousel
export const slideVariants = {
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
export const findChapterByName = (data, searchName) => {
    if (!data || !Array.isArray(data) || !searchName) return null;
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return null;
    
    // Priority 1: Exact normalized match
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            const ch = data[sIdx].chapters[cIdx];
            if (!ch) continue;
            const namesToCheck = [ch.name];
            if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
            for (const key of Object.keys(ch)) {
                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                    namesToCheck.push(ch[key]);
                }
            }
            for (const name of namesToCheck) {
                if (normalizeChapterName(name) === qNormalized) {
                    return { sIdx, cIdx };
                }
            }
        }
    }
    
    // Priority 2: Collect substring/fuzzy matches and return the one with the longest normalized name (most specific)
    const candidates = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            const ch = data[sIdx].chapters[cIdx];
            if (!ch) continue;
            const namesToCheck = [ch.name];
            if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
            for (const key of Object.keys(ch)) {
                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                    namesToCheck.push(ch[key]);
                }
            }
            for (const name of namesToCheck) {
                const chNameNormalized = normalizeChapterName(name);
                if (chNameNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                    candidates.push({
                        sIdx,
                        cIdx,
                        length: chNameNormalized.length
                    });
                    break;
                }
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
export const findAllChaptersByName = (data, searchName) => {
    if (!data || !Array.isArray(data) || !searchName) return [];
    const qNormalized = normalizeChapterName(searchName);
    if (!qNormalized) return [];
    
    // Priority 1: Exact normalized matches
    const exactMatches = [];
    for (let sIdx = 0; sIdx < data.length; sIdx++) {
        if (!data[sIdx] || !data[sIdx].chapters) continue;
        for (let cIdx = 0; cIdx < data[sIdx].chapters.length; cIdx++) {
            const ch = data[sIdx].chapters[cIdx];
            if (!ch) continue;
            const namesToCheck = [ch.name];
            if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
            for (const key of Object.keys(ch)) {
                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                    namesToCheck.push(ch[key]);
                }
            }
            for (const name of namesToCheck) {
                if (normalizeChapterName(name) === qNormalized) {
                    exactMatches.push({ sIdx, cIdx });
                    break;
                }
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
            const ch = data[sIdx].chapters[cIdx];
            if (!ch) continue;
            const namesToCheck = [ch.name];
            if (Array.isArray(ch.altNames)) namesToCheck.push(...ch.altNames);
            for (const key of Object.keys(ch)) {
                if (key.toLowerCase().startsWith('altname') && typeof ch[key] === 'string') {
                    namesToCheck.push(ch[key]);
                }
            }
            for (const name of namesToCheck) {
                const chNameNormalized = normalizeChapterName(name);
                if (chNameNormalized.length > 2 && (chNameNormalized.includes(qNormalized) || qNormalized.includes(chNameNormalized))) {
                    candidates.push({
                        sIdx,
                        cIdx,
                        length: chNameNormalized.length
                    });
                    break;
                }
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
export const extractChapterFromDppTitle = (title) => {
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
export const extractChapterFromModuleUrl = (url) => {
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

export const rc4DecryptHex = (keyStr, hexStr) => {
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

export const generateSecureSyncId = () => {
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
export const applyActivitiesToChapter = (chapter, activities, targetChapterSearch, specificActivityId = null) => {
    const updatedChapter = { ...chapter };
    const linkedActIds = [];

    activities.forEach(act => {
        if (act.type !== 'DPP_SCORE' && act.type !== 'PW_BOOKS_QUESTIONS' && act.type !== 'ASSIGNMENT_SUBMISSION') return;
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
        } else if (act.type === 'ASSIGNMENT_SUBMISSION') {
            actChapterSearch = act.details?.chapterName;
            actSection = 'assignments';
        }

        const actNorm = normalizeChapterName(actChapterSearch);
        const targetNorm = normalizeChapterName(targetChapterSearch);

        if (actNorm && targetNorm && actNorm === targetNorm) {
            linkedActIds.push(act.id);

            if (act.type === 'PW_BOOKS_QUESTIONS') {
                updatedChapter.customExerciseConfig = act.details.exercises;
                updatedChapter.exerciseDisplayNames = act.details.displayNames;
            } else if (act.type === 'ASSIGNMENT_SUBMISSION') {
                if (!updatedChapter.assignments) {
                    updatedChapter.assignments = [];
                }
                if (!updatedChapter.assignments.some(a => a.url === act.details.url)) {
                    updatedChapter.assignments.push({ name: act.details.assignmentName, url: act.details.url });
                }
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
