import express from 'express';
import {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
} from '../controllers/userController.js';
import upload from '../middleware/uploadMiddleware.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, canAccessUser, canModifyUser } from '../middleware/dataScope.js';
import { checkHierarchyLevel } from '../middleware/hierarchyAuth.js';
import User from '../models/User.js';

// User routes
const router = express.Router();

router.post('/',
    protect,
    checkPermission('user', 'create'),
    upload.single('profileImage'),
    createUser
);

router.get('/',
    protect,
    checkPermission('user', 'view'),
    applyScopeFilter(User),
    getUsers
);

router.get('/:id',
    protect,
    checkPermission('user', 'view'),
    canAccessUser,
    getUserById
);

router.put('/:id',
    protect,
    checkPermission('user', 'update'),
    canAccessUser,
    canModifyUser,
    upload.single('profileImage'),
    updateUser
);

router.delete('/:id',
    protect,
    checkPermission('user', 'delete'),
    canAccessUser,
    canModifyUser,
    deleteUser
);

export default router;