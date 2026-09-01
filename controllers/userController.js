import * as userService from '../services/userService.js';
import * as auditService from '../services/auditService.js';
import { validateUser, transformUserInput, formatUserResponse } from '../dto/userDTO.js';
import { sendVerificationEmail, sendAccountSetupEmail } from '../services/emailService.js';

// Create User
export const createUser = async (req, res) => {
    try {
        const transformed = transformUserInput(req.body);

        // Use default password if not provided
        if (!transformed.password) {
            transformed.password = process.env.DEFAULT_PASSWORD;
        }
        if (req.file) {
            transformed.profileImage = req.file;
        }

        // Generate Setup Token (using verificationCode field but long string)
        const crypto = await import('crypto');
        const setupToken = crypto.randomBytes(32).toString('hex');
        transformed.verificationCode = setupToken;
        transformed.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const validation = validateUser(transformed);
        if (!validation.isValid) return res.status(400).json({ errors: validation.errors });

        // Access Control: Branch Admin can only create users for their branch
        const isBranchAdmin = req.user.accessLevel === 'branch_admin' ||
            (req.user.roles && req.user.roles.some(r => ['Branch Admin', 'branch_admin'].includes(r.name)));

        const isSuperAdmin = req.user.accessLevel === 'super_admin' ||
            (req.user.roles && req.user.roles.some(r => ['Super Admin', 'super_admin', 'superadmin'].includes(r.name)));

        if (isBranchAdmin && !isSuperAdmin) {
            const userOrgId = req.user.organization?._id || req.user.organization;
            if (transformed.organization && String(transformed.organization) !== String(userOrgId)) {
                return res.status(403).json({ message: "Branch Admins can only create users for their own branch." });
            }
            transformed.organization = userOrgId;

            // Privilege Escalation Prevention
            if (transformed.accessLevel === 'super_admin' || (transformed.accessLevel === 'manager' && transformed.organizationType === 'head_office')) {
                return res.status(403).json({ message: "Branch Admins cannot create Super Admin or Head Office manager accounts." });
            }
            if (transformed.organizationType === 'head_office') {
                return res.status(403).json({ message: "Branch Admins cannot create Head Office accounts." });
            }
            if (transformed.roles && transformed.roles.length > 0) {
                const Role = (await import('../models/Role.js')).default;
                const assignedRoles = await Role.find({ _id: { $in: transformed.roles } });
                const hasHeadOfficeRole = assignedRoles.some(role =>
                    ['super admin', 'superadmin', 'head office', 'head_office'].includes(role.name.toLowerCase()) || role.type === 'head_office'
                );
                if (hasHeadOfficeRole) {
                    return res.status(403).json({ message: "Branch Admins cannot assign Head Office or Super Admin roles." });
                }
            }
        }

        const user = await userService.createUser(transformed);

        // Send Account Setup Email
        try {
            const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
            const setupUrl = `${clientUrl}/setup-account?token=${setupToken}`;
            console.log('--- ACCOUNT SETUP LINK (DEV) ---');
            console.log(setupUrl);
            console.log('-------------------------------');
            await sendAccountSetupEmail(user.email, setupUrl);
        } catch (emailError) {
            console.error("Failed to send setup email:", emailError);
        }

        if (req.user) {
            await auditService.logAction({
                userId: req.user.id,
                action: 'USER_CREATE',
                resource: 'User',
                after: { id: user._id, email: user.email },
                ip: req.ip
            });
        }

        res.status(201).json(formatUserResponse(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all users
export const getUsers = async (req, res) => {
    try {
        const query = req.dataScope || {};
        const users = await userService.getAllUsers(query);
        res.json(users.map(formatUserResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get user by ID
export const getUserById = async (req, res) => {
    try {
        const user = await userService.getUserById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(formatUserResponse(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update user
export const updateUser = async (req, res) => {
    try {
        const transformed = transformUserInput(req.body);
        if (req.file) {
            transformed.profileImage = req.file;
        }
        // Validation for update can be partial or stricter depending on needs.
        // For now allowing partial updates without strict validation of all fields.

        // Get 'before' state for audit logging
        const beforeUser = await userService.getUserById(req.params.id);
        if (!beforeUser) return res.status(404).json({ message: 'User not found' });

        // Access Control: Branch Admin restrictions on update
        const isBranchAdmin = req.user.accessLevel === 'branch_admin' ||
            (req.user.roles && req.user.roles.some(r => ['Branch Admin', 'branch_admin'].includes(r.name)));

        const isSuperAdmin = req.user.accessLevel === 'super_admin' ||
            (req.user.roles && req.user.roles.some(r => ['Super Admin', 'super_admin', 'superadmin'].includes(r.name)));

        if (isBranchAdmin && !isSuperAdmin) {
            const userOrgId = req.user.organization?._id || req.user.organization;

            // 1. Prevent changing organization to other branches
            if (transformed.organization && String(transformed.organization) !== String(userOrgId)) {
                return res.status(403).json({ message: "Branch Admins cannot assign users to other branches." });
            }

            // 2. Prevent setting organizationType to head_office
            if (transformed.organizationType === 'head_office') {
                return res.status(403).json({ message: "Branch Admins cannot set organization type to Head Office." });
            }

            // 3. Prevent setting accessLevel to super_admin or head office manager
            if (transformed.accessLevel === 'super_admin' || (transformed.accessLevel === 'manager' && transformed.organizationType === 'head_office')) {
                return res.status(403).json({ message: "Branch Admins cannot grant Super Admin or Head Office manager access." });
            }

            // 4. Prevent assigning Head Office / Super Admin roles
            if (transformed.roles && transformed.roles.length > 0) {
                const Role = (await import('../models/Role.js')).default;
                const assignedRoles = await Role.find({ _id: { $in: transformed.roles } });
                const hasHeadOfficeRole = assignedRoles.some(role =>
                    ['super admin', 'superadmin', 'head office', 'head_office'].includes(role.name.toLowerCase()) || role.type === 'head_office'
                );
                if (hasHeadOfficeRole) {
                    return res.status(403).json({ message: "Branch Admins cannot assign Head Office or Super Admin roles." });
                }
            }
        }

        const user = await userService.updateUserById(req.params.id, transformed);

        if (req.user) {
            const beforeFormatted = formatUserResponse(beforeUser);
            const afterFormatted = formatUserResponse(user);

            console.log('Audit Log Debug - Before:', JSON.stringify(beforeFormatted, null, 2));
            console.log('Audit Log Debug - After:', JSON.stringify(afterFormatted, null, 2));

            await auditService.logAction({
                userId: req.user.id,
                action: 'USER_UPDATE',
                resource: 'User',
                before: beforeFormatted,
                after: afterFormatted,
                ip: req.ip
            });
        }

        res.json(formatUserResponse(user));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    try {
        const user = await userService.deleteUserById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (req.user) {
            await auditService.logAction({
                userId: req.user.id,
                action: 'USER_DELETE',
                resource: 'User',
                before: { id: user._id, email: user.email },
                ip: req.ip
            });
        }

        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
