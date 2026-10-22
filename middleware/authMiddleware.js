import jwt from 'jsonwebtoken';
import * as userService from '../services/userService.js';
import dotenv from 'dotenv';
dotenv.config();

// Middleware to protect routes 
export const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Use userService to get fully populated user
            const user = await userService.getUserById(decoded.id);
            if (!user) {
                console.warn(`[AUTH] User not found in DB for decoded.id=${decoded.id}`);
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // Check if user is active
            if (user.status !== 'active') {
                console.warn(`[AUTH] User ${user.email} has inactive status: ${user.status}`);
                return res.status(401).json({ message: 'Not authorized, user account is inactive' });
            }

            // Diagnostic log — server-side only, never sent to client
            if (process.env.NODE_ENV !== 'production' || process.env.AUTH_DEBUG === 'true') {
                console.log('[AUTH] req.user loaded:', {
                    id: user._id,
                    email: user.email,
                    accessLevel: user.accessLevel,
                    organizationType: user.organizationType,
                    status: user.status,
                    roles: Array.isArray(user.roles)
                        ? user.roles.map(r => (r && typeof r === 'object' ? { id: r._id, name: r.name } : r))
                        : user.roles
                });
            }

            // Avoid attaching passwordHash to request
            user.passwordHash = undefined;
            req.user = user;
            next();
        } catch (err) {
            console.error('[AUTH] Token verification error:', err.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = (req, res, next) => {
    if (req.user && req.user.roles && req.user.roles.some(r =>
        ['Admin', 'Super Admin', 'superadmin', 'Branch Admin', 'branch_admin', 'branch admin'].includes(r.name) ||
        ['admin', 'super_admin', 'branch_admin'].includes(r.name.toLowerCase())
    )) {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

// Middleware for routes accessible to both public and authenticated users
export const optionalAuth = async (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await userService.getUserById(decoded.id);
            if (user && user.status === 'active') {
                user.passwordHash = undefined;
                req.user = user;
            }
        } catch (err) {
            // Ignore token verification errors for optional auth
        }
    }
    next();
};
