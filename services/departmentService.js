import Department from '../models/Department.js';

export const createDepartment = async (data) => {
    const department = new Department(data);
    return await department.save();
};

export const getAllDepartments = async (scopeFilter = {}) => {
    return await Department.find(scopeFilter)
        .populate('organizationId', 'name type')
        .populate('sectorId', 'name')
        .sort({ name: 1 });
};

export const getDepartmentById = async (id) => {
    return await Department.findById(id)
        .populate('organizationId', 'name type')
        .populate('sectorId', 'name');
};

export const updateDepartment = async (id, data) => {
    return await Department.findByIdAndUpdate(id, data, { new: true })
        .populate('organizationId', 'name type')
        .populate('sectorId', 'name');
};

export const deleteDepartment = async (id) => {
    return await Department.findByIdAndDelete(id)
        .populate('organizationId', 'name type')
        .populate('sectorId', 'name');
};

export const getDepartmentsByOrganization = async (orgId) => {
    return await Department.find({ organizationId: orgId })
        .populate('organizationId', 'name type')
        .populate('sectorId', 'name')
        .sort({ name: 1 });
};

export const getDepartmentsBySector = async (sectorId) => {
    return await Department.find({ sectorId })
        .populate('organizationId', 'name type')
        .populate('sectorId', 'name')
        .sort({ name: 1 });
};
