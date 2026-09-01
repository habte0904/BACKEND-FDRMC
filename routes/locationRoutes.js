import express from 'express';
import {
    getSubcities,
    createSubcity,
    deleteSubcity,
    getWoredas,
    createWoreda,
    deleteWoreda,
    getLocationHierarchy
} from '../controllers/locationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Publicly accessible for public forms and dropdown lists (no login required)
router.get('/hierarchy', getLocationHierarchy);
router.get('/subcities', getSubcities);
router.get('/woredas', getWoredas);


// Protected administrative actions
router.post('/subcities', protect, checkPermission('location', 'create'), createSubcity);
router.delete('/subcities/:id', protect, checkPermission('location', 'delete'), deleteSubcity);
router.post('/woredas', protect, checkPermission('location', 'create'), createWoreda);
router.delete('/woredas/:id', protect, checkPermission('location', 'delete'), deleteWoreda);

export default router;
