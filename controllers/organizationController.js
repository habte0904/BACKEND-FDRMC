import * as organizationService from '../services/organizationService.js';
import * as auditService from '../services/auditService.js';
import { validateOrganization, transformOrganizationInput, formatOrganizationResponse } from '../dto/organizationDTO.js';

export const createOrganization = async (req, res) => {
    try {
        const transformedData = transformOrganizationInput(req.body);
        const validation = validateOrganization(transformedData);
        if (!validation.isValid) {
            return res.status(400).json({ message: 'Validation Error', errors: validation.errors });
        }

        const organization = await organizationService.createOrganization(transformedData);

        await auditService.logAction({
            userId: req.user._id || req.user.id,
            action: 'ORGANIZATION_CREATE',
            resource: 'Organization',
            resourceId: organization._id,
            after: organization,
            ip: req.ip || '127.0.0.1'
        });

        res.status(201).json(formatOrganizationResponse(organization));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getOrganizations = async (req, res) => {
    try {
        const organizations = await organizationService.getAllOrganizations();
        res.json(organizations.map(formatOrganizationResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getOrganizationById = async (req, res) => {
    try {
        const organization = await organizationService.getOrganizationById(req.params.id);
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }
        res.json(formatOrganizationResponse(organization));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateOrganization = async (req, res) => {
    try {
        // Transform input even for updates
        const transformedData = transformOrganizationInput(req.body);

        // Get before state for audit
        const beforeOrganization = await organizationService.getOrganizationById(req.params.id);
        if (!beforeOrganization) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        const organization = await organizationService.updateOrganization(req.params.id, transformedData);

        await auditService.logAction({
            userId: req.user.id,
            action: 'ORGANIZATION_UPDATE',
            resource: 'Organization',
            before: formatOrganizationResponse(beforeOrganization),
            after: formatOrganizationResponse(organization),
            ip: req.ip
        });

        res.json(formatOrganizationResponse(organization));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteOrganization = async (req, res) => {
    try {
        // Check if any sectors are registered with this organization
        const Sector = (await import('../models/Sector.js')).default;
        const sectorsCount = await Sector.countDocuments({ organizationId: req.params.id });

        if (sectorsCount > 0) {
            return res.status(400).json({
                message: `Cannot delete organization. ${sectorsCount} sector(s) are registered with this organization. Please delete the sectors first.`
            });
        }

        // Check if any departments are registered with this organization
        const Department = (await import('../models/Department.js')).default;
        const departmentsCount = await Department.countDocuments({ organizationId: req.params.id });

        if (departmentsCount > 0) {
            return res.status(400).json({
                message: `Cannot delete organization. ${departmentsCount} department(s) are registered with this organization. Please delete the departments first.`
            });
        }

        const organization = await organizationService.deleteOrganization(req.params.id);
        if (!organization) {
            return res.status(404).json({ message: 'Organization not found' });
        }

        await auditService.logAction({
            userId: req.user.id,
            action: 'ORGANIZATION_DELETE',
            resource: 'Organization',
            before: organization,
            ip: req.ip
        });

        res.json({ message: 'Organization deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
