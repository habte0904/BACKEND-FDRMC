import smpp from 'smpp';
import SmsConfig from '../models/SmsConfig.js';
import SmsLog from '../models/SmsLog.js';
import { decryptConfig } from '../utils/fieldEncryption.js';
import { validateAndNormalizeEthiopianPhone } from '../utils/telecomValidator.js';
import { emitDashboardEvent } from './socketService.js';

/**
 * Non-secret defaults for admin-configurable fields.
 * Secrets (systemId, password, host, port) always come from .env at runtime.
 */
export const DEFAULT_SMS_CONFIG = {
  // Secrets — always from .env, never hardcoded
  systemId: process.env.SMPP_SYSTEM_ID,
  password:  process.env.SMPP_PASSWORD,
  host:      process.env.SMPP_HOST      || '10.204.181.70',
  port:      parseInt(process.env.SMPP_PORT || '5019', 10),
  // Admin-configurable defaults
  protocol:         'SMPP3.4',
  systemType:       '',
  sourceAddr:       'FDRMC',
  sourceAddrTon:    5,
  sourceAddrNpi:    0,
  destAddrTon:      1,
  destAddrNpi:      1,
  dataCoding:       0,
  enquireLinkIntervalMs: 30000,
  reconnectIntervalMs:   10000,
  maxTps:           20,
  dlrEnabled:       true,
  // HTTP REST Gateway defaults
  httpEndpoint:     null,
  httpMethod:       'POST',
  httpAuthType:     'bearer',
  httpApiKey:       null,
  httpHeaders:      null,
  httpPayloadTemplate: null,
};

// ─── Module-level Persistent Connection State ─────────────────────────────────
let persistentSession = null;
let isConnecting = false;
let isBound = false;
let connectionPromise = null;
let heartbeatInterval = null;
let reconnectTimeout = null;

/**
 * Get active SMS gateway configuration from DB, decrypt admin-configurable fields,
 * then inject .env secrets (systemId, password, host, port) at runtime.
 */
export const getActiveSmsConfig = async () => {
  try {
    let dbConfig = await SmsConfig.findOne({ isActive: true }).lean();
    if (!dbConfig) {
      dbConfig = null;
    }

    // Decrypt admin-configurable string fields
    const decrypted = dbConfig ? decryptConfig(dbConfig) : {};

    return {
      // Admin-configurable fields from DB (decrypted), with defaults fallback
      protocol:              decrypted.protocol              || DEFAULT_SMS_CONFIG.protocol,
      systemType:            decrypted.systemType            || DEFAULT_SMS_CONFIG.systemType,
      sourceAddr:            decrypted.sourceAddr            || DEFAULT_SMS_CONFIG.sourceAddr,
      sourceAddrTon:         decrypted.sourceAddrTon         ?? DEFAULT_SMS_CONFIG.sourceAddrTon,
      sourceAddrNpi:         decrypted.sourceAddrNpi         ?? DEFAULT_SMS_CONFIG.sourceAddrNpi,
      destAddrTon:           decrypted.destAddrTon           ?? DEFAULT_SMS_CONFIG.destAddrTon,
      destAddrNpi:           decrypted.destAddrNpi           ?? DEFAULT_SMS_CONFIG.destAddrNpi,
      dataCoding:            decrypted.dataCoding            ?? DEFAULT_SMS_CONFIG.dataCoding,
      enquireLinkIntervalMs: decrypted.enquireLinkIntervalMs ?? DEFAULT_SMS_CONFIG.enquireLinkIntervalMs,
      reconnectIntervalMs:   decrypted.reconnectIntervalMs   ?? DEFAULT_SMS_CONFIG.reconnectIntervalMs,
      maxTps:                decrypted.maxTps                ?? DEFAULT_SMS_CONFIG.maxTps,
      dlrEnabled:            decrypted.dlrEnabled            ?? DEFAULT_SMS_CONFIG.dlrEnabled,
      // HTTP gateway fields
      httpEndpoint:          decrypted.httpEndpoint          || DEFAULT_SMS_CONFIG.httpEndpoint,
      httpMethod:            decrypted.httpMethod            || DEFAULT_SMS_CONFIG.httpMethod,
      httpAuthType:          decrypted.httpAuthType          || DEFAULT_SMS_CONFIG.httpAuthType,
      httpApiKey:            decrypted.httpApiKey            || DEFAULT_SMS_CONFIG.httpApiKey,
      httpHeaders:           decrypted.httpHeaders           || DEFAULT_SMS_CONFIG.httpHeaders,
      httpPayloadTemplate:   decrypted.httpPayloadTemplate   || DEFAULT_SMS_CONFIG.httpPayloadTemplate,
      // Validation policy
      phoneValidationMode:   dbConfig?.phoneValidationMode   || 'ethiopia_only',
      allowedOperators:      dbConfig?.allowedOperators      || ['ethio_telecom', 'safaricom'],
      // DB metadata
      _id:            dbConfig?._id,
      lastTestedAt:   dbConfig?.lastTestedAt,
      lastTestStatus: dbConfig?.lastTestStatus,
      // Secrets always from .env
      systemId: process.env.SMPP_SYSTEM_ID,
      password:  process.env.SMPP_PASSWORD,
      host:      decrypted.host || process.env.SMPP_HOST,
      port:      decrypted.port || parseInt(process.env.SMPP_PORT, 10),
    };
  } catch (error) {
    console.error('[SMS-GATEWAY] Error loading SmsConfig from DB, using fallback defaults:', error);
    return DEFAULT_SMS_CONFIG;
  }
};

