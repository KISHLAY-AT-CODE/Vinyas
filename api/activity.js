import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase(uri) {
  if (cachedDb) return cachedDb;

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('vinyas');

  cachedClient = client;
  cachedDb = db;
  return db;
}

export default async function handler(req, res) {
  // Setup CORS to allow requests from the Chrome Extension
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  const isAllowed = origin && (
    origin.startsWith('chrome-extension://') ||
    origin.startsWith('http://localhost:') ||
    origin.endsWith('.vercel.app')
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

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return res.status(500).json({ error: 'MONGODB_URI is not defined' });
  }

  try {
    const db = await connectToDatabase(uri);
    const collection = db.collection('users');

    if (req.method === 'POST') {
      const { syncId, type, details, timestamp } = req.body;
      
      if (!syncId || typeof syncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });

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
                'activities.$.timestamp': timestamp || new Date().toISOString()
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
        timestamp: timestamp || new Date().toISOString()
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
      const { syncId, date } = req.query;
      if (!syncId || typeof syncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });

      const userDoc = await collection.findOne({ syncId }, { projection: { activities: 1 } });
      let activities = userDoc?.activities || [];

      if (date) {
        // filter activities that start with the requested date
        activities = activities.filter(a => a.timestamp && a.timestamp.startsWith(date));
      }

      return res.status(200).json({ activities });
    }

    // DEV ONLY: Nuke all activities for this user
    if (req.method === 'DELETE') {
      const { syncId } = req.query;
      if (!syncId || typeof syncId !== 'string') return res.status(400).json({ error: 'Invalid or missing syncId' });

      // DEV ONLY: Nuke all activities and data for this user
      await collection.deleteOne({ syncId });

      return res.status(200).json({ success: true, cleared: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("MongoDB Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
