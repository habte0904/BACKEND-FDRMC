import mongoose from 'mongoose';

const IncidentLocationSchema = new mongoose.Schema(
  {
    addressLine: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    placeName: { type: String, trim: true, default: '' },
    subCity: { type: String, trim: true, default: '' },
    woreda: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
  },
  { _id: false }
);

const IncidentAttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    type: { type: String, trim: true, default: '' }, // image/video
    name: { type: String, trim: true, default: '' },
    uploadedBy: { type: String, default: 'user' },
  },
  { _id: false }
);

const IncidentReportSchema = new mongoose.Schema(
  {
    reportCode: { type: String, trim: true, default: '' },
    reportType: {
      type: String,
      enum: ['incident', 'concern'],
      default: 'incident',
    },
    status: {
      type: String,
      enum: ['new', 'submitted', 'received', 'dispatched', 'not_solved', 'solved', 'closed', 'archived'],
      default: 'new',
    },
    category: { type: String, trim: true, default: '' },
    concernCategory: [{ type: String, trim: true }],
    severity: { type: String, trim: true, default: 'moderate' },
    location: { type: IncidentLocationSchema, default: () => ({}) },
    details: { type: String, trim: true, default: '' },
    concernDetails: { type: String, trim: true, default: '' },
    fireInfo: {
      smellOfGas: { type: Boolean, default: false },
      estimatedSize: { type: String, trim: true, default: '' },
    },
    floodInfo: {
      waterDepth: { type: String, trim: true, default: '' },
      fastRising: { type: Boolean, default: false },
    },
    collapseInfo: {
      peopleTrapped: { type: Boolean, default: false },
      buildingType: { type: String, trim: true, default: '' },
    },
    medicalInfo: {
      injuriesCount: { type: String, trim: true, default: '' },
      needsAmbulance: { type: Boolean, default: false },
    },
    powerInfo: {
      liveWires: { type: Boolean, default: false },
      outageArea: { type: String, trim: true, default: '' },
    },
    securityInfo: {
      ongoingThreat: { type: Boolean, default: false },
      incidentType: { type: String, trim: true, default: '' },
    },
    trafficInfo: {
      lanesBlocked: { type: String, trim: true, default: '' },
      injuries: { type: Boolean, default: false },
    },
    animalInfo: {
      animalType: { type: String, trim: true, default: '' },
      aggressive: { type: Boolean, default: false },
    },
    otherInfo: {
      categoryNote: { type: String, trim: true, default: '' },
    },
    concernInfo: {
      nature: { type: String, trim: true, default: '' },
      peopleAffected: { type: String, trim: true, default: '' },
      householdsInArea: { type: String, trim: true, default: '' },
    },
    resolutionDescription: { type: String, trim: true, default: '' },
    resolvedBy: { type: String, trim: true, default: '' },
    resolvedAt: { type: Date, default: null },
    resolutionNotes: { type: String, trim: true, default: '' },
    responsibleInstitution: { type: String, trim: true, default: '' },
    assignedTo: { type: String, trim: true, default: '' },
    attachments: { type: [IncidentAttachmentSchema], default: [] },
    contact: {
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
    },
    anonymous: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
    readBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastUpdatedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

IncidentReportSchema.index({ isRead: 1 });
IncidentReportSchema.index({ reportCode: 1 });
IncidentReportSchema.index({ reportType: 1 });
IncidentReportSchema.index({ status: 1 });
IncidentReportSchema.index({ category: 1 });
IncidentReportSchema.index({ concernCategory: 1 });
IncidentReportSchema.index({ severity: 1 });

export default mongoose.model('IncidentReport', IncidentReportSchema);
