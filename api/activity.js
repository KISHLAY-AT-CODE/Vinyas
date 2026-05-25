import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from './timezone.js';

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

function normalizeChapterName(name) {
  if (!name) return "";
  const normalized = name
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

  const CHAPTER_SYNONYMS = {
      "atomic structure": "structure of atom",
      "structure of atoms": "structure of atom",
      "structure of atom": "structure of atom",
      "periodic table": "classification of elements and periodicity in properties",
      "periodicity in properties": "classification of elements and periodicity in properties",
      "periodicity in propertie": "classification of elements and periodicity in properties",
      "periodic classification": "classification of elements and periodicity in properties",
      "chemical bonding": "chemical bonding and molecular structure",
      "goc": "organic chemistry some basic principles and techniques",
      "general organic chemistry": "organic chemistry some basic principles and techniques",
      "organic chemistry basic principles": "organic chemistry some basic principles and techniques"
  };

  if (CHAPTER_SYNONYMS[normalized]) {
      return CHAPTER_SYNONYMS[normalized];
  }
  return normalized;
}

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
  if (req.body && JSON.stringify(req.body).length > 500 * 1024) {
    return res.status(413).json({ error: 'Payload too large (limit is 500KB)' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');

    if (req.method === 'POST') {
      const { syncId: rawSyncId, type, details, timestamp } = req.body;
      
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      const isSecure = syncId.startsWith('vny_sec_');
      const existingDoc = await collection.findOne({ syncId });

      if (!isSecure && !existingDoc) {
        return res.status(400).json({ 
          error: 'Security Enforcement: The Sync ID provided is not secure and does not exist in the database. Activity logging requires a secure cryptographically generated Sync ID.' 
        });
      }

      if (existingDoc) {
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
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      if (checkUrl) {
        // Find if a normalized matching URL exists in the database for the given syncId
        const userDoc = await collection.findOne({ syncId }, { projection: { activities: 1, data: 1 } });
        const activities = userDoc?.activities || [];
        const normCheckUrl = normalizeUrl(checkUrl);
        let exists = activities.some(act => 
          (act.type === 'DPP_SCORE' || act.type === 'PW_BOOKS_QUESTIONS') && 
          act.details?.url && 
          normalizeUrl(act.details.url) === normCheckUrl
        );

        // Fail-safe: if the URL exists in logs but is a Module practice layout, check if it actually exists in the syllabus!
        if (exists && checkUrl.includes('chapterTitle=')) {
          const match = checkUrl.match(/chapterTitle=([^&]+)/);
          if (match) {
            let raw = match[1].replace(/\+/g, ' ');
            try { raw = decodeURIComponent(raw); } catch (e) {}
            const chapterSearchName = raw.trim();
            const normSearchName = normalizeChapterName(chapterSearchName);
            
            const syllabus = userDoc?.data || {};
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
            
            // If the URL exists in logs but is NOT configured in the syllabus, force "exists" to false to allow sync!
            if (!isConfigured) {
              exists = false;
            }
          }
        }

        return res.status(200).json({ exists });
      }

      const userDoc = await collection.findOne({ syncId }, { projection: { activities: 1 } });
      if (userDoc) {
        await collection.updateOne({ syncId }, { $unset: { logoutTimestamp: "", alertSent: "" } });
      }
      let activities = userDoc?.activities || [];

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
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

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
