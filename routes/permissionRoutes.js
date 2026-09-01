import express from 'express';
import {
    createPermission,
    getPermissions,
    getPermissionById,
    updatePermission,
    deletePermission
} from '../controllers/permissionController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, checkPermission('permission', 'create'), createPermission)
    .get(protect, checkPermission('permission', 'view'), getPermissions);

router.route('/:id')
    .get(protect, checkPermission('permission', 'view'), getPermissionById)
    .put(protect, checkPermission('permission', 'update'), updatePermission)
    .delete(protect, checkPermission('permission', 'delete'), deletePermission);

export default router;
