import Team from '../models/Team.js';
import User from '../models/User.js';
import Department from '../models/Department.js';

/**
 * Create a new team
 */
export const createTeam = async (teamData, creatorId) => {
    const creator = await User.findById(creatorId);

    if (!creator) {
        throw new Error('Creator not found');
    }

    // Validate creator has authority to create teams
    const allowedLevels = ['super_admin', 'manager', 'deputy', 'directorate', 'branch_admin'];
    if (!allowedLevels.includes(creator.accessLevel)) {
        throw new Error('Insufficient authority to create teams');
    }

    // Validate department exists
    const department = await Department.findById(teamData.department);
    if (!department) {
        throw new Error('Department not found');
    }

    // Access Control: Branch Admin restriction
    const isBranchAdmin = creator.accessLevel === 'branch_admin' ||
        (creator.roles && creator.roles.some(r => ['Branch Admin', 'branch_admin'].includes(r.name)));

    const isSuperAdmin = creator.accessLevel === 'super_admin' ||
        (creator.roles && creator.roles.some(r => ['Super Admin', 'super_admin', 'superadmin'].includes(r.name)));

    if (isBranchAdmin && !isSuperAdmin) {
        const creatorOrgId = creator.organization?._id || creator.organization;
        if (department.organizationId.toString() !== String(creatorOrgId)) {
            throw new Error('Branch Admins can only create teams for departments in their own branch');
        }
    }

    const team = new Team({
        ...teamData,
        organization: department.organizationId
    });

    await team.save();

    return team;
};

/**
 * Get all teams with optional filtering
 */
export const getTeams = async (filter = {}) => {
    const teams = await Team.find({ ...filter, status: 'active' })
        .populate('department')
        .populate('organization')
        .populate('teamLeader', 'fullname email accessLevel')
        .populate('members', 'fullname email accessLevel');

    return teams;
};

/**
 * Get team by ID
 */
export const getTeamById = async (teamId) => {
    const team = await Team.findById(teamId)
        .populate('department')
        .populate('organization')
        .populate('teamLeader', 'fullname email phone accessLevel')
        .populate('members', 'fullname email phone accessLevel');

    if (!team) {
        throw new Error('Team not found');
    }

    return team;
};

/**
 * Assign team leader
 */
export const assignTeamLeader = async (teamId, userId) => {
    const team = await Team.findById(teamId);
    const user = await User.findById(userId);

    if (!team) {
        throw new Error('Team not found');
    }

    if (!user) {
        throw new Error('User not found');
    }

    if (user.accessLevel !== 'team_leader') {
        throw new Error('User must have team_leader access level');
    }

    // Remove previous team leader from managedTeams
    if (team.teamLeader) {
        const previousLeader = await User.findById(team.teamLeader);
        if (previousLeader) {
            previousLeader.managedTeams = previousLeader.managedTeams.filter(
                t => !t.equals(teamId)
            );
            await previousLeader.save();
        }
    }

    // Assign new team leader
    team.teamLeader = userId;
    await team.save();

    // Update user's managed teams
    if (!user.managedTeams) {
        user.managedTeams = [];
    }
    if (!user.managedTeams.includes(teamId)) {
        user.managedTeams.push(teamId);
    }
    user.team = teamId;
    await user.save();

    return { team, user };
};

/**
 * Add member to team
 */
export const addTeamMember = async (teamId, userId) => {
    const team = await Team.findById(teamId);
    const user = await User.findById(userId);

    if (!team) {
        throw new Error('Team not found');
    }

    if (!user) {
        throw new Error('User not found');
    }

    // Add to team members if not already there
    if (!team.members.includes(userId)) {
        team.members.push(userId);
        await team.save();
    }

    // Update user's team
    user.team = teamId;
    await user.save();

    return { team, user };
};

/**
 * Remove member from team
 */
export const removeTeamMember = async (teamId, userId) => {
    const team = await Team.findById(teamId);
    const user = await User.findById(userId);

    if (!team) {
        throw new Error('Team not found');
    }

    if (!user) {
        throw new Error('User not found');
    }

    // Remove from team members
    team.members = team.members.filter(memberId => !memberId.equals(userId));
    await team.save();

    // Clear user's team if it matches
    if (user.team && user.team.equals(teamId)) {
        user.team = null;
        await user.save();
    }

    return { team, user };
};

/**
 * Update team
 */
export const updateTeam = async (teamId, updateData) => {
    const team = await Team.findById(teamId);

    if (!team) {
        throw new Error('Team not found');
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'status'];
    allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
            team[field] = updateData[field];
        }
    });

    await team.save();

    return team;
};

/**
 * Delete team (soft delete)
 */
export const deleteTeam = async (teamId) => {
    const team = await Team.findById(teamId);

    if (!team) {
        throw new Error('Team not found');
    }

    // Soft delete
    team.status = 'inactive';
    await team.save();

    // Clear team from all members
    await User.updateMany(
        { team: teamId },
        { $unset: { team: 1 } }
    );

    // Clear from managed teams
    await User.updateMany(
        { managedTeams: teamId },
        { $pull: { managedTeams: teamId } }
    );

    return team;
};

/**
 * Get teams for a specific department
 */
export const getTeamsByDepartment = async (departmentId) => {
    const teams = await Team.find({
        department: departmentId,
        status: 'active'
    })
        .populate('teamLeader', 'fullname email')
        .populate('members', 'fullname email');

    return teams;
};

/**
 * Get teams for a specific organization
 */
export const getTeamsByOrganization = async (organizationId) => {
    const teams = await Team.find({
        organization: organizationId,
        status: 'active'
    })
        .populate('department')
        .populate('teamLeader', 'fullname email')
        .populate('members', 'fullname email');

    return teams;
};

/**
 * Get team statistics
 */
export const getTeamStats = async (teamId) => {
    const team = await Team.findById(teamId)
        .populate('members');

    if (!team) {
        throw new Error('Team not found');
    }

    return {
        totalMembers: team.members.length,
        hasLeader: !!team.teamLeader,
        status: team.status,
        createdAt: team.createdAt
    };
};
