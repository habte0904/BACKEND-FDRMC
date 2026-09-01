import mongoose from 'mongoose';
import { normalizeHouseholdToAggregatedSchema } from '../services/SpatialAggregationService.js';


const adminLocationSchema = new mongoose.Schema({
    subcity: { type: String, trim: true },
    woreda: { type: String, required: true, trim: true },
    block: { type: String, trim: true },
    house_no: { type: String, trim: true }
});

const demographicsSchema = new mongoose.Schema({
    total_population: { type: Number },
    male_population: { type: Number },
    female_population: { type: Number },
    children_0_17: { type: Number },
    youth_18_29: { type: Number },
    adults_30_59: { type: Number },
    elderly_60_plus: { type: Number },
    total_households: { type: Number },
    female_headed_households: { type: Number },
    informal_settlement_population: { type: Number },
    low_income_households: { type: Number },
    unemployment_rate: { type: Number }, // stored as percentage e.g. 33
    internally_displaced_population: { type: Number },
    education_levels: [{
        category: String,
        count: Number
    }]
});

const livelihoodSchema = new mongoose.Schema({
    livelihood_type: { type: String, required: true },
    households: { type: Number },
    percentage: { type: Number }
});

const basicServiceSchema = new mongoose.Schema({
    water_source: { type: String },
    electricity: { type: Boolean },
    road_access: { type: String, enum: ['All-weather', 'Seasonal', 'No road', ''] },
    drainage_system_coverage: { type: Boolean },
    solid_waste_management_coverage: { type: Boolean },
    telecommunications_access: { type: Boolean },
    critical_lifeline_redundancy: { type: Boolean }
});

const criticalFacilitySchema = new mongoose.Schema({
    facility_type: { type: String, required: true },
    distance_to_nearest_emergency_service: { type: Number }, // in km
    structural_safety: { type: String, enum: ['Good', 'Fair', 'Poor', ''] },
    emergency_equipment_available: { type: Boolean }
});

const vulnerableGroupSchema = new mongoose.Schema({
    group_type: { type: String, required: true },
    number: { type: Number }
});

const communityCapacitySchema = new mongoose.Schema({
    capacity_type: { type: String, required: true },
    available: { type: Boolean },
    remarks: { type: String }
});

const hazardSchema = new mongoose.Schema({
    hazard_name: { type: String, required: true },
    hazard_category: { type: String }
});

const communityHazardSchema = new mongoose.Schema({
    hazard_name: { type: String },
    frequency: { type: String },
    severity: { type: String },
    duration: { type: String },
    spatial_extent: { type: String },
    seasonality: { type: String },
    historical_events: { type: String }
});

const vulnerabilityAssessmentSchema = new mongoose.Schema({
    hazard_name: { type: String },
    element_at_risk: { type: String },
    vulnerability_level: { type: String },
    reasons: { type: String }
});

const housingIndicatorsSchema = new mongoose.Schema({
    percent_non_durable_materials: { type: Number },
    age_buildings_over_30_years: { type: Number },
    compliance_with_building_codes: { type: Number },
    housing_density_overcrowding: { type: Number },
    informal_housing_coverage: { type: Number },
    proximity_to_hazard_zones: { type: Number },
    fire_resistant_materials_availability: { type: Number }
});

const capacityAssessmentSchema = new mongoose.Schema({
    hazard_name: { type: String },
    capacity_type: { type: String },
    capacity_level: { type: String },
    remarks: { type: String }
});

const economicRiskIndicatorsSchema = new mongoose.Schema({
    concentration_small_informal_businesses: { type: String },
    market_exposure: { type: String },
    daily_labor_dependency: { type: String },
    business_interruption_risk: { type: String },
    industrial_hazard_exposure: { type: String },
    insurance_coverage_level: { type: String }
});

const environmentalIndicatorsSchema = new mongoose.Schema({
    green_space_per_capita: { type: String },
    wetland_encroachment: { type: String },
    soil_sealing_coverage: { type: String },
    waste_dumping_sites: { type: String },
    urban_drainage_blockage_frequency: { type: String },
    pollution_hotspots: { type: String }
});

const infrastructureExposureSchema = new mongoose.Schema({
    road_network_status: { type: String, trim: true },
    health_facility_access: { type: String, trim: true },
    water_supply_coverage: { type: String, trim: true },
    sanitation_infrastructure_coverage: { type: String, trim: true },
    shelter_exposure: { type: String, trim: true }
}, { _id: false });

const communityVoiceInterventionsSchema = new mongoose.Schema({
    priority_needs: { type: String, trim: true },
    local_response_capacity: { type: String, trim: true },
    early_warning_feedback: { type: String, trim: true },
    suggested_interventions: { type: String, trim: true },
    social_cohesion_level: { type: String, trim: true }
}, { _id: false });

const preparednessIndicatorsSchema = new mongoose.Schema({
    emergency_shelters_availability: { type: String },
    evacuation_routes_mapped: { type: String },
    firefighting_equipment_availability: { type: String },
    ambulance_coverage: { type: String },
    emergency_drills_frequency: { type: String },
    community_awareness_level: { type: String },
    stockpiled_emergency_supplies: { type: String }
});

