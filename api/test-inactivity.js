import { connectToDatabase } from './db.js';
import { getISTLogPrefix, getISTISOString, getISTCalendarDaysDifference } from './timezone.js';
import nodemailer from 'nodemailer';

async function sendDeletionAlertEmail(toEmail, syncId) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error("SMTP_USER or SMTP_PASS environment variables are not configured");
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  const mailOptions = {
    from: `"Vinyas Security" <${smtpUser}>`,
    to: toEmail,
    subject: '⚠️ ACTION REQUIRED: Your Vinyas Account is Pending Deletion (Simulated)',
    html: `
      <div style="font-family: sans-serif; background-color: #0c0a09; color: #f5f5f4; padding: 40px; border-radius: 16px; border: 1px solid #292524; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444; font-size: 24px; font-weight: 900; margin-bottom: 20px;">⚠️ Simulated Inactivity & Deletion Alert</h2>
        <p style="font-size: 14px; color: #a8a29e; line-height: 1.6;">
          You logged out of your Vinyas dashboard more than <strong>5 days ago</strong>. To protect privacy and optimize storage, inactive accounts are automatically pruned.
        </p>
        
        <div style="background-color: #1c1917; border: 1px solid #44403c; padding: 20px; border-radius: 12px; margin: 25px 0;">
          <span style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1px;">Security Alert Details</span>
          <div style="margin-top: 10px; font-size: 13px;">
            <strong>Registered Sync ID:</strong> <code style="font-family: monospace; color: #f43f5e; background-color: #0c0a09; padding: 2px 6px; border-radius: 4px; border: 1px solid #292524;">${syncId}</code>
          </div>
          <div style="margin-top: 10px; font-size: 13px; color: #f5f5f4;">
            <strong>Scheduled Deletion Time:</strong> On the <strong style="color: #ef4444;">6th day</strong> of inactivity (in less than 24 hours).
          </div>
        </div>

        <p style="font-size: 14px; color: #e7e5e4; line-height: 1.6;">
          To stop this deletion and preserve your syllabus data, simply <strong>log back into the Vinyas app</strong> on your browser. Logging in will immediately restore your active status and cancel the deletion schedule.
        </p>
        
        <p style="font-size: 12px; color: #78716c; margin-top: 30px; border-top: 1px solid #292524; padding-top: 20px;">
          Secure Inactivity Protocols Active • Vinyas Study Ecosystem
        </p>
      </div>
    `
  };

  return await transporter.sendMail(mailOptions);
}

export default async function handler(req, res) {
  // CORS setup
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

  const { action, syncId, email } = req.body;

  if (!syncId) {
    return res.status(400).json({ error: 'syncId is required' });
  }

  try {
    if (action === 'simulate-logout') {
      const days = Number(req.body.daysAgo) || 0;
      const date = new Date();
      date.setDate(date.getDate() - days);
      const logoutTimestamp = getISTISOString(date);
      
      const db = await connectToDatabase();
      const collection = db.collection('users');
      
      await collection.updateOne(
        { syncId },
        { $set: { logoutTimestamp, alertSent: false } }
      );
      
      console.log(`${getISTLogPrefix()} Simulated logout of syncId: ${syncId} at ${logoutTimestamp} (${days} days ago).`);
      return res.status(200).json({ 
        success: true, 
        message: `Simulated logout successfully set to ${days} days ago (${logoutTimestamp}).` 
      });
    }

    if (action === 'check') {
      const db = await connectToDatabase();
      const collection = db.collection('users');
      
      const user = await collection.findOne({ syncId });
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
        await collection.deleteOne({ syncId });
        resultAction = 'delete';
        detail += ' Account deleted on 6th day of inactivity.';
      } else if (diffDays >= 5) {
        if (user.email) {
          if (!user.alertSent) {
            await sendDeletionAlertEmail(user.email, syncId);
            await collection.updateOne({ syncId }, { $set: { alertSent: true } });
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

      await sendDeletionAlertEmail(email.trim(), syncId);
      console.log(`${getISTLogPrefix()} Dispatched simulated 5-day deletion warning email to: ${email}`);
      return res.status(200).json({ success: true, message: 'Simulated 5-day warning email sent successfully!' });
    }

    if (action === 'delete') {
      const db = await connectToDatabase();
      const collection = db.collection('users');

      // Delete the active testing account
      const result = await collection.deleteOne({ syncId });
      console.log(`${getISTLogPrefix()} Simulated 6-day inactivity prune for syncId: ${syncId}`);

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
