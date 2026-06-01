import nodemailer from 'nodemailer';

/**
 * Redesigns the backup verification and automated weekly backup email template.
 */
export async function sendEmailViaSMTP(toEmail, syncId, filename, base64Content, isTest = false) {
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

  const subjectText = isTest ? '⚡ Vinyas Backup: Connection Test Successful!' : '📦 Vinyas Weekly Syllabus Backup';

  // Check if syncId is the database hashed representation (64 characters, hexadecimal)
  const isHashed = syncId && /^[a-fA-F0-9]{64}$/.test(syncId);

  const securitySection = (!syncId || isHashed) 
    ? `
      <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 22px; border-radius: 12px; margin: 25px 0; text-align: left;">
        <span style="font-size: 10px; font-weight: 800; color: #f97316; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Security Note</span>
        <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0;">
          This backup file is client-side encrypted utilizing your private device Sync ID. To restore your data, use the Vinyas Import tool and enter your secret Sync ID when prompted.
        </p>
      </div>
    `
    : `
      <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 22px; border-radius: 12px; margin: 25px 0; text-align: left;">
        <span style="font-size: 10px; font-weight: 800; color: #f97316; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Security Credentials</span>
        <div style="font-size: 14px; margin-bottom: 8px; color: #e2e8f0;">
          <strong>Device Sync ID:</strong> 
          <code style="font-family: 'Courier New', Courier, monospace; color: #c084fc; background-color: #020617; padding: 4px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">${syncId}</code>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
          Keep this Sync ID safe. You will need it to decrypt and restore your syllabus settings and study progress logs.
        </p>
      </div>
    `;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subjectText}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header banner with gradient -->
        <div style="background: linear-gradient(135deg, #f97316 0%, #d97706 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Vinyas Tracker</h1>
          <p style="color: rgba(255, 255, 255, 0.85); font-size: 12px; font-weight: 700; margin-top: 5px; text-transform: uppercase; letter-spacing: 1.5px;">Syllabus Backup Service</p>
        </div>

        <div style="padding: 40px 30px; text-align: center;">
          
          <div style="font-size: 48px; margin-bottom: 20px; display: inline-block;">
            ${isTest ? '⚡' : '📦'}
          </div>

          <h2 style="color: #f1f5f9; font-size: 20px; font-weight: 800; margin: 0 0 15px 0;">
            ${isTest ? 'Connection Test Successful!' : 'Automated Syllabus Backup Ready'}
          </h2>

          <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 auto; max-width: 480px;">
            ${isTest 
              ? 'This is a verification email to confirm that your automated Vinyas backup mailing configurations are active and fully operational.' 
              : 'Here is your weekly automated backup of your Vinyas study profile. We have attached the encrypted syllabus progress file to this email.'}
          </p>

          ${securitySection}

          <!-- Restore Instructions -->
          <div style="text-align: left; background-color: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); padding: 25px; border-radius: 12px; margin-top: 25px;">
            <h3 style="color: #f8fafc; font-size: 14px; font-weight: 700; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">How to restore your progress</h3>
            <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #94a3b8; line-height: 1.7;">
              <li style="margin-bottom: 8px;">Download the attached <strong>.json</strong> backup file.</li>
              <li style="margin-bottom: 8px;">Open your Vinyas syllabus dashboard in your browser.</li>
              <li style="margin-bottom: 8px;">Click the <strong>Settings Cog Wheel</strong> in the upper right.</li>
              <li style="margin-bottom: 8px;">Select <strong>Import settings</strong> and upload this JSON file.</li>
              <li>Input your device Sync ID when prompted to decrypt and restore.</li>
            </ol>
          </div>

          <p style="font-size: 12px; color: #475569; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px; font-weight: 600;">
            End-to-End Cryptographic Security Active • Yogi Syllabus Sync
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Vinyas Backup" <${smtpUser}>`,
    to: toEmail,
    subject: subjectText,
    html: htmlContent,
    attachments: [
      {
        filename: filename,
        content: Buffer.from(base64Content, 'base64')
      }
    ]
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * Redesigns the inactivity deletion warning email template.
 */
