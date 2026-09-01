import mongoose from 'mongoose';

const communityHazardSchema = new mongoose.Schema({
    hazard_name: { type: String },
    frequency: { type: String },
    severity: { type: String },
    duration: { type: String },
    spatial_extent: { type: String },
    seasonality: { type: String },
    historical_events: { type: String }
});

const kiiCapacityIndicatorsSchema = new mongoose.Schema({
    ews: { type: Number, min: 1, max: 5 },
    drm_committee: { type: Number, min: 1, max: 5 },
    focal_persons: { type: Number, min: 1, max: 5 },
    training_freq: { type: Number, min: 1, max: 5 },
    shelters: { type: Number, min: 1, max: 5 },
    community_structures: { type: Number, min: 1, max: 5 },
    emergency_services: { type: Number, min: 1, max: 5 },
    inter_sector_coordination: { type: Number, min: 1, max: 5 },
    institutional_strength: { type: Number, min: 1, max: 5 },
    recovery_plan: { type: Number, min: 1, max: 5 },
    budget: { type: Number, min: 1, max: 5 },
    drm_mainstreaming: { type: Number, min: 1, max: 5 }
}, { _id: false });

const kiiInfrastructureExposureSchema = new mongoose.Schema({
    health: { type: Number, min: 1, max: 5 },
    water: { type: Number, min: 1, max: 5 },
    energy: { type: Number, min: 1, max: 5 },
    emergency: { type: Number, min: 1, max: 5 },
    communications: { type: Number, min: 1, max: 5 }
}, { _id: false });

const kiiEnvironmentalIndicatorsSchema = new mongoose.Schema({
    drainage: { type: Number, min: 1, max: 5 },
    green_cover: { type: Number, min: 1, max: 5 },
    waste_mgmt: { type: Number, min: 1, max: 5 },
    pollution: { type: Number, min: 1, max: 5 }
}, { _id: false });

const cgdCommunityVoiceSchema = new mongoose.Schema({
    coping_strategies: { type: String, trim: true },
    collective_action_structure: { type: String, trim: true },
    suggested_interventions: { type: String, trim: true }
}, { _id: false });

const disasterRecordSchema = new mongoose.Schema({
    year: { type: Number, required: true },
    hazard_name: { type: String, required: true, trim: true },
    location_description: { type: String, trim: true },
    affected_population: { type: Number, default: 0 },
    displaced_population: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    injuries: { type: Number, default: 0 },
    houses_damaged: { type: Number, default: 0 },
    infrastructure_damaged: { type: String, trim: true },
    estimated_loss_etb: { type: Number, default: 0 }
}, { _id: false });

const woredaAssessmentSchema = new mongoose.Schema({
    location: {
        subcity: { type: String, trim: true },
        woreda: { type: String, required: true, trim: true },
        block: { type: String, trim: true },
        house_no: { type: String, trim: true }
    },
    assessment_date: { type: Date, required: true },
    assessed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String },

    // CGD Data
    hazards: [communityHazardSchema],
    cgd_community_voice: { type: cgdCommunityVoiceSchema },
    disaster_history: [disasterRecordSchema],

    // KII Data
    kii_capacity_indicators: { type: kiiCapacityIndicatorsSchema },
    kii_infrastructure_exposure: { type: kiiInfrastructureExposureSchema },
    kii_environmental_indicators: { type: kiiEnvironmentalIndicatorsSchema },

    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Reviewed'],
        default: 'Draft'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for performance
woredaAssessmentSchema.index({ 'location.subcity': 1, 'location.woreda': 1 });
woredaAssessmentSchema.index({ 'location.woreda': 1, status: 1 });
woredaAssessmentSchema.index({ 'location.woreda': 1, 'location.house_no': 1 });

/**
 * Post-save hook: Trigger woreda-level risk score recalculation when a new woreda
 * assessment (KII/CGD) is saved. Uses dynamic import to avoid circular dependency.
 */
const triggerWoredaRiskRecalculation = async (doc) => {
    try {
        const { triggerScopedAggregation } = await import('../services/aggregationTriggerService.js');
        await triggerScopedAggregation({
            subcity: doc.location?.subcity,
            woreda: doc.location?.woreda,
            block: null  // Woreda assessment enriches at woreda level and above
        });
    } catch (err) {
        console.error('[WoredaAssessment] Aggregation trigger failed:', err.message);
    }
};

woredaAssessmentSchema.post('save', triggerWoredaRiskRecalculation);
woredaAssessmentSchema.post('findOneAndUpdate', triggerWoredaRiskRecalculation);
woredaAssessmentSchema.post('findOneAndDelete', triggerWoredaRiskRecalculation);

export default mongoose.model('WoredaAssessment', woredaAssessmentSchema);