/**
 * Normalize and validate phone number according to Ethiopian Telecom rules
 */
export const normalizePhoneNumber = (phone, options = {}) => {
  const result = validateAndNormalizeEthiopianPhone(phone, options);
  return result.isValid ? result.normalized : null;
};

/**
 * Detect if text contains non-ASCII characters (e.g. Amharic / Ge'ez script)
 */
export const isUnicode = (text) => {
  if (!text) return false;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) {
      return true;
    }
  }
  return false;
};

/**
 * Build 6-byte User Data Header (UDH) for Concatenated SMS (CSMS)
 */
const makeConcatUdh = (refNum, totalParts, partNum) => {
  return Buffer.from([
    0x05, // Length of UDH = 5 bytes following
    0x00, // Information Element Identifier: 8-bit Concatenated Short Message
    0x03, // Length of IE data: 3 bytes
    refNum & 0xff, // Batch reference number (0-255)
    totalParts & 0xff, // Total segments
    partNum & 0xff, // Current segment index (1-based)
  ]);
};

/**
 * Split and encode long text into single or multi-part SMPP segments (Amharic & English)
 */
export const prepareMessageSegments = (text) => {
  const isUni = isUnicode(text);
  const singleLimit = isUni ? 70 : 160;
  const multiLimit = isUni ? 67 : 153;

  if (text.length <= singleLimit) {
    // Single segment (no UDH needed)
    let buf;
    if (isUni) {
      const utf16 = Buffer.from(text, 'utf16le');
      buf = Buffer.alloc(utf16.length);
      for (let i = 0; i < utf16.length; i += 2) {
        buf[i] = utf16[i + 1];
        buf[i + 1] = utf16[i];
      }
    } else {
      buf = Buffer.from(text, 'latin1');
    }

    return [
      {
        short_message: isUni ? buf : text,
        esm_class: 0x00,
        data_coding: isUni ? 8 : 0,
        encoding: isUni ? 'UCS-2' : 'GSM-7',
      },
    ];
  }

  // Multi-part Concatenated SMS (CSMS)
  const totalParts = Math.ceil(text.length / multiLimit);
  const refNum = Math.floor(Math.random() * 255);
  const segments = [];

  for (let i = 0; i < totalParts; i++) {
    const chunkText = text.slice(i * multiLimit, (i + 1) * multiLimit);
    const udh = makeConcatUdh(refNum, totalParts, i + 1);

    let chunkBuf;
    if (isUni) {
      const utf16 = Buffer.from(chunkText, 'utf16le');
      chunkBuf = Buffer.alloc(utf16.length);
      for (let j = 0; j < utf16.length; j += 2) {
        chunkBuf[j] = utf16[j + 1];
        chunkBuf[j + 1] = utf16[j];
      }
    } else {
      chunkBuf = Buffer.from(chunkText, 'latin1');
    }

    segments.push({
      short_message: Buffer.concat([udh, chunkBuf]),
      esm_class: 0x40, // UDHI (User Data Header Indicator) enabled
      data_coding: isUni ? 8 : 0,
      encoding: isUni ? 'UCS-2' : 'GSM-7',
    });
  }

  return segments;
};

