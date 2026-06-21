import { connectToDatabase } from './_shared/db.js';
import { getISTDateStringYYYYMMDD, getISTLogPrefix, getISTCalendarDaysDifference } from '../src/shared/time.js';
import { deserializeSyllabus, loadTemplate } from './_shared/syllabus.js';
import { sendEmailViaSMTP, sendDeletionAlertEmail } from './_shared/email.js';
import { aesEncrypt } from '../src/services/crypto.js';

export default async function handler(req, res) {
  // Enforce Vercel Cron Authentication validation
  const cronAuthHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && cronAuthHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Vercel Cron Authorization header token' });
  }

  try {
    const db = await connectToDatabase();
    const collection = db.collection('users');

    // --- Inactivity and Deletion Checks (Calculated in IST) ---
    try {
      const now = new Date();
      const usersToCheck = await collection.find({ logoutTimestamp: { $ne: null } }).toArray();
      
      for (const user of usersToCheck) {
        if (!user.logoutTimestamp) continue;
        const logoutDate = new Date(user.logoutTimestamp);
        const diffDays = getISTCalendarDaysDifference(logoutDate, now);
        
        if (diffDays >= 6) {
          // Delete account on 6th day
          const syncId = user.syncId;
          await collection.deleteMany({ syncId });
          await db.collection('rate_limits').deleteMany({ _id: syncId });
          await db.collection('telemetry').deleteMany({ syncId });
          console.log(`[Vinyas Inactivity] Deleted inactive account and all associated rate limits and telemetry for syncId: ${syncId} after ${diffDays} calendar days in IST.`);
        } else if (diffDays >= 5) {
          // More than 5 days (5th day onwards) - send deletion alert email if email provided and not sent
          if (user.email && !user.alertSent) {
            try {
              await sendDeletionAlertEmail(user.email, user.syncId);
              await collection.updateOne({ syncId: user.syncId }, { $set: { alertSent: true } });
              console.log(`[Vinyas Inactivity] Sent deletion alert email to: ${user.email} for syncId: ${user.syncId}`);
            } catch (emailErr) {
              console.error(`[Vinyas Inactivity] Failed to send deletion alert email to: ${user.email}:`, emailErr);
            }
          }
        }
      }
    } catch (inactivityErr) {
      console.error("[Vinyas Inactivity] Error during inactivity checks:", inactivityErr);
    }

    // Retrieve all users who have backups enabled and email configured
    const usersToBackup = await collection.find({
      autoBackupEnabled: true,
      email: { $ne: null, $not: /^\s*$/ }
    }).toArray();

    const results = [];

    for (const userDoc of usersToBackup) {
      try {
        // Reconstruct the full syllabus data
        const baseTemplate = loadTemplate(userDoc.cohort);
        const fullSyllabus = deserializeSyllabus(userDoc.data, baseTemplate);

        // Prepare backup JSON string
        const backupData = {
          syncId: userDoc.syncId,
          userName: userDoc.userName || '',
          cohort: userDoc.cohort || 'BITSAT',
          targetDate: userDoc.targetDate || '2026-05-23',
          data: fullSyllabus,
          routines: userDoc.routines || [],
          testLogs: userDoc.testLogs || [],
          resolvedActivityIds: userDoc.resolvedActivityIds || []
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        
        // Encrypt on the server side using user's Sync ID as the password key
        const encryptedBundle = await aesEncrypt(userDoc.syncId, jsonString);

        const backupWrapper = {
          vinyasBackup: true,
          encrypted: true,
          encryptionVersion: "AES-GCM",
          payload: encryptedBundle
        };

        const wrapperJsonString = JSON.stringify(backupWrapper, null, 2);
        const base64Content = Buffer.from(wrapperJsonString).toString('base64');
        const filename = `vinyas_weekly_backup_${getISTDateStringYYYYMMDD()}.json`;

        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          await sendEmailViaSMTP(userDoc.email, userDoc.syncId, filename, base64Content);
        } else {
          throw new Error('Gmail SMTP credentials are not configured');
        }

        results.push({ syncId: userDoc.syncId, email: userDoc.email, success: true });
        console.log(`${getISTLogPrefix()} Weekly backup sent successfully for syncId: ${userDoc.syncId} to: ${userDoc.email}`);
      } catch (err) {
        console.error(`${getISTLogPrefix()} Failed to send weekly backup for syncId: ${userDoc.syncId}:`, err);
        results.push({ syncId: userDoc.syncId, email: userDoc.email, success: false, error: err.message });
      }
    }

    return res.status(200).json({ success: true, count: usersToBackup.length, results });
  } catch (error) {
    console.error(`${getISTLogPrefix()} Cron Backup Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
