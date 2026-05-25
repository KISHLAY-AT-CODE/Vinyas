import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from './timezone.js';

export default async function handler(req, res) {
  // Setup CORS to allow requests from specific origins
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
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

    await collection.updateOne(
      { syncId },
      { $set: { logoutTimestamp: getISTISOString(), alertSent: false } }
    );

    console.log(`${getISTLogPrefix()} Logged out syncId: ${syncId}, registered logout timestamp.`);
    return res.status(200).json({ success: true, message: 'Logout registered successfully' });
  } catch (error) {
    console.error('Logout handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
