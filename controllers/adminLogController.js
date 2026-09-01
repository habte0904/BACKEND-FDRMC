import AdminLog from '../models/AdminLog.js';

export const getAdminLogs = async (req, res) => {
    try {
        const { resource, action, severity, userId } = req.query;
        let query = {};
        
        if (resource) query.resource = resource;
        if (action) query.action = action;
        if (severity) query.severity = severity;
        if (userId) query.userId = userId;

        const logs = await AdminLog.find(query)
            .populate('userId', 'fullname username email')
            .sort({ timestamp: -1 })
            .limit(1000); // Protection against massive data loads
            
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const clearOldAdminLogs = async (req, res) => {
    try {
        // Retention policy: 90 days? 
        const date = new Date();
        date.setDate(date.getDate() - 90);
        await AdminLog.deleteMany({ timestamp: { $lt: date } });
        res.json({ message: 'Old admin logs cleared' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
