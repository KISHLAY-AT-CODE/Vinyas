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
  // CORS setup
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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
    const collection = db.collection('telemetry');

    if (req.method === 'GET') {
      const { password } = req.query;
      const expectedPassword = process.env.TELEMETRY_PASSWORD;

      if (!expectedPassword) {
        return res.status(500).json({ error: 'Server Configuration Error: TELEMETRY_PASSWORD environment variable is not defined.' });
      }

      if (!password || password !== expectedPassword) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing developer credentials.' });
      }

      const records = await collection.find({}).sort({ timestamp: -1 }).toArray();
      return res.status(200).json({ success: true, telemetry: records });
    }

    if (req.method === 'POST') {
      const { syncId, encryptedTelemetry } = req.body;
      
      if (!syncId || typeof syncId !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing syncId' });
      }
      if (!encryptedTelemetry || typeof encryptedTelemetry !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing encryptedTelemetry' });
      }

      const telemetryRecord = {
        syncId,
        encryptedTelemetry,
        timestamp: new Date()
      };

      await collection.insertOne(telemetryRecord);

      return res.status(200).json({ success: true, message: 'Developer telemetry record saved successfully.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error("MongoDB Telemetry Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
