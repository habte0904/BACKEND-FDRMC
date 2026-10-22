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

// Helper: allow if user is viewing or modifying their own profile, or if they have permission
const allowSelfOrPermission = (resource, action) => {
    const permMiddleware = checkPermission(resource, action);
    return (req, res, next) => {
        const targetId = req.params.id;
        const currentUserId = req.user?._id?.toString() || req.user?.id?.toString();
        if (currentUserId && targetId && currentUserId === targetId.toString()) {
            return next();
        }
        return permMiddleware(req, res, next);
    };
};

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
    allowSelfOrPermission('user', 'view'),
    canAccessUser,
    getUserById
);

router.put('/:id',
    protect,
    upload.single('profileImage'),
    allowSelfOrPermission('user', 'update'),
    canAccessUser,
    canModifyUser,
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