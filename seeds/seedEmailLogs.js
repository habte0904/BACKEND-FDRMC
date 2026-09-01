import mongoose from 'mongoose';
import dotenv from 'dotenv';
import EmailLog from '../models/EmailLog.js';
import connectDB from '../config/db.js';

dotenv.config();

const seedEmailLogs = async () => {
    try {
        await connectDB();

        // Clear existing logs
        await EmailLog.deleteMany({});

        const logs = [
            // SENT FOLDER
            {
                recipient: 'admin@idrmis.gov.et',
                subject: 'High-Level Deployment Protocol initiated',
                body: 'Deployment of relief modules to Woreda 502 has been successfully transmitted via secondary satellite link.',
                type: 'Alert',
                status: 'sent',
                folder: 'sent',
                retryCount: 0
            },
            {
                recipient: 'director@drm.gov.et',
                subject: 'Quarterly Risk Assessment PDF Ready',
                body: 'Director, the risk assessment for the Addis region is attached to your dashboard portal.',
                type: 'Other',
                status: 'sent',
                folder: 'sent',
                retryCount: 0
            },
            // INBOX FOLDER (Incoming Signals)
            {
                recipient: 'system@idrmis.gov.et',
                subject: 'RE: Verification Code Problem',
                body: 'I am not receiving the verification code on my mobile terminal. Please assist.',
                type: 'Other',
                status: 'unread',
                folder: 'inbox'
            },
            {
                recipient: 'helpdesk@idrmis.gov.et',
                subject: 'User Registration Request - Ambo Woreda',
                body: 'We need access for 5 additional field enumerators for the upcoming drought survey.',
                type: 'AccountSetup',
                status: 'read',
                folder: 'inbox'
            },
            // DRAFT FOLDER (Unfinished Missions)
            {
                recipient: 'field-op-alpha@relief.net',
                subject: '[DRAFT] Emergency Rerouting Instructions',
                body: 'Due to flood warnings in Sector 7, please reroute the supply convoy through the highland pass.',
                type: 'Alert',
                status: 'pending',
                folder: 'draft'
            },
            // TRASH FOLDER (Decommissioned)
            {
                recipient: 'test-user@null.com',
                subject: 'Decommissioned Test Packet',
                body: 'This is a test message that has been discarded.',
                type: 'Other',
                status: 'failed',
                folder: 'trash',
                error: 'Manual deletion by administrator'
            }
        ];

        await EmailLog.insertMany(logs);
        console.log('Advanced communication trails seeded successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding advanced email logs:', error);
        process.exit(1);
    }
};

seedEmailLogs();
