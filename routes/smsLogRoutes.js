import express from 'express';
import {
  getSmsLogs,
  getSmsStats,
  previewSubscribers,
  broadcastSms,
  resendSms,
  bulkResendSms,
  bulkDeleteSmsLogs,
  deleteSmsLog,
} from '../controllers/smsLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/stats', protect, checkPermission('smslog|audit_log', 'view'), getSmsStats);
router.post('/preview-subscribers', protect, checkPermission('smslog|alertsubscription', 'view'), previewSubscribers);
router.post('/broadcast', protect, checkPermission('smslog|alertsubscription', 'create'), broadcastSms);
router.post('/bulk-resend', protect, checkPermission('smslog|alertsubscription', 'update'), bulkResendSms);
router.delete('/bulk-delete', protect, checkPermission('smslog|audit_log', 'delete'), bulkDeleteSmsLogs);

router.get('/', protect, checkPermission('smslog|audit_log', 'view'), getSmsLogs);
router.post('/resend/:id', protect, checkPermission('smslog|alertsubscription', 'update'), resendSms);
router.delete('/:id', protect, checkPermission('smslog|audit_log', 'delete'), deleteSmsLog);

export default router;

