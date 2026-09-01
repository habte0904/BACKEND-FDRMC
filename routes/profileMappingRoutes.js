import express from 'express';
import { 
    getProfileMappings, 
    getMappingBySource, 
    createProfileMapping, 
    updateProfileMapping, 
    deleteProfileMapping,
    permanentlyDeleteProfileMapping
} from '../controllers/profileMappingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, checkPermission('profilemapping', 'view'), getProfileMappings)
    .post(protect, checkPermission('profilemapping', 'create'), createProfileMapping);

router.route('/source/:sourceId')
    .get(protect, checkPermission('profilemapping', 'view'), getMappingBySource);

router.route('/:id')
    .put(protect, checkPermission('profilemapping', 'update'), updateProfileMapping)
    .delete(protect, checkPermission('profilemapping', 'delete'), deleteProfileMapping);

router.delete('/:id/permanent', protect, checkPermission('profilemapping', 'delete'), permanentlyDeleteProfileMapping);

export default router;
