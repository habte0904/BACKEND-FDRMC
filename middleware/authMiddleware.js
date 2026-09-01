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
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // Check if user is active
            if (user.status !== 'active') {
                return res.status(401).json({ message: 'Not authorized, user account is inactive' });
            }
            // Avoid attaching passwordHash to request
            user.passwordHash = undefined;
            // ... existing code ...
            req.user = user;
            next();
        } catch (err) {
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
