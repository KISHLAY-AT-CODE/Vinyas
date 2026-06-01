import fs from 'fs';
import path from 'path';

export function loadTemplate(cohortName) {
  if (!cohortName) return null;
  const filename = cohortName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
  const filePath = path.join(process.cwd(), 'templates', filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      return parsed.subjects || null;
    }
  } catch (err) {
    console.error(`Failed to load template ${cohortName} from ${filePath}:`, err);
  }
  return null;
}

export function serializeSyllabus(userData, baseTemplate) {
  if (!baseTemplate || !Array.isArray(userData)) {
    return { isRaw: true, data: userData };
  }

  const additions = [];
  const deletions = [];
  const progressList = [];

  userData.forEach(sub => {
    if (!sub || !sub.name) return;
    const baseSub = baseTemplate.find(s => s.name.trim().toLowerCase() === sub.name.trim().toLowerCase());
    
    if (!baseSub) {
      // Custom subject added by user
      additions.push({
        type: 'subject',
        subjectName: sub.name,
        color: sub.color,
        bookUrl: sub.bookUrl,
        bookName: sub.bookName,
        books: sub.books || [],
        chapters: sub.chapters
      });
      return;
    }

    // Check for deleted chapters
    baseSub.chapters.forEach(baseCh => {
      const userCh = sub.chapters.find(c => c.name.trim().toLowerCase() === baseCh.name.trim().toLowerCase());
      if (!userCh) {
        deletions.push({
          subjectName: sub.name,
          chapterName: baseCh.name
        });
      }
    });

    // Check for custom added chapters and active progress
    sub.chapters.forEach(userCh => {
      const baseCh = baseSub.chapters.find(c => c.name.trim().toLowerCase() === userCh.name.trim().toLowerCase());
      
      if (!baseCh) {
        // Custom chapter added by user
        additions.push({
          type: 'chapter',
          subjectName: sub.name,
          chapter: userCh
        });
      } else {
        // Base template chapter - check if it has active progress or synced module questions
        const hasProgress = 
          userCh.status !== 'None' || 
          userCh.lectures > 0 || 
          (userCh.log && userCh.log.trim() !== '') || 
          (userCh.dpp && (userCh.dpp.acc > 0 || userCh.dpp.comp > 0)) || 
          (userCh.module && (userCh.module.acc > 0 || userCh.module.comp > 0)) ||
          (userCh.dppLogs && Object.keys(userCh.dppLogs).length > 0) ||
          (userCh.moduleLogs && Object.keys(userCh.moduleLogs).length > 0) ||
          (userCh.customExerciseConfig && Object.keys(userCh.customExerciseConfig).length > 0) ||
          (userCh.exerciseDisplayNames && Object.keys(userCh.exerciseDisplayNames).length > 0) ||
          (userCh.moduleQuestionStates && Object.keys(userCh.moduleQuestionStates).length > 0) ||
          (userCh.focusTime > 0) ||
          (userCh.reviewsDone > 0) ||
          (userCh.nextReview && userCh.nextReview.trim() !== '') ||
          (userCh.lastReviewRating && userCh.lastReviewRating.trim() !== '') ||
          (userCh.assignments && userCh.assignments.length > 0);

        if (hasProgress) {
          progressList.push({
            subjectName: sub.name,
            chapterName: userCh.name,
            progress: {
              status: userCh.status,
              lectures: userCh.lectures,
              log: userCh.log,
              dpp: userCh.dpp,
              module: userCh.module,
              dppLogs: userCh.dppLogs,
              moduleLogs: userCh.moduleLogs,
              customExerciseConfig: userCh.customExerciseConfig,
              exerciseDisplayNames: userCh.exerciseDisplayNames,
              moduleQuestionStates: userCh.moduleQuestionStates,
              focusTime: userCh.focusTime,
              reviewsDone: userCh.reviewsDone,
              nextReview: userCh.nextReview,
              lastReviewRating: userCh.lastReviewRating,
              assignments: userCh.assignments || []
            }
          });
        }
      }
    });
  });

  return {
    isRaw: false,
    additions,
    deletions,
    progressList,
    subjectColors: userData.map(s => ({ name: s.name, color: s.color, bookUrl: s.bookUrl, bookName: s.bookName, books: s.books || [] }))
  };
}

