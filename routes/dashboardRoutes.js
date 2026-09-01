import express from 'express';
import { getStats } from '../controllers/dashboardController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// Protect the route and check for dashboard view permission
router.get('/stats', protect, checkPermission('dashboard', 'view'), getStats);

export default router;
