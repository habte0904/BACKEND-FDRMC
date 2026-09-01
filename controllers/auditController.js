import AuditLog from '../models/AuditLog.js';

export const getAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find()
            .populate('userId', 'fullname email')
            .sort({ timestamp: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
