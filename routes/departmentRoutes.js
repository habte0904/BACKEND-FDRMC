import express from 'express';
import {
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment,
    getDepartmentsByOrg,
    getDepartmentsBySector
} from '../controllers/departmentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import Department from '../models/Department.js';

const router = express.Router();

router.route('/')
    .post(protect, checkPermission('department', 'create'), createDepartment)
    .get(protect, checkPermission('department', 'view'), applyScopeFilter(Department), getDepartments);

router.route('/:id')
    .get(protect, checkPermission('department', 'view'), checkDocumentAccess(Department), getDepartmentById)
    .put(protect, checkPermission('department', 'update'), checkDocumentAccess(Department), updateDepartment)
    .delete(protect, checkPermission('department', 'delete'), checkDocumentAccess(Department), deleteDepartment);

// Get departments of an organization
router.get('/organization/:orgId', protect, checkPermission('department', 'view'), getDepartmentsByOrg);

// Get departments of a sector

export default router;
