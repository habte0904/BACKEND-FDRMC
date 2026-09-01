import express from 'express';
import multer from 'multer';
import {
    getWoredaProfiles,
    getWoredaProfileById,
    createWoredaProfile,
    updateWoredaProfile,
    deleteWoredaProfile,
    getWoredaProfileStats,
    importWoredaProfile,
    syncFromInterview,
    getWoredaProfilesLastUpdated
} from '../controllers/woredaProfileController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import WoredaProfile from '../models/WoredaProfile.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/last-updated', getWoredaProfilesLastUpdated);
router.get('/stats', protect, checkPermission('woredaprofile', 'view'), applyScopeFilter(WoredaProfile), getWoredaProfileStats);
router.get('/', protect, checkPermission('woredaprofile', 'view'), applyScopeFilter(WoredaProfile), getWoredaProfiles);
router.post('/', protect, checkPermission('woredaprofile', 'create'), createWoredaProfile);
router.post('/import', protect, checkPermission('woredaprofile', 'import'), upload.single('file'), importWoredaProfile);
router.post('/sync-interview', protect, checkPermission('woredaprofile', 'sync'), syncFromInterview);
router.get('/:id', protect, checkPermission('woredaprofile', 'view'), checkDocumentAccess(WoredaProfile), getWoredaProfileById);
router.put('/:id', protect, checkPermission('woredaprofile', 'update'), checkDocumentAccess(WoredaProfile), updateWoredaProfile);
router.delete('/:id', protect, checkPermission('woredaprofile', 'delete'), checkDocumentAccess(WoredaProfile), deleteWoredaProfile);

export default router;
