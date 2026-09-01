import * as roleService from '../services/roleService.js';
import * as auditService from '../services/auditService.js';
import { validateRole, transformRoleInput, formatRoleResponse } from '../dto/roleDTO.js';

export const createRole = async (req, res) => {
    try {
        const transformed = transformRoleInput(req.body);
        const validation = validateRole(transformed);
        if (!validation.isValid) return res.status(400).json({ errors: validation.errors });

        const role = await roleService.createRole(transformed);

        await auditService.logAction({
            userId: req.user.id,
            action: 'ROLE_CREATE',
            resource: 'Role',
            after: role,
            ip: req.ip
        });

        res.status(201).json(formatRoleResponse(role));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRoles = async (req, res) => {
    try {
        const roles = await roleService.getAllRoles();
        res.json(roles.map(formatRoleResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRoleById = async (req, res) => {
    try {
        const role = await roleService.getRoleById(req.params.id);
        if (!role) return res.status(404).json({ message: 'Role not found' });
        res.json(formatRoleResponse(role));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateRole = async (req, res) => {
    try {
        const transformed = transformRoleInput(req.body);

        // Get before state for audit
        const beforeRole = await roleService.getRoleById(req.params.id);
        if (!beforeRole) return res.status(404).json({ message: 'Role not found' });

        const role = await roleService.updateRole(req.params.id, transformed);

        await auditService.logAction({
            userId: req.user.id,
            action: 'ROLE_UPDATE',
            resource: 'Role',
            before: formatRoleResponse(beforeRole),
            after: formatRoleResponse(role),
            ip: req.ip
        });

        res.json(formatRoleResponse(role));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteRole = async (req, res) => {
    try {
        const role = await roleService.deleteRole(req.params.id);
        if (!role) return res.status(404).json({ message: 'Role not found' });

        await auditService.logAction({
            userId: req.user.id,
            action: 'ROLE_DELETE',
            resource: 'Role',
            before: role,
            ip: req.ip
        });

        res.json({ message: 'Role deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
