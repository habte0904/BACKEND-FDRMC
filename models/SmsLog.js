import mongoose from 'mongoose';

const SmsLogSchema = new mongoose.Schema(
  {
    recipientPhone: {
      type: String,
      required: true,
      trim: true,
    },
    recipientName: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
    },
    severity: {
      type: String,
      trim: true,
      default: 'normal',
    },
    messageType: {
      type: String,
      enum: ['single', 'broadcast', 'test', 'verification', 'alert', 'other'],
      default: 'single',
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'delivered', 'failed'],
      default: 'pending',
    },
    messageId: {
      type: String,
      default: '',
    },
    senderId: {
      type: String,
      default: 'FDRMC',
    },
    broadcastBatchId: {
      type: String,
      default: '',
    },
    errorDetails: {
      type: String,
      default: '',
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

SmsLogSchema.index({ recipientPhone: 1, createdAt: -1 });
SmsLogSchema.index({ status: 1, createdAt: -1 });
SmsLogSchema.index({ broadcastBatchId: 1 });

export default mongoose.model('SmsLog', SmsLogSchema);
