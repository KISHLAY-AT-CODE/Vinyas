import nodemailer from 'nodemailer';

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

  const mailOptions = {
    from: `"Vinyas Backup" <${smtpUser}>`,
    to: toEmail,
    subject: subjectText,
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
        
        <p style="font-size: 12px; color: #475569; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 20px;">
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

  const mailOptions = {
    from: `"Vinyas Security" <${smtpUser}>`,
    to: toEmail,
    subject: `${subjectPrefix}ACTION REQUIRED: Your Vinyas Account is Pending Deletion`,
    html: `
      <div style="font-family: sans-serif; background-color: #0c0a09; color: #f5f5f4; padding: 40px; border-radius: 16px; border: 1px solid #292524; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444; font-size: 24px; font-weight: 900; margin-bottom: 20px;">⚠️ Inactivity & Deletion Alert${isSimulated ? ' (Simulated)' : ''}</h2>
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
