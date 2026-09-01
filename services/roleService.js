import Role from '../models/Role.js';

export const createRole = async (data) => {
    return await Role.create(data);
};

export const getAllRoles = async () => {
    return await Role.find();
};

export const getRoleById = async (id) => {
    return await Role.findById(id);
};

export const updateRole = async (id, data) => {
    return await Role.findByIdAndUpdate(id, data, { new: true });
};

export const deleteRole = async (id) => {
    return await Role.findByIdAndDelete(id);
};
