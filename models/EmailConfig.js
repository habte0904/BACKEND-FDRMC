import mongoose from 'mongoose';

const EmailConfigSchema = new mongoose.Schema(
  {
    // NOTE: user and pass are loaded from .env (EMAIL_USER / EMAIL_PASS or EMAIL_SMTP_USER / EMAIL_SMTP_PASS).
    // They are intentionally NOT stored in plain text in MongoDB for security reasons.
    isEncrypted: {
      type: Boolean,
      default: false, // true once record has been saved with AES-256-GCM encryption enabled
    },
    service: {
      type: String,
      default: 'Gmail', // 'Gmail', 'Custom', 'Office365', 'SendGrid', 'SES'
    },
    host: {
      type: String,
      trim: true,
      default: null, // stored encrypted if modified; falls back to process.env.EMAIL_SMTP_HOST
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
    // Sensitive credentials: fall back to .env (EMAIL_USER / EMAIL_PASS)
    // Stored strictly encrypted (AES-256-GCM) if overridden by admin. NEVER stored in plain text!
    user: {
      type: String,
      trim: true,
      default: null,
    },
    pass: {
      type: String,
      trim: true,
      default: null,
    },
    fromName: {
      type: String,
      trim: true,
      default: 'FDRMC Early Warning & Comms',
    },
    fromEmail: {
      type: String,
      trim: true,
      default: null, // falls back to user or .env
    },
    replyTo: {
      type: String,
      trim: true,
      default: '',
    },
    // Throughput & Rate Limiting (Emails per second)
    maxTps: {
      type: Number,
      default: 5, // 5 emails per second to comply with SMTP provider sending limits
    },
    enableOtp: {
      type: Boolean,
      default: true,
    },
    enableAlertBroadcast: {
      type: Boolean,
      default: true,
    },
    // Email validation policy
    emailValidationMode: {
      type: String,
      enum: ['strict', 'restricted_domains'],
      default: 'strict',
    },
    allowedDomains: {
      type: String,
      default: '',
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
