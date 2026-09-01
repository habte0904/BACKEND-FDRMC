import ProfileMapping from '../models/ProfileMapping.js';
import * as auditService from '../services/auditService.js';

// @desc    Get all mappings
// @route   GET /api/profile-mappings
export const getProfileMappings = async (req, res) => {
    try {
        const mappings = await ProfileMapping.find()
            .populate('createdBy', 'fullname');
        res.json(mappings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get mapping by source
// @route   GET /api/profile-mappings/source/:sourceId
export const getMappingBySource = async (req, res) => {
    try {
        const mapping = await ProfileMapping.findOne({ 
            sourceId: req.params.sourceId, 
            status: 'Published' 
        }).sort({ version: -1 });
        
        if (!mapping) return res.status(404).json({ message: 'Mapping not found' });
        res.json(mapping);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new mapping
// @route   POST /api/profile-mappings
export const createProfileMapping = async (req, res) => {
    try {
        const mapping = new ProfileMapping({
            ...req.body,
            status: 'Draft',
            createdBy: req.user?._id
        });
        const saved = await mapping.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'PROFILE_MAPPING_CREATE',
            resource: 'ProfileMapping',
            resourceId: saved._id,
            after: saved,
            ip: req.ip
        });

        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update mapping
// @route   PUT /api/profile-mappings/:id
export const updateProfileMapping = async (req, res) => {
    try {
        const mapping = await ProfileMapping.findById(req.params.id);
        if (!mapping) return res.status(404).json({ message: 'Mapping not found' });

        const before = mapping.toObject();
        Object.assign(mapping, req.body);
        const updated = await mapping.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'PROFILE_MAPPING_UPDATE',
            resource: 'ProfileMapping',
            resourceId: updated._id,
            before,
            after: updated,
            ip: req.ip
        });

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete mapping (soft delete)
// @route   DELETE /api/profile-mappings/:id
export const deleteProfileMapping = async (req, res) => {
    try {
        const mapping = await ProfileMapping.findById(req.params.id);
        if (!mapping) return res.status(404).json({ message: 'Mapping not found' });
        
        const before = mapping.toObject();
        mapping.status = 'Archived';
        mapping.isActive = false;
        await mapping.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'PROFILE_MAPPING_DEACTIVATE',
            resource: 'ProfileMapping',
            resourceId: mapping._id,
            before,
            ip: req.ip
        });

        res.json({ message: 'Mapping archived successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Permanently delete mapping
// @route   DELETE /api/profile-mappings/:id/permanent
export const permanentlyDeleteProfileMapping = async (req, res) => {
    try {
        const mapping = await ProfileMapping.findById(req.params.id);
        if (!mapping) return res.status(404).json({ message: 'Mapping not found' });
        
        const before = mapping.toObject();
        await ProfileMapping.findByIdAndDelete(req.params.id);

        await auditService.logAction({
            userId: req.user?._id,
            action: 'PROFILE_MAPPING_PERMANENT_DELETE',
            resource: 'ProfileMapping',
            resourceId: req.params.id,
            before,
            ip: req.ip
        });

        res.json({ message: 'Mapping permanently deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