// ─── Delivery Receipt (DLR) Processor ─────────────────────────────────────────
const handleDeliveryReceipt = async (pdu) => {
  try {
    const msgText = pdu.short_message?.message || String(pdu.short_message || '');
    // Standard DLR format: "id:1234567890 sub:001 dlvrd:001 submit date:... done date:... stat:DELIVRD err:000 ..."
    const idMatch = msgText.match(/id:([a-zA-Z0-9_-]+)/i);
    const statMatch = msgText.match(/stat:([a-zA-Z]+)/i);

    const messageId = idMatch ? idMatch[1] : pdu.receipted_message_id;
    const status = statMatch ? statMatch[1].toUpperCase() : '';

    if (messageId) {
      let finalStatus = 'sent';
      if (['DELIVRD', 'DELIVERED', 'ACCEPTED'].includes(status)) {
        finalStatus = 'delivered';
      } else if (['UNDELIV', 'EXPIRED', 'DELETED', 'UNKNOWN', 'REJECTD', 'FAILED'].includes(status)) {
        finalStatus = 'failed';
      }

      await SmsLog.findOneAndUpdate(
        { messageId },
        {
          status: finalStatus,
          deliveredAt: new Date(),
          ...(finalStatus === 'failed' ? { errorDetails: `DLR Status: ${status}` } : {}),
        }
      );
      console.log(`[SMPP-DLR] Updated message ${messageId} -> ${finalStatus}`);
    }
  } catch (err) {
    console.error('[SMPP-DLR] Error processing delivery receipt:', err.message);
  }
};

// ─── Persistent SMPP Connection Manager ───────────────────────────────────────
const startHeartbeat = (session, intervalMs = 30000) => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (session && isBound) {
      session.enquire_link((pdu) => {
        if (pdu.command_status !== 0) {
          console.warn('[SMPP-HEARTBEAT] enquire_link returned non-zero status:', pdu.command_status);
        }
      });
    }
  }, Math.max(10000, intervalMs));
};

const cleanupPersistentSession = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  isBound = false;
  isConnecting = false;
  persistentSession = null;
  connectionPromise = null;
};

/**
 * Get or establish a persistent, long-lived bound SMPP session.
 * Reuses the existing bound TCP socket across multiple SMS requests.
 */
