import mongoose from 'mongoose';

const OrganizationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { 
        type: String, 
        required: true,
        enum: ['head_office', 'branch', 'subcity', 'woreda'],
        default: 'branch'
    },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null },

    // Branch to Subcity linkage
    subcity: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subcity', 
        default: null 
    },
    subcityName: { type: String, trim: true },

    // Additional fields for hierarchy & branch operations
    branchCode: { type: String, trim: true }, // e.g. BR-YEKA, BR-BOLE
    headOffice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization'
    }, // Reference to head office for branches
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    description: String,
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

export default mongoose.model('Organization', OrganizationSchema);