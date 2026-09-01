import smpp from 'smpp';
import SmsConfig from '../models/SmsConfig.js';
import SmsLog from '../models/SmsLog.js';

// Default configuration constants
export const DEFAULT_SMS_CONFIG = {
  systemId: process.env.SMSC_SYSTEM_ID || '6524',
  password: process.env.SMSC_PASSWORD || 'Aacai$73',
  host: process.env.SMSC_HOST || '10.204.181.70',
  port: parseInt(process.env.SMSC_PORT || '5019', 10),
  protocol: 'SMPP3.4',
  systemType: '',
  sourceAddr: 'IDRMIS',
  sourceAddrTon: 5,
  sourceAddrNpi: 0,
  destAddrTon: 1,
  destAddrNpi: 1,
};

let activeSession = null;
let isConnecting = false;
let connectionListeners = [];

/**
 * Get active SMS gateway configuration from DB or defaults
 */
export const getActiveSmsConfig = async () => {
  try {
    let config = await SmsConfig.findOne({ isActive: true }).lean();
    if (!config) {
      // Seed default config in database
      const created = await SmsConfig.create(DEFAULT_SMS_CONFIG);
      config = created.toObject();
    }
    return config;
  } catch (error) {
    console.error('[SMPP] Error loading SmsConfig from DB, using fallback defaults:', error);
    return DEFAULT_SMS_CONFIG;
  }
};

/**
 * Normalize phone number for SMS delivery
 */
export const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  // If local Ethiopian number (e.g. 0912345678 or 0712345678), convert to 2519... or 2517...
  if (/^0[97]\d{8}$/.test(cleaned)) {
    cleaned = '251' + cleaned.substring(1);
  }
  return cleaned;
};

/**
 * Detect if text contains non-ASCII characters (e.g. Amharic / Ge'ez)
 */
const isUnicode = (text) => {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) {
      return true;
    }
  }
  return false;
};

/**
 * Prepare message payload and data_coding for SMPP submit_sm
 */
const encodeMessage = (text) => {
  if (isUnicode(text)) {
    // UCS-2 (UTF-16BE) encoding for Amharic / non-ASCII
    const buffer = Buffer.from(text, 'utf16le');
    // Swap bytes to Big-Endian (UCS-2BE)
    for (let i = 0; i < buffer.length; i += 2) {
      const temp = buffer[i];
      buffer[i] = buffer[i + 1];
      buffer[i + 1] = temp;
    }
    return {
      short_message: buffer,
      data_coding: 8, // UCS-2
    };
  }
  return {
    short_message: text,
    data_coding: 0, // Default alphabet (GSM 7-bit / ASCII)
  };
};

/**
 * Establish a single-use or bound session to the SMSC
 */
export const createSmppSession = (config) => {
  return new Promise((resolve, reject) => {
    const host = config.host || DEFAULT_SMS_CONFIG.host;
    const port = config.port || DEFAULT_SMS_CONFIG.port;
    const systemId = config.systemId || DEFAULT_SMS_CONFIG.systemId;
    const password = config.password || DEFAULT_SMS_CONFIG.password;
    const systemType = config.systemType || '';

    let isSettled = false;
    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try { session.close(); } catch (_) {}
        reject(new Error(`SMPP Connection to ${host}:${port} timed out after 10 seconds`));
      }
    }, 10000);

    const session = smpp.connect({
      url: `smpp://${host}:${port}`,
      auto_enquire_link_period: 30000,
    });

    session.on('error', (err) => {
      console.error('[SMPP] Session error:', err.message);
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeoutTimer);
        reject(err);
      }
    });

    session.on('close', () => {
      console.log('[SMPP] Session closed');
    });

    session.on('connect', () => {
      console.log(`[SMPP] Connected to SMSC ${host}:${port}, sending bind_transceiver...`);
      session.bind_transceiver(
        {
          system_id: systemId,
          password: password,
          system_type: systemType,
          interface_version: 0x34, // SMPP 3.4
        },
        (pdu) => {
          clearTimeout(timeoutTimer);
          if (isSettled) return;
          isSettled = true;

          if (pdu.command_status === 0) {
            console.log(`[SMPP] bind_transceiver successful! System ID: ${systemId}`);
            resolve(session);
          } else {
            const errMsg = `SMPP bind failed with command_status: 0x${pdu.command_status.toString(16)}`;
            console.error(`[SMPP] ${errMsg}`);
            try { session.close(); } catch (_) {}
            reject(new Error(errMsg));
          }
        }
      );
    });
  });
};

/**
 * Test connectivity & bind status against SMSC
 */
