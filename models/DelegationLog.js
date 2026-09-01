import mongoose from 'mongoose';

const delegationLogSchema = new mongoose.Schema({
    delegator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    delegatee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authority: {
        canManageTeams: { type: Boolean, default: false },
        canManageDepartments: { type: Boolean, default: false },
        canApproveReports: { type: Boolean, default: false }
    },
    reason: String,
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    status: {
        type: String,
        enum: ['active', 'expired', 'revoked'],
        default: 'active'
    },
    revokedAt: Date,
    revokedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Index for faster queries
delegationLogSchema.index({ delegator: 1, delegatee: 1, status: 1 });

export default mongoose.model('DelegationLog', delegationLogSchema);