export const getOrInitSmppSession = async (overrideConfig = null) => {
  if (persistentSession && isBound) {
    return persistentSession;
  }

  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  const config = overrideConfig || (await getActiveSmsConfig());
  const host = config.host || DEFAULT_SMS_CONFIG.host;
  const port = config.port || DEFAULT_SMS_CONFIG.port;
  const systemId = config.systemId || DEFAULT_SMS_CONFIG.systemId;
  const password = config.password || DEFAULT_SMS_CONFIG.password;
  const systemType = config.systemType || '';

  if (!systemId || !password) {
    throw new Error('SMPP Credentials missing: SMPP_SYSTEM_ID and SMPP_PASSWORD must be configured in .env');
  }

  isConnecting = true;

  connectionPromise = new Promise((resolve, reject) => {
    const timeoutMs = parseInt(process.env.SMPP_CONNECT_TIMEOUT_MS || '30000', 10);
    let settled = false;

    const timeoutTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanupPersistentSession();
        reject(
          new Error(
            `SMPP Connection to ${host}:${port} timed out after ${timeoutMs / 1000}s. Check VPN/network routing to Telecom SMSC.`
          )
        );
      }
    }, timeoutMs);

    console.log(`[SMPP-POOL] Connecting to SMSC ${host}:${port} with systemId: ${systemId}...`);

    const session = smpp.connect({
      url: `smpp://${host}:${port}`,
      auto_enquire_link_period: 0, // Heartbeat managed manually
    });

    session.on('error', (err) => {
      console.error('[SMPP-POOL] Session error:', err.message);
      if (!settled) {
        settled = true;
        clearTimeout(timeoutTimer);
        cleanupPersistentSession();
        reject(err);
      } else {
        cleanupPersistentSession();
      }
    });

    session.on('close', () => {
      console.log('[SMPP-POOL] Session closed by SMSC');
      cleanupPersistentSession();
    });

    // DLR Delivery receipt listener
    session.on('deliver_sm', (pdu) => {
      handleDeliveryReceipt(pdu);
      // Acknowledge deliver_sm
      session.deliver_sm_resp({ sequence_number: pdu.sequence_number });
    });

    session.on('connect', () => {
      console.log(`[SMPP-POOL] TCP Connected. Sending bind_transceiver for ${systemId}...`);
      session.bind_transceiver(
        {
          system_id: systemId,
          password: password,
          system_type: systemType,
          interface_version: 0x34, // SMPP 3.4
        },
        (pdu) => {
          clearTimeout(timeoutTimer);
          if (settled) return;
          settled = true;
          isConnecting = false;

          if (pdu.command_status === 0) {
            console.log(`[SMPP-POOL] ✅ Successfully bound to SMSC as ${systemId}!`);
            isBound = true;
            persistentSession = session;
            startHeartbeat(session, config.enquireLinkIntervalMs);
            resolve(session);
          } else {
            const errMsg = `SMPP bind failed with command_status: 0x${pdu.command_status.toString(16)}`;
            console.error(`[SMPP-POOL] ❌ ${errMsg}`);
            try { session.close(); } catch (_) {}
            cleanupPersistentSession();
            reject(new Error(errMsg));
          }
        }
      );
    });
  });

  return connectionPromise;
};

// ─── HTTP / REST API Gateway Driver ───────────────────────────────────────────
/**
 * Send SMS via Telecom HTTP / REST API
 */
export const sendHttpSms = async ({ phone, message, senderId, config }) => {
  const endpoint = config.httpEndpoint;
  if (!endpoint) {
    throw new Error('HTTP SMS Gateway endpoint URL is not configured in SMS Gateway Settings');
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  // Auth Header
  if (config.httpAuthType === 'bearer' && config.httpApiKey) {
    headers['Authorization'] = `Bearer ${config.httpApiKey}`;
  } else if (config.httpAuthType === 'api_key' && config.httpApiKey) {
    headers['X-API-Key'] = config.httpApiKey;
  } else if (config.httpAuthType === 'basic' && config.httpApiKey) {
    headers['Authorization'] = `Basic ${Buffer.from(config.httpApiKey).toString('base64')}`;
  }

  // Custom User Headers
  if (config.httpHeaders) {
    try {
      const custom = JSON.parse(config.httpHeaders);
      Object.assign(headers, custom);
    } catch (_) {}
  }

  // Body payload formatting
  let bodyPayload;
  if (config.httpPayloadTemplate) {
    try {
      const templated = config.httpPayloadTemplate
        .replace(/{{phone}}/g, phone)
        .replace(/{{message}}/g, JSON.stringify(message).slice(1, -1))
        .replace(/{{senderId}}/g, senderId);
      bodyPayload = templated;
    } catch (_) {
      bodyPayload = JSON.stringify({ to: phone, message, from: senderId });
    }
  } else {
    bodyPayload = JSON.stringify({
      to: phone,
      recipient: phone,
      message,
      text: message,
      from: senderId,
      sender: senderId,
    });
  }

  const method = (config.httpMethod || 'POST').toUpperCase();
  const startTime = Date.now();

  const response = await fetch(endpoint, {
    method,
    headers,
    body: method === 'GET' ? undefined : bodyPayload,
  });

  const latencyMs = Date.now() - startTime;
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`HTTP Gateway responded with HTTP ${response.status}: ${errorText.slice(0, 200)}`);
  }

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  const messageId = data.messageId || data.id || data.msg_id || `HTTP-${Date.now()}`;
  return { messageId, latencyMs };
};

