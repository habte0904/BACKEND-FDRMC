
export const validateRole = (data) => {
    const errors = [];
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Name is required and must be a non-empty string.');
    }
    return { isValid: errors.length === 0, errors };
};

export const transformRoleInput = (data) => {
    return {
        ...data,
        name: data.name?.trim(),
        type: data.type?.trim().toLowerCase(),
        description: data.description?.trim()
    };
};

export const formatRoleResponse = (role) => {
    if (!role) return null;
    return {
        id: role._id,
        name: role.name,
        type: role.type,
        description: role.description
    };
};
