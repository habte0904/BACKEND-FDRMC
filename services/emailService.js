import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  ACCOUNT_SETUP_TEMPLATE,
} from '../utils/emailTemplates.js';
import EmailLog from '../models/EmailLog.js';
import EmailConfig from '../models/EmailConfig.js';
import { decryptEmailConfig } from '../utils/fieldEncryption.js';
import { validateEmailAddress } from '../utils/telecomValidator.js';
import { emitDashboardEvent } from './socketService.js';

dotenv.config();

/**
 * Non-secret defaults for admin-configurable fields.
 * Secrets (user, pass, host, port) always come from .env at runtime if not set.
 */
export const DEFAULT_EMAIL_CONFIG = {
  service: process.env.EMAIL_SERVICE || 'Gmail',
  host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
  secure: process.env.EMAIL_SMTP_SECURE === 'true',
  user: process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER || '',
  pass: process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASS || '',
  fromName: 'FDRMC Early Warning & Comms',
  fromEmail: process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER || '',
  replyTo: '',
  maxTps: 5,
  enableOtp: true,
  enableAlertBroadcast: true,
  isActive: true,
};

let cachedTransporter = null;
let lastConfigVersion = null;

/**
 * Get active email configuration from DB, decrypt admin-configurable fields,
 * and inject .env-managed secrets (EMAIL_USER, EMAIL_PASS) at runtime.
 */
export const getActiveEmailConfig = async () => {
  try {
    let dbConfig = await EmailConfig.findOne({ isActive: true }).lean();
    if (!dbConfig) {
      dbConfig = null;
    }

    // Decrypt sensitive fields from DB if present
    const decrypted = dbConfig ? decryptEmailConfig(dbConfig) : {};

    const service = decrypted.service || process.env.EMAIL_SERVICE || 'Gmail';
    const isGmail = service.toLowerCase() === 'gmail';
    const host = decrypted.host || process.env.EMAIL_SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'localhost');
    const port = decrypted.port || parseInt(process.env.EMAIL_SMTP_PORT || (isGmail ? '587' : '25'), 10);
    const secure = decrypted.secure ?? (process.env.EMAIL_SMTP_SECURE === 'true' || port === 465);

    // SECRETS: Priority given to .env, falls back to decrypted DB value if set
    const user = process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER || decrypted.user || '';
    const pass = process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASS || decrypted.pass || '';
    const fromEmail = decrypted.fromEmail || process.env.EMAIL_FROM_ADDRESS || user;
    const fromName = decrypted.fromName || 'FDRMC Early Warning & Comms';

    return {
      _id: dbConfig?._id,
      service,
      host,
      port,
      secure,
      authType: decrypted.authType || 'login',
      user,
      pass,
      fromName,
      fromEmail,
      replyTo: decrypted.replyTo || '',
      maxTps: decrypted.maxTps || 5,
      enableOtp: decrypted.enableOtp ?? true,
      enableAlertBroadcast: decrypted.enableAlertBroadcast ?? true,
      emailValidationMode: dbConfig?.emailValidationMode || 'strict',
      allowedDomains: dbConfig?.allowedDomains || '',
      isActive: true,
      lastTestedAt: dbConfig?.lastTestedAt,
      lastTestStatus: dbConfig?.lastTestStatus,
      lastTestMessage: dbConfig?.lastTestMessage,
    };
  } catch (error) {
    console.error('[EmailService] Error loading EmailConfig from DB, using fallback defaults:', error);
    return DEFAULT_EMAIL_CONFIG;
  }
};

/**
 * Build Nodemailer transporter from a given config
 */
export const createTransporter = (config) => {
  const cfg = config || DEFAULT_EMAIL_CONFIG;

  if (cfg.service && cfg.service.toLowerCase() === 'gmail') {
    return nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: cfg.user,
        pass: cfg.pass,
      },
    });
  }

  // Custom SMTP server (Office 365, SendGrid, Amazon SES, Internal Exchange/Postfix)
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port || 587,
    secure: cfg.secure || cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert issues on internal intranet relays
    },
  });
};

/**
 * Get cached or updated active transporter
 */
export const getTransporter = async () => {
  const config = await getActiveEmailConfig();
  const configKey = `${config.service}-${config.host}-${config.port}-${config.user}-${config.pass}`;

  if (!cachedTransporter || lastConfigVersion !== configKey) {
    cachedTransporter = createTransporter(config);
    lastConfigVersion = configKey;
  }

  return { transporter: cachedTransporter, config };
};

