import AuditLog from '../models/AuditLog.js';
import AdminLog from '../models/AdminLog.js';

// Sensitive keys to be sanitized from logs
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'apiKey', 'auth'];

/**
 * Sanitizes object by removing or masking sensitive data (e.g., passwords)
 * to protect against "fault" (leaking sensitive data or circular references).
 */
const sanitizeData = (data) => {
    if (!data) return data;
    try {
        // Simple clone to avoid mutating the original object or circular refs
        const cloned = JSON.parse(JSON.stringify(data));

        const maskSensitiveValues = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            for (const key in obj) {
                if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
                    obj[key] = '********';
                } else if (typeof obj[key] === 'object') {
                    maskSensitiveValues(obj[key]);
                }
            }
        };

        maskSensitiveValues(cloned);
        return cloned;
    } catch (e) {
        console.warn('Logging: Failed to sanitize data, returning minimal info', e.message);
        return { error: 'Failed to serialize payload' };
    }
};

/**
 * Log Business Audit Actions (Changes to business entities/data)
 */
export const logAuditAction = async ({ userId, action, resource, resourceId, before, after, ipAddress, details, status = 'success', severity = 'low' }) => {
    try {
        const logEntry = new AuditLog({
            userId,
            action,
            resource,
            resourceId,
            before: sanitizeData(before),
            after: sanitizeData(after),
            details: sanitizeData(details),
            ipAddress,
            status,
            severity
        });
        await logEntry.save();
        console.log(`[AUDIT] Action: ${action} on ${resource} id: ${resourceId} | User: ${userId}`);
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Fault tolerance: Admin/User shouldn't be blocked because logging fails
    }
};

/**
 * Log System Admin Actions (Changes to roles, permissions, system config, users)
 */
export const logAdminAction = async ({ userId, action, resource, resourceId, details, ip, severity = 'info' }) => {
    try {
        const logEntry = new AdminLog({
            userId,
            action,
            resource,
            resourceId,
            details: sanitizeData(details),
            ip,
            severity
        });
        await logEntry.save();
        console.log(`[ADMIN] Action: ${action} on ${resource} | User: ${userId}`);
    } catch (error) {
        console.error('Failed to create admin log:', error);
    }
};

// Legacy support for smooth transition
export const logAction = async (payload) => {
    const p = { ...payload };

    // Field mapping for backward compatibility
    if (p.ip && !p.ipAddress) p.ipAddress = p.ip;
    if (p.ipAddress && !p.ip) p.ip = p.ipAddress;

    // Determine if it should be an admin log or audit log based on resource
    const adminResources = ['User', 'Role', 'Permission', 'System', 'Auth', 'Team', 'Sector', 'Department', 'Organization', 'Hierarchy'];

    if (adminResources.some(res => p.resource?.includes(res))) {
        // For admin logs, we map before/after to details if not already present
        if (!p.details && (p.before || p.after)) {
            p.details = { before: p.before, after: p.after };
        }
        return logAdminAction(p);
    } else {
        return logAuditAction(p);
    }
};
