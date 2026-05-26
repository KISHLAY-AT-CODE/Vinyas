import { connectToDatabase } from './db.js';
import { getISTLogPrefix, getISTISOString, getISTCalendarDaysDifference } from '../src/shared/time.js';
import { sendDeletionAlertEmail } from './shared/email.js';
import { resolveUser, hashSyncId } from './shared/auth.js';

export default async function handler(req, res) {
  // Enforce CRON_SECRET authorization if defined in environment variables (production security)
  const cronAuthHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && cronAuthHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Cron Authorization header token' });
  }

  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  const origin = req.headers.origin;
  const ALLOWED_ORIGINS_REGEX = /^chrome-extension:\/\/([a-z]{32})$/;
  if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.includes('vinyas') || ALLOWED_ORIGINS_REGEX.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, syncId, email } = req.body;

  if (!syncId) {
    return res.status(400).json({ error: 'syncId is required' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');
    const userDoc = await resolveUser(db, syncId);
    const targetSyncId = userDoc ? userDoc.syncId : hashSyncId(syncId);

    if (action === 'simulate-logout') {
      const days = Number(req.body.daysAgo) || 0;
      const date = new Date();
      date.setDate(date.getDate() - days);
      const logoutTimestamp = getISTISOString(date);
      
      await collection.updateOne(
        { syncId: targetSyncId },
        { $set: { logoutTimestamp, alertSent: false } }
      );
      
      console.log(`${getISTLogPrefix()} Simulated logout of syncId: ${targetSyncId} at ${logoutTimestamp} (${days} days ago).`);
      return res.status(200).json({ 
        success: true, 
        message: `Simulated logout successfully set to ${days} days ago (${logoutTimestamp}).` 
      });
    }

    if (action === 'check') {
      const user = userDoc;
      if (!user) {
        return res.status(404).json({ error: 'User not found in database' });
      }
      
      if (!user.logoutTimestamp) {
        return res.status(200).json({ 
          success: true, 
          resultAction: 'none', 
          detail: 'User is active (logoutTimestamp is null or unset).' 
        });
      }
      
      const now = new Date();
      const logoutDate = new Date(user.logoutTimestamp);
      const diffDays = getISTCalendarDaysDifference(logoutDate, now);
      
      let resultAction = 'none';
      let detail = `Inactive for ${diffDays} calendar days in IST.`;
      
      if (diffDays >= 6) {
        await collection.deleteOne({ syncId: targetSyncId });
        resultAction = 'delete';
        detail += ' Account deleted on 6th day of inactivity.';
      } else if (diffDays >= 5) {
        if (user.email) {
          if (!user.alertSent) {
            await sendDeletionAlertEmail(user.email, targetSyncId, true);
            await collection.updateOne({ syncId: targetSyncId }, { $set: { alertSent: true } });
            resultAction = 'alert';
            detail += ' Sent 5-day deletion warning email.';
          } else {
            resultAction = 'alert-already-sent';
            detail += ' 5-day deletion warning email was already sent previously.';
          }
        } else {
          resultAction = 'alert-skipped';
          detail += ' 5-day warning email skipped (no email configured).';
        }
      }
      
      return res.status(200).json({ success: true, resultAction, detail, diffDays });
    }

    if (action === 'alert') {
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Email is required for alerts simulation' });
      }

      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({ 
          error: 'SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASS in your environment.' 
        });
      }

      await sendDeletionAlertEmail(email.trim(), targetSyncId, true);
      console.log(`${getISTLogPrefix()} Dispatched simulated 5-day deletion warning email to: ${email}`);
      return res.status(200).json({ success: true, message: 'Simulated 5-day warning email sent successfully!' });
    }

    if (action === 'delete') {
      // Delete the active testing account
      const result = await collection.deleteOne({ syncId: targetSyncId });
      console.log(`${getISTLogPrefix()} Simulated 6-day inactivity prune for syncId: ${targetSyncId}`);

      return res.status(200).json({ 
        success: true, 
        message: result.deletedCount > 0 
          ? 'Simulated 6-day inactivity: Account deleted successfully from database!' 
          : 'Sync ID not found in database, simulated reset initiated.' 
      });
    }

    return res.status(400).json({ error: 'Invalid simulation action' });
  } catch (error) {
    console.error('Test Inactivity handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
