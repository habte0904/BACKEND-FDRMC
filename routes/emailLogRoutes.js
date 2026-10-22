import express from 'express';
import {
  getEmailLogs,
  getEmailStats,
  previewEmailSubscribers,
  broadcastEmail,
  deleteOldEmailLogs,
  resendEmailLog,
  bulkResendEmailLogs,
  bulkDeleteEmailLogs,
  deleteSingleEmailLog,
  createManualEmail,
  updateLogStatus,
  moveToFolder,
} from '../controllers/emailLogController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/stats', protect, checkPermission('emaillog|audit_log', 'view'), getEmailStats);
router.post('/preview-subscribers', protect, checkPermission('emaillog|alertsubscription', 'view'), previewEmailSubscribers);
router.post('/broadcast', protect, checkPermission('emaillog|alertsubscription', 'create'), broadcastEmail);
router.post('/bulk-resend', protect, checkPermission('emaillog|alertsubscription', 'update'), bulkResendEmailLogs);
router.delete('/bulk-delete', protect, checkPermission('emaillog|audit_log', 'delete'), bulkDeleteEmailLogs);

router.route('/')
  .get(protect, checkPermission('emaillog|audit_log', 'view'), getEmailLogs)
  .delete(protect, checkPermission('emaillog|audit_log', 'delete'), deleteOldEmailLogs);

router.post('/manual', protect, checkPermission('emaillog|alertsubscription', 'create'), createManualEmail);
router.post('/:id/resend', protect, checkPermission('emaillog|alertsubscription', 'update'), resendEmailLog);
router.delete('/:id', protect, checkPermission('emaillog|audit_log', 'delete'), deleteSingleEmailLog);
router.patch('/:id/status', protect, checkPermission('emaillog', 'update'), updateLogStatus);
router.patch('/:id/folder', protect, checkPermission('emaillog', 'update'), moveToFolder);

export default router;
