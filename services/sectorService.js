import Sector from '../models/Sector.js';

export const createSector = async (sectorData) => {
    const sector = new Sector(sectorData);
    return await sector.save();
};

export const getAllSectors = async (scopeFilter = {}) => {
    return await Sector.find(scopeFilter).populate('organizationId', 'name type').sort({ name: 1 });
};

export const getSectorById = async (id) => {
    return await Sector.findById(id).populate('organizationId', 'name type');
};

export const getSectorsByOrganization = async (organizationId) => {
    return await Sector.find({ organizationId }).populate('organizationId', 'name type').sort({ name: 1 });
};

export const updateSector = async (id, updateData) => {
    return await Sector.findByIdAndUpdate(id, updateData, { new: true }).populate('organizationId', 'name type');
};

export const deleteSector = async (id) => {
    return await Sector.findByIdAndDelete(id).populate('organizationId', 'name type');
};
