import { connectToDatabase } from './db.js';
import { getISTISOString, getISTLogPrefix } from './timezone.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { resolveUser, hashSyncId } from './shared/auth.js';

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
      const { syncId: rawSyncId, encryptedTelemetry, bugSeverity, bugDesc, screenshot, screenshots, isFeatureSuggestion } = req.body;
      
      if (!rawSyncId || typeof rawSyncId !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing syncId' });
      }
      const syncId = String(rawSyncId).trim();
      if (!syncId) return res.status(400).json({ error: 'syncId cannot be empty' });

      if (!encryptedTelemetry || typeof encryptedTelemetry !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing encryptedTelemetry' });
      }

      // Resolve plaintext / session tokens to Hashed Sync ID for DB storage (prevents session hijacking / plaintext leakage)
      const userDoc = await resolveUser(db, syncId);
      const targetSyncId = userDoc ? userDoc.syncId : hashSyncId(syncId);

      const telemetryRecord = {
        syncId: targetSyncId,
        encryptedTelemetry,
        isFeatureSuggestion: !!isFeatureSuggestion,
        bugSeverity: isFeatureSuggestion ? null : bugSeverity,
        timestamp: new Date(),
        timestampIST: getISTISOString()
      };

      await collection.insertOne(telemetryRecord);

      // SMTP Email dispatch to Developer
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              user: smtpUser,
              pass: smtpPass
            }
          });

          const attachments = [];
          if (screenshot && typeof screenshot === 'string') {
            const match = screenshot.match(/^data:image\/(\w+);base64,(.+)$/);
            if (match) {
              const ext = match[1];
              const base64Data = match[2];
              attachments.push({
                filename: `screenshot.${ext}`,
                content: Buffer.from(base64Data, 'base64')
              });
            }
          }
          if (Array.isArray(screenshots)) {
            screenshots.forEach((sc, idx) => {
              if (typeof sc === 'string') {
                const match = sc.match(/^data:image\/(\w+);base64,(.+)$/);
                if (match) {
                  const ext = match[1];
                  const base64Data = match[2];
                  attachments.push({
                    filename: `screenshot_${idx + 1}.${ext}`,
                    content: Buffer.from(base64Data, 'base64')
                  });
                }
              }
            });
          }

          const isSuggestion = !!isFeatureSuggestion;
          const subjectText = isSuggestion 
            ? `💡 Vinyas Feature Suggestion Report` 
            : `🐞 Vinyas Digital Telemetry Bug Report [${bugSeverity || 'Medium'}]`;
          
          const headerHtml = isSuggestion 
            ? `<h2 style="color: #f59e0b; font-size: 20px; font-weight: 900; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">💡 Vinyas Feature Suggestion</h2>`
            : `<h2 style="color: #ef4444; font-size: 20px; font-weight: 900; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 10px;">🐞 Vinyas Telemetry Bug Report</h2>`;

          const severityHtml = isSuggestion 
            ? `<div style="margin-bottom: 15px;">
                 <strong style="color: #a1a1aa;">Type:</strong> <span style="font-weight: bold; color: #f59e0b;">Feature Suggestion</span>
               </div>`
            : `<div style="margin-bottom: 15px;">
                 <strong style="color: #a1a1aa;">Severity:</strong> <span style="font-weight: bold; color: ${bugSeverity === 'Critical' ? '#ef4444' : bugSeverity === 'High' ? '#f97316' : bugSeverity === 'Medium' ? '#eab308' : '#3b82f6'};">${bugSeverity || 'Medium'}</span>
               </div>`;

          const descLabel = isSuggestion ? 'Feature Suggestion Details:' : 'User Description:';

          const mailOptions = {
            from: `"Vinyas Telemetry Portal" <${smtpUser}>`,
            to: process.env.DEV_EMAIL,
            subject: subjectText,
            html: `
              <div style="font-family: sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px; border-radius: 16px; border: 1px solid #27272a; max-width: 600px; margin: 0 auto;">
                ${headerHtml}
                <div style="margin-bottom: 15px;">
                  <strong style="color: #a1a1aa;">Sync ID:</strong> <code style="font-family: monospace; color: #f43f5e; background-color: #18181b; padding: 2px 6px; border-radius: 4px; border: 1px solid #27272a;">${syncId}</code>
                </div>
                ${severityHtml}
                <div style="margin-top: 20px; margin-bottom: 20px; background-color: #18181b; border: 1px solid #27272a; padding: 15px; border-radius: 10px;">
                  <strong style="color: #a1a1aa; display: block; margin-bottom: 5px;">${descLabel}</strong>
                  <p style="margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap;">${bugDesc || 'No plain description provided'}</p>
                </div>
                <div style="margin-top: 20px;">
                  <strong style="color: #a1a1aa; display: block; margin-bottom: 5px;">Encrypted Diagnostics Payload:</strong>
                  <textarea readonly style="width: 100%; height: 120px; background-color: #18181b; border: 1px solid #27272a; color: #a1a1aa; font-family: monospace; font-size: 11px; padding: 10px; border-radius: 8px; resize: none; outline: none;">${encryptedTelemetry}</textarea>
                </div>
                <p style="font-size: 11px; color: #52525b; margin-top: 30px; border-top: 1px solid #27272a; padding-top: 15px; text-align: center;">
                  Vinyas Study Ecosystem • Automated Diagnostics Relay
                </p>
              </div>
            `,
            attachments
          };

          await transporter.sendMail(mailOptions);
          console.log(`${getISTLogPrefix()} Telemetry mail dispatched successfully to dev for syncId: ${syncId} (attachments: ${attachments.length}).`);
        } catch (emailError) {
          console.error('[Vinyas Telemetry] Failed to dispatch telemetry SMTP mail:', emailError);
        }
      }

      return res.status(200).json({ success: true, message: 'Developer telemetry record saved successfully.' });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error(`${getISTLogPrefix()} MongoDB Telemetry Error:`, error);
    return res.status(500).json({ error: error.message });
  }
}
