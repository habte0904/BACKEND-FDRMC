import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  VERIFICATION_EMAIL_TEMPLATE,
  WELCOME_EMAIL_TEMPLATE,
  PASSWORD_RESET_REQUEST_TEMPLATE,
  PASSWORD_RESET_SUCCESS_TEMPLATE,
  ACCOUNT_SETUP_TEMPLATE
} from '../utils/emailTemplates.js';
import EmailLog from '../models/EmailLog.js';
import EmailConfig from '../models/EmailConfig.js';

dotenv.config();

export const DEFAULT_EMAIL_CONFIG = {
  service: 'Gmail',
  host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_SMTP_PORT || '587', 10),
  secure: process.env.EMAIL_SMTP_SECURE === 'true',
  user: process.env.EMAIL_USER || 'petrosh122@gmail.com',
  pass: process.env.EMAIL_PASS || 'yyfq thbc kcno dddo',
  fromName: 'IDRMIS Early Warning & Comms',
  fromEmail: process.env.EMAIL_USER || 'petrosh122@gmail.com',
  replyTo: '',
  enableOtp: true,
  enableAlertBroadcast: true,
  isActive: true,
};

let cachedTransporter = null;
let lastConfigVersion = null;

/**
 * Get active email configuration from DB or fallback to .env/defaults
 */
export const getActiveEmailConfig = async () => {
  try {
    let config = await EmailConfig.findOne({ isActive: true }).lean();
    if (!config) {
      const created = await EmailConfig.create(DEFAULT_EMAIL_CONFIG);
      config = created.toObject();
    }
    return config;
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

  // Custom SMTP server configuration (e.g. Office365, Mailgun, SendGrid, Internal Postfix/Exchange)
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port || 587,
    secure: cfg.secure || cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert issues on enterprise intranet relays
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
 * Send an email message
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
  broadcastBatchId = ''
}) => {
  const logEntry = new EmailLog({
    recipient: to,
    recipientName,
    subject,
    body: text || (html ? html.substring(0, 200) + '...' : ''),
    type,
    category,
    severity,
    broadcastBatchId,
    status: 'pending',
    folder: 'sent'
  });

  try {
    const { transporter, config } = await getTransporter();
    const fromHeader = `"${config.fromName || 'IDRMIS'}" <${config.fromEmail || config.user}>`;

    const mailOptions = {
      from: fromHeader,
      to,
      subject,
      text,
      html,
    };
    if (config.replyTo) {
      mailOptions.replyTo = config.replyTo;
    }

    const info = await transporter.sendMail(mailOptions);

    logEntry.status = 'sent';
    logEntry.messageId = info.messageId;
    await logEntry.save();

    console.log(`[EmailService] Email sent: ${info.messageId} to ${to}`);
    return info;
  } catch (error) {
    console.error('[EmailService] Error sending email: ', error);
    logEntry.status = 'failed';
    logEntry.error = error.message;
    await logEntry.save();
    throw error;
  }
};

export const saveDraft = async ({ to, subject, text, html, type = 'Manual' }) => {
  const logEntry = new EmailLog({
    recipient: to,
    subject,
    body: text || (html ? html.substring(0, 200) + '...' : ''),
    type,
    status: 'pending',
    folder: 'draft'
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
  const subject = 'Password Reset Successful';
  const text = `Your password has been successfully reset.`;
  const html = PASSWORD_RESET_SUCCESS_TEMPLATE;
  await sendEmail({ to: email, subject, text, html, type: 'PasswordReset' });
};

export const sendAccountSetupEmail = async (email, setupURL) => {
  const subject = 'Set Up Your IDRMIS Account';
  const text = `Welcome to IDRMIS. Please set up your account by clicking the following link: ${setupURL}`;
  const html = ACCOUNT_SETUP_TEMPLATE.replace('{setupURL}', setupURL);
  await sendEmail({ to: email, subject, text, html, type: 'AccountSetup' });
};

/**
 * Generate formatted HTML template for Alert Broadcast emails
 */
export const generateAlertEmailHtml = ({ title, message, category, severity, sourceAuthority }) => {
  const severityColors = {
    emergency: '#dc2626',
    high: '#ea580c',
    medium: '#d97706',
    warning: '#eab308',
    low: '#2563eb',
    info: '#0284c7',
  };
  const color = severityColors[String(severity).toLowerCase()] || '#dc2626';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
      <tr>
        <td style="background-color: ${color}; padding: 24px; text-align: left; color: #ffffff;">
          <p style="margin: 0 0 6px 0; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; opacity: 0.9;">
            IDRMIS Emergency Comms • ${category.toUpperCase()}
          </p>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">${title}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 28px 24px;">
          <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #475569;">
            <strong>Issued By:</strong> ${sourceAuthority || 'Disaster Risk Management Commission'} &nbsp;|&nbsp;
            <strong>Priority:</strong> <span style="text-transform: capitalize; color: ${color}; font-weight: bold;">${severity}</span> &nbsp;|&nbsp;
            <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style="font-size: 15px; line-height: 1.7; color: #334155; white-space: pre-wrap;">
${message}
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
            <p style="margin: 0;">You received this alert because you subscribed to disaster warning notifications.</p>
            <p style="margin: 4px 0 0 0;">Integrated Disaster Risk Management Information System (IDRMIS)</p>
          </div>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

/**
 * Send batch broadcast emails to alert subscription clients
 */
export const sendBroadcastEmail = async ({
  recipients,
  subject,
  message,
  category = 'general',
  severity = 'normal',
  sourceAuthority = 'Disaster Risk Management',
  broadcastBatchId = '',
}) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  const html = generateAlertEmailHtml({
    title: subject,
    message,
    category,
    severity,
    sourceAuthority,
  });

  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const item of recipients) {
    const email = typeof item === 'string' ? item : item.email;
    const name = typeof item === 'string' ? '' : (item.name || item.fullName || '');

    if (!email) continue;

    try {
      const res = await sendEmail({
        to: email,
        recipientName: name,
        subject,
        text: message,
        html,
        type: 'Alert',
        category,
        severity,
        broadcastBatchId,
      });

      sentCount++;
      results.push({ success: true, email, messageId: res.messageId });
    } catch (err) {
      failedCount++;
      results.push({ success: false, email, error: err.message });
    }
  }

  return {
    total: recipients.length,
    sent: sentCount,
    failed: failedCount,
    results,
  };
};
