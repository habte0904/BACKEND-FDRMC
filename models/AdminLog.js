import mongoose from 'mongoose';

const AdminLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    resource: { type: String, required: true }, // e.g., 'User', 'Role', 'System'
    resourceId: String,
    details: { type: mongoose.Schema.Types.Mixed }, // Detailed description or payload
    timestamp: { type: Date, default: Date.now },
    ip: String,
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' }
}, { timestamps: true });

export default mongoose.model('AdminLog', AdminLogSchema);
