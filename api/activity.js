import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from '../src/shared/time.js';
import { normalizeChapterName } from '../src/shared/normalize.js';
import { resolveUser, hashSyncId } from './shared/auth.js';
import { deserializeSyllabus, serializeSyllabus, loadTemplate } from './shared/syllabus.js';

function normalizeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    let u = urlStr.trim().toLowerCase();
    
    // Normalize domains
    u = u.replace('books.physicswallah.live', 'books.pw.live');
    u = u.replace('www.physicswallah.live', 'pw.live');
    u = u.replace('physicswallah.live', 'pw.live');
    u = u.replace('www.pw.live', 'pw.live');
    
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      u = 'https://' + u;
    }
    
    const urlObj = new URL(u);
    
    // Remove dynamic query params
    const paramsToRemove = ['token', 'time', 'session', 'index', 'utm', 'reattempt', 'type', 'referrer'];
    paramsToRemove.forEach(p => {
      urlObj.searchParams.delete(p);
    });
    
    // Sort query parameters
    const keys = Array.from(urlObj.searchParams.keys()).sort();
    const sortedParams = new URLSearchParams();
    keys.forEach(k => {
      sortedParams.set(k, urlObj.searchParams.get(k));
    });
    urlObj.search = sortedParams.toString();
    urlObj.hash = '';
    
    return urlObj.toString();
  } catch (e) {
    return urlStr;
  }
}

// normalizeChapterName imported from shared module

