import mongoose from 'mongoose';

const formResponseSchema = new mongoose.Schema({
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    templateVersion: { type: Number, required: true },

    // Dynamic context mapping
    moduleContextId: { type: mongoose.Schema.Types.Mixed },
    moduleContextType: {
        type: String,
        default: 'Feedback'
    },

    respondentMetadata: {
        fullName: String,
        phone: String,
        location: {
            lat: Number,
            lng: Number,
            accuracy: Number
        },
        deviceId: String,
        enumeratorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },

    // answers is a map where key is the field questionCode or fieldId
    // Map allows flexible indexing for high-volume surveys
    answers: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    syncStatus: {
        type: String,
        enum: ['UNSYNCED', 'SYNCED', 'UPDATED'],
        default: 'UNSYNCED'
    },
    lastSyncedAt: Date,

    isDraft: { type: Boolean, default: false },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes for performance
formResponseSchema.index({ templateId: 1, templateVersion: 1 });
formResponseSchema.index({ moduleContextId: 1, moduleContextType: 1 });
formResponseSchema.index({ submittedAt: -1 });

export default mongoose.model('FormResponse', formResponseSchema);
