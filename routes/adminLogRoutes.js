import express from 'express';
import { getAdminLogs, clearOldAdminLogs } from '../controllers/adminLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/', protect, checkPermission('adminlog', 'view'), getAdminLogs);
router.delete('/purge', protect, checkPermission('adminlog', 'delete'), clearOldAdminLogs);

export default router;
