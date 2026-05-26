import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from '../src/shared/time.js';
import { resolveUser } from './shared/auth.js';

export default async function handler(req, res) {
  // Setup CORS to allow requests from specific origins
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  const ALLOWED_ORIGINS_REGEX = /^chrome-extension:\/\/([a-z]{32})$/;
  if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.includes('vinyas') || ALLOWED_ORIGINS_REGEX.test(origin))) {
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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { syncId } = req.body;
  if (!syncId) {
    return res.status(400).json({ error: 'syncId is required' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');

    const userDoc = await resolveUser(db, syncId);
    if (userDoc) {
      const updateFields = { logoutTimestamp: getISTISOString(), alertSent: false };

      if (syncId.startsWith('vny_sess_')) {
        // Log out specific session and remove token
        await collection.updateOne(
          { syncId: userDoc.syncId },
          { 
            $set: updateFields,
            $pull: { sessions: { token: syncId } }
          }
        );
      } else {
        await collection.updateOne(
          { syncId: userDoc.syncId },
          { $set: updateFields }
        );
      }
      console.log(`${getISTLogPrefix()} Logged out user: ${userDoc.syncId}, registered logout timestamp and invalidated session token.`);
    }

    return res.status(200).json({ success: true, message: 'Logout registered successfully' });
  } catch (error) {
    console.error('Logout handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
