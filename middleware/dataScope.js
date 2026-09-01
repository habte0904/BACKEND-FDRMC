import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Department from '../models/Department.js';
import Team from '../models/Team.js';

/**
 * Middleware to apply data scope filtering based on user's hierarchy level
 */
export const applyScopeFilter = (Model) => {
    return async (req, res, next) => {
        try {
            const user = await User.findById(req.user._id)
                .populate('organization')
                .populate('sector')
                .populate('department')
                .populate('team')
                .populate('managedDepartments')
                .populate('managedTeams');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const scope = {};

            const isSuperAdmin = user.accessLevel === 'super_admin' || 
                                 (user.accessLevel === 'manager' && user.organizationType === 'head_office');

            if (!isSuperAdmin) {
                const userOrgId = user.organization?._id || user.organization;
                const branchUserIds = [];

                if (userOrgId) {
                    const branchUsers = await User.find({ organization: userOrgId }).select('_id');
                    branchUsers.forEach(u => branchUserIds.push(u._id));
                }

                // If Model is passed, inspect schema paths for scoping
                if (Model && Model.schema) {
                    const paths = Model.schema.paths;
                    const conditions = [];

                    // 1. Organization boundary
                    if (paths.organizationId && userOrgId) {
                        conditions.push({ organizationId: userOrgId });
                    } else if (paths.organization && userOrgId) {
                        conditions.push({ organization: userOrgId });
                    }

                    // 2. Creator boundaries (experts only see their own, managers/admins see branch)
                    if (user.accessLevel === 'expert') {
                        if (paths.createdBy) conditions.push({ createdBy: user._id });
                        if (paths.createdByUser) conditions.push({ createdByUser: user._id });
                        if (paths.submittedBy) conditions.push({ submittedBy: user._id });
                        if (paths.assessed_by) conditions.push({ assessed_by: user._id });
                    } else if (branchUserIds.length > 0) {
                        if (paths.createdBy) conditions.push({ createdBy: { $in: branchUserIds } });
                        if (paths.createdByUser) conditions.push({ createdByUser: { $in: branchUserIds } });
                        if (paths.submittedBy) conditions.push({ submittedBy: { $in: branchUserIds } });
                        if (paths.assessed_by) conditions.push({ assessed_by: { $in: branchUserIds } });
                    }

                    if (conditions.length > 0) {
                        scope.$or = conditions;
                    } else {
                        // Fallback if no paths match but user is restricted
                        scope._id = null; // Matches nothing
                    }
                } else {
                    // Fallback to basic organization check if no Model is provided
                    if (userOrgId) {
                        scope.organization = userOrgId;
                    }
                }
            }

            req.dataScope = scope;
            req.scopedUser = user;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Scope filter failed', error: error.message });
        }
    };
};

/**
 * Middleware to check if user has access to a specific document
 */
