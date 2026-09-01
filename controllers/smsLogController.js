import SmsLog from '../models/SmsLog.js';
import { sendSingleSms } from '../services/smppService.js';

// GET /api/sms-logs
export const getSmsLogs = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    if (search) {
      query.$or = [
        { recipientPhone: { $regex: search, $options: 'i' } },
        { recipientName: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
        { senderId: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      SmsLog.countDocuments(query),
      SmsLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('sentBy', 'name email')
        .lean(),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('getSmsLogs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-logs/resend/:id
export const resendSms = async (req, res) => {
  try {
    const log = await SmsLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'SMS log entry not found' });
    }

    const result = await sendSingleSms({
      phone: log.recipientPhone,
      recipientName: log.recipientName,
      message: log.message,
      category: log.category,
      severity: log.severity,
      messageType: log.messageType,
      senderId: log.senderId,
      sentBy: req.user?._id,
    });

    res.json({
      message: result.success ? 'SMS resent successfully' : 'Resend attempt failed',
      result,
    });
  } catch (error) {
    console.error('resendSms error:', error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/sms-logs/:id
export const deleteSmsLog = async (req, res) => {
  try {
    const log = await SmsLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'SMS log not found' });
    }
    res.json({ message: 'SMS log deleted successfully' });
  } catch (error) {
    console.error('deleteSmsLog error:', error);
    res.status(500).json({ message: error.message });
  }
};
