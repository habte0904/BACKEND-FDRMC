import mongoose from 'mongoose';

const reportTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    source: { type: String, required: true, trim: true }, // e.g. 'incident_reports'
    filters: { type: mongoose.Schema.Types.Mixed, default: {} },
    fields: [{ type: String, trim: true }],
    groupBy: { type: String, trim: true, default: '' },
    chartType: {
      type: String,
      enum: ['table', 'bar', 'line', 'pie', 'donut'],
      default: 'table',
    },
    // Advanced Sharing & Scope
    isShared: { type: Boolean, default: false },
    sharingType: {
      type: String,
      enum: ['private', 'all_users', 'specific_users', 'by_roles'],
      default: 'private',
    },
    sharedWithUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sharedWithRoles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],

    // Advanced Metadata & Presentation
    category: { type: String, trim: true, default: 'Operational' },
    tags: [{ type: String, trim: true }],
    icon: { type: String, trim: true, default: 'FileText' },
    color: { type: String, trim: true, default: '#143f84' },
    isFeatured: { type: Boolean, default: false },
    executiveNotes: { type: String, trim: true, default: '' },
    refreshSchedule: {
      type: String,
      enum: ['on_demand', 'daily', 'weekly', 'monthly'],
      default: 'on_demand',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

reportTemplateSchema.index({ createdBy: 1, source: 1 });
reportTemplateSchema.index({ isShared: 1, sharingType: 1 });
reportTemplateSchema.index({ sharedWithUsers: 1 });
reportTemplateSchema.index({ sharedWithRoles: 1 });

export default mongoose.model('ReportTemplate', reportTemplateSchema);
