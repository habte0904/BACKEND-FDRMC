import User from '../models/User.js';
import DelegationLog from '../models/DelegationLog.js';

// Hierarchy levels for comparison
const HIERARCHY_LEVELS = {
    super_admin: 100,
    manager: 90,
    deputy: 80,
    branch_admin: 75,
    directorate: 60,
    team_leader: 40,
    expert: 20
};

/**
 * Delegate authority from one user to another
 */
export const delegateAuthority = async (delegatorId, delegateeId, authority, reason, endDate) => {
    const delegator = await User.findById(delegatorId);
    const delegatee = await User.findById(delegateeId);

    if (!delegator || !delegatee) {
        throw new Error('Delegator or delegatee not found');
    }

    // Validate delegation is allowed
    if (!canDelegate(delegator, delegatee)) {
        throw new Error(`Cannot delegate: ${delegator.accessLevel} cannot delegate to ${delegatee.accessLevel}`);
    }

    // Update delegatee
    delegatee.delegatedBy = delegatorId;
    delegatee.delegatedAuthority = {
        ...authority,
        expiresAt: endDate
    };
    await delegatee.save();

    // Log delegation
    const log = new DelegationLog({
        delegator: delegatorId,
        delegatee: delegateeId,
        authority,
        reason,
        endDate,
        status: 'active'
    });
    await log.save();

    return { delegatee, log };
};

/**
 * Revoke delegation
 */
export const revokeDelegation = async (delegatorId, delegateeId) => {
    const delegatee = await User.findById(delegateeId);

    if (!delegatee) {
        throw new Error('Delegatee not found');
    }

    // Clear delegation
    delegatee.delegatedBy = null;
    delegatee.delegatedAuthority = {
        canManageTeams: false,
        canManageDepartments: false,
        canApproveReports: false
    };
    await delegatee.save();

    // Update log
    await DelegationLog.updateMany(
        { delegator: delegatorId, delegatee: delegateeId, status: 'active' },
        {
            status: 'revoked',
            revokedAt: new Date(),
            revokedBy: delegatorId
        }
    );

    return delegatee;
};

/**
 * Get all subordinates for a user
 */
export const getSubordinates = async (userId) => {
    const user = await User.findById(userId)
        .populate('organization')
        .populate('department')
        .populate('managedDepartments')
        .populate('managedTeams');

    if (!user) {
        throw new Error('User not found');
    }

    let subordinates = [];

    switch (user.accessLevel) {
        case 'super_admin':
            // Can see all users
            subordinates = await User.find({})
                .populate('organization')
                .populate('department')
                .populate('team');
            break;

        case 'manager':
            if (user.organizationType === 'head_office') {
                // Can see all users
                subordinates = await User.find({})
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            } else {
                // Branch manager - only branch users
                subordinates = await User.find({ organization: user.organization._id })
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            }
            break;

        case 'deputy':
            // Can see users in managed departments
            if (user.managedDepartments && user.managedDepartments.length > 0) {
                subordinates = await User.find({
                    department: { $in: user.managedDepartments.map(d => d._id) }
                })
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            }
            break;

        case 'branch_admin':
            // Can see all users in their branch
            subordinates = await User.find({ organization: user.organization._id })
                .populate('organization')
                .populate('department')
                .populate('team');
            break;

        case 'directorate':
            // Can see users in managed departments or own department
            if (user.managedDepartments && user.managedDepartments.length > 0) {
                subordinates = await User.find({
                    department: { $in: user.managedDepartments.map(d => d._id) }
                })
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            } else if (user.department) {
                subordinates = await User.find({ department: user.department._id })
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            }
            break;

        case 'team_leader':
            // Can see team members
            if (user.managedTeams && user.managedTeams.length > 0) {
                subordinates = await User.find({
                    team: { $in: user.managedTeams.map(t => t._id) }
                })
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            } else if (user.team) {
                subordinates = await User.find({ team: user.team._id })
                    .populate('organization')
                    .populate('department')
                    .populate('team');
            }
            break;

        case 'expert':
            // No subordinates
            subordinates = [];
            break;
    }

    return subordinates;
};

/**
 * Get delegation history for a user
 */
export const getDelegationHistory = async (userId) => {
    const delegatedBy = await DelegationLog.find({ delegator: userId })
        .populate('delegatee', 'fullname email accessLevel')
        .sort({ createdAt: -1 });

    const delegatedTo = await DelegationLog.find({ delegatee: userId })
        .populate('delegator', 'fullname email accessLevel')
        .sort({ createdAt: -1 });

    return { delegatedBy, delegatedTo };
};

/**
 * Check if delegation is expired and update status
 */
export const checkExpiredDelegations = async () => {
    const now = new Date();

    // Find expired delegations
    const expiredLogs = await DelegationLog.find({
        status: 'active',
        endDate: { $lt: now }
    });

    // Update users with expired delegations
    for (const log of expiredLogs) {
        const user = await User.findById(log.delegatee);
        if (user && user.delegatedAuthority && user.delegatedAuthority.expiresAt) {
            if (new Date(user.delegatedAuthority.expiresAt) < now) {
                user.delegatedBy = null;
                user.delegatedAuthority = {
                    canManageTeams: false,
                    canManageDepartments: false,
                    canApproveReports: false
                };
                await user.save();
            }
        }

        // Update log status
        log.status = 'expired';
        await log.save();
    }

    return expiredLogs.length;
};

/**
 * Assign reporting relationship
 */
export const assignReportingTo = async (userId, managerId) => {
    const user = await User.findById(userId);
    const manager = await User.findById(managerId);

    if (!user || !manager) {
        throw new Error('User or manager not found');
    }

    // Validate manager has higher hierarchy level
    if (!canDelegate(manager, user)) {
        throw new Error('Manager must have higher hierarchy level');
    }

    user.reportsTo = managerId;
    await user.save();

    return user;
};

/**
 * Helper function to check if delegation is allowed
 */
const canDelegate = (delegator, delegatee) => {
    const delegatorLevel = HIERARCHY_LEVELS[delegator.accessLevel] || 0;
    const delegateeLevel = HIERARCHY_LEVELS[delegatee.accessLevel] || 0;

    // Can only delegate to someone at a lower level
    return delegatorLevel > delegateeLevel;
};

/**
 * Get organizational chart for a user
 */
export const getOrganizationalChart = async (userId) => {
    const user = await User.findById(userId)
        .populate('reportsTo', 'fullname email accessLevel')
        .populate('organization')
        .populate('department');

    if (!user) {
        throw new Error('User not found');
    }

    // Get subordinates
    const subordinates = await getSubordinates(userId);

    // Get peers (same reportsTo)
    let peers = [];
    if (user.reportsTo) {
        peers = await User.find({
            reportsTo: user.reportsTo,
            _id: { $ne: userId }
        })
            .populate('organization')
            .populate('department')
            .select('fullname email accessLevel');
    }

    return {
        user,
        manager: user.reportsTo,
        peers,
        subordinates
    };
};
