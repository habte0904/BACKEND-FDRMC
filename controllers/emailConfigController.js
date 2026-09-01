import EmailConfig from '../models/EmailConfig.js';
import { testEmailConnection, sendEmail, DEFAULT_EMAIL_CONFIG } from '../services/emailService.js';
import * as auditService from '../services/auditService.js';

// GET /api/email-config
export const getEmailConfig = async (req, res) => {
  try {
    let config = await EmailConfig.findOne({ isActive: true }).lean();
    if (!config) {
      const created = await EmailConfig.create(DEFAULT_EMAIL_CONFIG);
      config = created.toObject();
    }
    res.json(config);
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

    if (!config) {
      config = new EmailConfig({
        ...DEFAULT_EMAIL_CONFIG,
        ...payload,
        updatedBy: req.user?._id,
      });
      await config.save();
    } else {
      Object.assign(config, payload);
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

    res.json({
      message: 'Email & SMTP Gateway configuration saved successfully',
      config,
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
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #0284c7;">IDRMIS Email Gateway Test</h2>
          <p>${testMessage}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Verified at ${new Date().toISOString()}</p>
        </div>
      `,
      type: 'Other',
      category: 'test',
    });

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMAIL_SEND_TEST',
      resource: 'EmailLog',
      after: { recipient: to, messageId: result.messageId },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${to}`,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('sendTestEmail error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to send test email' });
  }
};
