import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Template from '../models/Template.js';
import ProfileMapping from '../models/ProfileMapping.js';

dotenv.config();

const oid = () => uuidv4();

const buildTemplateAndMapping = () => {
  const templateId = new mongoose.Types.ObjectId();
  const mappingId = new mongoose.Types.ObjectId();

  // Define modules, sections and fields
  const modules = [
    {
      moduleId: oid(),
      title: 'Household Identity & Location',
      order: 1,
      sections: [
        {
          sectionId: oid(),
          title: 'Location & Consent details',
          description: 'Basic identifying information and consent status.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'subcity',
              label: 'Sub-city',
              type: 'text',
              required: true,
              helpText: 'Administrative sub-city'
            },
            {
              fieldId: oid(),
              questionCode: 'woreda',
              label: 'Woreda',
              type: 'text',
              required: true,
              helpText: 'Woreda name or number'
            },
            {
              fieldId: oid(),
              questionCode: 'block',
              label: 'Block',
              type: 'text',
              required: false,
              helpText: 'Block number if applicable'
            },
            {
              fieldId: oid(),
              questionCode: 'house_no',
              label: 'House Number',
              type: 'text',
              required: true,
              helpText: 'Unique house number'
            },
            {
              fieldId: oid(),
              questionCode: 'gps_latitude',
              label: 'GPS Latitude',
              type: 'number',
              required: false,
              readOnly: true,
              systemAutoFill: 'gps_latitude',
              helpText: 'Auto-detected device latitude coordinate'
            },
            {
              fieldId: oid(),
              questionCode: 'gps_longitude',
              label: 'GPS Longitude',
              type: 'number',
              required: false,
              readOnly: true,
              systemAutoFill: 'gps_longitude',
              helpText: 'Auto-detected device longitude coordinate'
            },
            {
              fieldId: oid(),
              questionCode: 'enumerator_name',
              label: 'Enumerator Name',
              type: 'text',
              required: true,
              systemAutoFill: 'user_name',
              helpText: 'Full name of the assessor'
            },
            {
              fieldId: oid(),
              questionCode: 'survey_date',
              label: 'Survey Date',
              type: 'date',
              required: true,
              defaultValue: new Date().toISOString().split('T')[0],
              helpText: 'Date of assessment'
            },
            {
              fieldId: oid(),
              questionCode: 'respondent_consent_status',
              label: 'Respondent Consent Status',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ],
              helpText: 'Did the respondent consent to this survey?'
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'Demographics',
      order: 2,
      sections: [
        {
          sectionId: oid(),
          title: 'Household Demographics',
          description: 'Members details and education metrics.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'total_household_members',
              label: 'Total Household Members',
              type: 'number',
              required: true,
              helpText: 'Total number of members living in this dwelling'
            },
            {
              fieldId: oid(),
              questionCode: 'male_members',
              label: 'Male Members Count',
              type: 'number',
              required: true,
              helpText: 'Total number of male members'
            },
            {
              fieldId: oid(),
              questionCode: 'female_members',
              label: 'Female Members Count',
              type: 'number',
              required: true,
              helpText: 'Total number of female members'
            },
            {
              fieldId: oid(),
              questionCode: 'children_0_17',
              label: 'Children Count (Age 0 - 17)',
              type: 'number',
              required: true,
              helpText: 'Total members aged between 0 and 17'
            },
            {
              fieldId: oid(),
              questionCode: 'youth_18_29',
              label: 'Youth Count (Age 18 - 29)',
              type: 'number',
              required: true,
              helpText: 'Total members aged between 18 and 29'
            },
            {
              fieldId: oid(),
              questionCode: 'elderly_60_plus',
              label: 'Elderly Count (Age 60+)',
              type: 'number',
              required: true,
              helpText: 'Total members aged 60 or above'
            },
            {
              fieldId: oid(),
              questionCode: 'female_headed_household',
              label: 'Female-headed Household?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'idp_status',
              label: 'IDP Status',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ],
              helpText: 'Is any member an Internally Displaced Person?'
            },
            {
              fieldId: oid(),
              questionCode: 'idp_reason',
              label: 'IDP Reason (If Yes)',
              type: 'text',
              required: false,
              conditionalLogic: {
                dependsOn: 'idp_status',
                operator: 'equals',
                value: 'Yes'
              },
              helpText: 'Reason for internal displacement'
            },
            {
              fieldId: oid(),
              questionCode: 'education_level_of_head',
              label: 'Education Level of Head',
              type: 'select',
              required: true,
              options: [
                { label: 'No Education', value: 'No Education' },
                { label: 'Primary', value: 'Primary' },
                { label: 'Secondary', value: 'Secondary' },
                { label: 'Higher Education', value: 'Higher Education' },
                { label: 'Vocational', value: 'Vocational' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'employment_status',
              label: 'Employment Status of Head',
              type: 'select',
              required: true,
              options: [
                { label: 'Employed', value: 'Employed' },
                { label: 'Unemployed', value: 'Unemployed' },
                { label: 'Self-employed', value: 'Self-employed' },
                { label: 'Student', value: 'Student' },
                { label: 'Retired', value: 'Retired' },
                { label: 'Other', value: 'Other' }
              ]
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'Livelihood & Economy',
      order: 3,
      sections: [
        {
          sectionId: oid(),
          title: 'Livelihood details',
          description: 'Economic vulnerability and asset indicators.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'primary_livelihood_type',
              label: 'Primary Livelihood Type',
              type: 'select',
              required: true,
              options: [
                { label: 'Agriculture', value: 'Agriculture' },
                { label: 'Livestock', value: 'Livestock' },
                { label: 'Trade', value: 'Trade' },
                { label: 'Labor', value: 'Labor' },
                { label: 'Other', value: 'Other' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'secondary_livelihood_type',
              label: 'Secondary Livelihood Type',
              type: 'select',
              required: false,
              options: [
                { label: 'None', value: 'None' },
                { label: 'Agriculture', value: 'Agriculture' },
                { label: 'Livestock', value: 'Livestock' },
                { label: 'Trade', value: 'Trade' },
                { label: 'Labor', value: 'Labor' },
                { label: 'Other', value: 'Other' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'household_income_level',
              label: 'Household Income Level',
              type: 'select',
              required: true,
              options: [
                { label: 'Low', value: 'Low' },
                { label: 'Medium', value: 'Medium' },
                { label: 'High', value: 'High' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'small_business_ownership',
              label: 'Small Business Ownership',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'small_business_type',
              label: 'Small Business Type (If Yes)',
              type: 'text',
              required: false,
              conditionalLogic: {
                dependsOn: 'small_business_ownership',
                operator: 'equals',
                value: 'Yes'
              }
            },
            {
              fieldId: oid(),
              questionCode: 'daily_labour_dependency',
              label: 'Daily Labor Dependency?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'income_disruption_by_disaster',
              label: 'Income Disruption By Disaster',
              type: 'text',
              required: false,
              helpText: 'e.g., Yes - 3 months, No, etc.'
            },
            {
              fieldId: oid(),
              questionCode: 'insurance_coverage',
              label: 'Insurance Coverage',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' },
                { label: 'Partial', value: 'Partial' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'access_to_credit_safety_nets',
              label: 'Access to Credit & Safety Nets',
              type: 'select',
              required: true,
              options: [
                { label: 'Good Access', value: 'Good Access' },
                { label: 'Limited Access', value: 'Limited Access' },
                { label: 'No Access', value: 'No Access' }
              ]
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'Housing & Physical Conditions',
      order: 4,
      sections: [
        {
          sectionId: oid(),
          title: 'Housing indicators',
          description: 'Dwelling physical stability metrics.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'wall_material_type',
              label: 'Wall Material Type',
              type: 'select',
              required: true,
              options: [
                { label: 'Wood and Mud', value: 'Wood and Mud' },
                { label: 'Stone', value: 'Stone' },
                { label: 'Brick', value: 'Brick' },
                { label: 'Corrugated Iron Sheet', value: 'Corrugated Iron Sheet' },
                { label: 'Other', value: 'Other' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'roof_material_type',
              label: 'Roof Material Type',
              type: 'select',
              required: true,
              options: [
                { label: 'Corrugated Iron Sheet', value: 'Corrugated Iron Sheet' },
                { label: 'Thatch', value: 'Thatch' },
                { label: 'Concrete', value: 'Concrete' },
                { label: 'Other', value: 'Other' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'building_age_years',
              label: 'Building Age (years)',
              type: 'number',
              required: true
            },
            {
              fieldId: oid(),
              questionCode: 'building_code_compliance',
              label: 'Building Code Compliance',
              type: 'select',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' },
                { label: 'Unsure', value: 'Unsure' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'informal_settlement',
              label: 'Informal / Squatter Settlement?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'sleeping_rooms',
              label: 'Number of Sleeping Rooms',
              type: 'number',
              required: true
            },
            {
              fieldId: oid(),
              questionCode: 'fire_resistant_materials',
              label: 'Fire-resistant Materials Status',
              type: 'select',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' },
                { label: 'Partial', value: 'Partial' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'proximity_to_hazard_zone',
              label: 'Proximity to Hazard Zone',
              type: 'text',
              required: false,
              helpText: 'e.g. Yes - Landslide zone, No'
            },
            {
              fieldId: oid(),
              questionCode: 'drainage_water_electricity_access',
              label: 'Drainage, Water & Electricity Access',
              type: 'select',
              required: true,
              options: [
                { label: 'Full Access', value: 'Full Access' },
                { label: 'Partial Access', value: 'Partial Access' },
                { label: 'No Access', value: 'No Access' }
              ]
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'Preparedness',
      order: 5,
      sections: [
        {
          sectionId: oid(),
          title: 'Disaster preparedness',
          description: 'mitigation capabilities and community networks.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'knows_nearest_emergency_shelter',
              label: 'Knows Nearest Emergency Shelter?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'knows_local_evacuation_route',
              label: 'Knows Local Evacuation Route?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'drm_training_received_type',
              label: 'DRM Training Received & Type',
              type: 'text',
              required: false,
              helpText: 'e.g. Yes - Basic First Aid, No'
            },
            {
              fieldId: oid(),
              questionCode: 'family_emergency_plan_exists',
              label: 'Family Emergency Plan Exists?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'emergency_supplies_stockpiled',
              label: 'Emergency Supplies Stockpiled',
              type: 'select',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' },
                { label: 'Partial', value: 'Partial' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'early_warning_received_channel',
              label: 'Early Warning Received & Channel',
              type: 'text',
              required: false,
              helpText: 'e.g. Yes - SMS, No'
            },
            {
              fieldId: oid(),
              questionCode: 'community_awareness_self_rated_1_5',
              label: 'Community Awareness (Self-rated 1-5)',
              type: 'select',
              required: true,
              options: [
                { label: '1 - Very Low', value: '1' },
                { label: '2 - Low', value: '2' },
                { label: '3 - Medium', value: '3' },
                { label: '4 - High', value: '4' },
                { label: '5 - Very High', value: '5' }
              ]
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'Recovery Capacity',
      order: 6,
      sections: [
        {
          sectionId: oid(),
          title: 'Coping & Adaptive Capacity',
          description: 'Recovery time and community support frameworks.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'past_disaster_experience_type',
              label: 'Past Disaster Experience & Type',
              type: 'text',
              required: false,
              helpText: 'e.g. Yes - 2024 Flood, No'
            },
            {
              fieldId: oid(),
              questionCode: 'recovery_duration_months',
              label: 'Recovery Duration (months)',
              type: 'number',
              required: true,
              helpText: 'Number of months required to recover from last disaster'
            },
            {
              fieldId: oid(),
              questionCode: 'self_help_savings_group_membership',
              label: 'Self-help / Savings Group Membership?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'government_safety_net_access',
              label: 'Government Safety Net Access?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'income_diversification_2plus_sources',
              label: 'Income Diversification (2+ sources)?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes', value: 'Yes' },
                { label: 'No', value: 'No' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'resilience_enumerator_assessment_1_5',
              label: 'Resilience (Enumerator Assessment 1-5)',
              type: 'select',
              required: true,
              options: [
                { label: '1 - Extremely Vulnerable', value: '1' },
                { label: '2 - Vulnerable', value: '2' },
                { label: '3 - Moderately Resilient', value: '3' },
                { label: '4 - Resilient', value: '4' },
                { label: '5 - Highly Resilient', value: '5' }
              ]
            }
          ]
        }
      ]
    }
  ];

  const template = {
    _id: templateId,
    name: 'Household Assessment Questionnaire',
    description: 'Dynamic survey protocol to assess vulnerability, exposure, demographics and resilience capacity per individual household.',
    category: 'Household',
    moduleType: 'HHQ',
    version: 1,
    isLatest: true,
    status: 'Published',
    publishedAt: new Date(),
    modules
  };

  // Build Profile Mapping
  const targetPaths = [
    // Identity & Location
    { q: 'subcity',                           t: 'location.subcity',                                             cast: 'direct' },
    { q: 'woreda',                            t: 'location.woreda',                                              cast: 'direct' },
    { q: 'block',                             t: 'location.block',                                               cast: 'direct' },
    { q: 'house_no',                          t: 'location.house_no',                                            cast: 'direct' },
    { q: 'gps_latitude',                      t: 'location.gps_latitude',                                        cast: 'cast_number' },
    { q: 'gps_longitude',                     t: 'location.gps_longitude',                                       cast: 'cast_number' },
    { q: 'enumerator_name',                   t: 'location.enumerator_name',                                     cast: 'direct' },
    { q: 'survey_date',                       t: 'location.survey_date',                                         cast: 'direct' },
    { q: 'respondent_consent_status',         t: 'location.respondent_consent_status',                           cast: 'direct' },

    // Demographics
    { q: 'total_household_members',           t: 'demographics.total_household_members',                         cast: 'cast_number' },
    { q: 'male_members',                      t: 'demographics.male_members',                                    cast: 'cast_number' },
    { q: 'female_members',                    t: 'demographics.female_members',                                  cast: 'cast_number' },
    { q: 'children_0_17',                     t: 'demographics.children_0_17',                                   cast: 'cast_number' },
    { q: 'youth_18_29',                       t: 'demographics.youth_18_29',                                     cast: 'cast_number' },
    { q: 'elderly_60_plus',                   t: 'demographics.elderly_60_plus',                                 cast: 'cast_number' },
    { q: 'female_headed_household',           t: 'demographics.female_headed_household',                         cast: 'direct' },
    { q: 'idp_status',                        t: 'demographics.idp_status',                                      cast: 'direct' },
    { q: 'idp_reason',                        t: 'demographics.idp_reason',                                      cast: 'direct' },
    { q: 'education_level_of_head',           t: 'demographics.education_level_of_head',                         cast: 'direct' },
    { q: 'employment_status',                 t: 'demographics.employment_status',                               cast: 'direct' },

    // Livelihood
    { q: 'primary_livelihood_type',           t: 'livelihood_economy.primary_livelihood_type',                   cast: 'direct' },
    { q: 'secondary_livelihood_type',         t: 'livelihood_economy.secondary_livelihood_type',                 cast: 'direct' },
    { q: 'household_income_level',            t: 'livelihood_economy.household_income_level',                    cast: 'direct' },
    { q: 'small_business_ownership',          t: 'livelihood_economy.small_business_ownership',                  cast: 'direct' },
    { q: 'small_business_type',               t: 'livelihood_economy.small_business_type',                       cast: 'direct' },
    { q: 'daily_labour_dependency',           t: 'livelihood_economy.daily_labour_dependency',                   cast: 'direct' },
    { q: 'income_disruption_by_disaster',     t: 'livelihood_economy.income_disruption_by_disaster',             cast: 'direct' },
    { q: 'insurance_coverage',                t: 'livelihood_economy.insurance_coverage',                        cast: 'direct' },
    { q: 'access_to_credit_safety_nets',      t: 'livelihood_economy.access_to_credit_safety_nets',              cast: 'direct' },

    // Housing
    { q: 'wall_material_type',                t: 'housing_physical_conditions.wall_material_type',               cast: 'direct' },
    { q: 'roof_material_type',                t: 'housing_physical_conditions.roof_material_type',               cast: 'direct' },
    { q: 'building_age_years',                t: 'housing_physical_conditions.building_age_years',               cast: 'cast_number' },
    { q: 'building_code_compliance',          t: 'housing_physical_conditions.building_code_compliance',         cast: 'direct' },
    { q: 'informal_settlement',               t: 'housing_physical_conditions.informal_settlement',              cast: 'direct' },
    { q: 'sleeping_rooms',                    t: 'housing_physical_conditions.sleeping_rooms',                   cast: 'cast_number' },
    { q: 'fire_resistant_materials',          t: 'housing_physical_conditions.fire_resistant_materials',         cast: 'direct' },
    { q: 'proximity_to_hazard_zone',          t: 'housing_physical_conditions.proximity_to_hazard_zone',         cast: 'direct' },
    { q: 'drainage_water_electricity_access', t: 'housing_physical_conditions.drainage_water_electricity_access',cast: 'direct' },

    // Preparedness
    { q: 'knows_nearest_emergency_shelter',   t: 'preparedness.knows_nearest_emergency_shelter',                 cast: 'direct' },
    { q: 'knows_local_evacuation_route',      t: 'preparedness.knows_local_evacuation_route',                    cast: 'direct' },
    { q: 'drm_training_received_type',        t: 'preparedness.drm_training_received_type',                      cast: 'direct' },
    { q: 'family_emergency_plan_exists',      t: 'preparedness.family_emergency_plan_exists',                    cast: 'direct' },
    { q: 'emergency_supplies_stockpiled',     t: 'preparedness.emergency_supplies_stockpiled',                   cast: 'direct' },
    { q: 'early_warning_received_channel',    t: 'preparedness.early_warning_received_channel',                  cast: 'direct' },
    { q: 'community_awareness_self_rated_1_5',t: 'preparedness.community_awareness_self_rated_1_5',              cast: 'cast_number' },

    // Recovery Capacity
    { q: 'past_disaster_experience_type',     t: 'recovery_capacity.past_disaster_experience_type',              cast: 'direct' },
    { q: 'recovery_duration_months',          t: 'recovery_capacity.recovery_duration_months',                   cast: 'cast_number' },
    { q: 'self_help_savings_group_membership',t: 'recovery_capacity.self_help_savings_group_membership',         cast: 'direct' },
    { q: 'government_safety_net_access',      t: 'recovery_capacity.government_safety_net_access',              cast: 'direct' },
    { q: 'income_diversification_2plus_sources', t: 'recovery_capacity.income_diversification_2plus_sources',   cast: 'direct' },
    { q: 'resilience_enumerator_assessment_1_5', t: 'recovery_capacity.resilience_enumerator_assessment_1_5',   cast: 'cast_number' }
  ];

  const mappings = targetPaths.map(tp => ({
    targetFieldPath: tp.t,
    sourceKey: tp.q,
    transformation: tp.cast,
    validation: {
      required: false
    }
  }));

  const mapping = {
    _id: mappingId,
    name: 'Household Assessment Mapping',
    description: '1-to-1 profile mapping matching the premium Household Assessment Questionnaire fields directly into the structured HouseholdProfile model.',
    sourceType: 'InterviewTemplate',
    sourceId: templateId,
    targetModel: 'HouseholdProfile',
    version: 1,
    mappings,
    status: 'Published',
    isActive: true
  };

  return { template, mapping };
};

const main = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/NPDRM';
  await mongoose.connect(mongoUri);

  const { template, mapping } = buildTemplateAndMapping();

  // Strip _id so upsert doesn't try to modify the immutable field
  const { _id: _tid, ...templateBody } = template;

  // Upsert dynamic template
  const savedTemplate = await Template.findOneAndUpdate(
    { name: template.name },
    { $set: templateBody },
    { upsert: true, new: true }
  );
  console.log('Successfully seeded Household Template v1:', savedTemplate.name, `(${savedTemplate._id})`);

  // Update mapping sourceId to match the upserted template
  mapping.sourceId = savedTemplate._id;

  // Strip _id so upsert doesn't try to modify the immutable field
  const { _id: _mid, ...mappingBody } = mapping;

  // Upsert Profile Mapping
  const savedMapping = await ProfileMapping.findOneAndUpdate(
    { name: mapping.name },
    { $set: mappingBody },
    { upsert: true, new: true }
  );
  console.log('Successfully seeded Household Mapping:', savedMapping.name, `(${savedMapping._id})`);

  await mongoose.disconnect();
};

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
