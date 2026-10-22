import mongoose from 'mongoose';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Department from '../models/Department.js';
import Team from '../models/Team.js';
import { getBranchScope, buildSubcityRegex } from '../utils/branchScope.js';

/**
 * Universal helper to verify if a user has Super Administrator privileges
 * Checks both accessLevel and roles array safely.
 */
export const isSuperAdminUser = (user) => {
    if (!user) return false;
    if (user.accessLevel === 'super_admin') return true;
    if (user.accessLevel === 'manager' && user.organizationType === 'head_office') return true;
    if (Array.isArray(user.roles)) {
        return user.roles.some(r => {
            if (!r) return false;
            const name = (typeof r === 'string' ? r : r.name || r.title || '').toString().toLowerCase().trim();
            return ['super admin', 'superadmin', 'super_admin', 'admin'].includes(name);
        });
    }
    return false;
};

/**
 * Helper to safely extract string ID from an ObjectId, populated doc, or string
 */
export const safeId = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (val._id) return val._id.toString();
    if (val.id) return val.id.toString();
    return val.toString();
};

/**
 * Middleware to apply data scope filtering based on user's hierarchy level
 */
export const applyScopeFilter = (Model) => {
    return async (req, res, next) => {
        try {
            // Super Admin check directly on authenticated req.user
            if (isSuperAdminUser(req.user)) {
                req.dataScope = {};
                req.scopedUser = req.user;
                return next();
            }

            const currentUserId = safeId(req.user?._id || req.user?.id);
            if (!currentUserId) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            const user = await User.findById(currentUserId)
                .populate('organization')
                .populate('sector')
                .populate('department')
                .populate('team')
                .populate('managedDepartments')
                .populate('managedTeams')
                .populate('roles');

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const scope = {};

            const isSuperAdmin = isSuperAdminUser(user);

            if (!isSuperAdmin) {
                // Check if user is a branch user assigned to a territorial branch (subcity branch)
                const branchScope = await getBranchScope(user);

                if (branchScope.isBranch && branchScope.subcityName) {
                    const subRegex = buildSubcityRegex(branchScope.subcityName);
                    const userOrgId = user.organization?._id || user.organization || branchScope.organizationId;
                    const branchUserIds = [];

                    if (userOrgId) {
                        const branchUsers = await User.find({ organization: userOrgId }).select('_id');
                        branchUsers.forEach(u => branchUserIds.push(u._id));
                    }

                    const modelName = Model?.modelName;

                    if (['WoredaProfile', 'HouseholdProfile', 'WoredaAssessment'].includes(modelName)) {
                        req.dataScope = {
                            $or: [
                                { 'location.subcity': subRegex },
                                { 'location.subCity': subRegex }
                            ]
                        };
                        req.scopedUser = user;
                        return next();
                    }

                    if (modelName === 'IncidentReport') {
                        req.dataScope = {
                            $or: [
                                { 'location.subcity': subRegex },
                                { 'location.subCity': subRegex },
                                {
                                    $and: [
                                        { $or: [{ 'location.subCity': { $in: [null, ''] } }, { 'location.subCity': { $exists: false } }] },
                                        { $or: [{ 'location.subcity': { $in: [null, ''] } }, { 'location.subcity': { $exists: false } }] },
                                        { 'location.addressLine': subRegex }
                                    ]
                                },
                                ...(branchUserIds.length > 0 ? [{ createdByUser: { $in: branchUserIds } }] : [])
                            ]
                        };
                        req.scopedUser = user;
                        return next();
                    }

                    if (modelName === 'AlertSubscription') {
                        req.dataScope = {
                            $or: [
                                { 'location.subcity': subRegex },
                                { 'location.subCity': subRegex },
                                {
                                    $and: [
                                        { $or: [{ 'location.subCity': { $in: [null, ''] } }, { 'location.subCity': { $exists: false } }] },
                                        { $or: [{ 'location.subcity': { $in: [null, ''] } }, { 'location.subcity': { $exists: false } }] },
                                        { 'location.addressLine': subRegex }
                                    ]
                                },
                                ...(branchUserIds.length > 0 ? [{ createdByUser: { $in: branchUserIds } }] : [])
                            ]
                        };
                        req.scopedUser = user;
                        return next();
                    }

                    if (modelName === 'EmergencyContact') {
                        req.dataScope = {
                            $or: [
                                { subcity: subRegex },
                                { addressLine: subRegex },
                                { regions: { $in: [subRegex] } },
                                ...(userOrgId ? [{ organizationId: userOrgId }] : []),
                                ...(branchUserIds.length > 0 ? [{ createdByUser: { $in: branchUserIds } }] : [])
                            ]
                        };
                        req.scopedUser = user;
                        return next();
                    }

                    if (modelName === 'InspectionRequest') {
                        req.dataScope = {
                            $or: [
                                { subcity: subRegex },
                                { propertyAddress: subRegex },
                                ...(userOrgId ? [{ organizationId: userOrgId }] : [])
                            ]
                        };
                        req.scopedUser = user;
                        return next();
                    }

                    // Generic territorial fallback
                    if (Boolean(Model?.schema?.path('location.subcity') || Model?.schema?.path('location.subCity') || Model?.schema?.path('location'))) {
                        req.dataScope = {
                            $or: [
                                { 'location.subcity': subRegex },
                                { 'location.subCity': subRegex }
                            ]
                        };
                        req.scopedUser = user;
                        return next();
                    }
                }

                // If user is Head Office (not a branch), they can see all city-wide data for territorial/admin collections
                const headOfficeTerritorialModels = ['WoredaProfile', 'HouseholdProfile', 'WoredaAssessment', 'IncidentReport', 'AlertSubscription', 'EmergencyContact', 'InspectionRequest'];
                if (headOfficeTerritorialModels.includes(Model?.modelName) && !branchScope.isBranch) {
                    req.dataScope = {};
                    req.scopedUser = user;
                    return next();
                }

                const userOrgId = user.organization?._id || user.organization;
                const branchUserIds = [];

                if (userOrgId) {
                    const branchUsers = await User.find({ organization: userOrgId }).select('_id');
                    branchUsers.forEach(u => branchUserIds.push(u._id));
                }

                // Resolve branch subcity name if organization is linked to a subcity
                let branchSubcityName = null;
                if (user.organization) {
                    if (user.organization.subcityName) {
                        branchSubcityName = user.organization.subcityName;
                    } else if (user.organization.subcity) {
                        const Subcity = (await import('../models/Subcity.js')).default;
                        const subDoc = await Subcity.findById(user.organization.subcity);
                        if (subDoc) branchSubcityName = subDoc.name;
                    }
                }

                // If Model is passed, inspect schema paths for scoping
                if (Model && Model.schema) {
                    const paths = Model.schema.paths;
                    const conditions = [];

                    // Special case for Organization model itself
                    if (Model.modelName === 'Organization') {
                        if (userOrgId) conditions.push({ _id: userOrgId });
                        conditions.push({ type: 'head_office' });
                    } else {
                        // 1. Organization boundary
                        if (paths.organizationId && userOrgId) {
                            conditions.push({ organizationId: userOrgId });
                        } else if (paths.organization && userOrgId) {
                            conditions.push({ organization: userOrgId });
                        }

                        // 2. Territorial boundary (Subcity & Woredas matching this branch)
                        if (branchSubcityName) {
                            const subRegex = new RegExp(`^${branchSubcityName.replace(/\\bsub[\\s-]?city\\b/ig, '').trim()}$`, 'i');
                            if (Model.schema.path('location.subcity') || paths['location.subcity']) conditions.push({ 'location.subcity': subRegex });
                            if (Model.schema.path('location.subCity') || paths['location.subCity']) conditions.push({ 'location.subCity': subRegex });
                            if (Model.schema.path('subCity') || paths.subCity) conditions.push({ subCity: subRegex });
                            if (Model.schema.path('subcity') || paths.subcity) conditions.push({ subcity: subRegex });
                        }

                        // 3. Creator boundaries (experts only see their own, managers/admins see branch)
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

            // Super Admin bypass immediately
            if (isSuperAdminUser(req.user)) {
                return next();
            }

            if (!req.dataScope) {
                await new Promise((resolve, reject) => {
                    applyScopeFilter(Model)(req, res, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }

            if (isSuperAdminUser(req.scopedUser) || isSuperAdminUser(req.user)) {
                return next();
            }

            if (!mongoose.Types.ObjectId.isValid(docId)) {
                return res.status(400).json({ message: 'Invalid resource ID parameter' });
            }

            const doc = await Model.findOne({ _id: docId, ...req.dataScope });
            if (!doc) {
                return res.status(403).json({ message: 'Access denied: Resource not found or belongs to another branch.' });
            }

            req.targetDocument = doc;
            next();
        } catch (error) {
            console.error('[checkDocumentAccess Error]:', error);
            res.status(500).json({ message: 'Access check failed', error: error.message });
        }
    };
};

/**
 * Middleware to check if current user can modify/delete target user based on hierarchy
 */
export const canModifyUser = async (req, res, next) => {
    try {
        const currentUserId = safeId(req.user?._id || req.user?.id);
        const targetUserId = safeId(req.params?.id || req.params?.userId || req.body?.userId);

        if (!targetUserId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        // 1. Users can always modify their own profile
        if (currentUserId && currentUserId === targetUserId) {
            return next();
        }

        // 2. Super admins can modify any user
        if (isSuperAdminUser(req.user)) {
            return next();
        }

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: 'Invalid target user ID' });
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
            expert: 20,
            public: 0
        };

        const getHierarchyValue = (level) => HIERARCHY_LEVELS[level] ?? 0;

        const currentUserLevel = getHierarchyValue(req.user?.accessLevel);
        const targetUserLevel = getHierarchyValue(targetUser?.accessLevel);

        if (currentUserLevel <= targetUserLevel) {
            return res.status(403).json({
                message: 'Access denied: You cannot modify or delete a user with an equal or higher hierarchy level than yours.'
            });
        }

        next();
    } catch (error) {
        console.error('[canModifyUser Error]:', error);
        res.status(500).json({ message: 'Hierarchy modification check failed', error: error.message });
    }
};

/**
 * Middleware to check if current user can access target user
 */
export const canAccessUser = async (req, res, next) => {
    try {
        const currentUserId = safeId(req.user?._id || req.user?.id);
        const targetUserId = safeId(req.params?.id || req.params?.userId || req.body?.userId);

        if (!targetUserId) {
            return res.status(400).json({ message: 'Target user ID required' });
        }

        // 1. Users can always access their own account
        if (currentUserId && currentUserId === targetUserId) {
            return next();
        }

        // 2. Super admins can view and access ANY user
        if (isSuperAdminUser(req.user)) {
            return next();
        }

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ message: 'Invalid target user ID' });
        }

        const currentUser = await User.findById(currentUserId)
            .populate('organization')
            .populate('roles')
            .populate('sector')
            .populate('department')
            .populate('team')
            .populate('managedDepartments')
            .populate('managedTeams');

        if (!currentUser) {
            return res.status(401).json({ message: 'Current user not found' });
        }

        // Check if DB user is Super Admin
        if (isSuperAdminUser(currentUser)) {
            return next();
        }

        const targetUser = await User.findById(targetUserId)
            .populate('organization')
            .populate('roles')
            .populate('sector')
            .populate('department')
            .populate('team');

        if (!targetUser) {
            return res.status(404).json({ message: 'Target user not found' });
        }

        // Users can always access their own account
        if (safeId(currentUser._id) === safeId(targetUser._id)) {
            req.targetUser = targetUser;
            return next();
        }

        const currentUserOrgId = safeId(currentUser.organization);
        const targetUserOrgId = safeId(targetUser.organization);
        const currentUserDeptId = safeId(currentUser.department);
        const targetUserDeptId = safeId(targetUser.department);
        const currentUserSectorId = safeId(currentUser.sector);
        const targetUserSectorId = safeId(targetUser.sector);
        const currentUserTeamId = safeId(currentUser.team);
        const targetUserTeamId = safeId(targetUser.team);

        // Manager can access anyone in their organization
        if (currentUser.accessLevel === 'manager') {
            if (currentUser.organizationType === 'head_office') {
                req.targetUser = targetUser;
                return next();
            }
            if (currentUserOrgId && targetUserOrgId && currentUserOrgId === targetUserOrgId) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Deputy can access users in managed departments
        if (currentUser.accessLevel === 'deputy') {
            if (currentUser.managedDepartments && targetUserDeptId &&
                currentUser.managedDepartments.some(d => safeId(d) === targetUserDeptId)) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Sector Lead can access users in their sector
        if (currentUser.accessLevel === 'sector_lead') {
            if (currentUserSectorId && targetUserSectorId && currentUserSectorId === targetUserSectorId) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Branch admin can access users in their branch
        if (currentUser.accessLevel === 'branch_admin') {
            if (currentUserOrgId && targetUserOrgId && currentUserOrgId === targetUserOrgId) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Directorate can access users in their department
        if (currentUser.accessLevel === 'directorate') {
            if (currentUserDeptId && targetUserDeptId && currentUserDeptId === targetUserDeptId) {
                req.targetUser = targetUser;
                return next();
            }
            if (currentUser.managedDepartments && targetUserDeptId &&
                currentUser.managedDepartments.some(d => safeId(d) === targetUserDeptId)) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Team leader can access team members
        if (currentUser.accessLevel === 'team_leader') {
            if (currentUserTeamId && targetUserTeamId && currentUserTeamId === targetUserTeamId) {
                req.targetUser = targetUser;
                return next();
            }
            if (currentUser.managedTeams && targetUserTeamId &&
                currentUser.managedTeams.some(t => safeId(t) === targetUserTeamId)) {
                req.targetUser = targetUser;
                return next();
            }
        }

        // Expert can only access themselves
        if (safeId(currentUser._id) === safeId(targetUser._id)) {
            req.targetUser = targetUser;
            return next();
        }

        return res.status(403).json({
            message: 'Access denied to this user',
            currentLevel: currentUser.accessLevel,
            targetLevel: targetUser.accessLevel
        });
    } catch (error) {
        console.error('[canAccessUser Error]:', error);
        res.status(500).json({ message: 'Access check failed', error: error.message });
    }
};

/**
 * Get accessible organizations for current user
 */
export const getAccessibleOrganizations = async (userId) => {
    const user = await User.findById(userId).populate('organization').populate('roles');
    if (!user) return [];

    if (isSuperAdminUser(user)) {
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
        .populate('managedDepartments')
        .populate('roles');

    if (!user) return [];

    if (isSuperAdminUser(user)) {
        return await Department.find({});
    }

    const userOrgId = safeId(user.organization);

    if (user.accessLevel === 'manager' || user.accessLevel === 'branch_admin') {
        if (userOrgId) {
            return await Department.find({ organizationId: userOrgId });
        }
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
