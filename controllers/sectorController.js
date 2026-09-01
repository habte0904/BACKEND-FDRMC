import * as sectorService from '../services/sectorService.js';
import * as auditService from '../services/auditService.js';
import { validateSector, transformSectorInput, formatSectorResponse } from '../dto/sectorDTO.js';

export const createSector = async (req, res) => {
    try {
        console.log('Creating sector with data:', req.body);

        const transformed = transformSectorInput(req.body);
        console.log('Transformed data:', transformed);

        const validation = validateSector(transformed);
        console.log('Validation result:', validation);

        if (!validation.isValid) {
            console.log('Validation failed:', validation.errors);
            return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
        }

        const sector = await sectorService.createSector(transformed);
        console.log('Sector created successfully:', sector);

        await auditService.logAction({
            userId: req.user.id,
            action: 'SECTOR_CREATE',
            resource: 'Sector',
            after: formatSectorResponse(sector),
            ip: req.ip
        });

        res.status(201).json(formatSectorResponse(sector));
    } catch (error) {
        console.error('Error creating sector:', error);
        res.status(500).json({ message: error.message });
    }
};

export const getSectors = async (req, res) => {
    try {
        const sectors = await sectorService.getAllSectors(req.dataScope || {});
        res.json(sectors.map(formatSectorResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getSectorById = async (req, res) => {
    try {
        const sector = await sectorService.getSectorById(req.params.id);
        if (!sector) return res.status(404).json({ message: 'Sector not found' });
        res.json(formatSectorResponse(sector));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getSectorsByOrg = async (req, res) => {
    try {
        const sectors = await sectorService.getSectorsByOrganization(req.params.orgId);
        res.json(sectors.map(formatSectorResponse));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateSector = async (req, res) => {
    try {
        const transformed = transformSectorInput(req.body);

        // Get before state for audit
        const beforeSector = await sectorService.getSectorById(req.params.id);
        if (!beforeSector) return res.status(404).json({ message: 'Sector not found' });

        const sector = await sectorService.updateSector(req.params.id, transformed);

        await auditService.logAction({
            userId: req.user.id,
            action: 'SECTOR_UPDATE',
            resource: 'Sector',
            before: formatSectorResponse(beforeSector),
            after: formatSectorResponse(sector),
            ip: req.ip
        });

        res.json(formatSectorResponse(sector));
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteSector = async (req, res) => {
    try {
        // Check if any departments are registered with this sector
        const Department = (await import('../models/Department.js')).default;
        const departmentsCount = await Department.countDocuments({ sectorId: req.params.id });

        if (departmentsCount > 0) {
            return res.status(400).json({
                message: `Cannot delete sector. ${departmentsCount} department(s) are registered with this sector. Please reassign or delete the departments first.`
            });
        }

        const sector = await sectorService.deleteSector(req.params.id);
        if (!sector) return res.status(404).json({ message: 'Sector not found' });

        await auditService.logAction({
            userId: req.user.id,
            action: 'SECTOR_DELETE',
            resource: 'Sector',
            before: formatSectorResponse(sector),
            ip: req.ip
        });

        res.json({ message: 'Sector deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
