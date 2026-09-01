import mongoose from 'mongoose';

const householdIdentitySchema = new mongoose.Schema({
    subcity: { type: String, trim: true },
    woreda: { type: String, trim: true },
    block: { type: String, trim: true },
    house_no: { type: String, trim: true },
    gps_latitude: { type: Number },
    gps_longitude: { type: Number },
    enumerator_name: { type: String, trim: true },
    survey_date: { type: Date },
    respondent_consent_status: { type: String, enum: ['Yes', 'No', 'Pending', ''] }
}, { _id: false });

const householdDemographicsSchema = new mongoose.Schema({
    total_household_members: { type: Number },
    male_members: { type: Number },
    female_members: { type: Number },
    children_0_17: { type: Number },
    youth_18_29: { type: Number },
    elderly_60_plus: { type: Number },
    female_headed_household: { type: String, enum: ['Yes', 'No', ''] },
    idp_status: { type: String, enum: ['Yes', 'No', 'Unknown', ''] },
    idp_reason: { type: String, trim: true },
    education_level_of_head: { type: String, trim: true },
    employment_status: { type: String, trim: true }
}, { _id: false });

const householdLivelihoodEconomySchema = new mongoose.Schema({
    primary_livelihood_type: { type: String, trim: true },
    secondary_livelihood_type: { type: String, trim: true },
    household_income_level: { type: String, trim: true },
    small_business_ownership: { type: String, enum: ['Yes', 'No', ''] },
    small_business_type: { type: String, trim: true },
    daily_labour_dependency: { type: String, enum: ['Yes', 'No', ''] },
    income_disruption_by_disaster: { type: String, trim: true },
    insurance_coverage: { type: String, enum: ['Yes', 'No', 'Partial', ''] },
    access_to_credit_safety_nets: { type: String, trim: true }
}, { _id: false });

const householdHousingSchema = new mongoose.Schema({
    wall_material_type: { type: String, trim: true },
    roof_material_type: { type: String, trim: true },
    building_age_years: { type: Number },
    building_code_compliance: { type: String, trim: true },
    informal_settlement: { type: String, enum: ['Yes', 'No', ''] },
    sleeping_rooms: { type: Number },
    fire_resistant_materials: { type: String, trim: true },
    proximity_to_hazard_zone: { type: String, trim: true },
    drainage_water_electricity_access: { type: String, trim: true }
}, { _id: false });

const householdPreparednessSchema = new mongoose.Schema({
    knows_nearest_emergency_shelter: { type: String, enum: ['Yes', 'No', ''] },
    knows_local_evacuation_route: { type: String, enum: ['Yes', 'No', ''] },
    drm_training_received_type: { type: String, trim: true },
    family_emergency_plan_exists: { type: String, enum: ['Yes', 'No', ''] },
    emergency_supplies_stockpiled: { type: String, enum: ['Yes', 'Partial', 'No', ''] },
    early_warning_received_channel: { type: String, trim: true },
    community_awareness_self_rated_1_5: { type: Number }
}, { _id: false });

const householdRecoveryCapacitySchema = new mongoose.Schema({
    past_disaster_experience_type: { type: String, trim: true },
    recovery_duration_months: { type: Number },
    self_help_savings_group_membership: { type: String, enum: ['Yes', 'No', ''] },
    government_safety_net_access: { type: String, enum: ['Yes', 'No', ''] },
    income_diversification_2plus_sources: { type: String, enum: ['Yes', 'No', ''] },
    resilience_enumerator_assessment_1_5: { type: Number }
}, { _id: false });

const householdProfileSchema = new mongoose.Schema({
    location: {
        subcity: { type: String, trim: true },
        woreda: { type: String, required: true, trim: true },
        block: { type: String, trim: true },
        house_no: { type: String, trim: true }
    },
    assessment_date: { type: Date, required: true },
    assessed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String },
    notes: { type: String, trim: true, default: '' },

    identity_location: { type: householdIdentitySchema },
    demographics: { type: householdDemographicsSchema },
    livelihood_economy: { type: householdLivelihoodEconomySchema },
    housing_physical_conditions: { type: householdHousingSchema },
    preparedness: { type: householdPreparednessSchema },
    recovery_capacity: { type: householdRecoveryCapacitySchema },

    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Reviewed'],
        default: 'Draft'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for performance on spatial queries
householdProfileSchema.index({ 'location.subcity': 1, 'location.woreda': 1, 'location.block': 1 });
householdProfileSchema.index({ 'location.woreda': 1, status: 1 });
householdProfileSchema.index({ 'location.woreda': 1, 'location.house_no': 1 });

/**
 * Post-save hook: Trigger scoped spatial aggregation after a household profile is saved.
 * Uses dynamic import to avoid circular dependency between model and controller.
 */
const triggerHouseholdAggregation = async (doc) => {
    try {
        const { triggerScopedAggregation } = await import('../services/aggregationTriggerService.js');
        await triggerScopedAggregation({
            subcity: doc.location?.subcity,
            woreda: doc.location?.woreda,
            block: doc.location?.block
        });
    } catch (err) {
        console.error('[HouseholdProfile] Aggregation trigger failed:', err.message);
    }
};

householdProfileSchema.post('save', triggerHouseholdAggregation);
householdProfileSchema.post('findOneAndUpdate', triggerHouseholdAggregation);
householdProfileSchema.post('findOneAndDelete', triggerHouseholdAggregation);

export default mongoose.model('HouseholdProfile', householdProfileSchema);
