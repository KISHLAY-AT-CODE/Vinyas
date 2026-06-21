import { connectToDatabase } from './_shared/db.js';

export default async function handler(req, res) {
  // Allow OPTIONS method for CORS preflight
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

  // Restrict to non-production to prevent accidental loss on staging/production databases
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Database nuking is disabled in production environments.' });
  }

  try {
    const db = await connectToDatabase();
    
    // Nuke the three collections
    const usersResult = await db.collection('users').deleteMany({});
    const rateLimitsResult = await db.collection('rate_limits').deleteMany({});
    const telemetryResult = await db.collection('telemetry').deleteMany({});

    console.log(`[Dev Nuke] Database wiped successfully. Users deleted: ${usersResult.deletedCount}, Rate limits deleted: ${rateLimitsResult.deletedCount}, Telemetry deleted: ${telemetryResult.deletedCount}`);

    return res.status(200).json({
      success: true,
      message: 'Database nuked successfully.',
      details: {
        usersDeleted: usersResult.deletedCount,
        rateLimitsDeleted: rateLimitsResult.deletedCount,
        telemetryDeleted: telemetryResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Error nuking database:', error);
    return res.status(500).json({ error: error.message });
  }
}
