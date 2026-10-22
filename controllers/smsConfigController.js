import SmsConfig from '../models/SmsConfig.js';
import { testSmppConnection, DEFAULT_SMS_CONFIG, sendSingleSms } from '../services/smppService.js';
import * as auditService from '../services/auditService.js';
import { encryptConfig, decryptConfig } from '../utils/fieldEncryption.js';

// GET /api/sms-config
export const getSmsConfig = async (req, res) => {
  try {
    let config = await SmsConfig.findOne({ isActive: true }).lean();
    if (!config) {
      // Seed a default encrypted config — all fields encrypted at rest
      const defaultPayload = encryptConfig({
        host:                 process.env.SMPP_HOST || '10.204.181.70',
        port:                 parseInt(process.env.SMPP_PORT || '5019', 10),
        protocol:             DEFAULT_SMS_CONFIG.protocol,
        systemType:           DEFAULT_SMS_CONFIG.systemType,
        sourceAddr:           DEFAULT_SMS_CONFIG.sourceAddr,
        sourceAddrTon:        DEFAULT_SMS_CONFIG.sourceAddrTon,
        sourceAddrNpi:        DEFAULT_SMS_CONFIG.sourceAddrNpi,
        destAddrTon:          DEFAULT_SMS_CONFIG.destAddrTon,
        destAddrNpi:          DEFAULT_SMS_CONFIG.destAddrNpi,
        dataCoding:           0,
        enquireLinkIntervalMs: 30000,
        reconnectIntervalMs:  10000,
        maxTps:               20,
        dlrEnabled:           true,
        isActive:             true,
      });
      const created = await SmsConfig.create(defaultPayload);
      config = created.toObject();
    }

    // Decrypt string fields from DB
    const decrypted = decryptConfig(config);

    // Inject .env-managed secrets as read-only display values
    // Password is ALWAYS masked — never sent to the frontend in plain text
    res.json({
      ...decrypted,
      systemId: process.env.SMPP_SYSTEM_ID || '••••',   // read-only, from .env
      password: '••••••••',                              // always masked
      host: decrypted.host || process.env.SMPP_HOST,    // DB override or .env fallback
      port: decrypted.port || parseInt(process.env.SMPP_PORT, 10),
      httpApiKey: decrypted.httpApiKey ? '••••••••' : null, // masked for security
      hasHttpApiKey: Boolean(decrypted.httpApiKey),
    });
  } catch (error) {
    console.error('getSmsConfig error:', error);
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/sms-config
export const updateSmsConfig = async (req, res) => {
  try {
    // Strip .env-managed secrets — they cannot be overwritten via the API
    // eslint-disable-next-line no-unused-vars
    const { password, systemId, ...adminPayload } = req.body || {};

    // Validate protocol plain-text value BEFORE encrypting
    const VALID_PROTOCOLS = ['SMPP3.4', 'SMPP5.0', 'HTTP', 'REST'];
    if (adminPayload.protocol && !VALID_PROTOCOLS.includes(adminPayload.protocol)) {
      return res.status(400).json({
        message: `Invalid protocol. Must be one of: ${VALID_PROTOCOLS.join(', ')}`,
      });
    }

    let config = await SmsConfig.findOne({ isActive: true });
    const before = config ? config.toObject() : null;

    // If httpApiKey is masked '••••••••', preserve previous key
    if (adminPayload.httpApiKey === '••••••••' || adminPayload.httpApiKey === '••••') {
      const existingDecrypted = config ? decryptConfig(config.toObject()) : {};
      adminPayload.httpApiKey = existingDecrypted.httpApiKey || null;
    }

    // Encrypt string fields before saving
    const encryptedPayload = encryptConfig(adminPayload);

    if (!config) {
      config = new SmsConfig({
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
      action: 'SMS_CONFIG_UPDATE',
      resource: 'SmsConfig',
      resourceId: config._id,
      before,
      after: config.toObject(),
      ip: req.ip,
    });

    // Return the decrypted version so the UI reflects what was saved
    const decrypted = decryptConfig(config.toObject());
    res.json({
      message: 'SMS Gateway configuration updated successfully',
      config: {
        ...decrypted,
        systemId: process.env.SMPP_SYSTEM_ID || '••••',
        password: '••••••••',
        host: decrypted.host || process.env.SMPP_HOST,
        port: decrypted.port || parseInt(process.env.SMPP_PORT, 10),
        httpApiKey: decrypted.httpApiKey ? '••••••••' : null,
        hasHttpApiKey: Boolean(decrypted.httpApiKey),
      },
    });
  } catch (error) {
    console.error('updateSmsConfig error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-config/test-connection
export const testConnection = async (req, res) => {
  try {
    // Test uses live config from DB (decrypted) merged with .env secrets — no override from body
    const result = await testSmppConnection();

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

