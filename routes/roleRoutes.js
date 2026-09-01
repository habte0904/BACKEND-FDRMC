import express from 'express';
import {
    createRole,
    getRoles,
    getRoleById,
    updateRole,
    deleteRole
} from '../controllers/roleController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

router.route('/')
    .post(protect, checkPermission('role', 'create'), createRole)
    .get(protect, checkPermission('role', 'view'), getRoles);

router.route('/:id')
    .get(protect, checkPermission('role', 'view'), getRoleById)
    .put(protect, checkPermission('role', 'update'), updateRole)
    .delete(protect, checkPermission('role', 'delete'), deleteRole);

export default router;