const recoveryIndicatorsSchema = new mongoose.Schema({
    post_disaster_recovery_plans: { type: String },
    livelihood_diversification: { type: String },
    access_to_credit_safety_nets: { type: String },
    community_self_help_groups: { type: String },
    urban_upgrading_programs: { type: String },
    climate_adaptation_initiatives: { type: String }
});

const riskIndexSchema = new mongoose.Schema({
    hazard_index: { type: Number },
    vulnerability_index: { type: Number },
    exposure_index: { type: Number },
    capacity_index: { type: Number },
    overall_woreda_risk_score: { type: Number }
});

const hierarchyBlockCountsSchema = new mongoose.Schema({
    total_households: { type: Number },
    total_population: { type: Number },
    female_headed_households: { type: Number },
    informal_settlement_population: { type: Number },
    low_income_households: { type: Number }
}, { _id: false });

const hierarchySummarySchema = new mongoose.Schema({
    aggregation_level: { type: String, enum: ['household', 'block', 'woreda', 'subcity', 'city'] },
    parent_level: { type: String, enum: ['household', 'block', 'woreda', 'subcity', 'city', null] },
    parent_key: { type: String },
    source_profiles: { type: Number },
    total_households: { type: Number },
    total_population: { type: Number },
    vulnerability_score: { type: Number },
    exposure_score: { type: Number },
    capacity_score: { type: Number },
    hazard_score: { type: Number },
    dr_risk_score: { type: Number },
    rank_in_parent: { type: Number },
    aggregation_method: { type: String },
    added_at_level: { type: String },
    block_counts: { type: hierarchyBlockCountsSchema }
}, { _id: false });

const riskAssessmentSchema = new mongoose.Schema({
    hazard_name: { type: String },
    risk_level: { type: String },
    risk_score: { type: Number },
    priority_rank: { type: Number },
    recommended_action: { type: String }
});

const surveyMetadataSchema = new mongoose.Schema({
    source_type: { type: String, trim: true },
    source_id: { type: String, trim: true },
    institution_name: { type: String, trim: true },
    assessor: { type: String, trim: true },
    version: { type: String, trim: true },
    gps_coordinates: { type: String, trim: true },
    location_reference: { type: String, trim: true },
    captured_at: { type: Date }
}, { _id: false });

const rawSurveySectionSchema = new mongoose.Schema({
    responses: { type: mongoose.Schema.Types.Mixed, default: {} },
    notes: { type: String },
    captured_at: { type: Date }
}, { _id: false });

const rawSurveySchema = new mongoose.Schema({
    household_level: { type: rawSurveySectionSchema, default: {} },
    community_group_discussion: { type: rawSurveySectionSchema, default: {} },
    key_informant_interview: { type: rawSurveySectionSchema, default: {} }
}, { _id: false });

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

const woredaProfileSchema = new mongoose.Schema({
    location: { type: adminLocationSchema, required: true },
    assessment_date: { type: Date, required: true },
    aggregation_level: {
        type: String,
        enum: ['household', 'block', 'woreda', 'subcity', 'city'],
        default: 'household'
    },
    assessed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String },
    survey_metadata: { type: surveyMetadataSchema },
    raw_survey: { type: rawSurveySchema },
    demographics: { type: demographicsSchema },
    livelihoods: [livelihoodSchema],
    basic_services: { type: basicServiceSchema },
    critical_facilities: [criticalFacilitySchema],
    vulnerable_groups: [vulnerableGroupSchema],
    community_capacity: [communityCapacitySchema],
    hazards: [communityHazardSchema],
    vulnerability_assessments: [vulnerabilityAssessmentSchema],
    housing_indicators: { type: housingIndicatorsSchema },
    capacity_assessments: [capacityAssessmentSchema],
    economic_risk_indicators: { type: economicRiskIndicatorsSchema },
    environmental_indicators: { type: environmentalIndicatorsSchema },
    infrastructure_exposure: { type: infrastructureExposureSchema },
    community_voice_interventions: { type: communityVoiceInterventionsSchema },
    preparedness_indicators: { type: preparednessIndicatorsSchema },
    recovery_indicators: { type: recoveryIndicatorsSchema },
    risk_index: { type: riskIndexSchema },
    risk_assessments: [riskAssessmentSchema],
    hierarchy_summary: { type: hierarchySummarySchema },
    kii_capacity_indicators: { type: kiiCapacityIndicatorsSchema },
    kii_infrastructure_exposure: { type: kiiInfrastructureExposureSchema },
    kii_environmental_indicators: { type: kiiEnvironmentalIndicatorsSchema },
    cgd_community_voice: { type: cgdCommunityVoiceSchema },
    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Reviewed'],
        default: 'Draft'
    },
    syncSources: {
        type: Map,
        of: new mongoose.Schema({
            responseId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormResponse' },
            answerId: String,
            sourceKey: String,
            syncedAt: { type: Date, default: Date.now }
        }, { _id: false })
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

woredaProfileSchema.index(
    { 'location.subcity': 1, 'location.woreda': 1, 'location.block': 1, 'location.house_no': 1 },
    { unique: true, name: 'unique_location_index' }
);



export default mongoose.model('WoredaProfile', woredaProfileSchema);

