import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from '../src/shared/time.js';
import { normalizeChapterName } from '../src/shared/normalize.js';
import { resolveUser, hashSyncId } from './shared/auth.js';

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
      const { syncId: rawSyncId, date, checkUrl } = req.query;
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const rawSyncIdTrimmed = String(rawSyncId).trim();
      if (!rawSyncIdTrimmed) return res.status(400).json({ error: 'syncId cannot be empty' });

      const userDoc = await resolveUser(db, rawSyncIdTrimmed);
      if (!userDoc) return res.status(401).json({ error: 'Unauthorized: Invalid session or sync ID' });
      const syncId = userDoc.syncId;

      if (checkUrl) {
        // Find if a normalized matching URL exists in the database for the given syncId
        const activities = userDoc.activities || [];
        const normCheckUrl = normalizeUrl(checkUrl);
        let exists = activities.some(act => 
          (act.type === 'DPP_SCORE' || act.type === 'PW_BOOKS_QUESTIONS') && 
          act.details?.url && 
          normalizeUrl(act.details.url) === normCheckUrl
        );

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
