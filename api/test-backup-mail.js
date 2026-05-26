import { connectToDatabase } from './db.js';
import { getISTDateStringYYYYMMDD, getISTLogPrefix } from '../src/shared/time.js';
import { sendEmailViaSMTP } from './shared/email.js';
import { resolveUser } from './shared/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { syncId, email, backupWrapper, isTest } = req.body;

  if (!syncId || !email || !backupWrapper) {
    return res.status(400).json({ error: 'Missing syncId, email, or backup data payload' });
  }

  try {
    // Security check: verify syncId exists in database before sending any email
    const db = await connectToDatabase();
    const user = await resolveUser(db, syncId);
    if (!user) {
      return res.status(404).json({ error: 'Access denied: Sync ID not found in database.' });
    }

    const jsonString = JSON.stringify(backupWrapper, null, 2);
    const base64Content = Buffer.from(jsonString).toString('base64');
    const filename = `vinyas_encrypted_backup_${getISTDateStringYYYYMMDD()}.json`;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ 
        error: 'Gmail SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASS in your environment variables.' 
      });
    }

    const isTestEmail = isTest !== false;
    const result = await sendEmailViaSMTP(email, user.syncId, filename, base64Content, isTestEmail);

    return res.status(200).json({ success: true, message: isTestEmail ? 'Test backup email dispatched successfully!' : 'Simulated weekend backup email dispatched successfully!', result });
  } catch (error) {
    console.error(`${getISTLogPrefix()} Email SMTP test error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
