import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema({
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    sectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sector', default: null }, // null for branch departments
    name: { type: String, required: true },
    description: String,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

// Index for faster queries
DepartmentSchema.index({ organizationId: 1, sectorId: 1 });

export default mongoose.model('Department', DepartmentSchema);
