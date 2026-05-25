import nodemailer from 'nodemailer';
import { MongoClient } from 'mongodb';
import { getISTDateStringYYYYMMDD, getISTLogPrefix, getISTCalendarDaysDifference } from './timezone.js';
import fs from 'fs';
import path from 'path';

// Reconstruct full syllabus array by combining template structure and diff modifications (identical to api/data.js)
function deserializeSyllabus(serialized, baseTemplate) {
  if (!serialized) return [];
  if (Array.isArray(serialized)) return serialized;
  if (serialized.isRaw) return serialized.data || [];

  if (!baseTemplate) return [];

  const COLORS = ["bg-blue-600", "bg-emerald-600", "bg-indigo-600", "bg-purple-600", "bg-rose-600", "bg-amber-600", "bg-cyan-600"];
  
  const reconstructed = baseTemplate.map((baseSub, idx) => {
    const savedColorObj = serialized.subjectColors?.find(c => c.name.trim().toLowerCase() === baseSub.name.toLowerCase());
    const color = savedColorObj ? savedColorObj.color : COLORS[idx % COLORS.length];

    const filteredChapters = baseSub.chapters
      .filter(baseCh => {
        const isDeleted = serialized.deletions?.some(d => 
          d.subjectName.trim().toLowerCase() === baseSub.name.trim().toLowerCase() &&
          d.chapterName.trim().toLowerCase() === baseCh.name.trim().toLowerCase()
        );
        return !isDeleted;
      })
      .map(baseCh => {
        const savedProgress = serialized.progressList?.find(p => 
          p.subjectName.trim().toLowerCase() === baseSub.name.trim().toLowerCase() &&
          p.chapterName.trim().toLowerCase() === baseCh.name.trim().toLowerCase()
        );

        if (savedProgress) {
          return {
            name: baseCh.name,
            status: savedProgress.progress.status || 'None',
            lectures: savedProgress.progress.lectures || 0,
            log: savedProgress.progress.log || '',
            dpp: savedProgress.progress.dpp || { acc: 0, comp: 0 },
            module: savedProgress.progress.module || { acc: 0, comp: 0 },
            dppLogs: savedProgress.progress.dppLogs || []
          };
        }

        return {
          name: baseCh.name,
          status: 'None',
          lectures: 0,
          log: '',
          dpp: { acc: 0, comp: 0 },
          module: { acc: 0, comp: 0 },
          dppLogs: []
        };
      });

    return {
      name: baseSub.name,
      color,
      chapters: filteredChapters
    };
  });

  if (serialized.additions && Array.isArray(serialized.additions)) {
    serialized.additions.forEach(add => {
      if (add.type === 'subject') {
        reconstructed.push({
          name: add.subjectName,
          color: add.color || "bg-indigo-600",
          chapters: add.chapters || []
        });
      } else if (add.type === 'chapter') {
        const sub = reconstructed.find(s => s.name.trim().toLowerCase() === add.subjectName.trim().toLowerCase());
        if (sub) {
          sub.chapters.push(add.chapter);
        } else {
          reconstructed.push({
            name: add.subjectName,
            color: "bg-indigo-600",
            chapters: [add.chapter]
          });
        }
      }
    });
  }

  return reconstructed;
}

// Load base template from disk
function loadTemplate(cohortName) {
  if (!cohortName) return null;
  const filename = cohortName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.json';
  const filePath = path.join(process.cwd(), 'templates', filename);
  
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      return parsed.subjects || null;
    }
  } catch (err) {
    console.error(`${getISTLogPrefix()} Failed to load template ${cohortName} from ${filePath}:`, err);
  }
  return null;
}

// Server-side Web Crypto AES-GCM Encrypter (fully compatible with browser client decryption)
async function aesEncrypt(passphrase, plaintext) {
  const { webcrypto } = await import('crypto');
  const subtle = webcrypto.subtle;
  
  const encoder = new TextEncoder();
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  
  const baseKey = await subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  
  const key = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  
  const ciphertextBuffer = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encoder.encode(plaintext)
  );
  
  const bufferToHex = (buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return {
    salt: bufferToHex(salt),
    iv: bufferToHex(iv),
    ciphertext: bufferToHex(ciphertextBuffer)
  };
}

// Helper function to send email via Gmail SMTP
async function sendEmailViaSMTP(toEmail, syncId, filename, base64Content) {
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
    from: `"Vinyas Backup" <${smtpUser}>`,
    to: toEmail,
    subject: '📦 Automated Weekly Vinyas Syllabus Backup',
    html: `
      <div style="font-family: sans-serif; background-color: #020617; color: #f1f5f9; padding: 40px; border-radius: 16px; border: 1px solid #1e293b; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f97316; font-size: 24px; font-weight: 900; margin-bottom: 20px;">Vinyas Syllabus Backup Portal</h2>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
          Here is your weekly automated backup of your Vinyas study profile. Keep this file safe to preserve your progress.
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
  });

  return await transporter.sendMail(mailOptions);
}

// Helper function to send account deletion warning alert email via Gmail SMTP
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
    subject: '⚠️ ACTION REQUIRED: Your Vinyas Account is Pending Deletion',
    html: `
      <div style="font-family: sans-serif; background-color: #0c0a09; color: #f5f5f4; padding: 40px; border-radius: 16px; border: 1px solid #292524; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444; font-size: 24px; font-weight: 900; margin-bottom: 20px;">⚠️ Inactivity & Deletion Alert</h2>
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
  // Enforce Vercel Cron Authentication validation
  const cronAuthHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && cronAuthHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Vercel Cron Authorization header token' });
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return res.status(500).json({ error: 'MONGODB_URI is not defined' });
  }

  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('vinyas');
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
          await collection.deleteOne({ syncId: user.syncId });
          console.log(`[Vinyas Inactivity] Deleted inactive account for syncId: ${user.syncId} after ${diffDays} calendar days in IST.`);
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

    await client.close();
    return res.status(200).json({ success: true, count: usersToBackup.length, results });
  } catch (error) {
    console.error(`${getISTLogPrefix()} Cron Backup Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
