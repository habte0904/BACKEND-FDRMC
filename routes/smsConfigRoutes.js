import express from 'express';
import {
  getSmsConfig,
  updateSmsConfig,
  testConnection,
  sendTestSms,
} from '../controllers/smsConfigController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.get('/', protect, checkPermission('smsconfig', 'view'), getSmsConfig);
router.put('/', protect, checkPermission('smsconfig', 'update'), updateSmsConfig);
router.post('/test-connection', protect, checkPermission('smsconfig', 'update'), testConnection);
router.post('/send-test-sms', protect, checkPermission('smsconfig', 'update'), sendTestSms);

export default router;