export async function sendDeletionAlertEmail(toEmail, syncId, isSimulated = false) {
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

  const subjectPrefix = isSimulated ? '(Simulated) ⚠️ ' : '⚠️ ';
  const subjectText = `${subjectPrefix}ACTION REQUIRED: Your Vinyas Account is Pending Deletion`;

  // Check if syncId is the database hashed representation (64 characters, hexadecimal)
  const isHashed = syncId && /^[a-fA-F0-9]{64}$/.test(syncId);

  const securitySection = (!syncId || isHashed)
    ? `
      <div style="background-color: #1c1917; border: 1px solid #44403c; padding: 22px; border-radius: 12px; margin: 25px 0; text-align: left;">
        <span style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Security Alert Details</span>
        <div style="font-size: 13px; color: #e7e5e4;">
          <strong>Scheduled Deletion Time:</strong> On the <strong style="color: #ef4444;">6th day</strong> of inactivity (in less than 24 hours).
        </div>
      </div>
    `
    : `
      <div style="background-color: #1c1917; border: 1px solid #44403c; padding: 22px; border-radius: 12px; margin: 25px 0; text-align: left;">
        <span style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 8px;">Security Alert Details</span>
        <div style="font-size: 14px; margin-bottom: 8px; color: #e7e5e4;">
          <strong>Registered Sync ID:</strong> 
          <code style="font-family: 'Courier New', Courier, monospace; color: #fb7185; background-color: #0c0a09; padding: 4px 8px; border-radius: 6px; border: 1px solid #292524; font-size: 13px; font-weight: bold; letter-spacing: 0.5px;">${syncId}</code>
        </div>
        <div style="font-size: 13px; color: #e7e5e4;">
          <strong>Scheduled Deletion Time:</strong> On the <strong style="color: #ef4444;">6th day</strong> of inactivity (in less than 24 hours).
        </div>
      </div>
    `;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subjectText}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0c0a09; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #171513; border: 1px solid #292524; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.65);">
        
        <!-- Header banner with warning gradient -->
        <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Vinyas Security</h1>
          <p style="color: rgba(255, 255, 255, 0.85); font-size: 12px; font-weight: 700; margin-top: 5px; text-transform: uppercase; letter-spacing: 1.5px;">Inactivity Warning Alert</p>
        </div>

        <div style="padding: 40px 30px; text-align: center;">
          
          <div style="font-size: 48px; margin-bottom: 20px; display: inline-block;">
            ⚠️
          </div>

          <h2 style="color: #f5f5f4; font-size: 20px; font-weight: 800; margin: 0 0 15px 0;">
            Account Deletion Scheduled
          </h2>

          <p style="font-size: 14px; color: #a8a29e; line-height: 1.6; margin: 0 auto; max-width: 480px;">
            You logged out of your Vinyas study dashboard more than <strong>5 days ago</strong>. To protect privacy and optimize storage, inactive accounts are automatically pruned from the MongoDB database after 6 days.
          </p>

          ${securitySection}

          <!-- Restore Instructions -->
          <div style="text-align: left; background-color: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.03); padding: 25px; border-radius: 12px; margin-top: 25px;">
            <h3 style="color: #f5f5f4; font-size: 14px; font-weight: 700; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">How to keep your profile active</h3>
            <p style="font-size: 13px; color: #a8a29e; line-height: 1.6; margin: 0 0 12px 0;">
              To prevent the permanent deletion of your syllabus data, streaks, and mock test logs, simply:
            </p>
            <div style="background-color: #0c0a09; border: 1px solid #292524; padding: 15px; border-radius: 10px; text-align: center; margin-top: 15px;">
              <span style="font-size: 14px; font-weight: bold; color: #f5f5f4; display: block; margin-bottom: 5px;">Log back into the Vinyas App</span>
              <span style="font-size: 12px; color: #78716c;">This will immediately cancel the pending deletion and refresh your active status.</span>
            </div>
          </div>

          <p style="font-size: 12px; color: #57534e; margin-top: 40px; border-top: 1px solid #292524; padding-top: 20px; font-weight: 600;">
            Secure Inactivity Protocols Active • Vinyas Study Ecosystem
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Vinyas Security" <${smtpUser}>`,
    to: toEmail,
    subject: subjectText,
    html: htmlContent
  };

  return await transporter.sendMail(mailOptions);
}

/**
 * Sends a What's New update email with release notes.
 */
