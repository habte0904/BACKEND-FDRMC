import mongoose from 'mongoose';

const SmsConfigSchema = new mongoose.Schema(
  {
    // NOTE: systemId and password are loaded from .env (SMPP_SYSTEM_ID / SMPP_PASSWORD).
    // They are intentionally NOT stored in MongoDB for security reasons.

    // ── Stored encrypted (AES-256-GCM via utils/fieldEncryption.js) ──────────────
    // protocol, systemType, sourceAddr are encrypted at rest
    isEncrypted: {
      type: Boolean,
      default: false, // true once the record has been saved with encryption enabled
    },
    // ── Admin-configurable (host/port encrypted like other string fields) ──
    host: {
      type: String,
      trim: true,
      default: null, // stored encrypted; falls back to process.env.SMPP_HOST if null
    },
    port: {
      type: mongoose.Schema.Types.Mixed, // Mixed: holds ciphertext (String) when encrypted
      default: null, // stored encrypted; falls back to process.env.SMPP_PORT if null
    },
    protocol: {
      type: String,
      // No enum here — the stored value is AES-256-GCM ciphertext (encrypted before saving).
      // Plain-text validation ('SMPP3.4' | 'SMPP5.0' | 'HTTP') is done in the controller
      // before encryption, so Mongoose never sees the raw value.
      default: null,
    },
    systemType: {
      type: String,
      trim: true,
      default: '',
    },
    sourceAddr: {
      type: String,
      trim: true,
      default: 'FDRMC',
    },
    sourceAddrTon: {
      type: Number,
      default: 5, // 5 = alphanumeric, 1 = international, 0 = unknown
    },
    sourceAddrNpi: {
      type: Number,
      default: 0, // 0 = unknown, 1 = ISDN/E.164
    },
    destAddrTon: {
      type: Number,
      default: 1, // 1 = international, 0 = unknown
    },
    destAddrNpi: {
      type: Number,
      default: 1, // 1 = ISDN/E.164
    },
    dataCoding: {
      type: Number,
      default: 0, // 0 = default SMSC alphabet / ASCII / GSM 7-bit, 8 = UCS-2 (Unicode)
    },
    enquireLinkIntervalMs: {
      type: Number,
      default: 30000, // 30 seconds keepalive
    },
    reconnectIntervalMs: {
      type: Number,
      default: 10000,
    },
    // ── HTTP / REST API Gateway Configuration ──
    httpEndpoint: {
      type: String,
      trim: true,
      default: null, // stored encrypted; e.g. https://api.ethiotelecom.et/v1/sms/send
    },
    httpMethod: {
      type: String,
      enum: ['POST', 'GET'],
      default: 'POST',
    },
    httpAuthType: {
      type: String,
      enum: ['bearer', 'api_key', 'basic', 'none'],
      default: 'bearer',
    },
    httpApiKey: {
      type: String,
      default: null, // stored encrypted
    },
    httpHeaders: {
      type: String,
      default: null, // stored encrypted (JSON string of custom headers)
    },
    httpPayloadTemplate: {
      type: String,
      default: null, // stored encrypted (custom template e.g. {"to":"{{phone}}","text":"{{message}}"})
    },
    // ── Throughput, Rate Limiting & Delivery Receipts ──
    maxTps: {
      type: Number,
      default: 20, // Max transactions per second to adhere to telecom limits
    },
    dlrEnabled: {
      type: Boolean,
      default: true, // Listen for deliver_sm DLR delivery receipts
    },
    // ── Phone validation policy ──
    phoneValidationMode: {
      type: String,
      enum: ['ethiopia_only', 'all'],
      default: 'ethiopia_only', // By default only Ethiopian numbers (+251 / 09 / 07)
    },
    allowedOperators: {
      type: [String],
      default: ['ethio_telecom', 'safaricom'], // Ethio Telecom (09) & Safaricom (07)
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    lastTestStatus: {
      type: String,
      enum: ['success', 'failed', 'not_tested'],
      default: 'not_tested',
    },
    lastTestMessage: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model('SmsConfig', SmsConfigSchema);
