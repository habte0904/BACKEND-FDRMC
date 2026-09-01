import Template from '../models/Template.js';
import FormResponse from '../models/FormResponse.js';
import * as auditService from '../services/auditService.js';

// @desc    Get all templates
// @route   GET /api/templates
export const getTemplates = async (req, res) => {
    try {
        const { category, status, search } = req.query;
        let query = {};

        // If unauthenticated public request, restrict to Published active templates
        if (!req.user) {
            query = { isDeleted: false, status: 'Published' };
        } else if (status === 'Archived') {
            // Include both "Archived" status and soft-deleted templates
            query = {
                $or: [
                    { status: 'Archived' },
                    { isDeleted: true }
                ]
            };
        } else {
            // Default: show only active ones
            query = { isDeleted: false };
            if (status) query.status = status;
        }

        if (category) query.category = category;
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const templates = await Template.find(query).sort({ updatedAt: -1 }).populate('createdBy', 'fullname');
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single template by ID
// @route   GET /api/templates/:id
export const getTemplateById = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id).populate('createdBy', 'fullname');
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }
        // If unauthenticated, only allow viewing published active templates
        if (!req.user && (template.isDeleted || template.status !== 'Published')) {
            return res.status(403).json({ message: 'Template is not published' });
        }
        res.json(template);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new template draft
// @route   POST /api/templates
export const createTemplate = async (req, res) => {
    try {
        const { name, category, moduleType, modules, description } = req.body;

        // Check if a template with same moduleType and version exists (though for new it starts at 1)
        const existing = await Template.findOne({ moduleType, version: 1 });
        if (existing) {
            // Maybe allow multiple if name is different, but moduleType usually implies a unique kind
        }

        const template = new Template({
            name,
            category,
            moduleType,
            modules: modules || [],
            description,
            status: 'Draft',
            createdBy: req.user?._id // Assuming auth middleware
        });

        const savedTemplate = await template.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_CREATE',
            resource: 'Template',
            resourceId: savedTemplate._id,
            after: savedTemplate,
            ip: req.ip
        });

        res.status(201).json(savedTemplate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update template draft
// @route   PUT /api/templates/:id
export const updateTemplate = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (template.status === 'Published') {
            return res.status(403).json({ message: 'Cannot edit a published template. Create a new version instead.' });
        }

        const before = template.toObject();
        Object.assign(template, req.body);
        const updatedTemplate = await template.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_UPDATE',
            resource: 'Template',
            resourceId: updatedTemplate._id,
            before,
            after: updatedTemplate,
            ip: req.ip
        });

        res.json(updatedTemplate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Publish template (Locks version)
// @route   POST /api/templates/:id/publish
export const publishTemplate = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Set all previous versions to isLatest: false
        await Template.updateMany(
            { moduleType: template.moduleType, _id: { $ne: template._id } },
            { $set: { isLatest: false } }
        );

        template.status = 'Published';
        template.isLatest = true;
        template.publishedAt = new Date();

        const publishedTemplate = await template.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_PUBLISH',
            resource: 'Template',
            resourceId: publishedTemplate._id,
            after: publishedTemplate,
            ip: req.ip
        });

        res.json(publishedTemplate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Revert published template to draft (Unlock)
// @route   POST /api/templates/:id/revert-to-draft
export const revertToDraft = async (req, res) => {
    console.log("Reverting template to draft:", req.params.id);
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            console.log("Template not found for ID:", req.params.id);
            return res.status(404).json({ message: 'Template not found' });
        }

        console.log("Current template status:", template.status);

        if (template.status !== 'Published') {
            return res.status(400).json({ message: `Only published templates can be reverted. Current status: ${template.status}` });
        }

        template.status = 'Draft';
        // Use null instead of undefined to clear the date field explicitly
        template.publishedAt = null;

        const updatedTemplate = await template.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_REVERT',
            resource: 'Template',
            resourceId: updatedTemplate._id,
            after: updatedTemplate,
            ip: req.ip
        });

        console.log("Revert successful for:", updatedTemplate.name);
        res.json(updatedTemplate);
    } catch (error) {
        console.error("Error in revertToDraft:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new version from existing template
// @route   POST /api/templates/:id/new-version
export const createNewVersion = async (req, res) => {
    try {
        const oldTemplate = await Template.findById(req.params.id);
        if (!oldTemplate) {
            return res.status(404).json({ message: 'Template not found' });
        }

        // Find highest version
        const lastTemplate = await Template.findOne({ moduleType: oldTemplate.moduleType })
            .sort({ version: -1 });

        const newTemplate = new Template({
            ...oldTemplate.toObject(),
            _id: undefined,
            version: lastTemplate.version + 1,
            status: 'Draft',
            isLatest: false,
            createdBy: req.user?._id,
            publishedAt: undefined,
            usageCount: 0,
            createdAt: undefined,
            updatedAt: undefined
        });

        const savedTemplate = await newTemplate.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_VERSION_CREATE',
            resource: 'Template',
            resourceId: savedTemplate._id,
            after: savedTemplate,
            ip: req.ip
        });

        res.status(201).json(savedTemplate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Archive template
// @route   DELETE /api/templates/:id
export const archiveTemplate = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ message: 'NotFound' });

        const before = template.toObject();
        template.status = 'Archived';
        template.isDeleted = true;
        template.isLatest = false; // Archived should not be considered "latest" active

        await template.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_ARCHIVE',
            resource: 'Template',
            resourceId: template._id,
            before,
            after: template,
            ip: req.ip
        });

        res.json({ message: 'Template moved to archive', template });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Restore template from archive
// @route   POST /api/templates/:id/restore
export const restoreTemplate = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        const before = template.toObject();
        template.isDeleted = false;
        template.status = 'Draft'; // Default back to draft
        await template.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_RESTORE',
            resource: 'Template',
            resourceId: template._id,
            before,
            after: template,
            ip: req.ip
        });

        res.json({ message: 'Template restored successfully', template });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Permanently delete template
// @route   DELETE /api/templates/:id/permanent
export const deleteTemplatePermanent = async (req, res) => {
    try {
        const template = await Template.findById(req.params.id);
        if (!template) return res.status(404).json({ message: 'Template not found' });

        const before = template.toObject();
        // Ensure it's archived/deleted first before permanent removal? 
        // User's choice, usually yes.
        await Template.findByIdAndDelete(req.params.id);

        await auditService.logAction({
            userId: req.user?._id,
            action: 'TEMPLATE_DELETE_PERMANENT',
            resource: 'Template',
            resourceId: req.params.id,
            before,
            ip: req.ip
        });

        res.json({ message: 'Template permanently deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
