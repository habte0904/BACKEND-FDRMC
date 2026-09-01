
export const validatePermission = (data) => {
    const errors = [];
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') errors.push('Name is required');
    if (!data.resource || typeof data.resource !== 'string' || data.resource.trim() === '') errors.push('Resource is required');
    if (!data.action || typeof data.action !== 'string' || data.action.trim() === '') errors.push('Action is required');

    return { isValid: errors.length === 0, errors };
};

export const transformPermissionInput = (data) => {
    return {
        ...data,
        name: data.name?.trim(),
        resource: data.resource?.trim(),
        action: data.action?.trim()
    };
};

export const formatPermissionResponse = (permission) => {
    if (!permission) return null;
    return {
        id: permission._id,
        name: permission.name,
        resource: permission.resource,
        action: permission.action
    };
};
