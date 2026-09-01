export const validateOrganization = (data) => {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Name is required and must be a non-empty string.');
    }

    if (!data.type || typeof data.type !== 'string' || data.type.trim() === '') {
        errors.push('Type is required (head_office | branch | subcity | woreda).');
    }

    // Optional: Validate type against allowed values if needed strictly
    const allowedTypes = ['head_office', 'branch', 'subcity', 'woreda'];
    if (data.type && !allowedTypes.includes(data.type)) {
        errors.push(`Type must be one of: ${allowedTypes.join(', ')}`);
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

export const transformOrganizationInput = (data) => {
    return {
        ...data,
        name: data.name ? data.name.trim() : data.name,
        type: data.type ? data.type.trim().toLowerCase() : data.type
    };
};

export const formatOrganizationResponse = (organization) => {
    if (!organization) return null;
    return {
        id: organization._id,
        name: organization.name,
        type: organization.type,
        parentId: organization.parentId
    };
};
