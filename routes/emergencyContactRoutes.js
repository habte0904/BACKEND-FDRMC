import express from 'express';
import {
  createEmergencyContact,
  deleteEmergencyContact,
  getPublicEmergencyDirectory,
  getGlobalWarning,
  updateGlobalWarning,
  listEmergencyContacts,
  updateEmergencyContact,
} from '../controllers/emergencyContactController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import EmergencyContact from '../models/EmergencyContact.js';

const router = express.Router();

router.get('/public', getPublicEmergencyDirectory);
// Global warning routes
router.get('/warning', protect, checkPermission('emergencycontact', 'view'), getGlobalWarning);
router.put('/warning', protect, checkPermission('emergencycontact', 'update'), updateGlobalWarning);

router.get('/', protect, checkPermission('emergencycontact', 'view'), applyScopeFilter(EmergencyContact), listEmergencyContacts);
router.post('/', protect, checkPermission('emergencycontact', 'create'), createEmergencyContact);
router.put('/:id', protect, checkPermission('emergencycontact', 'update'), checkDocumentAccess(EmergencyContact), updateEmergencyContact);
router.delete('/:id', protect, checkPermission('emergencycontact', 'delete'), checkDocumentAccess(EmergencyContact), deleteEmergencyContact);

export default router;
