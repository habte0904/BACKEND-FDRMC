import mongoose from 'mongoose';

const siteSchema = new mongoose.Schema({
    siteCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: String,
    region: String,
    zone: String,
    woreda: String,
    kebele: String,
    location: {
        latitude: Number,
        longitude: Number,
        altitude: Number,
        accuracy: Number,
        address: String
    },
    assignedSurveyor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    status: {
        type: String,
        enum: ['Assigned', 'In Progress', 'Completed', 'Synced'],
        default: 'Assigned'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    dueDate: Date,
    syncMetadata: {
        lastSyncedAt: Date,
        version: { type: Number, default: 1 }
    }
}, { timestamps: true });

export default mongoose.model('Site', siteSchema);
