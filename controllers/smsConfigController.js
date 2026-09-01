import SmsConfig from '../models/SmsConfig.js';
import { testSmppConnection, DEFAULT_SMS_CONFIG, sendSingleSms } from '../services/smppService.js';
import * as auditService from '../services/auditService.js';

// GET /api/sms-config
export const getSmsConfig = async (req, res) => {
  try {
    let config = await SmsConfig.findOne({ isActive: true }).lean();
    if (!config) {
      const created = await SmsConfig.create(DEFAULT_SMS_CONFIG);
      config = created.toObject();
    }

    // Mask password partially for security on display if needed, but allow admin to view/edit
    res.json(config);
  } catch (error) {
    console.error('getSmsConfig error:', error);
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/sms-config
export const updateSmsConfig = async (req, res) => {
  try {
    const payload = req.body || {};
    let config = await SmsConfig.findOne({ isActive: true });

    const before = config ? config.toObject() : null;

    if (!config) {
      config = new SmsConfig({
        ...DEFAULT_SMS_CONFIG,
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
      action: 'SMS_CONFIG_UPDATE',
      resource: 'SmsConfig',
      resourceId: config._id,
      before,
      after: config.toObject(),
      ip: req.ip,
    });

    res.json({
      message: 'SMS Gateway configuration updated successfully',
      config,
    });
  } catch (error) {
    console.error('updateSmsConfig error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-config/test-connection
export const testConnection = async (req, res) => {
  try {
    const overrideConfig = req.body && Object.keys(req.body).length > 0 ? req.body : null;
    const result = await testSmppConnection(overrideConfig);

    await auditService.logAction({
      userId: req.user?._id,
      action: 'SMS_CONNECTION_TEST',
      resource: 'SmsConfig',
      after: result,
      ip: req.ip,
    });

    res.json(result);
  } catch (error) {
    console.error('testConnection error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/sms-config/send-test-sms
export const sendTestSms = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) {
      return res.status(400).json({ message: 'Target phone number is required' });
    }

    const testMessage = message || 'Test alert message from IDRMIS SMPP 3.4 Gateway.';
    const result = await sendSingleSms({
      phone,
      message: testMessage,
      category: 'test',
      severity: 'info',
      messageType: 'test',
      sentBy: req.user?._id,
    });

    await auditService.logAction({
      userId: req.user?._id,
      action: 'SMS_SEND_TEST',
      resource: 'SmsLog',
      resourceId: result.logId,
      after: result,
      ip: req.ip,
    });

    if (result.success) {
      res.json({ success: true, message: `Test SMS sent successfully to ${phone}`, result });
    } else {
      res.status(500).json({ success: false, message: result.error || 'Failed to send test SMS', result });
    }
  } catch (error) {
    console.error('sendTestSms error:', error);
    res.status(500).json({ message: error.message });
  }
};
