import RolePermission from '../models/RolePermission.js';

export const assignPermissionToRole = async (roleId, permissionId) => {
    // Check if already exists to prevent duplicates
    const existing = await RolePermission.findOne({ roleId, permissionId });
    if (existing) return existing;
    return await RolePermission.create({ roleId, permissionId });
};

export const removePermissionFromRole = async (roleId, permissionId) => {
    return await RolePermission.findOneAndDelete({ roleId, permissionId });
};

export const getPermissionsByRole = async (roleId) => {
    return await RolePermission.find({ roleId }).populate('permissionId');
};