/**
 * Test SMTP connection and verify credentials
 */
export const testEmailConnection = async (overrideConfig = null) => {
  const config = overrideConfig ? { ...DEFAULT_EMAIL_CONFIG, ...overrideConfig } : await getActiveEmailConfig();
  const startTime = Date.now();
  const transporter = createTransporter(config);

  try {
    await transporter.verify();
    const latency = Date.now() - startTime;
    const result = {
      success: true,
      message: `SMTP Server is ready to transmit messages (${config.service || config.host}) - verified in ${latency}ms.`,
      latency,
      testedAt: new Date(),
    };

    if (config._id) {
      await EmailConfig.findByIdAndUpdate(config._id, {
        lastTestedAt: result.testedAt,
        lastTestStatus: 'success',
        lastTestMessage: result.message,
      });
    }

    return result;
  } catch (error) {
    console.error('[EmailService] SMTP verification error:', error.message);
    const result = {
      success: false,
      message: error.message || 'Failed to verify SMTP server credentials',
      latency: Date.now() - startTime,
      testedAt: new Date(),
    };

    if (config._id) {
      await EmailConfig.findByIdAndUpdate(config._id, {
        lastTestedAt: result.testedAt,
        lastTestStatus: 'failed',
        lastTestMessage: result.message,
      });
    }

    return result;
  }
};

/**
 * Render an executive-level responsive HTML email template for emergency disaster alerts
 */
