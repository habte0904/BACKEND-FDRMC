import RolePermission from '../models/RolePermission.js';
import Permission from '../models/Permission.js';

/**
 * Middleware to check if user has required permission
 * @param {string} resource - The resource name (e.g., 'dashboard', 'user', 'department')
 * @param {string} action - The action name (e.g., 'view', 'create', 'update', 'delete')
 */
export const checkPermission = (resource, action) => {
    return async (req, res, next) => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            // Super admins have all permissions
            const isSuperAdmin = req.user.accessLevel === 'super_admin' || 
                               req.user.roles?.some(r => ['superadmin', 'super admin', 'super_admin'].includes(r.name.toLowerCase()));
            
            if (isSuperAdmin) {
                return next();
            }

            // Get user's role IDs
            const roleIds = req.user.roles?.map(role => role._id) || [];
            
            if (roleIds.length === 0) {
                return res.status(403).json({ message: 'No roles assigned to user' });
            }

            // Find the permission
            const permission = await Permission.findOne({ resource, action });
            
            if (!permission) {
                // If permission doesn't exist in the system, deny access
                return res.status(403).json({ 
                    message: `Permission not found for ${action} on ${resource}` 
                });
            }

            // Check if any of the user's roles have this permission
            const hasPermission = await RolePermission.findOne({
                roleId: { $in: roleIds },
                permissionId: permission._id
            });

            if (!hasPermission) {
                return res.status(403).json({ 
                    message: `You don't have permission to ${action} ${resource}` 
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Error checking permissions' });
        }
    };
};

/**
 * Middleware to check if user has any of the required permissions
 * @param {Array} permissions - Array of {resource, action} objects
 */
export const checkAnyPermission = (permissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: 'Not authenticated' });
            }

            // Super admins have all permissions
            if (req.user.accessLevel === 'super_admin') {
                return next();
            }

            const roleIds = req.user.roles?.map(role => role._id) || [];
            
            if (roleIds.length === 0) {
                return res.status(403).json({ message: 'No roles assigned to user' });
            }

            // Check each permission
            for (const perm of permissions) {
                const permission = await Permission.findOne({ 
                    resource: perm.resource, 
                    action: perm.action 
                });
                
                if (permission) {
                    const hasPermission = await RolePermission.findOne({
                        roleId: { $in: roleIds },
                        permissionId: permission._id
                    });

                    if (hasPermission) {
                        return next(); // User has at least one required permission
                    }
                }
            }

            res.status(403).json({ 
                message: 'You don\'t have the required permissions' 
            });
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Error checking permissions' });
        }
    };
};

/**
 * Get all permissions for a user
 * @param {Object} user - User object with populated roles
 * @returns {Array} Array of permission objects
 */
export const getUserPermissions = async (user) => {
    if (!user || !user.roles || user.roles.length === 0) return [];

    const roleIds = user.roles.map(r => r._id);
    const rolePermissions = await RolePermission.find({ roleId: { $in: roleIds } })
        .populate('permissionId');

    return rolePermissions.map(rp => rp.permissionId);
};
