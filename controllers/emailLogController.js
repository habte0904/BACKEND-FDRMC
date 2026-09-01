import EmailLog from '../models/EmailLog.js';
import { sendEmail, saveDraft } from '../services/emailService.js';

// @desc    Get all email logs (filtered by folder)
// @route   GET /api/email-logs
export const getEmailLogs = async (req, res) => {
    try {
        const { search, status, type, folder = 'sent' } = req.query;
        let query = { folder };

        if (search) {
            query.$or = [
                { recipient: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ];
        }

        if (status) query.status = status;
        if (type) query.type = type;

        const logs = await EmailLog.find(query)
            .sort({ createdAt: -1 })
            .limit(500);

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Compose manual email (Send or Draft)
// @route   POST /api/email-logs/manual
export const createManualEmail = async (req, res) => {
    try {
        const { to, subject, body, action = 'send' } = req.body;

        if (action === 'draft') {
            const draft = await saveDraft({ to, subject, text: body, type: 'Manual' });
            return res.status(201).json(draft);
        }

        const info = await sendEmail({ to, subject, text: body, type: 'Manual' });
        res.status(201).json({ message: 'Email sent successfully', messageId: info.messageId });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update log status (e.g. read/unread)
// @route   PATCH /api/email-logs/:id/status
export const updateLogStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const log = await EmailLog.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json(log);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Move to folder (Trash/Archive)
export const moveToFolder = async (req, res) => {
    try {
        const { folder } = req.body;
        const log = await EmailLog.findByIdAndUpdate(req.params.id, { folder }, { new: true });
        res.json(log);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Resend or Send from Draft
export const resendEmailLog = async (req, res) => {
    try {
        const log = await EmailLog.findById(req.params.id);
        if (!log) return res.status(404).json({ message: 'Email log not found' });

        await sendEmail({
            to: log.recipient,
            subject: log.folder === 'draft' ? log.subject : `[Retry #${log.retryCount + 1}] ${log.subject}`,
            text: log.body,
            type: log.type
        });

        if (log.folder === 'draft') {
            log.folder = 'sent';
            log.status = 'sent';
        } else {
            log.retryCount += 1;
        }
        await log.save();

        res.json({ message: 'Success' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete logs older than 30 days
// @route   DELETE /api/email-logs
export const deleteOldEmailLogs = async (req, res) => {
    try {
        const days = 30;
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - days);

        const result = await EmailLog.deleteMany({
            createdAt: { $lt: dateLimit }
        });

        res.json({ message: `${result.deletedCount} old logs purged successfully` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
