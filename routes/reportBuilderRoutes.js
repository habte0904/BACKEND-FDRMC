import express from 'express';
import {
  getSources,
  executeQuery,
  exportQuery,
  executeMultiQuery,
  exportMultiQuery,
  saveTemplate,
  getTemplates,
  deleteTemplate,
  updateTemplate,
  getShareableUsers,
} from '../controllers/reportBuilderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Data source metadata and querying
router.get('/sources', checkPermission('reportbuilder', 'view'), getSources);
router.post('/query', checkPermission('reportbuilder', 'view'), executeQuery);
router.post('/query/export', checkPermission('reportbuilder', 'view'), exportQuery);

// Saved report templates
router.get('/templates', checkPermission('reportbuilder', 'view'), getTemplates);
router.post('/templates', checkPermission('reportbuilder', 'create'), saveTemplate);
router.put('/templates/:id', checkPermission('reportbuilder', 'update'), updateTemplate);
router.delete('/templates/:id', checkPermission('reportbuilder', 'delete'), deleteTemplate);

// Multi-dataset parallel queries
router.post('/multi-query', checkPermission('reportbuilder', 'view'), executeMultiQuery);
router.post('/multi-query/export', checkPermission('reportbuilder', 'view'), exportMultiQuery);

// Users available for sharing (for the user-picker)
router.get('/shareable-users', checkPermission('reportbuilder', 'create'), getShareableUsers);

export default router;
