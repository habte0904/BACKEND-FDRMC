import express from 'express';
import {
  createPublicInspectionRequest,
  trackInspectionRequest,
  listInspectionRequests,
  getInspectionRequestById,
  updateInspectionRequest,
} from '../controllers/inspectionRequestController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Public routes (no auth required)
router.post('/public', createPublicInspectionRequest);
router.get('/public/track/:trackingNumber', trackInspectionRequest);

// Protected routes (require auth & permissions)
router.get('/', protect, checkPermission('inspectionrequest', 'view'), listInspectionRequests);
router.get('/:id', protect, checkPermission('inspectionrequest', 'view'), getInspectionRequestById);
router.patch('/:id', protect, checkPermission('inspectionrequest', 'update'), updateInspectionRequest);

export default router;
