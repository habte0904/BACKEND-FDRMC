import express from 'express';
import {
    assignPermission,
    removePermission,
    getRolePermissions
} from '../controllers/rolePermissionController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Routes nested under roles usually, but here we can define them as:
// POST /api/roles/:roleId/permissions
// DELETE /api/roles/:roleId/permissions/:permissionId
// GET /api/roles/:roleId/permissions

// Since this router will be mounted probably at /api/roles, we need to handle the params carefully.
// However, the standard express router creation in server.js usually mounts exact paths.
// Let's assume we mount this router at `/api/roles` to keeping it RESTful.

router.post('/:roleId/permissions', protect, admin, assignPermission);
router.delete('/:roleId/permissions/:permissionId', protect, admin, removePermission);
router.get('/:roleId/permissions', protect, admin, getRolePermissions);

export default router;
