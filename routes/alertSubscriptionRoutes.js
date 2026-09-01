import express from 'express';
import {
  upsertAlertSubscriptionPublic,
  listAlertSubscriptions,
  getAlertSubscriptionById,
  updateAlertSubscription,
  deleteAlertSubscription,
  broadcastAlert,
  sendSingleSmsToSubscriber,
  sendSingleEmailToSubscriber,
} from '../controllers/alertSubscriptionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import AlertSubscription from '../models/AlertSubscription.js';

const router = express.Router();

// Public wizard submit (also works when logged in)
router.post('/', upsertAlertSubscriptionPublic);

// Broadcast alert to subscribers
router.post('/broadcast', protect, checkPermission('alertsubscription', 'create'), broadcastAlert);

// Single direct messaging
router.post('/:id/send-sms', protect, checkPermission('alertsubscription', 'update'), sendSingleSmsToSubscriber);
router.post('/:id/send-email', protect, checkPermission('alertsubscription', 'update'), sendSingleEmailToSubscriber);

// Protected management routes with scoping
router.get('/', protect, checkPermission('alertsubscription', 'view'), applyScopeFilter(AlertSubscription), listAlertSubscriptions);
router.get('/:id', protect, checkPermission('alertsubscription', 'view'), checkDocumentAccess(AlertSubscription), getAlertSubscriptionById);
router.put('/:id', protect, checkPermission('alertsubscription', 'update'), checkDocumentAccess(AlertSubscription), updateAlertSubscription);
router.delete('/:id', protect, checkPermission('alertsubscription', 'delete'), checkDocumentAccess(AlertSubscription), deleteAlertSubscription);

export default router;
