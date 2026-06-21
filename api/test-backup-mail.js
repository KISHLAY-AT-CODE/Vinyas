import { connectToDatabase } from './_shared/db.js';
import { getISTDateStringYYYYMMDD, getISTLogPrefix } from '../src/shared/time.js';
import { sendEmailViaSMTP, sendDeletionAlertEmail, sendWhatsNewEmail } from './_shared/email.js';
import { resolveUser } from './_shared/auth.js';
import { WHATS_NEW_CHANGELOG } from '../src/data/version.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { syncId, email, backupWrapper, isTest, action } = req.body;

  if (!syncId || !email) {
    return res.status(400).json({ error: 'Missing syncId or email' });
  }

  if ((!action || action === 'backup') && !backupWrapper) {
    return res.status(400).json({ error: 'Missing backup data payload for backup action' });
  }

  try {
    // Security check: verify syncId exists in database before sending any email
    const db = await connectToDatabase();
    const user = await resolveUser(db, syncId);
    if (!user) {
      return res.status(404).json({ error: 'Access denied: Sync ID not found in database.' });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ 
        error: 'Gmail SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASS in your environment variables.' 
      });
    }

    // Pass plaintext syncId if received in body, otherwise fallback to database hashed syncId
    const emailSyncId = (syncId && !/^[a-fA-F0-9]{64}$/.test(syncId)) ? syncId : user.syncId;

    let result;
    if (action === 'deletion_warning') {
      result = await sendDeletionAlertEmail(email, emailSyncId, true);
      return res.status(200).json({ 
        success: true, 
        message: 'Simulated 5-day deletion warning email dispatched successfully!', 
        result 
      });
    } else if (action === 'whats_new') {
      result = await sendWhatsNewEmail(email, emailSyncId, WHATS_NEW_CHANGELOG);
      return res.status(200).json({ 
        success: true, 
        message: "Simulated What's New update email dispatched successfully!", 
        result 
      });
    } else {
      const jsonString = JSON.stringify(backupWrapper, null, 2);
      const base64Content = Buffer.from(jsonString).toString('base64');
      const filename = `vinyas_encrypted_backup_${getISTDateStringYYYYMMDD()}.json`;
      const isTestEmail = isTest !== false;

      result = await sendEmailViaSMTP(email, emailSyncId, filename, base64Content, isTestEmail);
      return res.status(200).json({ 
        success: true, 
        message: isTestEmail ? 'Test backup email dispatched successfully!' : 'Simulated weekend backup email dispatched successfully!', 
        result 
      });
    }
  } catch (error) {
    console.error(`${getISTLogPrefix()} Email SMTP simulation error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
