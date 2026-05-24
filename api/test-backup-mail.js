import nodemailer from 'nodemailer';
import { getISTDateStringYYYYMMDD, getISTLogPrefix } from './timezone.js';

// Helper function to send email via Gmail SMTP
async function sendEmailViaSMTP(toEmail, syncId, filename, base64Content, isTest = false) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_USER or SMTP_PASS environment variables are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for port 465 (SSL/TLS)
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const mailOptions = {
    from: `"Vinyas Backup" <${smtpUser}>`,
    to: toEmail,
    subject: isTest ? '⚡ Vinyas Backup: Connection Test Successful!' : '📦 Vinyas Weekly Syllabus Backup',
    html: `
      <div style="font-family: sans-serif; background-color: #020617; color: #f1f5f9; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316; font-size: 24px; font-weight: 900; margin-bottom: 20px;">Vinyas Syllabus Backup Portal</h2>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
          ${isTest 
            ? 'This is a test backup email to verify your Vinyas mailing configurations. Your delivery pipeline is fully functional and ready!' 
            : 'Here is your weekly automated backup of your Vinyas study profile. Keep this file safe to preserve your progress.'}
        </p>
        
        <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 12px; margin: 25px 0;">
          <span style="font-size: 10px; font-weight: 800; color: #f97316; text-transform: uppercase; letter-spacing: 1px;">Security Credentials</span>
          <div style="margin-top: 10px; font-size: 13px;">
            <strong>Sync ID:</strong> <code style="font-family: monospace; color: #a855f7; background-color: #020617; padding: 2px 6px; border-radius: 4px; border: 1px solid #1e293b;">${syncId}</code>
          </div>
          <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
            Note: This backup file is client-side encrypted utilizing your personal Sync ID. To restore, use the Vinyas Import tool and enter your Sync ID when prompted.
          </div>
        </div>
        
        <p style="font-size: 12px; color: #475569; margin-top: 30px; border-t: 1px solid #1e293b; padding-top: 20px;">
          End-to-End Cryptographic Security Active • Yogi Syllabus Sync
        </p>
      </div>
    `,
    attachments: [
      {
        filename: filename,
        content: Buffer.from(base64Content, 'base64')
      }
    ]
  };

  return await transporter.sendMail(mailOptions);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { syncId, email, backupWrapper, isTest } = req.body;

  if (!syncId || !email || !backupWrapper) {
    return res.status(400).json({ error: 'Missing syncId, email, or backup data payload' });
  }

  try {
    const jsonString = JSON.stringify(backupWrapper, null, 2);
    const base64Content = Buffer.from(jsonString).toString('base64');
    const filename = `vinyas_encrypted_backup_${getISTDateStringYYYYMMDD()}.json`;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ 
        error: 'Gmail SMTP credentials are not configured. Please set SMTP_USER and SMTP_PASS in your environment variables.' 
      });
    }

    const isTestEmail = isTest !== false;
    const result = await sendEmailViaSMTP(email, syncId, filename, base64Content, isTestEmail);

    return res.status(200).json({ success: true, message: isTestEmail ? 'Test backup email dispatched successfully!' : 'Simulated weekend backup email dispatched successfully!', result });
  } catch (error) {
    console.error(`${getISTLogPrefix()} Email SMTP test error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
