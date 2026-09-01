// Sector DTO for validation and transformation

export const validateSector = (data) => {
    const errors = [];

    if (!data.name || data.name.trim() === '') {
        errors.push('Sector name is required');
    }

    if (!data.organizationId) {
        errors.push('Organization ID is required');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const transformSectorInput = (data) => {
    return {
        name: data.name?.trim(),
        organizationId: data.organizationId,
        description: data.description?.trim() || '',
        status: data.status || 'active'
    };
};

export const formatSectorResponse = (sector) => {
    if (!sector) return null;

    return {
        id: sector._id,
        name: sector.name,
        organizationId: sector.organizationId,
        organization: sector.organizationId?.name ? {
            id: sector.organizationId._id,
            name: sector.organizationId.name,
            type: sector.organizationId.type
        } : undefined,
        description: sector.description,
        status: sector.status,
        createdAt: sector.createdAt,
        updatedAt: sector.updatedAt
    };
};
