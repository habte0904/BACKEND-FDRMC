import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AuditLog from './models/AuditLog.js';
import AdminLog from './models/AdminLog.js';

dotenv.config();

const checkCounts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const auditCount = await AuditLog.countDocuments();
        const adminCount = await AdminLog.countDocuments();
        
        console.log('--- LOG COUNTS ---');
        console.log('Audit Logs:', auditCount);
        console.log('Admin Logs:', adminCount);

        const latestAudit = await AuditLog.findOne().sort({ timestamp: -1 });
        if (latestAudit) {
            console.log('\n--- LATEST AUDIT LOG ---');
            console.log('Action:', latestAudit.action);
            console.log('Resource:', latestAudit.resource);
            console.log('Timestamp:', latestAudit.timestamp);
        }

        const latestAdmin = await AdminLog.findOne().sort({ timestamp: -1 });
        if (latestAdmin) {
            console.log('\n--- LATEST ADMIN LOG ---');
            console.log('Action:', latestAdmin.action);
            console.log('Resource:', latestAdmin.resource);
            console.log('Timestamp:', latestAdmin.timestamp);
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkCounts();
