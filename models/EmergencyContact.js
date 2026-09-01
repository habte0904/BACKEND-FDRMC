import mongoose from 'mongoose';

const EmergencyContactSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    phoneNumber: { type: String, required: true, trim: true },
    alternatePhoneNumber: { type: String, trim: true, default: '' },
    iconKey: {
      type: String,
      trim: true,
      enum: ['phone', 'police', 'fire', 'hospital'],
      default: 'phone',
    },
    accentColor: { type: String, trim: true, default: '#D7000F' },
    directoryType: {
      type: String,
      trim: true,
      enum: ['national', 'regional', 'local'],
      default: 'national',
    },
    regions: { type: [String], default: [] },
    addressLine: { type: String, trim: true, default: '' },
    availabilityText: { type: String, trim: true, default: '24/7 response line' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastUpdatedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

EmergencyContactSchema.index({ isActive: 1, sortOrder: 1, title: 1 });
EmergencyContactSchema.index({ regions: 1 });

export default mongoose.model('EmergencyContact', EmergencyContactSchema);
