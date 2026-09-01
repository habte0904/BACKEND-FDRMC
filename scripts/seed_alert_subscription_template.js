import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Template from '../models/Template.js';

dotenv.config();

const oid = () => uuidv4();

const buildTemplate = () => ({
  name: 'Alert Subscription & Management',
  description:
    'Public portal subscription form to deliver targeted disaster alerts based on location, hazard type, severity, and delivery preferences.',
  category: 'Other',
  moduleType: 'AlertSubscription',
  version: 1,
  isLatest: true,
  status: 'Published',
  publishedAt: new Date(),
  modules: [
    {
      moduleId: oid(),
      title: 'Contact & Accessibility',
      order: 1,
      sections: [
        {
          sectionId: oid(),
          title: 'Where to send alerts',
          description: 'Provide at least one reliable contact channel.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'primary_mobile',
              label: 'Primary Mobile Number',
              type: 'phone',
              required: true,
              helpText: 'e.g., +251 9XX XXX XXX',
            },
            {
              fieldId: oid(),
              questionCode: 'alt_phone',
              label: 'Alternative / Home Phone',
              type: 'phone',
              required: false,
              helpText: 'Optional',
            },
            {
              fieldId: oid(),
              questionCode: 'email',
              label: 'Email Address',
              type: 'email',
              required: true,
              helpText: 'For detailed instructions and non-critical updates',
            },
            {
              fieldId: oid(),
              questionCode: 'preferred_language',
              label: 'Preferred Language',
              type: 'select',
              required: true,
              options: [
                { label: 'Amharic', value: 'am' },
                { label: 'Afaan Oromo', value: 'om' },
                { label: 'Tigrinya', value: 'ti' },
                { label: 'English', value: 'en' },
              ],
              helpText: 'Select your preferred language',
            },
            {
              fieldId: oid(),
              questionCode: 'tts_required',
              label: 'Accessibility: I require voice calls for text alerts (TTS)',
              type: 'radio',
              required: true,
              options: [
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
              ],
              helpText: 'If yes, we may call you for critical text alerts.',
            },
          ],
        },
      ],
    },
    {
      moduleId: oid(),
      title: 'Location Management',
      order: 2,
      sections: [
        {
          sectionId: oid(),
          title: 'Primary locations',
          description: 'Alerts are hyper-local. Capture at least your primary residence.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'residence_location',
              label: 'Primary Residence Location',
              type: 'geo',
              required: true,
              helpText: 'Use “Capture” to record your location',
            },
            {
              fieldId: oid(),
              questionCode: 'work_location',
              label: 'Workplace / School Location (Optional)',
              type: 'geo',
              required: false,
            },
            {
              fieldId: oid(),
              questionCode: 'other_locations',
              label: 'Other Locations (Optional)',
              type: 'table',
              required: false,
              options: {
                columns: [
                  { label: 'Name', value: 'name', type: 'text' },
                  { label: 'Address/Notes', value: 'notes', type: 'text' },
                ],
              },
              helpText: 'e.g., Vacation home, child’s school, relatives',
            },
            {
              fieldId: oid(),
              questionCode: 'proximity_radius',
              label: 'Proximity Radius',
              type: 'select',
              required: true,
              options: [
                { label: '1 km', value: '1' },
                { label: '5 km', value: '5' },
                { label: '10 km', value: '10' },
                { label: '25 km', value: '25' },
              ],
              helpText: 'Alert me for events within this distance of my locations',
            },
          ],
        },
      ],
    },
    {
      moduleId: oid(),
      title: 'Hazards & Delivery Preferences',
      order: 3,
      sections: [
        {
          sectionId: oid(),
          title: 'What to hear about',
          description: 'Choose alert severity per hazard type to reduce alert fatigue.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'all_hazards',
              label: 'Subscribe to all hazards?',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes (All Hazards)', value: 'yes' },
                { label: 'No (Choose hazards below)', value: 'no' },
              ],
            },
            {
              fieldId: oid(),
              questionCode: 'hazard_severity_matrix',
              label: 'Minimum alert level by hazard type',
              type: 'matrix',
              required: false,
              conditionalLogic: {
                dependsOn: 'all_hazards',
                operator: 'equals',
                value: 'no',
              },
              matrixConfig: {
                rows: [
                  { label: 'Floods', value: 'floods' },
                  { label: 'Heat Wave', value: 'heat_wave' },
                  { label: 'Drought', value: 'drought' },
                  { label: 'Landslides', value: 'landslides' },
                  { label: 'Earthquake', value: 'earthquake' },
                  { label: 'Subsidence/Fissures', value: 'subsidence_fissures' },
                  { label: 'Forest Fires', value: 'forest_fires' },
                  { label: 'Structural Fire', value: 'structural_fire' },
                  { label: 'Groundwater Pollution', value: 'groundwater_pollution' },
                  { label: 'Lake Water Pollution', value: 'lake_water_pollution' },
                  { label: 'Air Pollution', value: 'air_pollution' },
                  { label: 'Human Epidemics', value: 'human_epidemics' },
                  { label: 'Other', value: 'other' },
                ],
                columns: [
                  { label: 'Advisory', value: 'advisory' },
                  { label: 'Alert', value: 'alert' },
                  { label: 'Warning', value: 'warning' },
                ],
                cellType: 'radio',
              },
              helpText: 'Choose the minimum level you want for each hazard type.',
            },
            {
              fieldId: oid(),
              questionCode: 'global_severity_threshold',
              label: 'Minimum alert level (global)',
              type: 'radio',
              required: true,
              options: [
                { label: 'Advisory (Yellow)', value: 'advisory' },
                { label: 'Alert (Orange)', value: 'alert' },
                { label: 'Warning (Red)', value: 'warning' },
              ],
              helpText: 'Used as a default and for channels that do not support per-hazard settings.',
            },
          ],
        },
        {
          sectionId: oid(),
          title: 'Delivery channels',
          description: 'Choose the fastest channel available to you.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'delivery_channel',
              label: 'Preferred Delivery Channel',
              type: 'select',
              required: true,
              options: [
                { label: 'SMS', value: 'sms' },
                { label: 'Voice Call', value: 'voice' },
                { label: 'Email', value: 'email' },
                { label: 'WhatsApp/Telegram', value: 'chat' },
              ],
            },
            {
              fieldId: oid(),
              questionCode: 'quiet_hours_enabled',
              label: 'Quiet hours for non-critical alerts?',
              type: 'radio',
              required: true,
              options: [
                { label: 'No', value: 'no' },
                { label: 'Yes', value: 'yes' },
              ],
            },
            {
              fieldId: oid(),
              questionCode: 'quiet_hours_start',
              label: 'Quiet hours start time (HH:MM)',
              type: 'text',
              required: false,
              helpText: 'e.g., 22:00',
              conditionalLogic: {
                dependsOn: 'quiet_hours_enabled',
                operator: 'equals',
                value: 'yes',
              },
            },
            {
              fieldId: oid(),
              questionCode: 'quiet_hours_end',
              label: 'Quiet hours end time (HH:MM)',
              type: 'text',
              required: false,
              helpText: 'e.g., 06:00',
              conditionalLogic: {
                dependsOn: 'quiet_hours_enabled',
                operator: 'equals',
                value: 'yes',
              },
            },
            {
              fieldId: oid(),
              questionCode: 'family_contact',
              label: 'Emergency Contact / Family Plan (Optional)',
              type: 'phone',
              required: false,
              helpText: 'A second number to coordinate with family members.',
            },
          ],
        },
      ],
    },
    {
      moduleId: oid(),
      title: 'Household & Confirmation',
      order: 4,
      sections: [
        {
          sectionId: oid(),
          title: 'Household profile (optional)',
          description: 'Helps tailor instructions and prioritize response in emergencies.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'residents_count',
              label: 'How many people typically live in the household?',
              type: 'number',
              required: false,
              helpText: 'Optional',
            },
            {
              fieldId: oid(),
              questionCode: 'special_needs_matrix',
              label: 'Special needs / accessibility',
              type: 'matrix',
              required: false,
              matrixConfig: {
                rows: [
                  { label: 'Limited mobility', value: 'limited_mobility' },
                  { label: 'Deaf / hard of hearing', value: 'hearing' },
                  { label: 'Blind / visually impaired', value: 'vision' },
                  { label: 'Medical electricity required', value: 'medical_power' },
                ],
                columns: [
                  { label: 'No', value: 'no' },
                  { label: 'Yes', value: 'yes' },
                ],
                cellType: 'radio',
              },
            },
            {
              fieldId: oid(),
              questionCode: 'assets_matrix',
              label: 'Assets at risk (optional)',
              type: 'matrix',
              required: false,
              matrixConfig: {
                rows: [
                  { label: 'Livestock', value: 'livestock' },
                  { label: 'Boat', value: 'boat' },
                  { label: 'Multi-story building', value: 'multi_story' },
                ],
                columns: [
                  { label: 'No', value: 'no' },
                  { label: 'Yes', value: 'yes' },
                ],
                cellType: 'radio',
              },
            },
          ],
        },
        {
          sectionId: oid(),
          title: 'Review & confirm',
          description: 'Submit to activate your subscription.',
          fields: [
            {
              fieldId: oid(),
              questionCode: 'consent',
              label: 'I confirm that the contact details provided are correct and I consent to receive disaster alerts.',
              type: 'radio',
              required: true,
              options: [
                { label: 'Yes, I agree', value: 'yes' },
                { label: 'No', value: 'no' },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const main = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Missing MONGO_URI (or MONGODB_URI) in environment.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const template = buildTemplate();

  await Template.findOneAndUpdate(
    { name: template.name, version: template.version },
    { $set: template },
    { upsert: true, new: true }
  );

  console.log('Seeded template:', template.name, 'v', template.version);
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
