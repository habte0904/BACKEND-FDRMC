import express from 'express';
import {
  getEmailConfig,
  updateEmailConfig,
  testConnection,
  sendTestEmail,
} from '../controllers/emailConfigController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/', protect, checkPermission('emailconfig|portalcontent|audit_log', 'view'), getEmailConfig);
router.put('/', protect, checkPermission('emailconfig|portalcontent', 'update'), updateEmailConfig);
router.post('/test-connection', protect, checkPermission('emailconfig|portalcontent', 'update'), testConnection);
router.post('/send-test-email', protect, checkPermission('emailconfig|portalcontent', 'update'), sendTestEmail);

export default router;
