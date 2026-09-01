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

  // Define modules, sections and fields for Woreda Assessment
  const modules = [
    {
      moduleId: oid(),
      title: 'Location & Date Info',
      order: 1,
      sections: [
        {
          sectionId: oid(),
          title: 'Assessment Metadata',
          description: 'Basic location details and metadata for the Woreda-level assessment.',
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
              questionCode: 'assessment_date',
              label: 'Assessment Date',
              type: 'date',
              required: true,
              defaultValue: new Date().toISOString().split('T')[0],
              helpText: 'Date of the assessment'
            },
            {
              fieldId: oid(),
              questionCode: 'remarks',
              label: 'General Remarks',
              type: 'textarea',
              required: false,
              helpText: 'Additional observer remarks'
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'CGD (Community Group Discussion)',
      order: 2,
      sections: [
        {
          sectionId: oid(),
          title: 'CGD Community Voice',
          description: 'Community observations on coping mechanisms, interventions, and collective actions.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'cgd_coping_strategies',
              label: 'Coping Strategies',
              type: 'textarea',
              required: false,
              helpText: 'Common strategies used by the community to cope with hazards.'
            },
            {
              fieldId: oid(),
              questionCode: 'cgd_collective_action_structure',
              label: 'Collective Action Structure',
              type: 'textarea',
              required: false,
              helpText: 'Existing structures or mechanisms for community collective action.'
            },
            {
              fieldId: oid(),
              questionCode: 'cgd_suggested_interventions',
              label: 'Suggested Interventions',
              type: 'textarea',
              required: false,
              helpText: 'Priority risk-reduction interventions proposed by community members.'
            }
          ]
        },
        {
          sectionId: oid(),
          title: 'Primary Community Hazards',
          description: 'Details on the primary hazard observed or discussed in the group.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'hazard_name',
              label: 'Primary Hazard Name',
              type: 'text',
              required: false,
              helpText: 'e.g. Flood, Fire, Landslide, Drought'
            },
            {
              fieldId: oid(),
              questionCode: 'frequency',
              label: 'Frequency of Hazard Occurrence',
              type: 'select',
              required: false,
              options: [
                { label: 'Rare / Very Low', value: '1' },
                { label: 'Low', value: '2' },
                { label: 'Moderate', value: '3' },
                { label: 'High', value: '4' },
                { label: 'Frequent / Very High', value: '5' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'severity',
              label: 'Severity of Impact',
              type: 'select',
              required: false,
              options: [
                { label: 'Negligible', value: '1' },
                { label: 'Minor', value: '2' },
                { label: 'Moderate', value: '3' },
                { label: 'Major', value: '4' },
                { label: 'Catastrophic', value: '5' }
              ]
            },
            {
              fieldId: oid(),
              questionCode: 'spatial_extent',
              label: 'Spatial Extent / Area Affected',
              type: 'select',
              required: false,
              options: [
                { label: 'Isolated', value: '1' },
                { label: 'Local', value: '2' },
                { label: 'Subcity-wide', value: '3' },
                { label: 'City-wide', value: '4' },
                { label: 'National / Regional', value: '5' }
              ]
            }
          ]
        }
      ]
    },
    {
      moduleId: oid(),
      title: 'KII (Key Informant Interview) Indicators',
      order: 3,
      sections: [
        {
          sectionId: oid(),
          title: 'KII Capacity Indicators',
          description: 'Key informants rating of local disaster risk management capacity (Scores 1 to 5).',
          fields: [
            { fieldId: oid(), questionCode: 'ews', label: 'Early Warning System Capacity', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'drm_committee', label: 'DRM Committee Active Level', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'focal_persons', label: 'DRM Focal Persons Adequacy', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'training_freq', label: 'Disaster Training Frequency', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'shelters', label: 'Emergency Shelters Sufficiency', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'community_structures', label: 'Community Alert/Response Structures', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'emergency_services', label: 'Emergency Response Services Access', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'inter_sector_coordination', label: 'Inter-sectoral Coordination Level', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'institutional_strength', label: 'Institutional Strength of Authorities', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'recovery_plan', label: 'Post-Disaster Recovery Planning', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'budget', label: 'Dedicated DRM Budget Allocation', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'drm_mainstreaming', label: 'DRM Mainstreaming in Local Development', type: 'number', required: false }
          ]
        },
        {
          sectionId: oid(),
          title: 'KII Infrastructure Exposure & Vulnerability',
          description: 'Key informants rating of lifeline infrastructure resilience or vulnerability (Scores 1 to 5).',
          fields: [
            { fieldId: oid(), questionCode: 'health_exposure', label: 'Health Infrastructure Vulnerability', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'water_exposure', label: 'Water Infrastructure Vulnerability', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'energy_exposure', label: 'Energy Infrastructure Vulnerability', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'emergency_exposure', label: 'Emergency Services Infrastructure Vulnerability', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'comm_exposure', label: 'Communications Infrastructure Vulnerability', type: 'number', required: false }
          ]
        },
        {
          sectionId: oid(),
          title: 'KII Environmental Indicators',
          description: 'Key informants rating of local environmental degradation factors (Scores 1 to 5).',
          fields: [
            { fieldId: oid(), questionCode: 'drainage_blockage', label: 'Drainage System Blockage Level', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'green_cover_loss', label: 'Loss of Urban Green Cover', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'waste_mgmt_inadequacy', label: 'Solid Waste Management Inadequacy', type: 'number', required: false },
            { fieldId: oid(), questionCode: 'pollution_level', label: 'Environmental Pollution Hotspots level', type: 'number', required: false }
          ]
        }
      ]
    }
  ];

  const template = {
    _id: templateId,
    name: 'Woreda KII and CGD Assessment Template',
    description: 'Survey template structured for woreda-level assessments, gathering Community Group Discussions (CGD) and Key Informant Interviews (KII).',
    category: 'Assessment',
    moduleType: 'WRA',
    version: 1,
    isLatest: true,
    status: 'Published',
    modules
  };

  const targetPaths = [
    // Location
    { q: 'subcity', t: 'location.subcity', cast: 'direct' },
    { q: 'woreda', t: 'location.woreda', cast: 'direct' },
    { q: 'assessment_date', t: 'assessment_date', cast: 'direct' },
    { q: 'remarks', t: 'remarks', cast: 'direct' },

    // CGD
    { q: 'cgd_coping_strategies', t: 'cgd_community_voice.coping_strategies', cast: 'direct' },
    { q: 'cgd_collective_action_structure', t: 'cgd_community_voice.collective_action_structure', cast: 'direct' },
    { q: 'cgd_suggested_interventions', t: 'cgd_community_voice.suggested_interventions', cast: 'direct' },

    // Hazards
    { q: 'hazard_name', t: 'hazards.hazard_name', cast: 'direct' },
    { q: 'frequency', t: 'hazards.frequency', cast: 'direct' },
    { q: 'severity', t: 'hazards.severity', cast: 'direct' },
    { q: 'spatial_extent', t: 'hazards.spatial_extent', cast: 'direct' },

    // KII Capacity
    { q: 'ews', t: 'kii_capacity_indicators.ews', cast: 'cast_number' },
    { q: 'drm_committee', t: 'kii_capacity_indicators.drm_committee', cast: 'cast_number' },
    { q: 'focal_persons', t: 'kii_capacity_indicators.focal_persons', cast: 'cast_number' },
    { q: 'training_freq', t: 'kii_capacity_indicators.training_freq', cast: 'cast_number' },
    { q: 'shelters', t: 'kii_capacity_indicators.shelters', cast: 'cast_number' },
    { q: 'community_structures', t: 'kii_capacity_indicators.community_structures', cast: 'cast_number' },
    { q: 'emergency_services', t: 'kii_capacity_indicators.emergency_services', cast: 'cast_number' },
    { q: 'inter_sector_coordination', t: 'kii_capacity_indicators.inter_sector_coordination', cast: 'cast_number' },
    { q: 'institutional_strength', t: 'kii_capacity_indicators.institutional_strength', cast: 'cast_number' },
    { q: 'recovery_plan', t: 'kii_capacity_indicators.recovery_plan', cast: 'cast_number' },
    { q: 'budget', t: 'kii_capacity_indicators.budget', cast: 'cast_number' },
    { q: 'drm_mainstreaming', t: 'kii_capacity_indicators.drm_mainstreaming', cast: 'cast_number' },

    // KII Infrastructure Exposure
    { q: 'health_exposure', t: 'kii_infrastructure_exposure.health', cast: 'cast_number' },
    { q: 'water_exposure', t: 'kii_infrastructure_exposure.water', cast: 'cast_number' },
    { q: 'energy_exposure', t: 'kii_infrastructure_exposure.energy', cast: 'cast_number' },
    { q: 'emergency_exposure', t: 'kii_infrastructure_exposure.emergency', cast: 'cast_number' },
    { q: 'comm_exposure', t: 'kii_infrastructure_exposure.communications', cast: 'cast_number' },

    // KII Environmental
    { q: 'drainage_blockage', t: 'kii_environmental_indicators.drainage', cast: 'cast_number' },
    { q: 'green_cover_loss', t: 'kii_environmental_indicators.green_cover', cast: 'cast_number' },
    { q: 'waste_mgmt_inadequacy', t: 'kii_environmental_indicators.waste_mgmt', cast: 'cast_number' },
    { q: 'pollution_level', t: 'kii_environmental_indicators.pollution', cast: 'cast_number' }
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
    name: 'Woreda Assessment Mapping',
    description: '1-to-1 profile mapping matching the premium Woreda Assessment Template fields directly into the structured WoredaAssessment model.',
    sourceType: 'InterviewTemplate',
    sourceId: templateId,
    targetModel: 'WoredaAssessment',
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

  // Upsert template
  const savedTemplate = await Template.findOneAndUpdate(
    { name: template.name },
    { $set: templateBody },
    { upsert: true, new: true }
  );
  console.log('Successfully seeded Woreda Template v1:', savedTemplate.name, `(${savedTemplate._id})`);

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
  console.log('Successfully seeded Woreda Mapping:', savedMapping.name, `(${savedMapping._id})`);

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
