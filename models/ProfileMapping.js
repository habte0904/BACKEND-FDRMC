import mongoose from 'mongoose';

const profileMappingSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    sourceType: { 
        type: String, 
        enum: ['InterviewTemplate', 'SiteSurveyTemplate'], 
        required: true 
    },
    sourceId: { 
        type: mongoose.Schema.Types.ObjectId, // TemplateId
        ref: 'Template',
        required: true
    },
    targetModel: {
        type: String,
        enum: ['WoredaProfile', 'WoredaAssessment', 'HouseholdProfile'],
        default: 'WoredaProfile'
    },
    version: { type: Number, default: 1 },
    mappings: [{
        targetFieldPath: { type: String, required: true }, // e.g., 'demographics.total_population'
        sourceKey: { type: String }, // questionCode for templates, or Column Name for Excel
        transformation: { 
            type: String, 
            enum: ['direct', 'cast_number', 'boolean_map', 'lookup', 'calculation'], 
            default: 'direct' 
        },
        sourceKeys: [String], // Used for calculations (multi-field)
        operation: { 
            type: String, 
            enum: ['sum', 'average', 'min', 'max', 'formula', 'concat', 'and', 'or', 'count'] 
        },
        formula: String, // e.g. "source1 + source2"
        separator: { type: String, default: ' ' }, // For concat operation
        lookupOptions: [{ 
            sourceValue: mongoose.Schema.Types.Mixed, 
            targetValue: mongoose.Schema.Types.Mixed 
        }],
        validation: {
            required: { type: Boolean, default: false },
            type: { type: String, enum: ['string', 'number', 'boolean', 'date'] }
        }
    }],
    status: { 
        type: String, 
        enum: ['Draft', 'Published', 'Archived'], 
        default: 'Draft' 
    },
    isActive: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure unique mapping names if needed, or unique mapping per source and version
profileMappingSchema.index({ sourceId: 1, version: 1 }, { 
    unique: true, 
    partialFilterExpression: { sourceType: { $in: ['InterviewTemplate', 'SiteSurveyTemplate'] } } 
});

export default mongoose.model('ProfileMapping', profileMappingSchema);