export default async function handler(req, res) {
  // Setup CORS to allow requests from the Chrome Extension & specific origins
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  const allowedOriginsEnv = process.env.ALLOWED_CORS_ORIGINS ? process.env.ALLOWED_CORS_ORIGINS.split(',') : [];
  
  const isAllowed = origin && (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('http://localhost:') ||
    origin.endsWith('.vercel.app') ||
    allowedOriginsEnv.includes(origin)
  );
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Enforce body size limit of 500KB for activity payloads
  const contentLength = req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : 0;
  if (contentLength > 500 * 1024 || (req.body && JSON.stringify(req.body).length > 500 * 1024)) {
    return res.status(413).json({ error: 'Payload too large (limit is 500KB)' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');

    if (req.method === 'POST') {
      const { syncId: rawSyncId, type, details, timestamp } = req.body;
      
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const rawSyncIdTrimmed = String(rawSyncId).trim();
      if (!rawSyncIdTrimmed) return res.status(400).json({ error: 'syncId cannot be empty' });

      const existingDoc = await resolveUser(db, rawSyncIdTrimmed);
      const isSecure = rawSyncIdTrimmed.startsWith('vny_sec_') || rawSyncIdTrimmed.startsWith('vny_sess_');

      if (!isSecure && !existingDoc) {
        return res.status(400).json({ 
          error: 'Security Enforcement: The Sync ID provided is not secure and does not exist in the database. Activity logging requires a secure cryptographically generated Sync ID.' 
        });
      }

      const syncId = existingDoc ? existingDoc.syncId : hashSyncId(rawSyncIdTrimmed);

      if (existingDoc) {
        if (existingDoc.logoutTimestamp) {
          console.log(`[Vinyas Inactivity] User ${existingDoc.syncId} logged active via POST activity. Resetting inactivity countdown and warning flags. Previous logoutTimestamp: ${existingDoc.logoutTimestamp}`);
        }
        await collection.updateOne({ syncId }, { $unset: { logoutTimestamp: "", alertSent: "" } });
      }

      if (type === 'ADD_ASSIGNMENT') {
        const { chapterName, assignmentName, url } = details || {};
        if (!chapterName || !assignmentName || !url) {
          return res.status(400).json({ error: 'Missing chapterName, assignmentName, or url' });
        }

        if (!existingDoc) {
          return res.status(400).json({ error: 'User profile does not exist to add assignment' });
        }

        const baseTemplate = loadTemplate(existingDoc.cohort);
        let syllabusData = deserializeSyllabus(existingDoc.data, baseTemplate);

        const normSearchName = normalizeChapterName(chapterName);
        let found = false;

        for (const sub of syllabusData) {
          for (const ch of sub.chapters) {
            if (normalizeChapterName(ch.name) === normSearchName) {
              if (!ch.assignments) {
                ch.assignments = [];
              }
              // Avoid duplicates
              if (!ch.assignments.some(a => a.url === url)) {
                ch.assignments.push({ name: assignmentName, url });
              }
              found = true;
              break;
            }
          }
          if (found) break;
        }

        if (!found) {
          const activityLog = {
            id: Date.now().toString(),
            type: 'ASSIGNMENT_SUBMISSION',
            details: { chapterName, assignmentName, url },
            timestamp: getISTISOString()
          };
          await collection.updateOne(
            { syncId }, 
            { 
              $push: { 
                activities: { 
                  $each: [activityLog],
                  $sort: { timestamp: -1 },
                  $slice: 50
                } 
              } 
            }
          );
          return res.status(200).json({ success: true, unresolved: true });
        }

        const serializedData = serializeSyllabus(syllabusData, baseTemplate);
        await collection.updateOne(
          { syncId },
          { $set: { data: serializedData, lastUpdated: getISTISOString() } }
        );

        return res.status(200).json({ success: true });
      }

      if (type === 'INTERACTIVE_QUESTION_UPDATE') {
        const { subjectName, chapterName, exerciseName, questionNumber, state } = details || {};
        if (!subjectName || !chapterName || !exerciseName || !questionNumber) {
          return res.status(400).json({ error: 'Missing subjectName, chapterName, exerciseName, or questionNumber' });
        }

        if (!existingDoc) {
          return res.status(400).json({ error: 'User profile does not exist to update interactive question status' });
        }

        const baseTemplate = loadTemplate(existingDoc.cohort);
        let syllabusData = deserializeSyllabus(existingDoc.data, baseTemplate);

        let matchedSubjectIdx = -1;
        let matchedChapterIdx = -1;

        for (let sIdx = 0; sIdx < syllabusData.length; sIdx++) {
          const sub = syllabusData[sIdx];
          const normSubAct = subjectName.toLowerCase().trim();
          const normSubSyll = sub.name.toLowerCase().trim();
          if (normSubSyll.includes(normSubAct) || normSubAct.includes(normSubSyll) ||
              (normSubAct.includes('math') && normSubSyll.includes('math')) ||
              (normSubAct.includes('phys') && normSubSyll.includes('phys')) ||
              (normSubAct.includes('chem') && normSubSyll.includes('chem'))
          ) {
            const normChAct = normalizeChapterName(chapterName);
            const cIdx = sub.chapters.findIndex(ch => normalizeChapterName(ch.name) === normChAct);
            if (cIdx !== -1) {
              matchedSubjectIdx = sIdx;
              matchedChapterIdx = cIdx;
              break;
            } else {
              const candidates = [];
              sub.chapters.forEach((ch, chIdx) => {
                const chNorm = normalizeChapterName(ch.name);
                if (chNorm.length > 2 && (chNorm.includes(normChAct) || normChAct.includes(chNorm))) {
                  candidates.push({ chIdx, name: ch.name, length: chNorm.length });
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
          const sub = syllabusData[matchedSubjectIdx];
          const ch = sub.chapters[matchedChapterIdx];
          
          const normalizeSub = (name) => {
            const s = (name || '').toLowerCase().trim();
            if (s.includes('math')) return 'Maths';
            if (s.includes('phys')) return 'Physics';
            if (s.includes('chem')) return 'Chem';
            return name || '';
          };
          const normSubName = normalizeSub(sub.name);
          
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
          
          if (!ch.moduleQuestionStates) {
            ch.moduleQuestionStates = {};
          }

          if (state === 'none') {
            delete ch.moduleQuestionStates[key];
          } else {
            ch.moduleQuestionStates[key] = state;
          }

          // Recompute stats
          const exercisesConfig = ch.customExerciseConfig || {};
          let completed = 0;
          let difficult = 0;
          let later = 0;
          let total = 0;

          Object.entries(exercisesConfig).forEach(([exName, qCount]) => {
            total += qCount;
            for (let q = 1; q <= qCount; q++) {
              const qKey = getQuestionKey(exName, q);
              if (ch.moduleQuestionStates[qKey]) {
                if (ch.moduleQuestionStates[qKey] === 'completed') completed++;
                else if (ch.moduleQuestionStates[qKey] === 'difficult') difficult++;
                else if (ch.moduleQuestionStates[qKey] === 'later') later++;
              }
            }
          });

          const finalComp = total > 0 ? Math.round((completed / total) * 100) : 0;
          const totalTracked = completed + difficult + later;
          const finalAcc = totalTracked > 0 ? Math.round((completed / totalTracked) * 100) : 0;

          ch.module = {
            ...(ch.module || {}),
            comp: finalComp,
            acc: finalAcc
          };

          const serializedData = serializeSyllabus(syllabusData, baseTemplate);
          
          // Generate a fresh activity log ID so the React App sees it as a new update and matches it reactively
          const freshId = Date.now().toString();
          const activityLog = {
            id: freshId,
            type,
            details,
            timestamp: getISTISOString()
          };

          await collection.updateOne(
            { syncId },
            { 
              $set: { data: serializedData, lastUpdated: getISTISOString() },
              $push: { 
                activities: { 
                  $each: [activityLog],
                  $sort: { timestamp: -1 },
                  $slice: 50
                } 
              }
            }
          );

          return res.status(200).json({ success: true });
        } else {
          return res.status(404).json({ error: 'Chapter/Subject not found in syllabus' });
        }
      }

      // URL-based deduplication for DPP/Module submissions
      if (type === 'DPP_SCORE' && details?.url) {
        // If it's a MODULE, extract chapterTitle from URL to avoid generic "Exercise" titles overwriting each other
        if (details.quizType === 'MODULE') {
          const match = details.url.match(/chapterTitle=([^&]+)/);
          if (match) {
            let raw = match[1].replace(/\+/g, ' ');
            try { raw = decodeURIComponent(raw); } catch (e) {}
            details.title = `Module - ${raw.trim()}`;
          }
        }

        // Priority 1: Reattempt handling — update existing entry with matching title
        if (details.url.includes('type=Reattempt') && details.title) {
          const titleMatch = await collection.findOne({
            syncId,
            'activities.type': 'DPP_SCORE',
            'activities.details.title': details.title
          });
          if (titleMatch) {
            await collection.updateOne(
              { syncId, 'activities.details.title': details.title, 'activities.type': 'DPP_SCORE' },
              { $set: {
                'activities.$.details': details,
                'activities.$.timestamp': timestamp || getISTISOString()
              }}
            );
            return res.status(200).json({ success: true, reattempt: true });
          }
        }

        // Priority 2: Normalized URL duplicate check
        const userDocForPost = await collection.findOne({ syncId }, { projection: { activities: 1 } });
        const existingActivities = userDocForPost?.activities || [];
        const normPayloadUrl = normalizeUrl(details.url);
        const existingAct = existingActivities.find(act => 
          act.type === 'DPP_SCORE' && 
          act.details?.url && 
          normalizeUrl(act.details.url) === normPayloadUrl
        );

        if (existingAct) {
          if (details.forceUpdate) {
            const freshId = Date.now().toString();
            // Bypass deduplication, update existing entry matched by activity ID and refresh its ID to trigger react updates
            await collection.updateOne(
              { syncId, 'activities.id': existingAct.id, 'activities.type': 'DPP_SCORE' },
              { $set: {
                'activities.$.id': freshId,
                'activities.$.details': details,
                'activities.$.timestamp': timestamp || getISTISOString()
              }}
            );
            return res.status(200).json({ success: true, updated: true });
          } else {
            return res.status(200).json({ success: true, duplicate: true });
          }
        }
      }

      // URL-based deduplication for PW Books questions configs
      if (type === 'PW_BOOKS_QUESTIONS' && details?.url) {
        const userDocForPost = await collection.findOne({ syncId }, { projection: { activities: 1 } });
        const existingActivities = userDocForPost?.activities || [];
        const normPayloadUrl = normalizeUrl(details.url);
        const existingAct = existingActivities.find(act => 
          act.type === 'PW_BOOKS_QUESTIONS' && 
          act.details?.url && 
          normalizeUrl(act.details.url) === normPayloadUrl
        );

        if (existingAct) {
          if (details.forceUpdate) {
            const freshId = Date.now().toString();
            // Bypass deduplication, update existing entry matched by activity ID and refresh its ID to trigger react updates
            await collection.updateOne(
              { syncId, 'activities.id': existingAct.id, 'activities.type': 'PW_BOOKS_QUESTIONS' },
              { $set: {
                'activities.$.id': freshId,
                'activities.$.details': details,
                'activities.$.timestamp': timestamp || getISTISOString()
              }}
            );
            return res.status(200).json({ success: true, updated: true });
          } else {
            return res.status(200).json({ success: true, duplicate: true });
          }
        }
      }



      const activityLog = {
        id: Date.now().toString(),
        type,
        details,
        timestamp: timestamp || getISTISOString()
      };

      // Push to the activities array, keep only the latest 50
      await collection.updateOne(
        { syncId }, 
        { 
          $push: { 
            activities: { 
              $each: [activityLog],
              $sort: { timestamp: -1 },
              $slice: 50
            } 
          } 
        },
        { upsert: true }
      );

      return res.status(200).json({ success: true, log: activityLog });
    }

    if (req.method === 'GET') {
      const { syncId: rawSyncId, date, checkUrl, checkAssignmentUrl } = req.query;
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const rawSyncIdTrimmed = String(rawSyncId).trim();
      if (!rawSyncIdTrimmed) return res.status(400).json({ error: 'syncId cannot be empty' });

      const userDoc = await resolveUser(db, rawSyncIdTrimmed);
      if (!userDoc) return res.status(401).json({ error: 'Unauthorized: Invalid session or sync ID' });
      const syncId = userDoc.syncId;

      if (checkAssignmentUrl) {
        const normCheckUrl = normalizeUrl(checkAssignmentUrl);
        const syllabus = userDoc.data || {};
        let exists = false;

        if (syllabus.isRaw && Array.isArray(syllabus.data)) {
          exists = syllabus.data.some(sub => 
            sub.chapters?.some(ch => 
              ch.assignments?.some(a => normalizeUrl(a.url) === normCheckUrl)
            )
          );
        } else if (Array.isArray(syllabus)) {
          exists = syllabus.some(sub => 
            sub.chapters?.some(ch => 
              ch.assignments?.some(a => normalizeUrl(a.url) === normCheckUrl)
            )
          );
        } else {
          const inProgress = syllabus.progressList?.some(p => 
            p.progress?.assignments?.some(a => normalizeUrl(a.url) === normCheckUrl)
          );
          const inAdditions = syllabus.additions?.some(add => 
            add.type === 'chapter' && 
            add.chapter?.assignments?.some(a => normalizeUrl(a.url) === normCheckUrl)
          );
          exists = !!(inProgress || inAdditions);
        }

        return res.status(200).json({ exists });
      }

      if (checkUrl) {
        // Find if a normalized matching URL exists in the database for the given syncId
        const activities = userDoc.activities || [];
        const normCheckUrl = normalizeUrl(checkUrl);
        let exists = activities.some(act => {
          if (act.type === 'BOOK_CHAPTER_SUBMISSION') {
            return act.details?.chapterUrl && normalizeUrl(act.details.chapterUrl) === normCheckUrl;
          }
          return (act.type === 'DPP_SCORE' || act.type === 'PW_BOOKS_QUESTIONS' || act.type === 'BOOK_SUBMISSION') && 
            act.details?.url && 
            normalizeUrl(act.details.url) === normCheckUrl;
        });

        if (!exists) {
          const syllabus = userDoc.data || {};
          if (syllabus.isRaw && Array.isArray(syllabus.data)) {
            exists = syllabus.data.some(sub => 
              sub.books?.some(b => 
                b.chapters && Object.values(b.chapters).some(chUrl => normalizeUrl(chUrl) === normCheckUrl)
              )
            );
          } else {
            const inColors = syllabus.subjectColors?.some(sub => 
              sub.books?.some(b => 
                b.chapters && Object.values(b.chapters).some(chUrl => normalizeUrl(chUrl) === normCheckUrl)
              )
            );
            const inAdditions = syllabus.additions?.some(add => 
              add.type === 'subject' && 
              add.books?.some(b => 
                b.chapters && Object.values(b.chapters).some(chUrl => normalizeUrl(chUrl) === normCheckUrl)
              )
            );
            exists = !!(inColors || inAdditions);
          }
        }

        // For books/module practice pages, check if the chapter exercises are already configured in the syllabus.
        // If they are already configured, we force exists = true to bypass prompts.
        // If not configured, we force exists = false to allow syncing.
        if (checkUrl.includes('chapterTitle=')) {
          const match = checkUrl.match(/chapterTitle=([^&]+)/);
          if (match) {
            let raw = match[1].replace(/\+/g, ' ');
            try { raw = decodeURIComponent(raw); } catch (e) {}
            const chapterSearchName = raw.trim();
            const normSearchName = normalizeChapterName(chapterSearchName);
            
            const syllabus = userDoc.data || {};
            let isConfigured = false;
            
            if (syllabus.isRaw && Array.isArray(syllabus.data)) {
              isConfigured = syllabus.data.some(sub => 
                sub.chapters?.some(ch => 
                  normalizeChapterName(ch.name) === normSearchName && 
                  ch.customExerciseConfig && 
                  Object.keys(ch.customExerciseConfig).length > 0
                )
              );
            } else if (Array.isArray(syllabus)) {
              isConfigured = syllabus.some(sub => 
                sub.chapters?.some(ch => 
                  normalizeChapterName(ch.name) === normSearchName && 
                  ch.customExerciseConfig && 
                  Object.keys(ch.customExerciseConfig).length > 0
                )
              );
            } else {
              const inProgress = syllabus.progressList?.some(p => 
                normalizeChapterName(p.chapterName) === normSearchName && 
                p.progress?.customExerciseConfig && 
                Object.keys(p.progress.customExerciseConfig).length > 0
              );
              const inAdditions = syllabus.additions?.some(add => 
                add.type === 'chapter' && 
                normalizeChapterName(add.chapter?.name) === normSearchName && 
                add.chapter?.customExerciseConfig && 
                Object.keys(add.chapter.customExerciseConfig).length > 0
              );
              isConfigured = !!(inProgress || inAdditions);
            }
            
            exists = isConfigured;
          }
        }

        return res.status(200).json({ exists });
      }

      if (userDoc && userDoc.logoutTimestamp) {
        console.log(`[Vinyas Inactivity] User ${userDoc.syncId} logged active via GET activities. Resetting inactivity countdown and warning flags. Previous logoutTimestamp: ${userDoc.logoutTimestamp}`);
      }
      await collection.updateOne({ syncId }, { $unset: { logoutTimestamp: "", alertSent: "" } });
      let activities = userDoc.activities || [];

      if (date) {
        // filter activities that start with the requested date
        activities = activities.filter(a => a.timestamp && a.timestamp.startsWith(date));
      }

      return res.status(200).json({ activities });
    }

    // Support both full account deletion and activity nuking
    if (req.method === 'DELETE') {
      const { syncId: rawSyncId, fullDelete } = req.query;
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const rawSyncIdTrimmed = String(rawSyncId).trim();
      if (!rawSyncIdTrimmed) return res.status(400).json({ error: 'syncId cannot be empty' });

      const userDoc = await resolveUser(db, rawSyncIdTrimmed);
      if (!userDoc) return res.status(401).json({ error: 'Unauthorized: Invalid session or sync ID' });
      const syncId = userDoc.syncId;

      if (fullDelete === 'true') {
        // Permanently Delete Account
        await collection.deleteOne({ syncId });
        return res.status(200).json({ success: true, deletedAccount: true });
      } else {
        // DEV ONLY: Nuke all activities only, keeping syllabus and routines intact
        await collection.updateOne({ syncId }, { $set: { activities: [] } });
        return res.status(200).json({ success: true, clearedActivities: true });
      }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(`${getISTLogPrefix()} MongoDB Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