export function deserializeSyllabus(serialized, baseTemplate) {
  if (!serialized) return [];
  if (Array.isArray(serialized)) return serialized;
  if (serialized.isRaw) return serialized.data || [];

  if (!baseTemplate) {
    const reconstructed = [];
    const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];

    // 1. Reconstruct custom subjects first
    if (serialized.additions && Array.isArray(serialized.additions)) {
      serialized.additions.forEach(add => {
        if (add.type === 'subject') {
          reconstructed.push({
            name: add.subjectName,
            color: add.color || "bg-indigo-600",
            bookUrl: add.bookUrl,
            bookName: add.bookName,
            books: add.books || [],
            chapters: add.chapters || []
          });
        }
      });
    }

    // 2. Reconstruct from progressList (base template chapters with progress)
    if (serialized.progressList && Array.isArray(serialized.progressList)) {
      serialized.progressList.forEach(p => {
        let sub = reconstructed.find(s => s.name.trim().toLowerCase() === p.subjectName.trim().toLowerCase());
        if (!sub) {
          const savedColorObj = serialized.subjectColors?.find(c => c.name.trim().toLowerCase() === p.subjectName.toLowerCase());
          const color = savedColorObj ? savedColorObj.color : COLORS[reconstructed.length % COLORS.length];
          sub = {
            name: p.subjectName,
            color,
            bookUrl: savedColorObj?.bookUrl,
            bookName: savedColorObj?.bookName,
            books: savedColorObj?.books || [],
            chapters: []
          };
          reconstructed.push(sub);
        }
        
        const exists = sub.chapters.some(c => c.name.trim().toLowerCase() === p.chapterName.trim().toLowerCase());
        if (!exists) {
          sub.chapters.push({
            name: p.chapterName,
            status: p.progress.status || 'None',
            lectures: p.progress.lectures || 0,
            log: p.progress.log || '',
            dpp: p.progress.dpp || { acc: 0, comp: 0 },
            module: p.progress.module || { acc: 0, comp: 0 },
            dppLogs: p.progress.dppLogs || {},
            moduleLogs: p.progress.moduleLogs || {},
            customExerciseConfig: p.progress.customExerciseConfig || null,
            exerciseDisplayNames: p.progress.exerciseDisplayNames || null,
            moduleQuestionStates: p.progress.moduleQuestionStates || {},
            focusTime: p.progress.focusTime || 0,
            reviewsDone: p.progress.reviewsDone || 0,
            nextReview: p.progress.nextReview || null,
            lastReviewRating: p.progress.lastReviewRating || null,
            assignments: p.progress.assignments || []
          });
        }
      });
    }

    // 3. Reconstruct custom chapters second
    if (serialized.additions && Array.isArray(serialized.additions)) {
      serialized.additions.forEach(add => {
        if (add.type === 'chapter') {
          let sub = reconstructed.find(s => s.name.trim().toLowerCase() === add.subjectName.trim().toLowerCase());
          if (!sub) {
            const savedColorObj = serialized.subjectColors?.find(c => c.name.trim().toLowerCase() === add.subjectName.toLowerCase());
            const color = savedColorObj ? savedColorObj.color : COLORS[reconstructed.length % COLORS.length];
            sub = {
              name: add.subjectName,
              color,
              bookUrl: savedColorObj?.bookUrl,
              bookName: savedColorObj?.bookName,
              books: savedColorObj?.books || [],
              chapters: []
            };
            reconstructed.push(sub);
          }
          const exists = sub.chapters.some(c => c.name.trim().toLowerCase() === add.chapter.name.trim().toLowerCase());
          if (!exists) {
            sub.chapters.push(add.chapter);
          }
        }
      });
    }

    return reconstructed;
  }

  const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
  
  // 1. Build initial list from baseTemplate
  const reconstructed = baseTemplate.map((baseSub, idx) => {
    const savedColorObj = serialized.subjectColors?.find(c => c.name.trim().toLowerCase() === baseSub.name.toLowerCase());
    const color = savedColorObj ? savedColorObj.color : COLORS[idx % COLORS.length];
    const bookUrl = savedColorObj?.bookUrl;
    const bookName = savedColorObj?.bookName;
    const books = savedColorObj?.books || [];

    // Filter chapters (remove deletions)
    const filteredChapters = baseSub.chapters
      .filter(baseCh => {
        const isDeleted = serialized.deletions?.some(d => 
          d.subjectName.trim().toLowerCase() === baseSub.name.trim().toLowerCase() &&
          d.chapterName.trim().toLowerCase() === baseCh.name.trim().toLowerCase()
        );
        return !isDeleted;
      })
      .map(baseCh => {
        // Find if there is saved progress
        const savedProgress = serialized.progressList?.find(p => 
          p.subjectName.trim().toLowerCase() === baseSub.name.trim().toLowerCase() &&
          p.chapterName.trim().toLowerCase() === baseCh.name.trim().toLowerCase()
        );

        if (savedProgress) {
          return {
            name: baseCh.name,
            status: savedProgress.progress.status || 'None',
            lectures: savedProgress.progress.lectures || 0,
            log: savedProgress.progress.log || '',
            dpp: savedProgress.progress.dpp || { acc: 0, comp: 0 },
            module: savedProgress.progress.module || { acc: 0, comp: 0 },
            dppLogs: savedProgress.progress.dppLogs || {},
            moduleLogs: savedProgress.progress.moduleLogs || {},
            customExerciseConfig: savedProgress.progress.customExerciseConfig || null,
            exerciseDisplayNames: savedProgress.progress.exerciseDisplayNames || null,
            moduleQuestionStates: savedProgress.progress.moduleQuestionStates || {},
            focusTime: savedProgress.progress.focusTime || 0,
            reviewsDone: savedProgress.progress.reviewsDone || 0,
            nextReview: savedProgress.progress.nextReview || null,
            lastReviewRating: savedProgress.progress.lastReviewRating || null,
            assignments: savedProgress.progress.assignments || []
          };
        }

        // Untouched chapter default state
        return {
          name: baseCh.name,
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
      });

    return {
      name: baseSub.name,
      color,
      bookUrl,
      bookName,
      books,
      chapters: filteredChapters
    };
  });

  // 2. Apply custom additions
  if (serialized.additions && Array.isArray(serialized.additions)) {
    serialized.additions.forEach(add => {
      if (add.type === 'subject') {
        reconstructed.push({
          name: add.subjectName,
          color: add.color || "bg-indigo-600",
          bookUrl: add.bookUrl,
          bookName: add.bookName,
          chapters: add.chapters || []
        });
      } else if (add.type === 'chapter') {
        const sub = reconstructed.find(s => s.name.trim().toLowerCase() === add.subjectName.trim().toLowerCase());
        if (sub) {
          sub.chapters.push(add.chapter);
        } else {
          const savedColorObj = serialized.subjectColors?.find(c => c.name.trim().toLowerCase() === add.subjectName.toLowerCase());
          reconstructed.push({
            name: add.subjectName,
            color: savedColorObj ? savedColorObj.color : "bg-indigo-600",
            bookUrl: savedColorObj?.bookUrl,
            bookName: savedColorObj?.bookName,
            books: savedColorObj?.books || [],
            chapters: [add.chapter]
          });
        }
      }
    });
  }

  return reconstructed;
}
