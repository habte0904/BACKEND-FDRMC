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

const router = express.Router();

router.get('/', protect, getHouseholdProfiles);
router.get('/check-house-no', protect, checkHouseholdHouseNo);
router.post('/', protect, createHouseholdProfile);
router.get('/:id', protect, getHouseholdProfileById);
router.put('/:id', protect, updateHouseholdProfile);
router.delete('/:id', protect, deleteHouseholdProfile);

export default router;
