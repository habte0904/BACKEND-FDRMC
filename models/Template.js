import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema({
    fieldId: { type: String, required: true },
    questionCode: { type: String, required: true },
    label: { type: String, required: true },
    type: {
        type: String,
        enum: [
            'text', 'number', 'email', 'phone', 'date',
            'radio', 'checkbox', 'select', 'dropdown', 'multi-select',
            'textarea', 'matrix', 'table', 'geo', 'file',
            'note', 'tip', 'header'
        ],
        required: true
    },
    options: [{
        label: String,
        value: mongoose.Schema.Types.Mixed
    }],
    required: { type: Boolean, default: false },
    validation: {
        min: Number,
        max: Number,
        pattern: String,
        customRule: String
    },
    conditionalLogic: {
        dependsOn: String,
        operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'] },
        value: mongoose.Schema.Types.Mixed,
        statement: String // New flexible logic statement
    },
    matrixConfig: {
        rows: [{ label: String, value: String }],
        columns: [{ label: String, value: String }],
        cellType: { type: String, default: 'radio' }
    },
    tableConfig: {
        columns: [{
            label: String,
            type: { type: String, default: 'text' }
        }],
        allowAddRow: { type: Boolean, default: true }
    },
    repeatable: { type: Boolean, default: false },
    helpText: String,
    defaultValue: mongoose.Schema.Types.Mixed,
    systemAutoFill: {
        type: String,
        default: 'none'
    },
    permissions: {
        visibleToRoles: [{ type: String }], // Role names or IDs
        editableByRoles: [{ type: String }]
    }
});

const sectionSchema = new mongoose.Schema({
    sectionId: { type: String, required: true },
    title: String,
    description: String,
    fields: [fieldSchema]
});

const moduleSchema = new mongoose.Schema({
    moduleId: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    sections: [sectionSchema]
});

const templateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    category: {
        type: String,
        enum: ['Household', 'Woreda', 'Shock', 'Finance', 'Assessment', 'Feedback', 'Other'],
        default: 'Other'
    },
    moduleType: { type: String }, // e.g., 'HHQ', 'WRP', 'SAP'
    version: { type: Number, default: 1 },
    isLatest: { type: Boolean, default: true },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft'
    },
    modules: [moduleSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
    usageCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure unique versioning per template name.
// This allows multiple templates to share the same moduleType (category)
// while keeping versions unique within a named template group.
templateSchema.index({ name: 1, version: 1 }, { unique: true });

export default mongoose.model('Template', templateSchema);
