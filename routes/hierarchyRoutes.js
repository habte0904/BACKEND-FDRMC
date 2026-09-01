import express from 'express';
import * as hierarchyController from '../controllers/hierarchyController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkHierarchyLevel } from '../middleware/hierarchyAuth.js';

const router = express.Router();

// Delegation routes (only for directorate and above)
router.post('/delegate',
    protect,
    checkHierarchyLevel('directorate'),
    hierarchyController.delegateAuthority
);

router.delete('/delegate/:delegateeId',
    protect,
    checkHierarchyLevel('directorate'),
    hierarchyController.revokeDelegation
);

router.get('/delegation-history',
    protect,
    hierarchyController.getDelegationHistory
);

// Subordinates and hierarchy info
router.get('/subordinates',
    protect,
    hierarchyController.getSubordinates
);

router.get('/my-hierarchy',
    protect,
    hierarchyController.getMyHierarchy
);

router.get('/organizational-chart',
    protect,
    hierarchyController.getOrganizationalChart
);

router.get('/organizational-chart/:userId',
    protect,
    hierarchyController.getOrganizationalChart
);

// Reporting relationships (manager and above)
router.post('/assign-reporting',
    protect,
    checkHierarchyLevel('manager'),
    hierarchyController.assignReportingTo
);

// Admin route to check expired delegations
router.post('/check-expired-delegations',
    protect,
    checkHierarchyLevel('super_admin'),
    hierarchyController.checkExpiredDelegations
);

export default router;
