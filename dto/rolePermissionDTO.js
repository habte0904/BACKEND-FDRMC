import mongoose from 'mongoose';

export const validateRolePermission = (data) => {
    const errors = [];
    if (!data.roleId || !mongoose.Types.ObjectId.isValid(data.roleId)) {
        errors.push('Valid Role ID is required.');
    }
    if (!data.permissionId || !mongoose.Types.ObjectId.isValid(data.permissionId)) {
        errors.push('Valid Permission ID is required.');
    }
    return { isValid: errors.length === 0, errors };
};
