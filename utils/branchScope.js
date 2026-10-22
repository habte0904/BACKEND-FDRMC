import Subcity from '../models/Subcity.js';

/**
 * Resolves user's branch scope and territorial subcity.
 * Super Admins and Head Office managers return isBranch: false (unrestricted city-wide).
 * Branch users return isBranch: true with their assigned subcityName and organizationId.
 */
export const getBranchScope = async (user) => {
    if (!user) {
        return { isBranch: false, subcityName: null, organizationId: null };
    }

    // Resolve organization document if needed
    let orgDoc = null;
    const orgRef = user.organization;
    if (orgRef) {
        if (typeof orgRef === 'object' && (orgRef.name || orgRef.type)) {
            orgDoc = orgRef;
        } else {
            const orgId = orgRef._id || orgRef;
            const Organization = (await import('../models/Organization.js')).default;
            orgDoc = await Organization.findById(orgId).lean();
        }
    }

    // Branch check: if user belongs to a branch organization, they are strictly branch-scoped
    const isBranch = user.organizationType === 'branch' || (orgDoc && orgDoc.type === 'branch');

    if (!isBranch) {
        const isSuperAdmin = user.accessLevel === 'super_admin' ||
            (user.accessLevel === 'manager' && user.organizationType === 'head_office') ||
            (user.roles && user.roles.some(r => {
                const name = (r.name || r).toString().toLowerCase();
                return ['super admin', 'super_admin', 'superadmin'].includes(name);
            }));

        if (isSuperAdmin) {
            return { isBranch: false, subcityName: null, organizationId: null };
        }

        return { isBranch: false, subcityName: null, organizationId: orgDoc?._id || user.organization?._id || user.organization || null };
    }

    let subcityName = null;
    if (orgDoc) {
        if (orgDoc.subcityName) {
            subcityName = orgDoc.subcityName;
        } else if (orgDoc.subcity) {
            if (typeof orgDoc.subcity === 'object' && orgDoc.subcity.name) {
                subcityName = orgDoc.subcity.name;
            } else {
                const subDoc = await Subcity.findById(orgDoc.subcity);
                if (subDoc) subcityName = subDoc.name;
            }
        }
    }

    return {
        isBranch: true,
        subcityName: subcityName ? subcityName.trim() : null,
        organizationId: orgDoc?._id || user.organization?._id || user.organization || null
    };
};

/**
 * Checks if target document or payload belongs to the user's branch jurisdiction.
 * Returns true if allowed, or false with an error message if forbidden.
 */
export const checkBranchPermission = async (user, targetLocationSubcity) => {
    const scope = await getBranchScope(user);
    if (!scope.isBranch || !scope.subcityName) {
        return { allowed: true };
    }

    if (!targetLocationSubcity) {
        return { allowed: false, message: `Access denied: Location subcity is required for branch operations.` };
    }

    const normTarget = targetLocationSubcity.toString().toLowerCase().replace(/\bsub[\s-]?city\b/g, '').trim();
    const normBranch = scope.subcityName.toLowerCase().replace(/\bsub[\s-]?city\b/g, '').trim();

    if (normTarget !== normBranch) {
        return {
            allowed: false,
            message: `Access denied: You can only view, add, update, or delete data within your branch subcity (${scope.subcityName}).`
        };
    }

    return { allowed: true, subcityName: scope.subcityName };
};

/**
 * Builds a regex pattern matching the branch subcity name,
 * accounting for variations like 'Sub City', 'Subcity', and typos like 'yeak'.
 */
export const buildSubcityRegex = (subcityName) => {
    if (!subcityName) return null;
    const clean = subcityName.replace(/\bsub[\s-]?city\b/ig, '').trim();
    if (/^yeka$/i.test(clean)) {
        return new RegExp('(yeka|yeak)', 'i');
    }
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]?');
    return new RegExp(`\\b${escaped}\\b`, 'i');
};

