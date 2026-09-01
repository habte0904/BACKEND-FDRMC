import * as rolePermissionService from '../services/rolePermissionService.js';
import * as auditService from '../services/auditService.js';
import { validateRolePermission } from '../dto/rolePermissionDTO.js';
import { formatPermissionResponse } from '../dto/permissionDTO.js';

export const assignPermission = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissionId } = req.body;

        const validation = validateRolePermission({ roleId, permissionId });
        if (!validation.isValid) return res.status(400).json({ errors: validation.errors });

        await rolePermissionService.assignPermissionToRole(roleId, permissionId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'ROLE_PERMISSION_ASSIGN',
            resource: 'RolePermission',
            after: { roleId, permissionId },
            ip: req.ip
        });

        res.status(201).json({ message: 'Permission assigned to role' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const removePermission = async (req, res) => {
    try {
        const { roleId, permissionId } = req.params;
        await rolePermissionService.removePermissionFromRole(roleId, permissionId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'ROLE_PERMISSION_REMOVE',
            resource: 'RolePermission',
            before: { roleId, permissionId },
            ip: req.ip
        });

        res.json({ message: 'Permission removed from role' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const rolePermissions = await rolePermissionService.getPermissionsByRole(roleId);
        // Map to return just the permission details, formatted cleanly
        const permissions = rolePermissions.map(rp => rp.permissionId).filter(p => p !== null);
        res.json(permissions.map(formatPermissionResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
