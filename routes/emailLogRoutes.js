import express from 'express';
import { 
    getEmailLogs, 
    deleteOldEmailLogs, 
    resendEmailLog, 
    createManualEmail,
    updateLogStatus,
    moveToFolder
} from '../controllers/emailLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
    .get(protect, checkPermission('emaillog', 'view'), getEmailLogs)
    .delete(protect, checkPermission('emaillog', 'delete'), deleteOldEmailLogs);

router.post('/manual', protect, checkPermission('emaillog', 'create'), createManualEmail);
router.post('/:id/resend', protect, checkPermission('emaillog', 'update'), resendEmailLog);
router.patch('/:id/status', protect, checkPermission('emaillog', 'update'), updateLogStatus);
router.patch('/:id/folder', protect, checkPermission('emaillog', 'update'), moveToFolder);

export default router;
