import express from 'express';
import {
    submitResponse,
    getResponses,
    getResponseById,
    updateResponse,
    deleteResponse,
    exportToCSV
} from '../controllers/formResponseController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import FormResponse from '../models/FormResponse.js';

const router = express.Router();

router.post('/', optionalAuth, submitResponse);
router.get('/', protect, checkPermission('formresponse', 'view'), applyScopeFilter(FormResponse), getResponses);
router.get('/export/:templateId', protect, checkPermission('formresponse', 'view'), exportToCSV);
router.get('/:id', protect, checkPermission('formresponse', 'view'), checkDocumentAccess(FormResponse), getResponseById);
router.put('/:id', protect, checkPermission('formresponse', 'update'), checkDocumentAccess(FormResponse), updateResponse);
router.delete('/:id', protect, checkPermission('formresponse', 'delete'), checkDocumentAccess(FormResponse), deleteResponse);

export default router;
