import * as teamService from '../services/teamService.js';
import * as auditService from '../services/auditService.js';

/**
 * Create a new team
 */
export const createTeam = async (req, res) => {
    try {
        const teamData = req.body;

        if (!teamData.name || !teamData.department) {
            return res.status(400).json({
                message: 'Team name and department are required'
            });
        }

        // Access Control: Branch Admin restriction
        const isBranchAdmin = req.user.accessLevel === 'branch_admin' ||
            (req.user.roles && req.user.roles.some(r => ['Branch Admin', 'branch_admin'].includes(r.name)));

        const isSuperAdmin = req.user.accessLevel === 'super_admin' ||
            (req.user.roles && req.user.roles.some(r => ['Super Admin', 'super_admin', 'superadmin'].includes(r.name)));

        if (isBranchAdmin && !isSuperAdmin) {
            const userOrgId = req.user.organization?._id || req.user.organization;
            if (teamData.organization && String(teamData.organization) !== String(userOrgId)) {
                return res.status(403).json({ message: "Branch Admins can only create teams for their own branch." });
            }
            teamData.organization = userOrgId;
        }

        const team = await teamService.createTeam(teamData, req.user.id);

        await auditService.logAction({
            userId: req.user.id,
            action: 'TEAM_CREATE',
            resource: 'Team',
            after: team,
            ip: req.ip
        });

        res.status(201).json({
            message: 'Team created successfully',
            data: team
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Get all teams (with scope filtering)
 */
export const getTeams = async (req, res) => {
    try {
        const teams = await teamService.getTeams(req.dataScope || {});

        res.status(200).json({
            count: teams.length,
            data: teams
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get team by ID
 */
export const getTeamById = async (req, res) => {
    try {
        const { teamId } = req.params;
        const team = await teamService.getTeamById(teamId);

        res.status(200).json({
            data: team
        });
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

/**
 * Update team
 */
export const updateTeam = async (req, res) => {
    try {
        const { teamId } = req.params;
        const updateData = req.body;

        const team = await teamService.updateTeam(teamId, updateData);

        await auditService.logAction({
            userId: req.user.id,
            action: 'TEAM_UPDATE',
            resource: 'Team',
            after: team,
            ip: req.ip
        });

        res.status(200).json({
            message: 'Team updated successfully',
            data: team
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Delete team
 */
export const deleteTeam = async (req, res) => {
    try {
        const { teamId } = req.params;

        const team = await teamService.deleteTeam(teamId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'TEAM_DELETE',
            resource: 'Team',
            before: team,
            ip: req.ip
        });

        res.status(200).json({
            message: 'Team deleted successfully',
            data: team
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Assign team leader
 */
export const assignTeamLeader = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const result = await teamService.assignTeamLeader(teamId, userId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'TEAM_LEADER_ASSIGN',
            resource: 'Team',
            after: { teamId, leaderId: userId },
            ip: req.ip
        });

        res.status(200).json({
            message: 'Team leader assigned successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Add team member
 */
export const addTeamMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const result = await teamService.addTeamMember(teamId, userId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'TEAM_MEMBER_ADD',
            resource: 'Team',
            after: { teamId, memberId: userId },
            ip: req.ip
        });

        res.status(200).json({
            message: 'Team member added successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Remove team member
 */
export const removeTeamMember = async (req, res) => {
    try {
        const { teamId, userId } = req.params;

        const result = await teamService.removeTeamMember(teamId, userId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'TEAM_MEMBER_REMOVE',
            resource: 'Team',
            before: { teamId, memberId: userId },
            ip: req.ip
        });

        res.status(200).json({
            message: 'Team member removed successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Get teams by department
 */
export const getTeamsByDepartment = async (req, res) => {
    try {
        const { departmentId } = req.params;

        const teams = await teamService.getTeamsByDepartment(departmentId);

        res.status(200).json({
            count: teams.length,
            data: teams
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get teams by organization
 */
export const getTeamsByOrganization = async (req, res) => {
    try {
        const { organizationId } = req.params;

        const teams = await teamService.getTeamsByOrganization(organizationId);

        res.status(200).json({
            count: teams.length,
            data: teams
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get team statistics
 */
export const getTeamStats = async (req, res) => {
    try {
        const { teamId } = req.params;

        const stats = await teamService.getTeamStats(teamId);

        res.status(200).json({
            data: stats
        });
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};
