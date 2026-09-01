import mongoose from 'mongoose';

const SectorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    description: String,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

// Index for faster queries
SectorSchema.index({ organizationId: 1 });

export default mongoose.model('Sector', SectorSchema);
