import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from './timezone.js';
import crypto from 'crypto';

function safeCompare(input, expected) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  
  if (inputBuffer.length !== expectedBuffer.length) {
    // Run a dummy check of equal length to prevent timing attacks exposing password length
    crypto.timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('telemetry');

    if (req.method === 'GET') {
      const authHeader = req.headers.authorization;
      const expectedPassword = process.env.TELEMETRY_PASSWORD;

      if (!expectedPassword) {
        return res.status(500).json({ error: 'Server Configuration Error: TELEMETRY_PASSWORD environment variable is not defined.' });
      }

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing token in Authorization header.' });
      }

      const password = authHeader.substring(7).trim();

      if (!safeCompare(password, expectedPassword)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid developer credentials.' });
      }

      const records = await collection.find({}).sort({ timestamp: -1 }).toArray();
      return res.status(200).json({ success: true, telemetry: records });
    }

    if (req.method === 'POST') {
      const { syncId: rawSyncId, encryptedTelemetry } = req.body;
      
      if (!rawSyncId || typeof rawSyncId !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing syncId' });
      }
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      if (!encryptedTelemetry || typeof encryptedTelemetry !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing encryptedTelemetry' });
      }

      const telemetryRecord = {
        syncId,
        encryptedTelemetry,
        timestamp: new Date(),
        timestampIST: getISTISOString()
      };

      await collection.insertOne(telemetryRecord);

      return res.status(200).json({ success: true, message: 'Developer telemetry record saved successfully.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(`${getISTLogPrefix()} MongoDB Telemetry Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
