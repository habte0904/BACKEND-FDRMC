import mongoose from 'mongoose';

const SmsConfigSchema = new mongoose.Schema(
  {
    systemId: {
      type: String,
      required: true,
      trim: true,
      default: '6524',
    },
    password: {
      type: String,
      required: true,
      trim: true,
      default: 'Aacai$73',
    },
    host: {
      type: String,
      required: true,
      trim: true,
      default: '10.204.181.70',
    },
    port: {
      type: Number,
      required: true,
      default: 5019,
    },
    protocol: {
      type: String,
      enum: ['SMPP3.4', 'SMPP5.0', 'HTTP'],
      default: 'SMPP3.4',
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