// ─── Test Connection & Bind ───────────────────────────────────────────────────
/**
 * Test connectivity & bind status against the active gateway (SMPP or HTTP)
 */
export const testSmppConnection = async (overrideConfig = null) => {
  const config = overrideConfig ? { ...DEFAULT_SMS_CONFIG, ...overrideConfig } : await getActiveSmsConfig();
  const startTime = Date.now();
  const isHttp = (config.protocol || '').toUpperCase() === 'HTTP';

  try {
    if (isHttp) {
      if (!config.httpEndpoint) {
        throw new Error('HTTP Gateway endpoint URL is required to test HTTP connectivity');
      }
      // Ping HTTP endpoint
      const res = await fetch(config.httpEndpoint, {
        method: 'HEAD',
        headers: config.httpApiKey ? { Authorization: `Bearer ${config.httpApiKey}` } : {},
      }).catch(async () => {
        // Fallback to GET with limit
        return await fetch(config.httpEndpoint, { method: 'GET' });
      });

      const latency = Date.now() - startTime;
      const result = {
        success: true,
        message: `Successfully connected to HTTP Gateway (${config.httpEndpoint}) in ${latency}ms (Status: ${res.status}).`,
        latency,
        testedAt: new Date(),
      };

      if (config._id) {
        await SmsConfig.findByIdAndUpdate(config._id, {
          lastTestedAt: result.testedAt,
          lastTestStatus: 'success',
          lastTestMessage: result.message,
        });
      }
      return result;
    }

    // SMPP protocol test: reuse or open persistent session
    const session = await getOrInitSmppSession(config);
    const latency = Date.now() - startTime;

    const result = {
      success: true,
      message: `Successfully connected & bound to SMSC (${config.host}:${config.port}) via SMPP 3.4 in ${latency}ms. Connection pool active!`,
      latency,
      testedAt: new Date(),
    };

    if (config._id) {
      await SmsConfig.findByIdAndUpdate(config._id, {
        lastTestedAt: result.testedAt,
        lastTestStatus: 'success',
        lastTestMessage: result.message,
      });
    }

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    const result = {
      success: false,
      message: error.message || 'Failed to connect to SMS Gateway',
      latency,
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

// ─── Single SMS Dispatcher ────────────────────────────────────────────────────
/**
 * Send a single SMS via the active gateway (SMPP with persistent connection or HTTP REST)
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
  organizationId = null,
}) => {
  const config = await getActiveSmsConfig();
  const phoneValidation = validateAndNormalizeEthiopianPhone(phone, {
    mode: config.phoneValidationMode || 'ethiopia_only',
    allowedOperators: config.allowedOperators || ['ethio_telecom', 'safaricom'],
  });

  if (!phoneValidation.isValid) {
    throw new Error(phoneValidation.error || 'Invalid phone number format');
  }

  const normalizedPhone = phoneValidation.normalized;
  if (!message || !message.trim()) {
    throw new Error('SMS message body is required');
  }

  const finalSenderId = senderId || config.sourceAddr || 'FDRMC';
  const segments = prepareMessageSegments(message);
  const isUni = isUnicode(message);
  const encoding = isUni ? 'UCS-2' : 'GSM-7';

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
    organizationId: organizationId || null,
    encoding,
    segments: segments.length,
    status: 'pending',
  });
  await smsLog.save();

  const startTime = Date.now();
  const isHttp = (config.protocol || '').toUpperCase() === 'HTTP';

  try {
    let messageId = '';
    let latencyMs = 0;

    if (isHttp) {
      // Dispatch via HTTP / REST driver
      const httpRes = await sendHttpSms({
        phone: normalizedPhone,
        message,
        senderId: finalSenderId,
        config,
      });
      messageId = httpRes.messageId;
      latencyMs = httpRes.latencyMs;
    } else {
      // Dispatch via persistent SMPP session (reused connection)
      const session = await getOrInitSmppSession(config);

      // Submit each segment (supports multipart Concatenated SMS)
      for (const seg of segments) {
        const submitResult = await new Promise((resolve, reject) => {
          session.submit_sm(
            {
              source_addr: finalSenderId,
              source_addr_ton: config.sourceAddrTon ?? 5,
              source_addr_npi: config.sourceAddrNpi ?? 0,
              dest_addr_ton: config.destAddrTon ?? 1,
              dest_addr_npi: config.destAddrNpi ?? 1,
              destination_addr: normalizedPhone,
              short_message: seg.short_message,
              esm_class: seg.esm_class,
              data_coding: seg.data_coding,
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

        messageId = submitResult.message_id || messageId;
      }
      latencyMs = Date.now() - startTime;
    }

    smsLog.status = 'sent';
    smsLog.messageId = messageId || `MSG-${Date.now()}`;
    smsLog.deliveredAt = new Date();
    smsLog.latencyMs = latencyMs;
    await smsLog.save();

    return {
      success: true,
      logId: smsLog._id,
      messageId: smsLog.messageId,
      recipientPhone: normalizedPhone,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error(`[SMS-GATEWAY] Failed to send SMS to ${normalizedPhone}:`, error.message);
    smsLog.status = 'failed';
    smsLog.errorDetails = error.message;
    smsLog.latencyMs = latencyMs;
    await smsLog.save();

    return {
      success: false,
      logId: smsLog._id,
      error: error.message,
      recipientPhone: normalizedPhone,
      latencyMs,
    };
  }
};

// ─── High-Throughput Throttled Batch Dispatcher ───────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send batch broadcast SMS with TPS rate limiting and live WebSocket progress emissions
 */
export const sendBatchSms = async ({
  recipients, // Array of { phone, name }
  message,
  category = 'general',
  severity = 'normal',
  senderId,
  broadcastBatchId = '',
  sentBy = null,
  organizationId = null,
  onProgress = null,
}) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { total: 0, sent: 0, failed: 0, results: [] };
  }

  const config = await getActiveSmsConfig();
  const maxTps = Math.max(1, Math.min(100, config.maxTps || 20)); // Configurable TPS throttle

  const results = [];
  let sentCount = 0;
  let failedCount = 0;
  const total = recipients.length;

  console.log(`[SMS-BROADCAST] Starting batch ${broadcastBatchId} for ${total} recipients at ${maxTps} TPS...`);

  // Process in chunks corresponding to maxTps per second
  for (let i = 0; i < total; i += maxTps) {
    const chunk = recipients.slice(i, i + maxTps);
    const chunkStartTime = Date.now();

    const chunkPromises = chunk.map(async (item) => {
      const phone = typeof item === 'string' ? item : item.phone;
      const name = typeof item === 'string' ? '' : item.name || item.fullName || '';

      if (!phone) return null;

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
          organizationId,
        });

        if (res.success) {
          sentCount++;
        } else {
          failedCount++;
        }
        return res;
      } catch (err) {
        failedCount++;
        return {
          success: false,
          recipientPhone: phone,
          error: err.message,
        };
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults.filter(Boolean));

    // Emit live WebSocket progress
    const progressData = {
      batchId: broadcastBatchId,
      total,
      sent: sentCount,
      failed: failedCount,
      completed: sentCount + failedCount,
      percent: Math.round(((sentCount + failedCount) / total) * 100),
    };

    emitDashboardEvent('sms:broadcast:progress', progressData);
    if (typeof onProgress === 'function') {
      onProgress(progressData);
    }

    // Respect TPS limit: ensure at least 1 second per TPS chunk if more chunks remain
    const elapsed = Date.now() - chunkStartTime;
    if (i + maxTps < total && elapsed < 1000) {
      await sleep(1000 - elapsed);
    }
  }

  emitDashboardEvent('sms:broadcast:completed', {
    batchId: broadcastBatchId,
    total,
    sent: sentCount,
    failed: failedCount,
  });

  console.log(`[SMS-BROADCAST] Completed batch ${broadcastBatchId}: ${sentCount} sent, ${failedCount} failed.`);

  return {
    total,
    sent: sentCount,
    failed: failedCount,
    results,
  };
};
