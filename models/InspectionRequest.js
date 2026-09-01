import mongoose from 'mongoose';

const inspectionRequestSchema = new mongoose.Schema(
  {
    trackingNumber: { type: String, required: true, unique: true, index: true },
    propertyAddress: { type: String, required: true, trim: true },
    inspectionType: {
      type: String,
      required: true,
      enum: [
        'building_safety',
        'fire_safety',
        'electrical',
        'sanitation',
        'structural',
        'occupancy',
        'other',
      ],
    },
    preferredDate: { type: Date, required: true },
    additionalNotes: { type: String, trim: true, default: '' },
    requesterName: { type: String, trim: true, default: '' },
    requesterPhone: { type: String, trim: true, default: '' },
    requesterEmail: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Assigned', 'Scheduled', 'Completed', 'Rejected'],
      default: 'Submitted',
      index: true,
    },
    assignedInspector: { type: String, trim: true, default: '' },
    assignedInspectorContact: { type: String, trim: true, default: '' },
    certificateUrl: { type: String, trim: true, default: '' },
    adminNotes: { type: String, trim: true, default: '' },
    submittedFrom: { type: String, trim: true, default: 'Public Portal' },
  },
  { timestamps: true }
);

export default mongoose.model('InspectionRequest', inspectionRequestSchema);
