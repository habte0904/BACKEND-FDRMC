import User from '../models/User.js';

// Define hierarchy levels (higher number = more authority)
const HIERARCHY_LEVELS = {
    super_admin: 100,
    manager: 90,
    deputy: 80,
    branch_admin: 75,
    directorate: 60,
    team_leader: 40,
    expert: 20
};

/**
 * Middleware to check if user has required hierarchy level
 */
export const checkHierarchyLevel = (requiredLevel) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const userLevel = HIERARCHY_LEVELS[user.accessLevel] || 0;
            const required = HIERARCHY_LEVELS[requiredLevel] || 0;

            if (userLevel < required) {
                return res.status(403).json({
                    message: 'Insufficient hierarchy level',
                    required: requiredLevel,
                    current: user.accessLevel
                });
            }

            req.hierarchyLevel = userLevel;
            req.currentUser = user;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Hierarchy check failed', error: error.message });
        }
    };
};

/**
 * Middleware to check organization type
 */
export const checkOrganizationType = (allowedTypes) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!allowedTypes.includes(user.organizationType)) {
                return res.status(403).json({
                    message: 'Access restricted to specific organization types',
                    allowed: allowedTypes,
                    current: user.organizationType
                });
            }

            req.currentUser = user;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Organization type check failed', error: error.message });
        }
    };
};

/**
 * Middleware to check delegated authority
 */
export const checkDelegation = (requiredAuthority) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Check if user has the authority directly or through delegation
            const hasAuthority = user.delegatedAuthority &&
                user.delegatedAuthority[requiredAuthority] &&
                (!user.delegatedAuthority.expiresAt ||
                    new Date(user.delegatedAuthority.expiresAt) > new Date());

            if (!hasAuthority) {
                return res.status(403).json({
                    message: 'Delegated authority required',
                    required: requiredAuthority
                });
            }

            req.currentUser = user;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Delegation check failed', error: error.message });
        }
    };
};

/**
 * Get hierarchy level value for a given access level
 */
export const getHierarchyLevel = (accessLevel) => {
    return HIERARCHY_LEVELS[accessLevel] || 0;
};

/**
 * Check if one user can manage another based on hierarchy
 */
export const canManageUser = (managerLevel, targetLevel) => {
    const managerHierarchy = HIERARCHY_LEVELS[managerLevel] || 0;
    const targetHierarchy = HIERARCHY_LEVELS[targetLevel] || 0;
    return managerHierarchy > targetHierarchy;
};
