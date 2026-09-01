import express from 'express'; 
import { 
    createSector,
    getSectors,
    getSectorById,
    getSectorsByOrg,
    updateSector,
    deleteSector
} from '../controllers/sectorController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import Sector from '../models/Sector.js';

const router = express.Router();

router.post('/', protect, checkPermission('sector', 'create'), createSector);
router.get('/', protect, checkPermission('sector', 'view'), applyScopeFilter(Sector), getSectors);
router.get('/:id', protect, checkPermission('sector', 'view'), checkDocumentAccess(Sector), getSectorById);
router.get('/organization/:orgId', protect, checkPermission('sector', 'view'), getSectorsByOrg);
router.put('/:id', protect, checkPermission('sector', 'update'), checkDocumentAccess(Sector), updateSector);
router.delete('/:id', protect, checkPermission('sector', 'delete'), checkDocumentAccess(Sector), deleteSector);

export default router;
