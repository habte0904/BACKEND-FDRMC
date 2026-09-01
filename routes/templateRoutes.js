import express from 'express';
import multer from 'multer';
import {
    getTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    publishTemplate,
    revertToDraft,
    createNewVersion,
    archiveTemplate,
    restoreTemplate,
    deleteTemplatePermanent
} from '../controllers/templateController.js';
import { importWordTemplate } from '../controllers/importController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', optionalAuth, getTemplates);
router.post('/', protect, checkPermission('template', 'create'), createTemplate);
router.post('/import-word', protect, checkPermission('template', 'import'), upload.single('file'), importWordTemplate); 
router.get('/:id', optionalAuth, getTemplateById);
router.put('/:id', protect, checkPermission('template', 'update'), updateTemplate);
router.post('/:id/publish', protect, checkPermission('template', 'update'), publishTemplate);
router.post('/:id/revert-to-draft', protect, checkPermission('template', 'update'), revertToDraft);
router.post('/:id/new-version', protect, checkPermission('template', 'create'), createNewVersion);
router.post('/:id/restore', protect, checkPermission('template', 'update'), restoreTemplate);
router.delete('/:id', protect, checkPermission('template', 'delete'), archiveTemplate);
router.delete('/:id/permanent', protect, checkPermission('template', 'delete'), deleteTemplatePermanent);

export default router;
