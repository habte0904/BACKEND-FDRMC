import mongoose from 'mongoose';

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true }, // head_office | branch | subcity | woreda
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },

    // Additional fields for hierarchy
    branchCode: String, // Unique code for branches
    headOffice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    }, // Reference to head office for branches
    description: String,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

export default mongoose.model('Organization', OrganizationSchema);