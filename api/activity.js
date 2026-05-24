import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from './timezone.js';

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

        // Priority 2: Exact URL duplicate check
        const existing = await collection.findOne({
          syncId,
          'activities.details.url': details.url,
          'activities.type': 'DPP_SCORE'
        });
        if (existing) {
          return res.status(200).json({ success: true, duplicate: true });
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
      const { syncId: rawSyncId, date } = req.query;
      if (!rawSyncId || typeof rawSyncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      const userDoc = await collection.findOne({ syncId }, { projection: { activities: 1 } });
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
