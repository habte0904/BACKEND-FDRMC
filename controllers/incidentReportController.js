import IncidentReport from '../models/IncidentReport.js';
import * as auditService from '../services/auditService.js';
import { emitDashboardEvent } from '../services/socketService.js';

const formatReportLocation = (location = {}) => {
  const latitude = typeof location.latitude === 'number' && Number.isFinite(location.latitude) ? location.latitude.toFixed(6) : '';
  const longitude = typeof location.longitude === 'number' && Number.isFinite(location.longitude) ? location.longitude.toFixed(6) : '';
  if (latitude && longitude) {
    return [`GPS: ${latitude}, ${longitude}`, location.subCity, location.woreda, location.placeName]
      .filter(Boolean)
      .join(', ');
  }

  const fallbackParts = [location.subCity, location.woreda, location.placeName].filter(Boolean);
  if (fallbackParts.length > 0) return fallbackParts.join(', ');

  return 'Location unspecified';
};

const sanitizeIncomingPayload = (payload) => {
  const clean = payload && typeof payload === 'object' ? { ...payload } : {};
  delete clean._id;
  delete clean.createdAt;
  delete clean.updatedAt;
  delete clean.reportCode;
  return clean;
};

const REPORT_STATUSES = ['new', 'submitted', 'received', 'dispatched', 'not_solved', 'solved', 'closed', 'archived'];

const generateReportCode = () => {
  return String(Math.floor(1000 + Math.random() * 9000));
};

const normalizeStatus = (incoming) => {
  if (!incoming) return undefined;
  const s = String(incoming).toLowerCase().trim();
  if (REPORT_STATUSES.includes(s)) return s;
  if (s === 'not solved') return 'not_solved';
  return undefined;
};

