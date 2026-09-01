import express from 'express';
import * as teamController from '../controllers/teamController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import { checkHierarchyLevel } from '../middleware/hierarchyAuth.js';
import { applyScopeFilter, checkDocumentAccess } from '../middleware/dataScope.js';
import Team from '../models/Team.js';

const router = express.Router();

router.post('/',
    protect,
    checkPermission('team', 'create'),
    checkHierarchyLevel('directorate'),
    teamController.createTeam
);

router.get('/',
    protect,
    checkPermission('team', 'view'),
    applyScopeFilter(Team),
    teamController.getTeams
);

router.get('/:teamId',
    protect,
    checkPermission('team', 'view'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.getTeamById
);

router.put('/:teamId',
    protect,
    checkPermission('team', 'update'),
    checkHierarchyLevel('directorate'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.updateTeam
);

router.delete('/:teamId',
    protect,
    checkPermission('team', 'delete'),
    checkHierarchyLevel('directorate'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.deleteTeam
);

router.put('/:teamId/leader',
    protect,
    checkPermission('team', 'update'),
    checkHierarchyLevel('directorate'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.assignTeamLeader
);

router.post('/:teamId/members',
    protect,
    checkPermission('team', 'update'),
    checkHierarchyLevel('team_leader'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.addTeamMember
);

router.delete('/:teamId/members/:userId',
    protect,
    checkPermission('team', 'update'),
    checkHierarchyLevel('team_leader'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.removeTeamMember
);

router.get('/department/:departmentId',
    protect,
    checkPermission('team', 'view'),
    teamController.getTeamsByDepartment
);

router.get('/organization/:organizationId',
    protect,
    checkPermission('team', 'view'),
    teamController.getTeamsByOrganization
);

router.get('/:teamId/stats',
    protect,
    checkPermission('team', 'view'),
    checkDocumentAccess(Team, 'teamId'),
    teamController.getTeamStats
);

export default router;
