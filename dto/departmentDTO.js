import mongoose from 'mongoose';

export const validateDepartment = (data) => {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Name is required and must be a non-empty string.');
    }

    if (!data.organizationId || !mongoose.Types.ObjectId.isValid(data.organizationId)) {
        errors.push('Valid Organization ID is required.');
    }

    // Sector ID is optional (only for head_office organizations)
    if (data.sectorId && !mongoose.Types.ObjectId.isValid(data.sectorId)) {
        errors.push('Valid Sector ID is required when sector is specified.');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const transformDepartmentInput = (data) => {
    return {
        name: data.name ? data.name.trim() : data.name,
        organizationId: data.organizationId,
        sectorId: data.sectorId || null,
        description: data.description?.trim() || '',
        status: data.status || 'active'
    };
};

export const formatDepartmentResponse = (department) => {
    if (!department) return null;
    return {
        id: department._id,
        name: department.name,
        organizationId: department.organizationId && department.organizationId._id
            ? department.organizationId._id
            : department.organizationId,
        organization: department.organizationId?.name ? {
            id: department.organizationId._id,
            name: department.organizationId.name,
            type: department.organizationId.type
        } : undefined,
        sectorId: department.sectorId && department.sectorId._id
            ? department.sectorId._id
            : department.sectorId,
        sector: department.sectorId?.name ? {
            id: department.sectorId._id,
            name: department.sectorId.name
        } : undefined,
        description: department.description,
        status: department.status,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt
    };
};
