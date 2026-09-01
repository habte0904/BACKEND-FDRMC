import { formatRoleResponse } from './roleDTO.js';
import { formatOrganizationResponse } from './organizationDTO.js';
import { formatDepartmentResponse } from './departmentDTO.js';

// Validate user input for registration
export const validateUser = (data) => {
    const errors = [];
    if (!data.fullname || typeof data.fullname !== 'string' || data.fullname.trim() === '') {
        errors.push('Full name is required.');
    }

    // Simple Email Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
        errors.push('Valid email is required.');
    }

    // Phone validation (numeric, optional length check can be added)
    if (data.phone && !/^\d+$/.test(data.phone)) {
        errors.push('Phone must contain only numbers.');
    }

    // Password validation
    if (data.password && data.password.length < 6) {
        errors.push('Password must be at least 6 characters.');
    }

    return { isValid: errors.length === 0, errors };
};

// Transform user input for registration
export const transformUserInput = (data) => {
    const transformed = {
        ...data,
        fullname: data.fullname?.trim(),
        email: data.email?.trim().toLowerCase(),
        phone: data.phone?.trim() || undefined
    };
    if (transformed.email === "") delete transformed.email;
    if (transformed.phone === "") delete transformed.phone;

    // Handle role/roles mismatch
    if (data.role && !data.roles) {
        transformed.roles = [data.role];
        delete transformed.role;
    } else if (data.roles && !Array.isArray(data.roles)) {
        // Ensure roles is always an array
        transformed.roles = [data.roles];
    }

    // Sanitize ObjectId fields to prevent CastErrors
    ['organization', 'sector', 'department', 'team'].forEach(field => {
        if (transformed[field] === '' || transformed[field] === 'null' || transformed[field] === 'undefined') {
            delete transformed[field];
        }
    });

    return transformed;
};

// Format user response for API
export const formatUserResponse = (user, permissions = []) => {
    if (!user) return null;
    return {
        id: user._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        status: user.status,
        accessLevel: user.accessLevel,
        organizationType: user.organizationType,
        roles: Array.isArray(user.roles) ? user.roles.map(formatRoleResponse) : user.roles,
        organization: formatOrganizationResponse(user.organization),
        sector: user.sector ? { id: user.sector._id, name: user.sector.name } : null,
        department: formatDepartmentResponse(user.department),
        team: user.team ? { id: user.team._id, name: user.team.name } : null,
        permissions: permissions,
        lastLogin: user.lastLogin,
        profileImage: user.profileImage ? `http://localhost:5000/${user.profileImage}` : null,
        createdAt: user.createdAt
    };
};
