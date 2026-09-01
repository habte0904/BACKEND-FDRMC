import * as hierarchyService from '../services/hierarchyService.js';
import * as auditService from '../services/auditService.js';
import User from '../models/User.js';

/**
 * Delegate authority to another user
 */
export const delegateAuthority = async (req, res) => {
    try {
        const { delegateeId, authority, reason, endDate } = req.body;

        if (!delegateeId || !authority) {
            return res.status(400).json({ message: 'Delegatee ID and authority are required' });
        }

        const result = await hierarchyService.delegateAuthority(
            req.user.id,
            delegateeId,
            authority,
            reason,
            endDate
        );

        await auditService.logAction({
            userId: req.user.id,
            action: 'DELEGATION_CREATE',
            resource: 'Hierarchy',
            after: { delegateeId, authority, reason, endDate },
            ip: req.ip
        });

        res.status(200).json({
            message: 'Authority delegated successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Revoke delegation
 */
export const revokeDelegation = async (req, res) => {
    try {
        const { delegateeId } = req.params;

        if (!delegateeId) {
            return res.status(400).json({ message: 'Delegatee ID is required' });
        }

        const result = await hierarchyService.revokeDelegation(req.user.id, delegateeId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'DELEGATION_REVOKE',
            resource: 'Hierarchy',
            before: { delegateeId },
            ip: req.ip
        });

        res.status(200).json({
            message: 'Delegation revoked successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Get subordinates for current user
 */
export const getSubordinates = async (req, res) => {
    try {
        const subordinates = await hierarchyService.getSubordinates(req.user.id);

        res.status(200).json({
            count: subordinates.length,
            data: subordinates
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get hierarchy information for current user
 */
export const getMyHierarchy = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate('reportsTo', 'fullname email accessLevel')
            .populate('delegatedBy', 'fullname email accessLevel')
            .populate('organization', 'name type')
            .populate('department', 'name')
            .populate('team', 'name')
            .populate('managedDepartments', 'name')
            .populate('managedTeams', 'name');

        const subordinates = await hierarchyService.getSubordinates(req.user.id);

        res.status(200).json({
            user: {
                id: user._id,
                fullname: user.fullname,
                email: user.email,
                accessLevel: user.accessLevel,
                organizationType: user.organizationType,
                organization: user.organization,
                department: user.department,
                team: user.team,
                reportsTo: user.reportsTo,
                delegatedBy: user.delegatedBy,
                delegatedAuthority: user.delegatedAuthority,
                managedDepartments: user.managedDepartments,
                managedTeams: user.managedTeams
            },
            subordinates: subordinates.map(s => ({
                id: s._id,
                fullname: s.fullname,
                email: s.email,
                accessLevel: s.accessLevel,
                organization: s.organization,
                department: s.department,
                team: s.team
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get delegation history
 */
export const getDelegationHistory = async (req, res) => {
    try {
        const history = await hierarchyService.getDelegationHistory(req.user.id);

        res.status(200).json({
            delegatedBy: history.delegatedBy,
            delegatedTo: history.delegatedTo
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Assign reporting relationship
 */
export const assignReportingTo = async (req, res) => {
    try {
        const { userId, managerId } = req.body;

        if (!userId || !managerId) {
            return res.status(400).json({ message: 'User ID and Manager ID are required' });
        }

        const result = await hierarchyService.assignReportingTo(userId, managerId);

        await auditService.logAction({
            userId: req.user.id,
            action: 'REPORTING_ASSIGN',
            resource: 'Hierarchy',
            after: { userId, managerId },
            ip: req.ip
        });

        res.status(200).json({
            message: 'Reporting relationship assigned successfully',
            data: result
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

/**
 * Get organizational chart
 */
export const getOrganizationalChart = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUserId = userId || req.user.id;

        const chart = await hierarchyService.getOrganizationalChart(targetUserId);

        res.status(200).json(chart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Check and update expired delegations (admin only)
 */
export const checkExpiredDelegations = async (req, res) => {
    try {
        const count = await hierarchyService.checkExpiredDelegations();

        res.status(200).json({
            message: `Checked and updated ${count} expired delegations`,
            count
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