export const checkDocumentAccess = (Model, idParamName = 'id') => {
    return async (req, res, next) => {
        try {
            const docId = req.params[idParamName];
            if (!docId) {
                return res.status(400).json({ message: 'Resource ID parameter is required' });
            }

            if (!req.dataScope) {
                await new Promise((resolve, reject) => {
                    applyScopeFilter(Model)(req, res, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            const isSuperAdmin = req.scopedUser.accessLevel === 'super_admin' || 
                                 (req.scopedUser.accessLevel === 'manager' && req.scopedUser.organizationType === 'head_office');

            if (isSuperAdmin) {
                return next();
            }

            const doc = await Model.findOne({ _id: docId, ...req.dataScope });
            if (!doc) {
                return res.status(403).json({ message: 'Access denied: Resource not found or belongs to another branch.' });
            }

            req.targetDocument = doc;
            next();
        } catch (error) {
            res.status(500).json({ message: 'Access check failed', error: error.message });
        }
    };
};

/**
 * Middleware to check if current user can modify/delete target user based on hierarchy
 */
export const canModifyUser = async (req, res, next) => {
    try {
        const targetUserId = req.params.id || req.params.userId;
        if (!targetUserId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        if (req.user._id.toString() === targetUserId.toString()) {
            return next();
        }

        // Super admin can modify any user
        const isSuperAdmin = req.user.accessLevel === 'super_admin' ||
            (req.user.roles && req.user.roles.some(r => ['superadmin', 'super admin', 'super_admin'].includes(r.name.toLowerCase())));
        
        if (isSuperAdmin) {
            return next();
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        const HIERARCHY_LEVELS = {
            super_admin: 100,
            manager: 90,
            deputy: 80,
            branch_admin: 75,
            directorate: 60,
            team_leader: 40,
            expert: 20
        };

        const getHierarchyValue = (level) => HIERARCHY_LEVELS[level] || 0;

        const currentUserLevel = getHierarchyValue(req.user.accessLevel);
        const targetUserLevel = getHierarchyValue(targetUser.accessLevel);

        if (currentUserLevel <= targetUserLevel) {
            return res.status(403).json({
                message: 'Access denied: You cannot modify or delete a user with an equal or higher hierarchy level than yours.'
            });
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Hierarchy modification check failed', error: error.message });
    }
};

/**
 * Middleware to check if current user can access target user
 */
export const canAccessUser = async (req, res, next) => {
    try {
        const currentUser = await User.findById(req.user._id)
            .populate('organization')
            .populate('sector')
            .populate('department')
            .populate('team')
            .populate('managedDepartments')
            .populate('managedTeams');

        const targetUserId = req.params.userId || req.body.userId || req.params.id;

        if (!targetUserId) {
            return res.status(400).json({ message: 'Target user ID required' });
        }

        const targetUser = await User.findById(targetUserId)
            .populate('organization')
            .populate('sector')
            .populate('department')
            .populate('team');

        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        // Super admin can access anyone
        if (currentUser.accessLevel === 'super_admin') {
            req.targetUser = targetUser;
            return next();
        }

        // Manager can access anyone in their organization
        if (currentUser.accessLevel === 'manager') {
            if (currentUser.organizationType === 'head_office') {
                req.targetUser = targetUser;
                return next();
            }
            if (currentUser.organization && targetUser.organization &&
                currentUser.organization._id.equals(targetUser.organization._id)) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Deputy can access users in managed departments
        if (currentUser.accessLevel === 'deputy') {
            if (currentUser.managedDepartments && targetUser.department &&
                currentUser.managedDepartments.some(d => d._id.equals(targetUser.department._id))) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Sector Lead can access users in their sector
        if (currentUser.accessLevel === 'sector_lead') {
            if (currentUser.sector && targetUser.sector &&
                currentUser.sector._id.equals(targetUser.sector._id)) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Branch admin can access users in their branch
        if (currentUser.accessLevel === 'branch_admin') {
            if (currentUser.organization && targetUser.organization &&
                currentUser.organization._id.equals(targetUser.organization._id)) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Directorate can access users in their department
        if (currentUser.accessLevel === 'directorate') {
            if (currentUser.department && targetUser.department &&
                currentUser.department._id.equals(targetUser.department._id)) {
                req.targetUser = targetUser;
                return next();
            }
            // Also check managed departments
            if (currentUser.managedDepartments && targetUser.department &&
                currentUser.managedDepartments.some(d => d._id.equals(targetUser.department._id))) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Team leader can access team members
        if (currentUser.accessLevel === 'team_leader') {
            if (currentUser.team && targetUser.team &&
                currentUser.team._id.equals(targetUser.team._id)) {
                req.targetUser = targetUser;
                return next();
            }
            // Also check managed teams
            if (currentUser.managedTeams && targetUser.team &&
                currentUser.managedTeams.some(t => t._id.equals(targetUser.team._id))) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Expert can only access themselves
        if (currentUser._id.equals(targetUser._id)) {
            req.targetUser = targetUser;
            return next();
        }

        return res.status(403).json({
            message: 'Access denied to this user',
            currentLevel: currentUser.accessLevel,
            targetLevel: targetUser.accessLevel
        });
    } catch (error) {
        res.status(500).json({ message: 'Access check failed', error: error.message });
    }
};

/**
 * Get accessible organizations for current user
 */
export const getAccessibleOrganizations = async (userId) => {
    const user = await User.findById(userId).populate('organization');

    if (user.accessLevel === 'super_admin' ||
        (user.accessLevel === 'manager' && user.organizationType === 'head_office')) {
        return await Organization.find({ status: 'active' });
    }

    if (user.organization) {
        return [user.organization];
    }

    return [];
};

/**
 * Get accessible departments for current user
 */
export const getAccessibleDepartments = async (userId) => {
    const user = await User.findById(userId)
        .populate('organization')
        .populate('department')
        .populate('managedDepartments');

    if (user.accessLevel === 'super_admin' ||
        (user.accessLevel === 'manager' && user.organizationType === 'head_office')) {
        return await Department.find({});
    }

    if (user.accessLevel === 'manager' || user.accessLevel === 'branch_admin') {
        return await Department.find({ organizationId: user.organization._id });
    }

    if (user.accessLevel === 'deputy' || user.accessLevel === 'directorate') {
        if (user.managedDepartments && user.managedDepartments.length > 0) {
            return user.managedDepartments;
        }
        if (user.department) {
            return [user.department];
        }
    }

    if (user.department) {
        return [user.department];
    }

    return [];
};