// Public: create an incident report
// POST /api/incident-reports
export const createIncidentReportPublic = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});

    const reportType = (payload.reportType || 'incident').toString().trim();
    const category = (payload.category || '').toString().trim();
    const concernCategory = (payload.concernCategory || '').toString().trim();
    const severity = (payload.severity || '').toString().trim();
    const details = (payload.details || '').toString().trim();
    const concernDetails = (payload.concernDetails || '').toString().trim();

    if (reportType !== 'incident' && reportType !== 'concern') {
      return res.status(400).json({ message: 'Report type must be incident or concern' });
    }
    if (reportType === 'incident') {
      if (!category) {
        return res.status(400).json({ message: 'Incident category is required' });
      }
      if (!severity) {
        return res.status(400).json({ message: 'Severity is required' });
      }
      if (!details) {
        return res.status(400).json({ message: 'Details are required' });
      }
    } else {
      if (!concernCategory) {
        return res.status(400).json({ message: 'Concern category is required' });
      }
      if (!concernDetails) {
        return res.status(400).json({ message: 'Concern details are required' });
      }
    }

    let reportCode = generateReportCode();
    let attempts = 0;
    while (attempts < 3) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await IncidentReport.findOne({ reportCode }).lean();
      if (!existing) break;
      reportCode = generateReportCode();
      attempts += 1;
    }

    const doc = await IncidentReport.create({
      ...payload,
      ...(payload.status ? { status: normalizeStatus(payload.status) } : {}),
      reportCode,
      ...(req.user?._id ? { createdByUser: req.user._id, lastUpdatedByUser: req.user._id } : {}),
    });

    await auditService.logAction({
      userId: req.user?._id || 'PUBLIC_USER',
      action: 'INCIDENT_REPORT_CREATE',
      resource: 'IncidentReport',
      resourceId: doc._id,
      after: doc,
      ip: req.ip
    });

    // Real-time Live Dashboard & Header Notification Socket Event Emission
    emitDashboardEvent('incident:created', doc);
    emitDashboardEvent('notification:new', {
      _id: doc._id,
      reportCode: doc.reportCode,
      reportType: doc.reportType,
      category: doc.category || 'Public Report',
      concernCategory: doc.concernCategory || '',
      severity: doc.severity || 'moderate',
      details: doc.details || doc.concernDetails || '',
      location: {
        addressLine: doc.location?.addressLine || '',
        city: doc.location?.city || '',
        region: doc.location?.region || '',
        subCity: doc.location?.subCity || doc.location?.subcity || '',
        subcity: doc.location?.subcity || doc.location?.subCity || '',
        woreda: doc.location?.woreda || '',
        placeName: doc.location?.placeName || '',
      },
      status: doc.status,
      isRead: false,
      createdAt: doc.createdAt,
    });
    if (doc.severity === 'critical') {
      emitDashboardEvent('alert:critical', {
        title: 'CRITICAL INCIDENT REPORTED',
        category: doc.category || 'Emergency',
        location: formatReportLocation(doc.location),
        severity: 'critical',
        reportCode: doc.reportCode,
        createdAt: doc.createdAt
      });
    }

    res.status(201).json(doc);
  } catch (error) {
    console.error('createIncidentReportPublic error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: list incident reports
// GET /api/incident-reports
export const listIncidentReports = async (req, res) => {
  try {
    const { status, search, category, severity, reportType, concernCategory } = req.query;
    const query = { ...(req.dataScope || {}) };
    if (status) query.status = status;
    if (reportType) query.reportType = reportType;
    if (category) query.category = category;
    if (concernCategory) query.concernCategory = concernCategory;
    if (severity) query.severity = severity;
    if (search) {
      const searchOr = [
        { reportCode: { $regex: search, $options: 'i' } },
        { reportType: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { concernCategory: { $regex: search, $options: 'i' } },
        { severity: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { concernDetails: { $regex: search, $options: 'i' } },
        { 'location.addressLine': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.region': { $regex: search, $options: 'i' } },
        { 'location.placeName': { $regex: search, $options: 'i' } },
        { 'location.subCity': { $regex: search, $options: 'i' } },
        { 'location.woreda': { $regex: search, $options: 'i' } },
      ];
      // Merge search $or with any existing dataScope $or using $and to avoid collision
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchOr }];
        delete query.$or;
      } else {
        query.$or = searchOr;
      }
    }

    const docs = await IncidentReport.find(query).sort({ updatedAt: -1 }).lean();
    res.json(docs);
  } catch (error) {
    console.error('listIncidentReports error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: get unread public incident & concern reports for header notification
// GET /api/incident-reports/unread
export const getUnreadPublicReports = async (req, res) => {
  try {
    const scopeQuery = req.dataScope || {};
    const unreadCondition = {
      $or: [{ isRead: false }, { isRead: { $exists: false } }],
    };

    // Combine scopeQuery with unreadCondition using $and to avoid overwriting scopeQuery.$or
    const countQuery =
      scopeQuery && Object.keys(scopeQuery).length > 0
        ? { $and: [scopeQuery, unreadCondition] }
        : unreadCondition;

    // Count truly unread reports — branch scoping is applied by applyScopeFilter middleware
    const unreadCount = await IncidentReport.countDocuments(countQuery);

    // Fetch latest 30 reports for the dropdown (branch-scoped)
    const reports = await IncidentReport.find(scopeQuery)
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({ unreadCount, reports });
  } catch (error) {
    console.error('getUnreadPublicReports error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: mark single report as read
// PATCH /api/incident-reports/:id/read
export const markReportAsRead = async (req, res) => {
  try {
    const doc = await IncidentReport.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          readBy: req.user?._id || null,
        },
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: 'Report not found' });
    res.json(doc);
  } catch (error) {
    console.error('markReportAsRead error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: mark all reports as read
// PATCH /api/incident-reports/mark-all-read
export const markAllReportsAsRead = async (req, res) => {
  try {
    const scopeQuery = req.dataScope || {};
    const unreadCondition = {
      $or: [{ isRead: false }, { isRead: { $exists: false } }],
    };

    const updateQuery =
      scopeQuery && Object.keys(scopeQuery).length > 0
        ? { $and: [scopeQuery, unreadCondition] }
        : unreadCondition;

    await IncidentReport.updateMany(
      updateQuery,
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          readBy: req.user?._id || null,
        },
      }
    );

    res.json({ message: 'All reports marked as read' });
  } catch (error) {
    console.error('markAllReportsAsRead error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: get single report
// GET /api/incident-reports/:id
export const getIncidentReportById = async (req, res) => {
  try {
    const doc = await IncidentReport.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Report not found' });

    // Auto mark as read when viewed
    if (!doc.isRead) {
      await IncidentReport.findByIdAndUpdate(req.params.id, {
        $set: { isRead: true, readAt: new Date(), readBy: req.user?._id || null },
      });
      doc.isRead = true;
    }

    res.json(doc);
  } catch (error) {
    console.error('getIncidentReportById error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: update report
// PUT /api/incident-reports/:id
export const updateIncidentReport = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});
    const beforeDoc = await IncidentReport.findById(req.params.id);
    if (!beforeDoc) return res.status(404).json({ message: 'Report not found' });
    const before = beforeDoc.toObject();
    delete payload.reportType;
    // Determine if requester is admin/superuser
    const isAdmin = req.user && (['super_admin', 'manager', 'branch_admin'].includes(req.user.accessLevel) || (req.user.roles && req.user.roles.some(r => ['superadmin', 'super admin', 'super_admin', 'admin', 'administrator', 'branch_admin', 'manager'].includes((r.name || '').toString().toLowerCase()))));

    // Prevent non-admins from changing protected fields
    if (!isAdmin) {
      delete payload.status;
      delete payload.resolvedAt;
      delete payload.resolvedBy;
      delete payload.resolutionDescription;
      delete payload.resolutionNotes;
      delete payload.responsibleInstitution;
      delete payload.assignedTo;
    } else if (payload.status) {
      const normalizedStatus = normalizeStatus(payload.status);
      if (!normalizedStatus) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      payload.status = normalizedStatus;
    }
    const doc = await IncidentReport.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!doc) {
      return res.status(404).json({ message: 'Report not found' });
    }

    await auditService.logAction({
      userId: req.user?._id,
      action: 'INCIDENT_REPORT_UPDATE',
      resource: 'IncidentReport',
      resourceId: doc._id,
      before,
      after: doc,
      ip: req.ip
    });

    // Real-time Live Dashboard Socket Event Emission
    emitDashboardEvent('incident:updated', doc);

    res.json(doc);
  } catch (error) {
    console.error('updateIncidentReport error:', error);
    if (error?.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: Object.values(error.errors || {}).map((err) => err.message) });
    }
    res.status(500).json({ message: error.message });
  }
};

// Admin: delete report permanently
// DELETE /api/incident-reports/:id
export const deleteIncidentReport = async (req, res) => {
  try {
    const doc = await IncidentReport.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Report not found' });

    const before = doc.toObject();
    await IncidentReport.findByIdAndDelete(req.params.id);

    await auditService.logAction({
      userId: req.user?._id,
      action: 'INCIDENT_REPORT_DELETE',
      resource: 'IncidentReport',
      resourceId: doc._id,
      before,
      ip: req.ip,
    });

    // Real-time Live Dashboard Socket Event Emission
    emitDashboardEvent('incident:deleted', { _id: req.params.id });

    res.json({ message: 'Incident report permanently deleted' });
  } catch (error) {
    console.error('deleteIncidentReport error:', error);
    res.status(500).json({ message: error.message });
  }
};
