import Organization from '../models/Organization.js';

export const createOrganization = async (data) => {
    const organization = new Organization(data);
    return await organization.save();
};

export const getAllOrganizations = async () => {
    // Populate parentId to show hierarchy details if needed, or keep it simple
    return await Organization.find().populate('parentId', 'name type');
};

export const getOrganizationById = async (id) => {
    return await Organization.findById(id).populate('parentId', 'name type');
};

export const updateOrganization = async (id, data) => {
    return await Organization.findByIdAndUpdate(id, data, { new: true });
};

export const deleteOrganization = async (id) => {
    return await Organization.findByIdAndDelete(id);
};
