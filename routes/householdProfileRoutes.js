import express from 'express';
import {
    getHouseholdProfiles,
    getHouseholdProfileById,
    createHouseholdProfile,
    updateHouseholdProfile,
    deleteHouseholdProfile,
    checkHouseholdHouseNo
} from '../controllers/HouseholdProfileController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import HouseholdProfile from '../models/HouseholdProfile.js';

const router = express.Router();

router.get('/', protect, checkPermission('householdprofile', 'view'), applyScopeFilter(HouseholdProfile), getHouseholdProfiles);
router.get('/check-house-no', protect, checkHouseholdHouseNo);
router.post('/', protect, checkPermission('householdprofile', 'create'), createHouseholdProfile);
router.get('/:id', protect, checkPermission('householdprofile', 'view'), checkDocumentAccess(HouseholdProfile), getHouseholdProfileById);
router.put('/:id', protect, checkPermission('householdprofile', 'update'), updateHouseholdProfile);
router.delete('/:id', protect, checkPermission('householdprofile', 'delete'), deleteHouseholdProfile);

export default router;