export async function sendWhatsNewEmail(toEmail, syncId, changelogData) {
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

  const version = changelogData?.version || '2.0.0';
  const releaseDate = changelogData?.date || 'May 28, 2026';
  const clientChanges = changelogData?.clientChanges || [];
  const coreChanges = changelogData?.coreChanges || [];
  const actionRequired = changelogData?.actionRequired || [];

  const clientListItems = clientChanges.length > 0 
    ? clientChanges.map(change => `<li style="margin-bottom: 12px; font-size: 13px; line-height: 1.6; color: #cbd5e1; list-style-type: none; border-left: 3px solid #f97316; padding-left: 12px; margin-left: 0;">${change}</li>`).join('')
    : '<li style="color: #64748b; font-style: italic; list-style-type: none;">No client adjustments listed for this build.</li>';

  const coreListItems = coreChanges.length > 0
    ? coreChanges.map(change => `<li style="margin-bottom: 12px; font-size: 13px; line-height: 1.6; color: #cbd5e1; list-style-type: none; border-left: 3px solid #3b82f6; padding-left: 12px; margin-left: 0;">${change}</li>`).join('')
    : '';

  const actionListItems = actionRequired.length > 0
    ? actionRequired.map(act => `<div style="background-color: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); padding: 15px; border-radius: 10px; font-size: 12px; color: #93c5fd; margin-top: 10px; line-height: 1.5;">🔔 <strong>Notice:</strong> ${act}</div>`).join('')
    : '';

  const subjectText = `✨ What's New in Vinyas: v${version} Release Notes`;

  const isHashed = syncId && /^[a-fA-F0-9]{64}$/.test(syncId);
  const syncIdSection = (syncId && !isHashed) ? `
    <div style="background-color: #0f172a; border: 1px solid #1e293b; padding: 15px; border-radius: 10px; font-size: 12px; color: #94a3b8; margin-top: 20px; text-align: center;">
      Active Sync Profile ID: <code style="font-family: monospace; color: #a855f7; background-color: #020617; padding: 2px 6px; border-radius: 4px; border: 1px solid #334155;">${syncId}</code>
    </div>
  ` : '';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subjectText}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="max-width: 600px; margin: 40px auto; background-color: #0b0f19; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 1px;">Vinyas Tracker</h1>
          <p style="color: rgba(255, 255, 255, 0.85); font-size: 12px; font-weight: 700; margin-top: 5px; text-transform: uppercase; letter-spacing: 1.5px;">What's New & Updates</p>
        </div>

        <div style="padding: 40px 30px;">
          
          <div style="text-align: center; margin-bottom: 30px;">
            <span style="font-size: 11px; font-weight: 900; background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 6px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; border: 1px solid rgba(59, 130, 246, 0.2);">
              Release v${version}
            </span>
            <span style="font-size: 12px; color: #64748b; font-weight: 600; margin-left: 10px;">${releaseDate}</span>
            <h2 style="color: #f1f5f9; font-size: 22px; font-weight: 800; margin: 20px 0 10px 0;">New Features Have Arrived!</h2>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0;">
              We have updated the Vinyas study ecosystem with exciting new features, design enhancements, and stability fixes.
            </p>
          </div>

          <!-- Changes List -->
          <div style="background-color: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.03); padding: 25px; border-radius: 16px;">
            <h3 style="color: #f8fafc; font-size: 14px; font-weight: 800; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">Latest Adjustments</h3>
            <ul style="margin: 0; padding: 0;">
              ${clientListItems}
              ${coreListItems}
            </ul>
          </div>

          ${actionListItems}
          ${syncIdSection}

          <div style="text-align: center; margin-top: 30px;">
            <a href="https://vinyas-one.vercel.app" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; font-size: 13px; font-weight: 850; text-decoration: none; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">Launch Dashboard</a>
          </div>

          <p style="font-size: 11px; color: #475569; margin-top: 40px; border-top: 1px solid #1e293b; padding-top: 20px; text-align: center; font-weight: 600;">
            Made with ❤️ by students for students • Vinyas Study Ecosystem
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Vinyas Updates" <${smtpUser}>`,
    to: toEmail,
    subject: subjectText,
    html: htmlContent
  };

  return await transporter.sendMail(mailOptions);
}
