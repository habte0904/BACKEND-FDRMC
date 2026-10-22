import EmailConfig from '../models/EmailConfig.js';
import { testEmailConnection, sendEmail, DEFAULT_EMAIL_CONFIG } from '../services/emailService.js';
import * as auditService from '../services/auditService.js';
import { encryptEmailConfig, decryptEmailConfig } from '../utils/fieldEncryption.js';

// GET /api/email-config
export const getEmailConfig = async (req, res) => {
  try {
    let config = await EmailConfig.findOne({ isActive: true }).lean();
    if (!config) {
      config = null;
    }

    const decrypted = config ? decryptEmailConfig(config) : {};

    const service = decrypted.service || process.env.EMAIL_SERVICE || 'Gmail';
    const isGmail = service.toLowerCase() === 'gmail';
    const host = decrypted.host || process.env.EMAIL_SMTP_HOST || (isGmail ? 'smtp.gmail.com' : 'localhost');
    const port = decrypted.port || parseInt(process.env.EMAIL_SMTP_PORT || (isGmail ? '587' : '25'), 10);
    const user = process.env.EMAIL_USER || process.env.EMAIL_SMTP_USER || decrypted.user || '';
    const hasPass = Boolean(process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASS || decrypted.pass);

    // Password is ALWAYS masked — never sent to frontend in plain text
    res.json({
      _id: config?._id,
      service,
      host,
      port,
      secure: decrypted.secure ?? (process.env.EMAIL_SMTP_SECURE === 'true' || port === 465),
      authType: decrypted.authType || 'login',
      user,
      pass: hasPass ? '••••••••' : '',
      hasPass,
      fromName: decrypted.fromName || 'FDRMC Early Warning & Comms',
      fromEmail: decrypted.fromEmail || user,
      replyTo: decrypted.replyTo || '',
      maxTps: decrypted.maxTps || 5,
      enableOtp: decrypted.enableOtp ?? true,
      enableAlertBroadcast: decrypted.enableAlertBroadcast ?? true,
      emailValidationMode: decrypted.emailValidationMode || 'strict',
      allowedDomains: decrypted.allowedDomains || '',
      isActive: true,
      lastTestedAt: config?.lastTestedAt,
      lastTestStatus: config?.lastTestStatus,
      lastTestMessage: config?.lastTestMessage,
    });
  } catch (error) {
    console.error('getEmailConfig error:', error);
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/email-config
export const updateEmailConfig = async (req, res) => {
  try {
    const payload = req.body || {};
    let config = await EmailConfig.findOne({ isActive: true });
    const before = config ? config.toObject() : null;

    // If password sent as masked '••••••••' or empty, preserve previous encrypted password
    if (payload.pass === '••••••••' || payload.pass === '••••' || !payload.pass) {
      const existingDecrypted = config ? decryptEmailConfig(config.toObject()) : {};
      payload.pass = existingDecrypted.pass || null;
    }

    // Encrypt sensitive string fields (AES-256-GCM) before storing in DB
    const encryptedPayload = encryptEmailConfig(payload);

    if (!config) {
      config = new EmailConfig({
        ...encryptedPayload,
        updatedBy: req.user?._id,
      });
      await config.save();
    } else {
      Object.assign(config, encryptedPayload);
      config.updatedBy = req.user?._id;
      await config.save();
    }

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMAIL_CONFIG_UPDATE',
      resource: 'EmailConfig',
      resourceId: config._id,
      before,
      after: config.toObject(),
      ip: req.ip,
    });

    const decrypted = decryptEmailConfig(config.toObject());
    const hasPass = Boolean(process.env.EMAIL_PASS || process.env.EMAIL_SMTP_PASS || decrypted.pass);

    res.json({
      message: 'Email & SMTP Gateway configuration saved successfully',
      config: {
        ...decrypted,
        pass: hasPass ? '••••••••' : '',
        hasPass,
      },
    });
  } catch (error) {
    console.error('updateEmailConfig error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/email-config/test-connection
export const testConnection = async (req, res) => {
  try {
    const overrideConfig = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    const result = await testEmailConnection(overrideConfig);

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMAIL_CONNECTION_TEST',
      resource: 'EmailConfig',
      after: result,
      ip: req.ip,
    });

    res.json(result);
  } catch (error) {
    console.error('testConnection error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/email-config/send-test-email
export const sendTestEmail = async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    if (!to) {
      return res.status(400).json({ message: 'Target recipient email address is required' });
    }

    const testSubject = subject || 'Test Notification from IDRMIS Email Gateway';
    const testMessage = message || 'This is a test notification verifying your IDRMIS SMTP configuration for OTP and Alert subscription broadcasts.';

    const result = await sendEmail({
      to,
      subject: testSubject,
      text: testMessage,
      type: 'Test',
      sentBy: req.user?._id,
    });

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMAIL_SEND_TEST',
      resource: 'EmailLog',
      resourceId: result.messageId,
      after: result,
      ip: req.ip,
    });

    res.json({ success: true, message: `Test email sent successfully to ${to}`, result });
  } catch (error) {
    console.error('sendTestEmail error:', error);
    res.status(500).json({ message: error.message });
  }
};
