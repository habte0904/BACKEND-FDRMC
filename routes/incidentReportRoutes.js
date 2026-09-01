import express from 'express';
import {
  createIncidentReportPublic,
  listIncidentReports,
  getIncidentReportById,
  updateIncidentReport,
  deleteIncidentReport,
  getUnreadPublicReports,
  markReportAsRead,
  markAllReportsAsRead,
} from '../controllers/incidentReportController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import IncidentReport from '../models/IncidentReport.js';

const router = express.Router();

// Public submit (no auth required)
router.post('/', createIncidentReportPublic);

// Header Notification & Unread summary
router.get('/unread', protect, applyScopeFilter(IncidentReport), getUnreadPublicReports);
router.patch('/mark-all-read', protect, applyScopeFilter(IncidentReport), markAllReportsAsRead);
router.patch('/:id/read', protect, checkDocumentAccess(IncidentReport), markReportAsRead);

// Protected management routes with proper permissions and scoping
router.get('/', protect, checkPermission('incidentreport', 'view'), applyScopeFilter(IncidentReport), listIncidentReports);
router.get('/:id', protect, checkPermission('incidentreport', 'view'), checkDocumentAccess(IncidentReport), getIncidentReportById);
router.put('/:id', protect, checkPermission('incidentreport', 'update'), checkDocumentAccess(IncidentReport), updateIncidentReport);
router.delete('/:id', protect, checkPermission('incidentreport', 'delete'), checkDocumentAccess(IncidentReport), deleteIncidentReport);

export default router;
