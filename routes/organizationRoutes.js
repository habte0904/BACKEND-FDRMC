import express from 'express';
import {
    createOrganization,
    getOrganizations,
    getOrganizationById,
    updateOrganization,
    deleteOrganization
} from '../controllers/organizationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import Organization from '../models/Organization.js';

const router = express.Router();

router.route('/')
    .post(protect, checkPermission('organization', 'create'), createOrganization)
    .get(protect, checkPermission('organization', 'view'), applyScopeFilter(Organization), getOrganizations);

router.route('/:id')
    .get(protect, checkPermission('organization', 'view'), checkDocumentAccess(Organization), getOrganizationById)
    .put(protect, checkPermission('organization', 'update'), checkDocumentAccess(Organization), updateOrganization)
    .delete(protect, checkPermission('organization', 'delete'), checkDocumentAccess(Organization), deleteOrganization);

export default router;
