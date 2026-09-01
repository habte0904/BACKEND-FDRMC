import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    resource: { type: String, required: true }, // Name of the entity being acted upon
    resourceId: { type: String }, // Primary key of the resource or entity
    before: { type: mongoose.Schema.Types.Mixed }, // Snapshot of data before action
    after: { type: mongoose.Schema.Types.Mixed }, // Snapshot of data after action
    details: { type: mongoose.Schema.Types.Mixed }, // Extra contextual info or error message
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String },
    status: { type: String, enum: ['success', 'failure', 'pending'], default: 'success' },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' }
}, { timestamps: true });

// Prevent accidental deletion or updates to audit logs if possible (logical check or separate db collection could be used)
// AuditLogSchema.pre('save', function(next) { ... });

export default mongoose.model('AuditLog', AuditLogSchema);
