import EmailLog from '../models/EmailLog.js';
import AlertSubscription from '../models/AlertSubscription.js';
import { sendEmail, sendBatchEmail, saveDraft } from '../services/emailService.js';
import { validateEmailAddress } from '../utils/telecomValidator.js';
import * as auditService from '../services/auditService.js';
import { getBranchScope, buildSubcityRegex } from '../utils/branchScope.js';
import User from '../models/User.js';

// Hazard group mappings (matching AlertSubscription definitions)
const HAZARD_GROUP_CATEGORIES = {
  weather: ['floods', 'heat_wave', 'drought'],
  geo: ['earthquake', 'landslides', 'subsidence_fissures'],
  fire: ['forest_fires', 'structural_fire'],
  env: ['groundwater_pollution', 'lake_water_pollution', 'air_pollution', 'human_epidemics', 'other'],
};

// Helper to filter alert subscribers with valid emails
const getFilteredEmailSubscribers = async ({
  audienceStatus = 'active',
  subscriberCategory = 'all',
  hazardGroup = 'all',
  region = 'all',
  city = 'all',
  subCity = 'all',
  woreda = 'all',
  locationFilter = '',
  emailChannelOnly = false,
}) => {
  const query = {
    'contact.email': { $exists: true, $ne: '' },
  };

  if (audienceStatus && audienceStatus !== 'all') {
    query.status = audienceStatus;
  }

  if (subscriberCategory && subscriberCategory !== 'all') {
    query['preferences.categories'] = subscriberCategory;
  } else if (hazardGroup && hazardGroup !== 'all' && HAZARD_GROUP_CATEGORIES[hazardGroup]) {
    query['preferences.categories'] = { $in: HAZARD_GROUP_CATEGORIES[hazardGroup] };
  }

  if (region && region !== 'all') {
    query['location.region'] = { $regex: new RegExp(`^${region}$`, 'i') };
  }
  if (city && city !== 'all') {
    query['location.city'] = { $regex: new RegExp(`^${city}$`, 'i') };
  }
  if (subCity && subCity !== 'all') {
    query.$or = [
      { 'location.subCity': { $regex: new RegExp(`^${subCity}$`, 'i') } },
      { 'location.subcity': { $regex: new RegExp(`^${subCity}$`, 'i') } },
    ];
  }
  if (woreda && woreda !== 'all') {
    query['location.woreda'] = { $regex: new RegExp(`^${woreda}$`, 'i') };
  }

  if (emailChannelOnly) {
    query['delivery.emailEnabled'] = { $ne: false };
  }

  const subscribers = await AlertSubscription.find(query)
    .select('contact location preferences status delivery')
    .lean();

  if (locationFilter && locationFilter.trim() && locationFilter !== 'all') {
    const term = locationFilter.trim().toLowerCase();
    return subscribers.filter((sub) => {
      const locStr = [
        sub.location?.subCity,
        sub.location?.subcity,
        sub.location?.woreda,
        sub.location?.city,
        sub.location?.region,
        sub.location?.addressLine,
        sub.location?.placeName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return locStr.includes(term);
    });
  }

  return subscribers;
};

// GET /api/email-logs/stats - Aggregate Email statistics & simple report analysis
export const getEmailStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const branchScope = await getBranchScope(user);

    let logQuery = {};
    if (branchScope.isBranch && branchScope.organizationId) {
      const branchUserIds = (await User.find({ organization: branchScope.organizationId }).select('_id')).map(u => u._id);
      logQuery = { $or: [{ organizationId: branchScope.organizationId }, { sentBy: { $in: branchUserIds } }] };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      total,
      sent,
      failed,
      pending,
      read,
      todayCount,
      broadcastBatches,
      categoryStats,
    ] = await Promise.all([
      EmailLog.countDocuments(logQuery),
      EmailLog.countDocuments({ ...logQuery, status: 'sent' }),
      EmailLog.countDocuments({ ...logQuery, status: 'failed' }),
      EmailLog.countDocuments({ ...logQuery, status: 'pending' }),
      EmailLog.countDocuments({ ...logQuery, status: 'read' }),
      EmailLog.countDocuments({ ...logQuery, createdAt: { $gte: startOfToday } }),
      EmailLog.distinct('broadcastBatchId', { ...logQuery, broadcastBatchId: { $ne: '' } }),
      EmailLog.aggregate([
        { $match: logQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    const successTotal = sent + read;
    const deliveryRate = total > 0 ? Math.round((successTotal / total) * 100) : 0;

    res.json({
      total,
      sent,
      failed,
      pending,
      read,
      todayCount,
      totalBatches: broadcastBatches.length,
      deliveryRate,
      categoryBreakdown: categoryStats.map((c) => ({
        category: c._id || 'General',
        count: c.count,
      })),
    });
  } catch (error) {
    console.error('getEmailStats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/email-logs/preview-subscribers - Preview matching email subscribers
export const previewEmailSubscribers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const branchScope = await getBranchScope(user);

    let {
      audienceStatus = 'active',
      subscriberCategory = 'all',
      hazardGroup = 'all',
      region = 'all',
      city = 'all',
      subCity = 'all',
      woreda = 'all',
      locationFilter = '',
      emailChannelOnly = false,
    } = req.body;

    // Branch users can only preview subscribers in their subcity
    if (branchScope.isBranch && branchScope.subcityName) {
      subCity = branchScope.subcityName;
    }

    const subscribers = await getFilteredEmailSubscribers({
      audienceStatus,
      subscriberCategory,
      hazardGroup,
      region,
      city,
      subCity,
      woreda,
      locationFilter,
      emailChannelOnly,
    });

    const validWithEmail = subscribers.filter((s) => Boolean(s.contact?.email));
    const sample = validWithEmail.slice(0, 5).map((s) => ({
      name: s.contact?.fullName || 'Subscriber',
      email: s.contact?.email,
      region: s.location?.region || '',
      city: s.location?.city || '',
      subCity: s.location?.subCity || s.location?.subcity || '',
      woreda: s.location?.woreda || '',
      status: s.status,
    }));

    res.json({
      totalCount: validWithEmail.length,
      sample,
      branchLocked: branchScope.isBranch ? branchScope.subcityName : null,
    });
  } catch (error) {
    console.error('previewEmailSubscribers error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/email-logs/broadcast - Send custom or subscriber broadcast email
export const broadcastEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const branchScope = await getBranchScope(user);
    const userOrgId = user.organization?._id || user.organization || null;

    let {
      emails,
      subject,
      body,
      html,
      category = 'general',
      severity = 'normal',
      audienceType = 'custom', // 'custom' | 'subscribers'
      audienceStatus = 'active',
      subscriberCategory = 'all',
      hazardGroup = 'all',
      region = 'all',
      city = 'all',
      subCity = 'all',
      woreda = 'all',
      locationFilter = '',
      emailChannelOnly = false,
    } = req.body;

    // Branch users can only broadcast to their subcity
    if (branchScope.isBranch && branchScope.subcityName) {
      subCity = branchScope.subcityName;
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: 'Email subject is required.' });
    }
    if (!body && !html) {
      return res.status(400).json({ message: 'Email body content is required.' });
    }

    let recipients = [];

    if (audienceType === 'subscribers') {
      const subscribers = await getFilteredEmailSubscribers({
        audienceStatus,
        subscriberCategory: subscriberCategory !== 'all' ? subscriberCategory : category !== 'all' ? category : 'all',
        hazardGroup,
        region,
        city,
        subCity,
        woreda,
        locationFilter,
        emailChannelOnly,
      });

      const seen = new Set();
      for (const sub of subscribers) {
        const email = sub.contact?.email?.trim().toLowerCase();
        if (email && !seen.has(email)) {
          seen.add(email);
          recipients.push({
            email,
            name: sub.contact?.fullName || '',
          });
        }
      }
    } else {
      let rawList = [];
      if (Array.isArray(emails)) {
        rawList = emails;
      } else if (typeof emails === 'string') {
        rawList = emails.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      }

      const seen = new Set();
      const invalidEmails = [];

      for (const item of rawList) {
        const rawEmail = typeof item === 'string' ? item.trim() : item.email?.trim();
        const name = typeof item === 'object' ? item.name : '';

        const validation = validateEmailAddress(rawEmail);
        if (validation.isValid) {
          if (!seen.has(validation.normalized)) {
            seen.add(validation.normalized);
            recipients.push({ email: validation.normalized, name });
          }
        } else {
          invalidEmails.push(`${rawEmail}: ${validation.error}`);
        }
      }

      if (invalidEmails.length > 0 && recipients.length === 0) {
        return res.status(400).json({
          message: `Invalid email address detected: ${invalidEmails[0]}`,
          errors: invalidEmails,
        });
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'No valid recipient email addresses found.' });
    }

    const broadcastBatchId = `BATCH-EMAIL-${Date.now()}`;

    // For small batches (<= 5), execute synchronously for immediate feedback
    if (recipients.length <= 5) {
      const batchResult = await sendBatchEmail({
        recipients,
        subject: subject.trim(),
        body: body?.trim(),
        html,
        category,
        severity,
        type: 'Alert',
        broadcastBatchId,
        sentBy: req.user?._id || null,
        organizationId: userOrgId,
      });

      await auditService.logAction({
        userId: req.user?._id,
        action: 'EMAIL_BROADCAST_DISPATCH',
        resource: 'EmailLog',
        resourceId: broadcastBatchId,
        after: {
          batchId: broadcastBatchId,
          total: batchResult.total,
          sent: batchResult.sent,
          failed: batchResult.failed,
          category,
          severity,
          audienceType,
        },
        ip: req.ip,
      });

      return res.json({
        success: true,
        isAsync: false,
        message: `Broadcast complete: ${batchResult.sent} sent, ${batchResult.failed} failed out of ${batchResult.total} recipients.`,
        batchId: broadcastBatchId,
        summary: batchResult,
      });
    }

    // For larger broadcast batches, execute in background with TPS rate limiting
    // Prevents HTTP 504 timeouts and enables live WebSocket progress tracking!
    sendBatchEmail({
      recipients,
      subject: subject.trim(),
      body: body?.trim(),
      html,
      category,
      severity,
      type: 'Alert',
      broadcastBatchId,
      sentBy: req.user?._id || null,
      organizationId: userOrgId,
    })
      .then(async (batchResult) => {
        await auditService.logAction({
          userId: req.user?._id,
          action: 'EMAIL_BROADCAST_COMPLETED',
          resource: 'EmailLog',
          resourceId: broadcastBatchId,
          after: {
            batchId: broadcastBatchId,
            total: batchResult.total,
            sent: batchResult.sent,
            failed: batchResult.failed,
          },
          ip: req.ip,
        });
      })
      .catch((err) => {
        console.error(`[EmailService] Background broadcast error on ${broadcastBatchId}:`, err);
      });

    res.json({
      success: true,
      isAsync: true,
      message: `Emergency email broadcast initiated for ${recipients.length} recipients. Messages are actively dispatching in the background with live progress tracking.`,
      batchId: broadcastBatchId,
      totalCount: recipients.length,
    });
  } catch (error) {
    console.error('broadcastEmail error:', error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/email-logs - Filtered logs with pagination
export const getEmailLogs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const branchScope = await getBranchScope(user);

    const {
      search,
      status,
      category,
      type,
      folder = 'sent',
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    let query = {};
    if (folder && folder !== 'all') {
      query.folder = folder;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { recipient: { $regex: term, $options: 'i' } },
        { recipientName: { $regex: term, $options: 'i' } },
        { subject: { $regex: term, $options: 'i' } },
        { body: { $regex: term, $options: 'i' } },
        { broadcastBatchId: { $regex: term, $options: 'i' } },
        { messageId: { $regex: term, $options: 'i' } },
      ];
    }

    // Branch users can only see logs sent by their organization's users
    if (branchScope.isBranch && branchScope.organizationId) {
      const branchUserIds = (await User.find({ organization: branchScope.organizationId }).select('_id')).map(u => u._id);
      const scopeFilter = { $or: [{ organizationId: branchScope.organizationId }, { sentBy: { $in: branchUserIds } }] };
      if (query.$or) {
        query = { $and: [{ $or: query.$or }, scopeFilter, ...Object.entries(query).filter(([k]) => k !== '$or').map(([k, v]) => ({ [k]: v }))] };
      } else {
        Object.assign(query, scopeFilter);
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, logs] = await Promise.all([
      EmailLog.countDocuments(query),
      EmailLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.json({
      logs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      branchLocked: branchScope.isBranch ? branchScope.subcityName : null,
    });
  } catch (error) {
    console.error('getEmailLogs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/email-logs/manual - Compose manual email (Send or Draft)
export const createManualEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const userOrgId = user.organization?._id || user.organization || null;

    const { to, recipientName = '', subject, body, html, category = 'general', severity = 'normal', action = 'send' } = req.body;

    if (action === 'draft') {
      const draft = await saveDraft({ to, subject, text: body, html, type: 'Manual' });
      return res.status(201).json(draft);
    }

    const info = await sendEmail({
      to,
      recipientName,
      subject,
      text: body,
      html,
      type: 'Manual',
      category,
      severity,
      sentBy: req.user?._id || null,
      organizationId: userOrgId,
    });
    res.status(201).json({ message: 'Email sent successfully', messageId: info.messageId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/email-logs/:id/status
export const updateLogStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const log = await EmailLog.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PATCH /api/email-logs/:id/folder
export const moveToFolder = async (req, res) => {
  try {
    const { folder } = req.body;
    const log = await EmailLog.findByIdAndUpdate(req.params.id, { folder }, { new: true });
    res.json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/email-logs/:id/resend - Resend single email
export const resendEmailLog = async (req, res) => {
  try {
    const log = await EmailLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Email log not found' });

    const {
      to = log.recipient,
      recipientName = log.recipientName,
      subject = log.subject,
      body = log.body,
      category = log.category,
      severity = log.severity,
    } = req.body || {};

    const info = await sendEmail({
      to,
      recipientName,
      subject: log.folder === 'draft' ? subject : `[Retry #${(log.retryCount || 0) + 1}] ${subject}`,
      text: body,
      category,
      severity,
      type: log.type || 'Alert',
    });

    if (log.folder === 'draft') {
      log.folder = 'sent';
      log.status = 'sent';
    } else {
      log.retryCount = (log.retryCount || 0) + 1;
      log.status = 'sent';
    }
    log.messageId = info.messageId || log.messageId;
    log.error = '';
    await log.save();

    res.json({ success: true, message: `Email resent successfully to ${to}`, log });
  } catch (error) {
    console.error('resendEmailLog error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/email-logs/bulk-resend - Bulk retry failed emails
export const bulkResendEmailLogs = async (req, res) => {
  try {
    const { ids, allFailed = false } = req.body;
    let query = {};
    if (Array.isArray(ids) && ids.length > 0) {
      query._id = { $in: ids };
    } else if (allFailed) {
      query.status = 'failed';
    } else {
      return res.status(400).json({ message: 'Please provide IDs or allFailed: true' });
    }

    const failedLogs = await EmailLog.find(query).limit(100);
    if (failedLogs.length === 0) {
      return res.status(404).json({ message: 'No failed email logs found to resend.' });
    }

    let successCount = 0;
    let failCount = 0;

    for (const log of failedLogs) {
      try {
        await sendEmail({
          to: log.recipient,
          recipientName: log.recipientName,
          subject: log.subject,
          text: log.body,
          type: log.type,
          category: log.category,
          severity: log.severity,
        });
        log.retryCount = (log.retryCount || 0) + 1;
        log.status = 'sent';
        log.error = '';
        await log.save();
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    res.json({
      success: true,
      message: `Bulk resend complete: ${successCount} succeeded, ${failCount} failed.`,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error('bulkResendEmailLogs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/email-logs/bulk-delete
export const bulkDeleteEmailLogs = async (req, res) => {
  try {
    const { ids, allFailed = false, olderThanDays } = req.body;
    let deleteQuery = {};

    if (Array.isArray(ids) && ids.length > 0) {
      deleteQuery._id = { $in: ids };
    } else if (allFailed) {
      deleteQuery.status = 'failed';
    } else if (olderThanDays && parseInt(olderThanDays, 10) > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays, 10));
      deleteQuery.createdAt = { $lt: cutoff };
    } else {
      return res.status(400).json({ message: 'Invalid bulk delete parameters.' });
    }

    const result = await EmailLog.deleteMany(deleteQuery);
    res.json({ message: `Successfully deleted ${result.deletedCount} email log(s)` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/email-logs/:id
export const deleteSingleEmailLog = async (req, res) => {
  try {
    const log = await EmailLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ message: 'Email log not found' });
    res.json({ message: 'Email log deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Legacy deleteOldEmailLogs
export const deleteOldEmailLogs = async (req, res) => {
  try {
    const days = 30;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    const result = await EmailLog.deleteMany({ createdAt: { $lt: dateLimit } });
    res.json({ message: `${result.deletedCount} old logs purged successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
