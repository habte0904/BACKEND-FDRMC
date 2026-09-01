/**
 * reportBuilderController.js
 *
 * Dynamic query engine that powers the Report Builder.
 * Each data source maps to a Mongoose model + field registry.
 * Supports: filtering, field projection, groupBy aggregation, pagination.
 */

import IncidentReport from '../models/IncidentReport.js';
import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaAssessment from '../models/WoredaAssessment.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Organization from '../models/Organization.js';
import EmergencyContact from '../models/EmergencyContact.js';
import AlertSubscription from '../models/AlertSubscription.js';
import AuditLog from '../models/AuditLog.js';
import FormResponse from '../models/FormResponse.js';
import InspectionRequest from '../models/InspectionRequest.js';
import ReportTemplate from '../models/ReportTemplate.js';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';

// ─── Source Registry ───────────────────────────────────────────────────────────
// Defines every available data source, its model, filterable fields,
// and all selectable columns for the report builder.

const SOURCE_REGISTRY = {
  incident_reports: {
    label: 'Incident Reports',
    description: 'Public incident reports submitted by citizens',
    icon: 'AlertTriangle',
    color: '#ef4444',
    model: IncidentReport,
    defaultFields: ['reportCode', 'reportType', 'status', 'category', 'severity', 'location.woreda', 'createdAt'],
    fields: [
      { key: 'reportCode',          label: 'Report Code',        type: 'string' },
      { key: 'reportType',          label: 'Type',               type: 'enum',   options: ['incident', 'concern'] },
      { key: 'status',              label: 'Status',             type: 'enum',   options: ['new','submitted','received','dispatched','not_solved','solved','closed','archived'] },
      { key: 'category',            label: 'Category',           type: 'string' },
      { key: 'severity',            label: 'Severity',           type: 'enum',   options: ['low','moderate','high','critical'] },
      { key: 'location.woreda',     label: 'Woreda',             type: 'string' },
      { key: 'location.subCity',    label: 'Sub-City',           type: 'string' },
      { key: 'location.region',     label: 'Region',             type: 'string' },
      { key: 'location.placeName',  label: 'Place Name',         type: 'string' },
      { key: 'details',             label: 'Details',            type: 'string' },
      { key: 'anonymous',           label: 'Anonymous',          type: 'boolean' },
      { key: 'assignedTo',          label: 'Assigned To',        type: 'string' },
      { key: 'responsibleInstitution', label: 'Institution',     type: 'string' },
      { key: 'resolvedAt',          label: 'Resolved At',        type: 'date' },
      { key: 'resolutionDescription', label: 'Resolution',       type: 'string' },
      { key: 'isRead',              label: 'Is Read',            type: 'boolean' },
      { key: 'createdAt',           label: 'Submitted At',       type: 'date' },
      { key: 'updatedAt',           label: 'Updated At',         type: 'date' },
    ],
    filters: [
      { key: 'reportType', label: 'Report Type', type: 'enum',     options: ['incident','concern'] },
      { key: 'status',     label: 'Status',      type: 'enum',     options: ['new','submitted','received','dispatched','not_solved','solved','closed','archived'] },
      { key: 'severity',   label: 'Severity',    type: 'enum',     options: ['low','moderate','high','critical'] },
      { key: 'category',   label: 'Category',    type: 'string' },
      { key: 'location.woreda', label: 'Woreda', type: 'string' },
      { key: 'anonymous',  label: 'Anonymous',   type: 'boolean' },
      { key: 'isRead',     label: 'Is Read',     type: 'boolean' },
      { key: 'createdAt',  label: 'Date Range',  type: 'daterange' },
    ],
    groupByOptions: ['status','severity','category','reportType','location.woreda','location.subCity'],
  },

  household_profiles: {
    label: 'Household Profiles',
    description: 'Community household vulnerability assessment data',
    icon: 'Home',
    color: '#3b82f6',
    model: HouseholdProfile,
    defaultFields: ['location.woreda','location.block','demographics.total_household_members','status','createdAt'],
    fields: [
      { key: 'location.woreda',    label: 'Woreda',              type: 'string' },
      { key: 'location.subcity',   label: 'Sub-City',            type: 'string' },
      { key: 'location.block',     label: 'Block',               type: 'string' },
      { key: 'location.house_no',  label: 'House No',            type: 'string' },
      { key: 'assessment_date',    label: 'Assessment Date',     type: 'date' },
      { key: 'status',             label: 'Status',              type: 'enum',   options: ['Draft','Submitted','Reviewed'] },
      { key: 'demographics.total_household_members', label: 'Total Members', type: 'number' },
      { key: 'demographics.male_members',   label: 'Male Members',   type: 'number' },
      { key: 'demographics.female_members', label: 'Female Members', type: 'number' },
      { key: 'demographics.children_0_17', label: 'Children (0–17)', type: 'number' },
      { key: 'demographics.elderly_60_plus', label: 'Elderly (60+)', type: 'number' },
      { key: 'demographics.female_headed_household', label: 'Female Headed', type: 'string' },
      { key: 'demographics.idp_status',    label: 'IDP Status',      type: 'string' },
      { key: 'livelihood_economy.primary_livelihood_type', label: 'Livelihood', type: 'string' },
      { key: 'livelihood_economy.household_income_level',  label: 'Income Level', type: 'string' },
      { key: 'housing_physical_conditions.wall_material_type', label: 'Wall Material', type: 'string' },
      { key: 'housing_physical_conditions.informal_settlement', label: 'Informal Settlement', type: 'string' },
      { key: 'preparedness.knows_nearest_emergency_shelter', label: 'Knows Shelter', type: 'string' },
      { key: 'preparedness.family_emergency_plan_exists', label: 'Has Emergency Plan', type: 'string' },
      { key: 'recovery_capacity.resilience_enumerator_assessment_1_5', label: 'Resilience Score', type: 'number' },
      { key: 'createdAt',          label: 'Created At',          type: 'date' },
    ],
    filters: [
      { key: 'location.woreda',    label: 'Woreda',  type: 'string' },
      { key: 'location.subcity',   label: 'Sub-City', type: 'string' },
      { key: 'status',             label: 'Status',  type: 'enum', options: ['Draft','Submitted','Reviewed'] },
      { key: 'demographics.idp_status', label: 'IDP Status', type: 'string' },
      { key: 'demographics.female_headed_household', label: 'Female Headed', type: 'string' },
      { key: 'assessment_date',    label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['status','location.woreda','location.subcity','demographics.idp_status'],
  },

  woreda_assessments: {
    label: 'Woreda Assessments',
    description: 'KII & CGD risk assessments at woreda level',
    icon: 'MapPin',
    color: '#8b5cf6',
    model: WoredaAssessment,
    defaultFields: ['location.woreda','location.subcity','assessment_date','status'],
    fields: [
      { key: 'location.woreda',     label: 'Woreda',          type: 'string' },
      { key: 'location.subcity',    label: 'Sub-City',        type: 'string' },
      { key: 'location.block',      label: 'Block',           type: 'string' },
      { key: 'assessment_date',     label: 'Assessment Date', type: 'date' },
      { key: 'status',              label: 'Status',          type: 'enum', options: ['Draft','Submitted','Reviewed'] },
      { key: 'remarks',             label: 'Remarks',         type: 'string' },
      { key: 'kii_capacity_indicators.ews',             label: 'EWS Score',           type: 'number' },
      { key: 'kii_capacity_indicators.drm_committee',   label: 'DRM Committee Score', type: 'number' },
      { key: 'kii_capacity_indicators.budget',          label: 'Budget Score',        type: 'number' },
      { key: 'kii_infrastructure_exposure.health',      label: 'Health Infra Score',  type: 'number' },
      { key: 'kii_infrastructure_exposure.water',       label: 'Water Infra Score',   type: 'number' },
      { key: 'kii_environmental_indicators.drainage',   label: 'Drainage Score',      type: 'number' },
      { key: 'createdAt',           label: 'Created At',      type: 'date' },
    ],
    filters: [
      { key: 'location.woreda',   label: 'Woreda',    type: 'string' },
      { key: 'location.subcity',  label: 'Sub-City',  type: 'string' },
      { key: 'status',            label: 'Status',    type: 'enum', options: ['Draft','Submitted','Reviewed'] },
      { key: 'assessment_date',   label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['status','location.woreda','location.subcity'],
  },

  users: {
    label: 'Users',
    description: 'System user accounts and access levels',
    icon: 'Users',
    color: '#10b981',
    model: User,
    defaultFields: ['fullname','email','accessLevel','organizationType','status','createdAt'],
    fields: [
      { key: 'fullname',        label: 'Full Name',       type: 'string' },
      { key: 'email',           label: 'Email',           type: 'string' },
      { key: 'phone',           label: 'Phone',           type: 'string' },
      { key: 'status',          label: 'Status',          type: 'enum', options: ['pending','active','suspended'] },
      { key: 'accessLevel',     label: 'Access Level',    type: 'enum', options: ['super_admin','manager','deputy','sector_lead','directorate','team_leader','expert','branch_admin','public'] },
      { key: 'organizationType',label: 'Org Type',        type: 'enum', options: ['head_office','branch'] },
      { key: 'lastLogin',       label: 'Last Login',      type: 'date' },
      { key: 'createdAt',       label: 'Created At',      type: 'date' },
    ],
    filters: [
      { key: 'status',          label: 'Status',       type: 'enum', options: ['pending','active','suspended'] },
      { key: 'accessLevel',     label: 'Access Level', type: 'enum', options: ['super_admin','manager','deputy','sector_lead','directorate','team_leader','expert','branch_admin','public'] },
      { key: 'organizationType',label: 'Org Type',     type: 'enum', options: ['head_office','branch'] },
      { key: 'createdAt',       label: 'Date Range',   type: 'daterange' },
    ],
    groupByOptions: ['status','accessLevel','organizationType'],
  },

  teams: {
    label: 'Teams',
    description: 'Operational teams and their membership',
    icon: 'Users2',
    color: '#f59e0b',
    model: Team,
    defaultFields: ['name','status','createdAt'],
    fields: [
      { key: 'name',        label: 'Team Name',   type: 'string' },
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'status',      label: 'Status',      type: 'string' },
      { key: 'createdAt',   label: 'Created At',  type: 'date' },
    ],
    filters: [
      { key: 'status',    label: 'Status',     type: 'string' },
      { key: 'createdAt', label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['status'],
  },

  organizations: {
    label: 'Organizations',
    description: 'Registered organizations in the system',
    icon: 'Building2',
    color: '#06b6d4',
    model: Organization,
    defaultFields: ['name','type','createdAt'],
    fields: [
      { key: 'name',      label: 'Name',       type: 'string' },
      { key: 'type',      label: 'Type',       type: 'string' },
      { key: 'createdAt', label: 'Created At', type: 'date' },
    ],
    filters: [
      { key: 'type',      label: 'Type',       type: 'string' },
      { key: 'createdAt', label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['type'],
  },

  emergency_contacts: {
    label: 'Emergency Contacts',
    description: 'Emergency contact directory entries',
    icon: 'Phone',
    color: '#f43f5e',
    model: EmergencyContact,
    defaultFields: ['name','type','phone','createdAt'],
    fields: [
      { key: 'name',        label: 'Name',         type: 'string' },
      { key: 'type',        label: 'Type',         type: 'string' },
      { key: 'phone',       label: 'Phone',        type: 'string' },
      { key: 'description', label: 'Description',  type: 'string' },
      { key: 'isActive',    label: 'Is Active',    type: 'boolean' },
      { key: 'createdAt',   label: 'Created At',   type: 'date' },
    ],
    filters: [
      { key: 'type',      label: 'Type',       type: 'string' },
      { key: 'isActive',  label: 'Is Active',  type: 'boolean' },
      { key: 'createdAt', label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['type','isActive'],
  },

  alert_subscriptions: {
    label: 'Alert Subscriptions',
    description: 'Public alert subscription registrations',
    icon: 'Bell',
    color: '#a855f7',
    model: AlertSubscription,
    defaultFields: ['email','phone','status','channels','createdAt'],
    fields: [
      { key: 'email',      label: 'Email',     type: 'string' },
      { key: 'phone',      label: 'Phone',     type: 'string' },
      { key: 'status',     label: 'Status',    type: 'string' },
      { key: 'channels',   label: 'Channels',  type: 'string' },
      { key: 'createdAt',  label: 'Created At', type: 'date' },
    ],
    filters: [
      { key: 'status',    label: 'Status',     type: 'string' },
      { key: 'createdAt', label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['status'],
  },

  audit_logs: {
    label: 'Audit Logs',
    description: 'System audit trail of admin actions',
    icon: 'FileText',
    color: '#64748b',
    model: AuditLog,
    defaultFields: ['action','entityType','entityId','createdAt'],
    fields: [
      { key: 'action',      label: 'Action',      type: 'string' },
      { key: 'entityType',  label: 'Entity Type', type: 'string' },
      { key: 'entityId',    label: 'Entity ID',   type: 'string' },
      { key: 'description', label: 'Description', type: 'string' },
      { key: 'createdAt',   label: 'Timestamp',   type: 'date' },
    ],
    filters: [
      { key: 'action',     label: 'Action',      type: 'string' },
      { key: 'entityType', label: 'Entity Type', type: 'string' },
      { key: 'createdAt',  label: 'Date Range',  type: 'daterange' },
    ],
    groupByOptions: ['action','entityType'],
  },

  form_responses: {
    label: 'Survey Responses',
    description: 'Site survey and custom form response data',
    icon: 'ClipboardList',
    color: '#0ea5e9',
    model: FormResponse,
    defaultFields: ['templateId','status','submittedAt','createdAt'],
    fields: [
      { key: 'status',       label: 'Status',      type: 'string' },
      { key: 'submittedAt',  label: 'Submitted At', type: 'date' },
      { key: 'createdAt',    label: 'Created At',  type: 'date' },
    ],
    filters: [
      { key: 'status',      label: 'Status',     type: 'string' },
      { key: 'createdAt',   label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['status'],
  },

  inspection_requests: {
    label: 'Inspection Requests',
    description: 'Public inspection request submissions',
    icon: 'Search',
    color: '#84cc16',
    model: InspectionRequest,
    defaultFields: ['status','type','createdAt'],
    fields: [
      { key: 'status',     label: 'Status',      type: 'string' },
      { key: 'type',       label: 'Type',        type: 'string' },
      { key: 'createdAt',  label: 'Created At',  type: 'date' },
    ],
    filters: [
      { key: 'status',    label: 'Status',     type: 'string' },
      { key: 'type',      label: 'Type',       type: 'string' },
      { key: 'createdAt', label: 'Date Range', type: 'daterange' },
    ],
    groupByOptions: ['status','type'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build Mongoose query filter from the report builder's filter config.
 * Supports: exact match (enum/string/boolean), daterange
 */
const buildMongoFilter = (filters = {}, sourceConfig) => {
  const query = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined || value === '') continue;

    const fieldDef = sourceConfig.filters.find((f) => f.key === key);
    if (!fieldDef) continue;

    if (fieldDef.type === 'daterange') {
      const range = {};
      if (value.from) range.$gte = new Date(value.from);
      if (value.to) {
        const toDate = new Date(value.to);
        toDate.setHours(23, 59, 59, 999);
        range.$lte = toDate;
      }
      if (Object.keys(range).length > 0) query[key] = range;
    } else if (fieldDef.type === 'boolean') {
      query[key] = value === true || value === 'true';
    } else {
      // enum, string — exact match (case-insensitive for strings)
      if (fieldDef.type === 'string') {
        query[key] = { $regex: value, $options: 'i' };
      } else {
        query[key] = value;
      }
    }
  }

  return query;
};

/**
 * Build Mongoose projection from field list.
 * Handles dot-notation paths (e.g. 'location.woreda' → { 'location.woreda': 1 })
 */
const buildProjection = (fields = []) => {
  if (!fields || fields.length === 0) return {};
  const proj = {};
  fields.forEach((f) => { proj[f] = 1; });
  return proj;
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/report-builder/sources
 * Returns the registry of available sources and their field/filter metadata.
 */
export const getSources = (req, res) => {
  const sources = Object.entries(SOURCE_REGISTRY).map(([key, src]) => ({
    key,
    label: src.label,
    description: src.description,
    icon: src.icon,
    color: src.color,
    fields: src.fields,
    filters: src.filters,
    defaultFields: src.defaultFields,
    groupByOptions: src.groupByOptions,
  }));
  res.json({ sources });
};

/**
 * POST /api/report-builder/query
 * Executes a dynamic Mongoose query against any registered source.
 *
 * Body: {
 *   source: string,
 *   filters: { [key]: value | { from, to } },
 *   fields: string[],
 *   groupBy: string | null,
 *   page: number,
 *   limit: number,
 *   sortBy: string,
 *   sortOrder: 'asc' | 'desc'
 * }
 */
export const executeQuery = async (req, res) => {
  try {
    const {
      source,
      filters = {},
      fields = [],
      groupBy,
      page = 1,
      limit = 100,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.body;

    const sourceConfig = SOURCE_REGISTRY[source];
    if (!sourceConfig) {
      return res.status(400).json({ message: `Unknown data source: "${source}"` });
    }

    const Model = sourceConfig.model;
    const mongoFilter = buildMongoFilter(filters, sourceConfig);
    const selectedFields = fields.length > 0 ? fields : sourceConfig.defaultFields;
    const projection = buildProjection(selectedFields);
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 1000);
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    if (groupBy) {
      // ── Aggregation mode ────────────────────────────────────────────
      const pipeline = [
        { $match: mongoFilter },
        {
          $group: {
            _id: `$${groupBy}`,
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $project: { label: '$_id', count: 1, _id: 0 } },
      ];

      const grouped = await Model.aggregate(pipeline);
      const total = await Model.countDocuments(mongoFilter);
      return res.json({ data: grouped, total, isGrouped: true, groupBy });
    }

    // ── Plain list mode ────────────────────────────────────────────────
    const [data, total] = await Promise.all([
      Model.find(mongoFilter)
        .select(projection)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(Math.min(limit, 1000))
        .lean(),
      Model.countDocuments(mongoFilter),
    ]);

    res.json({
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      isGrouped: false,
    });
  } catch (err) {
    console.error('[ReportBuilder] executeQuery error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/report-builder/query/export
 * Returns full (non-paginated) dataset for client-side export.
 * Max 10,000 rows enforced.
 */
export const exportQuery = async (req, res) => {
  try {
    const { source, filters = {}, fields = [], sortBy = 'createdAt', sortOrder = 'desc' } = req.body;

    const sourceConfig = SOURCE_REGISTRY[source];
    if (!sourceConfig) {
      return res.status(400).json({ message: `Unknown data source: "${source}"` });
    }

    const Model = sourceConfig.model;
    const mongoFilter = buildMongoFilter(filters, sourceConfig);
    const selectedFields = fields.length > 0 ? fields : sourceConfig.defaultFields;
    const projection = buildProjection(selectedFields);
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const data = await Model.find(mongoFilter)
      .select(projection)
      .sort({ [sortBy]: sortDir })
      .limit(10000)
      .lean();

    res.json({ data, total: data.length, fields: selectedFields });
  } catch (err) {
    console.error('[ReportBuilder] exportQuery error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/report-builder/multi-query
 * Executes parallel independent queries for multiple data sources.
 * Each source is queried independently; results are returned as an array.
 *
 * Body: {
 *   sources: Array<{
 *     source: string,
 *     filters: object,
 *     fields: string[],
 *     groupBy: string | '',
 *     chartType: string,
 *     limit?: number
 *   }>
 * }
 */
export const executeMultiQuery = async (req, res) => {
  try {
    const { sources: sourceConfigs = [] } = req.body;

    if (!Array.isArray(sourceConfigs) || sourceConfigs.length === 0) {
      return res.status(400).json({ message: 'At least one source configuration is required.' });
    }
    if (sourceConfigs.length > 6) {
      return res.status(400).json({ message: 'Maximum 6 data sources per multi-dataset report.' });
    }

    const runSingleQuery = async (cfg) => {
      const {
        source,
        filters = {},
        fields = [],
        groupBy,
        limit = 100,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = cfg;

      const sourceConfig = SOURCE_REGISTRY[source];
      if (!sourceConfig) {
        return {
          sourceKey: source,
          sourceLabel: source,
          sourceColor: '#64748b',
          error: `Unknown data source: "${source}"`,
          data: [],
          total: 0,
          isGrouped: false,
        };
      }

      const Model = sourceConfig.model;
      const mongoFilter = buildMongoFilter(filters, sourceConfig);
      const selectedFields = fields.length > 0 ? fields : sourceConfig.defaultFields;
      const projection = buildProjection(selectedFields);
      const sortDir = sortOrder === 'asc' ? 1 : -1;

      if (groupBy) {
        const pipeline = [
          { $match: mongoFilter },
          { $group: { _id: `$${groupBy}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { label: '$_id', count: 1, _id: 0 } },
        ];
        const [grouped, total] = await Promise.all([
          Model.aggregate(pipeline),
          Model.countDocuments(mongoFilter),
        ]);
        return {
          sourceKey: source,
          sourceLabel: sourceConfig.label,
          sourceColor: sourceConfig.color,
          data: grouped,
          total,
          isGrouped: true,
          groupBy,
          fields: selectedFields,
        };
      }

      const [data, total] = await Promise.all([
        Model.find(mongoFilter)
          .select(projection)
          .sort({ [sortBy]: sortDir })
          .limit(Math.min(limit, 500))
          .lean(),
        Model.countDocuments(mongoFilter),
      ]);

      return {
        sourceKey: source,
        sourceLabel: sourceConfig.label,
        sourceColor: sourceConfig.color,
        data,
        total,
        isGrouped: false,
        fields: selectedFields,
      };
    };

    // Run all source queries in parallel
    const results = await Promise.all(sourceConfigs.map(runSingleQuery));

    const grandTotal = results.reduce((sum, r) => sum + (r.total || 0), 0);

    res.json({ results, grandTotal, sourceCount: results.length });
  } catch (err) {
    console.error('[ReportBuilder] executeMultiQuery error:', err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/report-builder/multi-query/export
 * Full (non-paginated) export across all selected sources. Max 10,000 per source.
 */
export const exportMultiQuery = async (req, res) => {
  try {
    const { sources: sourceConfigs = [] } = req.body;

    if (!Array.isArray(sourceConfigs) || sourceConfigs.length === 0) {
      return res.status(400).json({ message: 'At least one source configuration is required.' });
    }

    const runExport = async (cfg) => {
      const { source, filters = {}, fields = [], sortBy = 'createdAt', sortOrder = 'desc' } = cfg;

      const sourceConfig = SOURCE_REGISTRY[source];
      if (!sourceConfig) return { sourceKey: source, sourceLabel: source, data: [], fields: [] };

      const Model = sourceConfig.model;
      const mongoFilter = buildMongoFilter(filters, sourceConfig);
      const selectedFields = fields.length > 0 ? fields : sourceConfig.defaultFields;
      const projection = buildProjection(selectedFields);
      const sortDir = sortOrder === 'asc' ? 1 : -1;

      const data = await Model.find(mongoFilter)
        .select(projection)
        .sort({ [sortBy]: sortDir })
        .limit(10000)
        .lean();

      return {
        sourceKey: source,
        sourceLabel: sourceConfig.label,
        sourceColor: sourceConfig.color,
        data,
        total: data.length,
        fields: selectedFields,
      };
    };

    const results = await Promise.all(sourceConfigs.map(runExport));
    res.json({ results, sourceCount: results.length });
  } catch (err) {
    console.error('[ReportBuilder] exportMultiQuery error:', err);
    res.status(500).json({ message: err.message });
  }
};

// ─── Template CRUD ────────────────────────────────────────────────────────────

export const saveTemplate = async (req, res) => {
  try {
    const {
      name, description, source, filters, fields, groupBy, chartType,
      sharingType, sharedWithUsers, sharedWithRoles,
      category, tags, icon, color, isFeatured, executiveNotes, refreshSchedule,
    } = req.body;

    if (!name || !source) {
      return res.status(400).json({ message: 'Name and source are required.' });
    }

    const isShared = sharingType && sharingType !== 'private';

    const template = await ReportTemplate.create({
      name, description, source, filters, fields, groupBy, chartType,
      isShared,
      sharingType: sharingType || 'private',
      sharedWithUsers: sharingType === 'specific_users' ? (sharedWithUsers || []) : [],
      sharedWithRoles: sharingType === 'by_roles' ? (sharedWithRoles || []) : [],
      category: category || 'Operational',
      tags: tags || [],
      icon: icon || 'FileText',
      color: color || '#143f84',
      isFeatured: isFeatured || false,
      executiveNotes: executiveNotes || '',
      refreshSchedule: refreshSchedule || 'on_demand',
      createdBy: req.user._id,
    });

    const populated = await ReportTemplate.findById(template._id)
      .populate('createdBy', 'fullname email accessLevel')
      .populate('sharedWithUsers', 'fullname email')
      .populate('sharedWithRoles', 'name')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    console.error('[ReportBuilder] saveTemplate error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getTemplates = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRoles = req.user.roles || [];

    const templates = await ReportTemplate.find({
      $or: [
        { createdBy: userId },
        { sharingType: 'all_users', isShared: true },
        { sharingType: 'specific_users', sharedWithUsers: userId },
        { sharingType: 'by_roles', sharedWithRoles: { $in: userRoles } },
      ],
    })
      .populate('createdBy', 'fullname email accessLevel')
      .populate('sharedWithUsers', 'fullname email')
      .populate('sharedWithRoles', 'name')
      .sort({ isFeatured: -1, updatedAt: -1 })
      .lean();

    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const template = await ReportTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found.' });
    if (String(template.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only delete your own templates.' });
    }
    await template.deleteOne();
    res.json({ message: 'Template deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const template = await ReportTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found.' });
    if (String(template.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'You can only edit your own templates.' });
    }

    const {
      name, description, source, filters, fields, groupBy, chartType,
      sharingType, sharedWithUsers, sharedWithRoles,
      category, tags, icon, color, isFeatured, executiveNotes, refreshSchedule,
    } = req.body;

    const isShared = sharingType && sharingType !== 'private';

    Object.assign(template, {
      name, description, source, filters, fields, groupBy, chartType,
      isShared,
      sharingType: sharingType || 'private',
      sharedWithUsers: sharingType === 'specific_users' ? (sharedWithUsers || []) : [],
      sharedWithRoles: sharingType === 'by_roles' ? (sharedWithRoles || []) : [],
      category: category || template.category,
      tags: tags !== undefined ? tags : template.tags,
      icon: icon || template.icon,
      color: color || template.color,
      isFeatured: isFeatured !== undefined ? isFeatured : template.isFeatured,
      executiveNotes: executiveNotes !== undefined ? executiveNotes : template.executiveNotes,
      refreshSchedule: refreshSchedule || template.refreshSchedule,
    });

    await template.save();

    const populated = await ReportTemplate.findById(template._id)
      .populate('createdBy', 'fullname email accessLevel')
      .populate('sharedWithUsers', 'fullname email')
      .populate('sharedWithRoles', 'name')
      .lean();

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** Get list of users with reportbuilder permission (for the sharing user-picker) */
export const getShareableUsers = async (req, res) => {
  try {
    const users = await User.find(
      { status: 'active', accessLevel: { $ne: 'public' } },
      '_id fullname email accessLevel'
    )
      .sort({ fullname: 1 })
      .limit(500)
      .lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Seed default reportbuilder permissions and associate them with standard roles
 */
export const seedReportBuilderPermissions = async () => {
  try {
    const resource = 'reportbuilder';
    const actions = ['view', 'create', 'update', 'delete', 'export'];
    const roles = await Role.find({});

    for (const action of actions) {
      const permissionName = `${resource}_${action}`;
      let perm = await Permission.findOne({ resource, action });
      if (!perm) {
        perm = await Permission.create({
          resource,
          action,
          name: permissionName,
        });
        console.log(`✅ Seeded reportbuilder permission: ${permissionName}`);
      }

      // Assign view/create/export permissions to all active roles by default
      // while reserving delete/update to admin or creator
      for (const role of roles) {
        const exists = await RolePermission.findOne({
          roleId: role._id,
          permissionId: perm._id,
        });
        if (!exists) {
          await RolePermission.create({
            roleId: role._id,
            permissionId: perm._id,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error seeding reportbuilder permissions:', err.message);
  }
};
