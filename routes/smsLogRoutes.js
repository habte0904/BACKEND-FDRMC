import express from 'express';
import { getSmsLogs, resendSms, deleteSmsLog } from '../controllers/smsLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/', protect, checkPermission('smslog|audit_log', 'view'), getSmsLogs);
router.post('/resend/:id', protect, checkPermission('smslog|alertsubscription', 'update'), resendSms);
router.delete('/:id', protect, checkPermission('smslog|audit_log', 'delete'), deleteSmsLog);

export default router;
