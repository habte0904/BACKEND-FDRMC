import mongoose from 'mongoose';

const EmailConfigSchema = new mongoose.Schema(
  {
    service: {
      type: String,
      default: 'Gmail', // 'Gmail', 'Custom', 'Office365', 'SendGrid', 'SES'
    },
    host: {
      type: String,
      trim: true,
      default: 'smtp.gmail.com',
    },
    port: {
      type: Number,
      default: 587,
    },
    secure: {
      type: Boolean,
      default: false, // true for 465 (SSL), false for 587 (TLS/STARTTLS)
    },
    authType: {
      type: String,
      default: 'login', // 'login', 'oauth2'
    },
    user: {
      type: String,
      required: true,
      trim: true,
      default: 'petrosh122@gmail.com',
    },
    pass: {
      type: String,
      required: true,
      trim: true,
      default: 'yyfq thbc kcno dddo',
    },
    fromName: {
      type: String,
      trim: true,
      default: 'FDRMC Early Warning & Comms',
    },
    fromEmail: {
      type: String,
      trim: true,
      default: 'petrosh122@gmail.com',
    },
    replyTo: {
      type: String,
      trim: true,
      default: '',
    },
    enableOtp: {
      type: Boolean,
      default: true,
    },
    enableAlertBroadcast: {
      type: Boolean,
      default: true,
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

export default mongoose.model('EmailConfig', EmailConfigSchema);