export const testSmppConnection = async (overrideConfig = null) => {
  const config = overrideConfig ? { ...DEFAULT_SMS_CONFIG, ...overrideConfig } : await getActiveSmsConfig();
  const startTime = Date.now();

  try {
    const session = await createSmppSession(config);
    const latency = Date.now() - startTime;

    // Unbind and close session cleanly
    await new Promise((res) => {
      try {
        session.unbind(() => {
          session.close();
          res();
        });
      } catch (_) {
        session.close();
        res();
      }
    });

    const result = {
      success: true,
      message: `Successfully connected & bound to SMSC (${config.host}:${config.port}) via SMPP 3.4 in ${latency}ms.`,
      latency,
      testedAt: new Date(),
    };

    // Update config in DB if saved
    if (config._id) {
      await SmsConfig.findByIdAndUpdate(config._id, {
        lastTestedAt: result.testedAt,
        lastTestStatus: 'success',
        lastTestMessage: result.message,
      });
    }

    return result;
  } catch (error) {
    const result = {
      success: false,
      message: error.message || 'Failed to connect to SMSC gateway',
      latency: Date.now() - startTime,
      testedAt: new Date(),
    };

    if (config._id) {
      await SmsConfig.findByIdAndUpdate(config._id, {
        lastTestedAt: result.testedAt,
        lastTestStatus: 'failed',
        lastTestMessage: result.message,
      });
    }

    return result;
  }
};

/**
 * Send a single SMS via SMPP 3.4 and record to SmsLog
 */
export const sendSingleSms = async ({
  phone,
  recipientName = '',
  message,
  category = 'general',
  severity = 'normal',
  messageType = 'single',
  senderId,
  broadcastBatchId = '',
  sentBy = null,
}) => {
  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    throw new Error('Valid phone number is required');
  }
  if (!message || !message.trim()) {
    throw new Error('SMS message body is required');
  }

  const config = await getActiveSmsConfig();
  const finalSenderId = senderId || config.sourceAddr || 'IDRMIS';

  // Create log entry in DB
  const smsLog = new SmsLog({
    recipientPhone: normalizedPhone,
    recipientName,
    message,
    category,
    severity,
    messageType,
    senderId: finalSenderId,
    broadcastBatchId,
    sentBy,
    status: 'pending',
  });
  await smsLog.save();

  try {
    const session = await createSmppSession(config);
    const { short_message, data_coding } = encodeMessage(message);

    const submitResult = await new Promise((resolve, reject) => {
      session.submit_sm(
        {
          source_addr: finalSenderId,
          source_addr_ton: config.sourceAddrTon ?? 5,
          source_addr_npi: config.sourceAddrNpi ?? 0,
          dest_addr_ton: config.destAddrTon ?? 1,
          dest_addr_npi: config.destAddrNpi ?? 1,
          destination_addr: normalizedPhone,
          short_message: short_message,
          data_coding: data_coding,
        },
        (pdu) => {
          if (pdu.command_status === 0) {
            resolve(pdu);
          } else {
            reject(new Error(`submit_sm failed with status 0x${pdu.command_status.toString(16)}`));
          }
        }
      );
    });

    // Close session gracefully
    try {
      session.unbind(() => session.close());
    } catch (_) {
      session.close();
    }

    smsLog.status = 'sent';
    smsLog.messageId = submitResult.message_id || '';
    smsLog.deliveredAt = new Date();
    await smsLog.save();

    return {
      success: true,
      logId: smsLog._id,
      messageId: smsLog.messageId,
      recipientPhone: normalizedPhone,
    };
  } catch (error) {
    console.error(`[SMPP] Failed to send SMS to ${normalizedPhone}:`, error.message);
    smsLog.status = 'failed';
    smsLog.errorDetails = error.message;
    await smsLog.save();

    return {
      success: false,
      logId: smsLog._id,
      error: error.message,
      recipientPhone: normalizedPhone,
    };
  }
};

/**
 * Send batch broadcast SMS to multiple recipients
 */
export const sendBatchSms = async ({
  recipients, // Array of { phone, name } or string[]
  message,
  category = 'general',
  severity = 'normal',
  senderId,
  broadcastBatchId = '',
  sentBy = null,
}) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  const results = [];
  let sentCount = 0;
  let failedCount = 0;

  // Process sequentially or small batches to respect SMSC throughput
  for (const item of recipients) {
    const phone = typeof item === 'string' ? item : item.phone;
    const name = typeof item === 'string' ? '' : (item.name || item.fullName || '');

    if (!phone) continue;

    try {
      const res = await sendSingleSms({
        phone,
        recipientName: name,
        message,
        category,
        severity,
        messageType: 'broadcast',
        senderId,
        broadcastBatchId,
        sentBy,
      });

      results.push(res);
      if (res.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    } catch (err) {
      failedCount++;
      results.push({
        success: false,
        recipientPhone: phone,
        error: err.message,
      });
    }
  }

  return {
    total: recipients.length,
    sent: sentCount,
    failed: failedCount,
    results,
  };
};