export const renderDisasterAlertHtml = ({
  subject,
  message,
  category = 'Disaster Alert',
  severity = 'normal',
  recipientName = '',
  date = new Date().toLocaleString(),
  alertCode = '',
}) => {
  const sev = (severity || 'normal').toLowerCase();
  const sevColors = {
    critical: { bg: '#ef4444', text: '#ffffff', border: '#b91c1c', badge: 'CRITICAL DISASTER EMERGENCY' },
    urgent:   { bg: '#f97316', text: '#ffffff', border: '#c2410c', badge: 'URGENT DISASTER WARNING' },
    high:     { bg: '#eab308', text: '#78350f', border: '#a16207', badge: 'HIGH PRIORITY ADVISORY' },
    normal:   { bg: '#3b82f6', text: '#ffffff', border: '#1d4ed8', badge: 'PUBLIC SAFETY BULLETIN' },
  }[sev] || { bg: '#3b82f6', text: '#ffffff', border: '#1d4ed8', badge: 'EARLY WARNING BULLETIN' };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
          <!-- Top Accent Bar -->
          <tr>
            <td style="height: 6px; background-color: ${sevColors.bg};"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #94a3b8;">Federal Democratic Republic of Ethiopia</span>
                    <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 800; color: #ffffff;">Disaster Risk Management Commission (FDRMC)</h1>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">Integrated Early Warning & Incident Management System</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Severity Badge Strip -->
          <tr>
            <td style="padding: 16px 32px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 5px 12px; border-radius: 9999px; background-color: ${sevColors.bg}; color: ${sevColors.text}; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                      ${sevColors.badge}
                    </span>
                    <span style="display: inline-block; margin-left: 8px; font-size: 12px; font-weight: 700; color: #475569; text-transform: capitalize;">
                      • ${category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td align="right" style="font-size: 11px; color: #94a3b8; font-weight: 600;">
                    ${date}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 32px;">
              ${recipientName ? `<p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; font-weight: 600;">Dear ${recipientName},</p>` : ''}
              
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.4;">
                ${subject}
              </h2>

              <div style="background-color: #f8fafc; border-left: 4px solid ${sevColors.bg}; padding: 18px 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #334155; white-space: pre-line;">
                  ${message}
                </p>
              </div>

              <!-- Emergency Instructions Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <tr>
                  <td>
                    <strong style="color: #1e40af; font-size: 13px; display: block; margin-bottom: 6px;">Safety Guidance & Emergency Assistance:</strong>
                    <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #1e3a8a; line-height: 1.6;">
                      <li>Follow all local administration and emergency responder directives immediately.</li>
                      <li>Stay tuned to FDRMC verified emergency broadcasts and avoid affected hazard zones.</li>
                      <li>For critical emergency response, dial the National Disaster Hotline: <strong style="color: #b91c1c;">939</strong>.</li>
                    </ul>
                  </td>
                </tr>
              </table>

              ${alertCode ? `<p style="margin: 0; font-size: 11px; font-family: monospace; color: #94a3b8;">Official Broadcast Reference: #${alertCode}</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
              <p style="margin: 0 0 6px 0; font-weight: 600;">Disaster Risk Management Commission (FDRMC) — Addis Ababa, Ethiopia</p>
              <p style="margin: 0; color: #94a3b8;">This is an automated priority emergency transmission. Please do not reply directly to this notification.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

/**
 * Send a single email message
 */
export const sendEmail = async ({
  to,
  recipientName = '',
  subject,
  text,
  html,
  type = 'Other',
  category = 'general',
  severity = 'normal',
  broadcastBatchId = '',
  sentBy = null,
  organizationId = null,
}) => {
  const { transporter, config } = await getTransporter();

  // Strict email address & domain validation
  const allowedDomainsList = config.allowedDomains
    ? config.allowedDomains.split(/[\s,;]+/).map((d) => d.trim()).filter(Boolean)
    : [];

  const emailValidation = validateEmailAddress(to, {
    allowedDomains: config.emailValidationMode === 'restricted_domains' ? allowedDomainsList : [],
  });

  if (!emailValidation.isValid) {
    throw new Error(emailValidation.error || `Invalid recipient email address: "${to}".`);
  }

  const normalizedTo = emailValidation.normalized;

  const logEntry = new EmailLog({
    recipient: normalizedTo,
    recipientName,
    subject,
    body: text || (html ? html.substring(0, 300) + '...' : ''),
    type,
    category,
    severity,
    broadcastBatchId,
    status: 'pending',
    folder: 'sent',
    sentBy: sentBy || null,
    organizationId: organizationId || null,
  });

  const startTime = Date.now();

  try {
    const fromHeader = `"${config.fromName || 'FDRMC'}" <${config.fromEmail || config.user}>`;

    // If html is not provided, wrap message in professional emergency disaster template
    const finalHtml =
      html ||
      renderDisasterAlertHtml({
        subject,
        message: text || subject,
        category,
        severity,
        recipientName,
        alertCode: broadcastBatchId,
      });

    const mailOptions = {
      from: fromHeader,
      to: normalizedTo,
      subject,
      text: text || subject,
      html: finalHtml,
    };

    if (config.replyTo) {
      mailOptions.replyTo = config.replyTo;
    }

    const info = await transporter.sendMail(mailOptions);
    const latencyMs = Date.now() - startTime;

    logEntry.status = 'sent';
    logEntry.messageId = info.messageId;
    await logEntry.save();

    console.log(`[EmailService] Email sent (${latencyMs}ms): ${info.messageId} to ${to}`);
    return { ...info, latencyMs };
  } catch (error) {
    console.error('[EmailService] Error sending email: ', error.message);
    logEntry.status = 'failed';
    logEntry.error = error.message;
    await logEntry.save();
    throw error;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send batch broadcast emails with configurable rate limiting (TPS) and live WebSocket progress emissions
 */
export const sendBatchEmail = async ({
  recipients = [],
  subject,
  body,
  html,
  category = 'general',
  severity = 'normal',
  type = 'Alert',
  broadcastBatchId = `BATCH-EMAIL-${Date.now()}`,
  sentBy = null,
  organizationId = null,
  onProgress = null,
}) => {
  const config = await getActiveEmailConfig();
  const maxTps = Math.max(1, Math.min(50, config.maxTps || 5)); // Safe TPS chunking to avoid SMTP provider bans

  let sent = 0;
  let failed = 0;
  const results = [];
  const total = recipients.length;

  console.log(`[EmailService] Starting broadcast ${broadcastBatchId} for ${total} recipients at ${maxTps} emails/sec...`);

  // Process in chunks respecting maxTps per second
  for (let i = 0; i < total; i += maxTps) {
    const chunk = recipients.slice(i, i + maxTps);
    const chunkStartTime = Date.now();

    const chunkPromises = chunk.map(async (item) => {
      const to = typeof item === 'string' ? item : item.email;
      const recipientName = typeof item === 'object' ? item.name || item.fullName : '';
      if (!to) return null;

      try {
        const info = await sendEmail({
          to,
          recipientName,
          subject,
          text: body,
          html,
          type,
          category,
          severity,
          broadcastBatchId,
          sentBy,
          organizationId,
        });
        sent++;
        return { email: to, success: true, messageId: info.messageId };
      } catch (err) {
        failed++;
        return { email: to, success: false, error: err.message };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults.filter(Boolean));

    // Emit live WebSocket progress
    const progressData = {
      batchId: broadcastBatchId,
      total,
      sent,
      failed,
      completed: sent + failed,
      percent: Math.round(((sent + failed) / total) * 100),
    };

    emitDashboardEvent('email:broadcast:progress', progressData);
    if (typeof onProgress === 'function') {
      onProgress(progressData);
    }

    // Rate limiting: sleep remainder of the second if more chunks remain
    const elapsed = Date.now() - chunkStartTime;
    if (i + maxTps < total && elapsed < 1000) {
      await sleep(1000 - elapsed);
    }
  }

  emitDashboardEvent('email:broadcast:completed', {
    batchId: broadcastBatchId,
    total,
    sent,
    failed,
  });

  console.log(`[EmailService] Completed broadcast ${broadcastBatchId}: ${sent} sent, ${failed} failed.`);

  return {
    total,
    sent,
    failed,
    broadcastBatchId,
    results,
  };
};

export const saveDraft = async ({ to, subject, text, html, type = 'Manual' }) => {
  const logEntry = new EmailLog({
    recipient: to,
    subject,
    body: text || (html ? html.substring(0, 200) + '...' : ''),
    type,
    status: 'pending',
    folder: 'draft',
  });
  return await logEntry.save();
};

export const sendVerificationEmail = async (email, code) => {
  const subject = 'Verify your account';
  const text = `Your verification code is: ${code}`;
  const html = VERIFICATION_EMAIL_TEMPLATE.replace('{verificationCode}', code);
  await sendEmail({ to: email, subject, text, html, type: 'Verification' });
};

export const sendWelcomeEmail = async (email, fullname, password) => {
  const defaultPass = password || process.env.DEFAULT_PASSWORD || '123456';
  const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginURL = `${clientUrl}/login`;

  const subject = 'Welcome to IDRMIS - Your Account Credentials';
  const text = `Hello ${fullname}, welcome to IDRMIS! Your account is now active.\n\nYour Login Credentials:\nEmail: ${email}\nDefault Password: ${defaultPass}\n\nPlease login at: ${loginURL}`;
  const html = WELCOME_EMAIL_TEMPLATE
    .replace('{name}', fullname || 'User')
    .replace('{email}', email)
    .replace('{password}', defaultPass)
    .replace('{loginURL}', loginURL);

  await sendEmail({ to: email, subject, text, html, type: 'Welcome' });
};

export const sendPasswordResetEmail = async (email, resetURL) => {
  console.log(`Sending Password Reset Email to ${email} with URL: ${resetURL}`);
  const subject = 'Reset Your Password';
  const text = `To reset your password, click the following link: ${resetURL}`;
  const html = PASSWORD_RESET_REQUEST_TEMPLATE.replace('{resetURL}', resetURL);
  await sendEmail({ to: email, subject, text, html, type: 'PasswordReset' });
};

export const sendResetSuccessEmail = async (email) => {
  const subject = 'Your Password Has Been Reset Successfully';
  const text = 'Your password has been successfully reset. If you did not make this request, please contact administrator immediately.';
  const html = PASSWORD_RESET_SUCCESS_TEMPLATE;
  await sendEmail({ to: email, subject, text, html, type: 'PasswordResetSuccess' });
};

export const sendAccountSetupEmail = async (email, setupURL) => {
  const subject = 'Initialize Your IDRMIS Account';
  const text = `You have been invited to IDRMIS. Click here to initialize your account: ${setupURL}`;
  const html = ACCOUNT_SETUP_TEMPLATE.replace('{setupURL}', setupURL);
  await sendEmail({ to: email, subject, text, html, type: 'AccountSetup' });
};

export const generateAlertEmailHtml = renderDisasterAlertHtml;

export const sendBroadcastEmail = async ({
  recipients = [],
  subject,
  message,
  category = 'general',
  severity = 'normal',
  sourceAuthority = 'FDRMC',
  broadcastBatchId = null,
}) => {
  const formattedRecipients = recipients.map((r) =>
    typeof r === 'string' ? { email: r } : { email: r.email, name: r.fullName || r.name }
  );
  const html = renderDisasterAlertHtml({
    subject,
    message,
    category,
    severity,
  });

  return await sendBatchEmail({
    recipients: formattedRecipients,
    subject,
    text: message,
    html,
    category,
    severity,
    broadcastBatchId,
  });
};

