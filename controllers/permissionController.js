import * as permissionService from '../services/permissionService.js';
import * as auditService from '../services/auditService.js';
import { validatePermission, transformPermissionInput, formatPermissionResponse } from '../dto/permissionDTO.js';

export const createPermission = async (req, res) => {
    try {
        const transformed = transformPermissionInput(req.body);
        const validation = validatePermission(transformed);
        if (!validation.isValid) return res.status(400).json({ errors: validation.errors });

        const permission = await permissionService.createPermission(transformed);

        await auditService.logAction({
            userId: req.user.id,
            action: 'PERMISSION_CREATE',
            resource: 'Permission',
            after: permission,
            ip: req.ip
        });

        res.status(201).json(formatPermissionResponse(permission));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPermissions = async (req, res) => {
    try {
        const permissions = await permissionService.getAllPermissions();
        res.json(permissions.map(formatPermissionResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getPermissionById = async (req, res) => {
    try {
        const permission = await permissionService.getPermissionById(req.params.id);
        if (!permission) return res.status(404).json({ message: 'Permission not found' });
        res.json(formatPermissionResponse(permission));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePermission = async (req, res) => {
    try {
        const transformed = transformPermissionInput(req.body);

        // Get before state for audit
        const beforePermission = await permissionService.getPermissionById(req.params.id);
        if (!beforePermission) return res.status(404).json({ message: 'Permission not found' });

        const permission = await permissionService.updatePermission(req.params.id, transformed);

        await auditService.logAction({
            userId: req.user.id,
            action: 'PERMISSION_UPDATE',
            resource: 'Permission',
            before: formatPermissionResponse(beforePermission),
            after: formatPermissionResponse(permission),
            ip: req.ip
        });

        res.json(formatPermissionResponse(permission));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deletePermission = async (req, res) => {
    try {
        const permission = await permissionService.deletePermission(req.params.id);
        if (!permission) return res.status(404).json({ message: 'Permission not found' });

        await auditService.logAction({
            userId: req.user.id,
            action: 'PERMISSION_DELETE',
            resource: 'Permission',
            before: permission,
            ip: req.ip
        });

        res.json({ message: 'Permission deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
