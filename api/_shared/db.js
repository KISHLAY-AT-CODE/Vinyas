import { MongoClient } from 'mongodb';

let cachedClient = null;
let cachedDb = null;

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  // If connection is cached, verify it with a quick ping health check
  if (cachedDb && cachedClient) {
    try {
      await cachedDb.command({ ping: 1 });
      return cachedDb;
    } catch (e) {
      console.warn('[DB Caching] Cached MongoDB connection failed health check, reconnecting...', e.message);
      cachedClient = null;
      cachedDb = null;
    }
  }

  // Create connection client with timeouts configured
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30 seconds
  });

  await client.connect();
  const db = client.db('vinyas');

  // Ensure unique index on syncId (idempotent operation)
  try {
    await db.collection('users').createIndex({ syncId: 1 }, { unique: true });
  } catch (e) {
    console.error('[DB Index] Failed to create syncId index on users collection:', e.message);
  }

  cachedClient = client;
  cachedDb = db;
  return db;
}
