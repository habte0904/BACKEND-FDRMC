import mongoose from 'mongoose';

const surveySyncLogSchema = new mongoose.Schema({
    surveyorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    localSurveyId: { type: String, required: true },
    serverSurveyId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse' },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    syncStatus: {
        type: String,
        enum: ['pending', 'synced', 'failed', 'partial'],
        default: 'pending'
    },
    stepsCompleted: [{
        step: { type: String, required: true }, // 'header', 'responses', 'gps', 'photos', 'attachments', 'signatures', 'status'
        completedAt: { type: Date, default: Date.now },
        details: mongoose.Schema.Types.Mixed
    }],
    syncErrors: [{
        step: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
    }],
    syncedAt: Date
}, { timestamps: true, suppressReservedKeysWarning: true });

export default mongoose.model('SurveySyncLog', surveySyncLogSchema);
