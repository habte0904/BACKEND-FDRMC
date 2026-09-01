import mongoose from 'mongoose';

export const ALERT_CATEGORY_VALUES = [
  'floods',
  'heat_wave',
  'drought',
  'earthquake',
  'landslides',
  'subsidence_fissures',
  'forest_fires',
  'structural_fire',
  'groundwater_pollution',
  'lake_water_pollution',
  'air_pollution',
  'human_epidemics',
  'other',
];

const AlertContactSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    altPhone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const AlertLocationSchema = new mongoose.Schema(
  {
    country: { type: String, trim: true, default: '' },
    region: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    subCity: { type: String, trim: true, default: '' },
    woreda: { type: String, trim: true, default: '' },
    addressLine: { type: String, trim: true, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    radiusKm: { type: Number, default: 5 },
    additionalLocations: {
      type: [
        new mongoose.Schema(
          {
            label: { type: String, trim: true, default: '' },
            addressLine: { type: String, trim: true, default: '' },
            latitude: { type: Number, default: null },
            longitude: { type: Number, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const AlertPreferencesSchema = new mongoose.Schema(
  {
    categories: [
      {
        type: String,
        enum: ALERT_CATEGORY_VALUES,
      },
    ],
    severities: { type: [String], default: [] }, // e.g. info, warning, emergency
    minAlertLevel: { type: String, trim: true, default: 'warning' },
    language: { type: String, trim: true, default: 'en' },
    quietHours: {
      enabled: { type: Boolean, default: false },
      start: { type: String, trim: true, default: '22:00' }, // HH:mm
      end: { type: String, trim: true, default: '06:00' }, // HH:mm
    },
  },
  { _id: false }
);

const HouseholdInfoSchema = new mongoose.Schema(
  {
    householdSize: { type: Number, min: 1, default: 1 },
    hasChildren: { type: Boolean, default: false },
    hasElderly: { type: Boolean, default: false },
    hasDisability: { type: Boolean, default: false },
    specialNeeds: { type: [String], default: [] },
    assetsAtRisk: { type: [String], default: [] },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const DeliverySchema = new mongoose.Schema(
  {
    channels: { type: [String], default: [] }, // email, sms, whatsapp, in_app
    emailEnabled: { type: Boolean, default: true },
    smsEnabled: { type: Boolean, default: false },
    whatsappEnabled: { type: Boolean, default: false },
    inAppEnabled: { type: Boolean, default: false },
    voiceCallEnabled: { type: Boolean, default: false },
    emergencyContact: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const AlertSubscriptionSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['active', 'paused', 'unsubscribed'], default: 'active' },
    contact: { type: AlertContactSchema, default: () => ({}) },
    location: { type: AlertLocationSchema, default: () => ({}) },
    preferences: { type: AlertPreferencesSchema, default: () => ({}) },
    household: { type: HouseholdInfoSchema, default: () => ({}) },
    delivery: { type: DeliverySchema, default: () => ({}) },
    consent: {
      accepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
    },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastUpdatedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AlertSubscriptionSchema.index({ 'contact.email': 1 });
AlertSubscriptionSchema.index({ 'contact.phone': 1 });

export default mongoose.model('AlertSubscription', AlertSubscriptionSchema);
