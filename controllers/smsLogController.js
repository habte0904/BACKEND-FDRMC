import SmsLog from '../models/SmsLog.js';
import AlertSubscription from '../models/AlertSubscription.js';
import { sendSingleSms, sendBatchSms, normalizePhoneNumber } from '../services/smppService.js';
import * as auditService from '../services/auditService.js';
import { getBranchScope, buildSubcityRegex } from '../utils/branchScope.js';
import User from '../models/User.js';

// Hazard group mappings
const HAZARD_GROUP_CATEGORIES = {
  weather: ['floods', 'heat_wave', 'drought'],
  geo: ['earthquake', 'landslides', 'subsidence_fissures'],
  fire: ['forest_fires', 'structural_fire'],
  env: ['groundwater_pollution', 'lake_water_pollution', 'air_pollution', 'human_epidemics', 'other'],
};

// Helper to build subscriber query and filter based on comprehensive criteria
const getFilteredSubscribers = async ({
  audienceStatus = 'active',
  subscriberCategory = 'all',
  hazardGroup = 'all',
  region = 'all',
  city = 'all',
  subCity = 'all',
  woreda = 'all',
  locationFilter = '',
  smsChannelOnly = false,
}) => {
  const query = {
    'contact.phone': { $exists: true, $ne: '' },
  };

  // Audience Status
  if (audienceStatus && audienceStatus !== 'all') {
    query.status = audienceStatus;
  }

  // Hazard Group & Category
  if (subscriberCategory && subscriberCategory !== 'all') {
    query['preferences.categories'] = subscriberCategory;
  } else if (hazardGroup && hazardGroup !== 'all' && HAZARD_GROUP_CATEGORIES[hazardGroup]) {
    query['preferences.categories'] = { $in: HAZARD_GROUP_CATEGORIES[hazardGroup] };
  }

  // Location fields in MongoDB query
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

  // Delivery channel preference
  if (smsChannelOnly) {
    query['delivery.smsEnabled'] = { $ne: false };
  }

  const subscribers = await AlertSubscription.find(query)
    .select('contact location preferences status delivery')
    .lean();

  // General free-text location filter if provided
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

// GET /api/sms-logs/stats - Aggregate stats for SMS overview
export const getSmsStats = async (req, res) => {
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
      delivered,
      failed,
      pending,
      todayCount,
      unicodeCount,
      totalSegmentsAgg,
    ] = await Promise.all([
      SmsLog.countDocuments(logQuery),
      SmsLog.countDocuments({ ...logQuery, status: 'sent' }),
      SmsLog.countDocuments({ ...logQuery, status: 'delivered' }),
      SmsLog.countDocuments({ ...logQuery, status: 'failed' }),
      SmsLog.countDocuments({ ...logQuery, status: { $in: ['pending', 'queued'] } }),
      SmsLog.countDocuments({ ...logQuery, createdAt: { $gte: startOfToday } }),
      SmsLog.countDocuments({ ...logQuery, encoding: 'UCS-2' }),
      SmsLog.aggregate([
        { $match: logQuery },
        { $group: { _id: null, totalSegments: { $sum: '$segments' }, avgLatency: { $avg: '$latencyMs' } } },
      ]),
    ]);

    const totalSegments = totalSegmentsAgg[0]?.totalSegments || total;
    const avgLatency = Math.round(totalSegmentsAgg[0]?.avgLatency || 0);

    const successTotal = sent + delivered;
    const deliveryRate = total > 0 ? Math.round((successTotal / total) * 100) : 0;

    res.json({
      total,
      sent,
      delivered,
      failed,
      pending,
      todayCount,
      unicodeCount,
      totalSegments,
      avgLatency,
      deliveryRate,
    });
  } catch (error) {
    console.error('getSmsStats error:', error);
    res.status(500).json({ message: error.message });
  }
};

// GET /api/sms-logs
export const getSmsLogs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const branchScope = await getBranchScope(user);

    const {
      status,
      category,
      messageType,
      encoding,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    let query = {};

    if (status && status !== 'all') {
      if (status === 'success') {
        query.status = { $in: ['sent', 'delivered'] };
      } else {
        query.status = status;
      }
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (messageType && messageType !== 'all') {
      query.messageType = messageType;
    }

    if (encoding && encoding !== 'all') {
      query.encoding = encoding;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { recipientPhone: { $regex: term, $options: 'i' } },
        { recipientName: { $regex: term, $options: 'i' } },
        { message: { $regex: term, $options: 'i' } },
        { senderId: { $regex: term, $options: 'i' } },
        { messageId: { $regex: term, $options: 'i' } },
        { broadcastBatchId: { $regex: term, $options: 'i' } },
        { errorDetails: { $regex: term, $options: 'i' } },
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
      SmsLog.countDocuments(query),
      SmsLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('sentBy', 'name email role')
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
    console.error('getSmsLogs error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-logs/preview-subscribers - Live count & sample of matching subscribers
export const previewSubscribers = async (req, res) => {
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
      smsChannelOnly = false,
    } = req.body;

    // Branch users can only preview subscribers in their subcity
    if (branchScope.isBranch && branchScope.subcityName) {
      subCity = branchScope.subcityName;
    }

    const subscribers = await getFilteredSubscribers({
      audienceStatus,
      subscriberCategory,
      hazardGroup,
      region,
      city,
      subCity,
      woreda,
      locationFilter,
      smsChannelOnly,
    });

    const validWithPhone = subscribers.filter((s) => Boolean(s.contact?.phone));
    const sample = validWithPhone.slice(0, 5).map((s) => ({
      name: s.contact?.fullName || 'Anonymous',
      phone: s.contact?.phone,
      region: s.location?.region || '',
      city: s.location?.city || '',
      subCity: s.location?.subCity || s.location?.subcity || '',
      woreda: s.location?.woreda || '',
      status: s.status,
    }));

    res.json({
      totalCount: validWithPhone.length,
      sample,
      branchLocked: branchScope.isBranch ? branchScope.subcityName : null,
    });
  } catch (error) {
    console.error('previewSubscribers error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-logs/broadcast - Send custom or subscriber broadcast SMS
export const broadcastSms = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('organization');
    const branchScope = await getBranchScope(user);
    const userOrgId = user.organization?._id || user.organization || null;

    let {
      phoneNumbers,
      message,
      category = 'general',
      severity = 'normal',
      senderId,
      audienceType = 'custom', // 'custom' | 'subscribers'
      audienceStatus = 'active',
      subscriberCategory = 'all',
      hazardGroup = 'all',
      region = 'all',
      city = 'all',
      subCity = 'all',
      woreda = 'all',
      locationFilter = '',
      smsChannelOnly = false,
    } = req.body;

    // Branch users can only broadcast to their subcity
    if (branchScope.isBranch && branchScope.subcityName) {
      subCity = branchScope.subcityName;
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'SMS message body is required' });
    }

    let recipients = [];

    if (audienceType === 'subscribers') {
      const subscribers = await getFilteredSubscribers({
        audienceStatus,
        subscriberCategory: subscriberCategory !== 'all' ? subscriberCategory : category !== 'all' ? category : 'all',
        hazardGroup,
        region,
        city,
        subCity,
        woreda,
        locationFilter,
        smsChannelOnly,
      });

      const seen = new Set();
      for (const sub of subscribers) {
        const phone = normalizePhoneNumber(sub.contact?.phone);
        if (phone && !seen.has(phone)) {
          seen.add(phone);
          recipients.push({
            phone,
            name: sub.contact?.fullName || '',
          });
        }
      }
    } else {
      // Custom manual phone numbers: array or string separated by comma/newline/space/semicolon
      let rawList = [];
      if (Array.isArray(phoneNumbers)) {
        rawList = phoneNumbers;
      } else if (typeof phoneNumbers === 'string') {
        rawList = phoneNumbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      }

      // Deduplicate and normalize according to Ethiopian telecom rules
      const seen = new Set();
      const invalidPhones = [];

      for (const item of rawList) {
        const rawPhone = typeof item === 'string' ? item : item.phone;
        const name = typeof item === 'object' ? item.name : '';
        const normalized = normalizePhoneNumber(rawPhone);
        if (normalized) {
          if (!seen.has(normalized)) {
            seen.add(normalized);
            recipients.push({ phone: normalized, name });
          }
        } else {
          invalidPhones.push(rawPhone);
        }
      }

      if (invalidPhones.length > 0 && recipients.length === 0) {
        return res.status(400).json({
          message: `Invalid Ethiopian mobile number(s): ${invalidPhones.slice(0, 3).join(', ')}. Must be 10 digits starting with 09 (Ethio Telecom), 07 (Safaricom), or +251 (e.g. 0911223344 or +251911223344).`,
          invalidPhones,
        });
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: 'No valid Ethiopian mobile phone numbers found matching the criteria.' });
    }

    const broadcastBatchId = `BATCH-${Date.now()}`;

    // For small batches (<= 5), execute synchronously for immediate feedback
    if (recipients.length <= 5) {
      const batchResult = await sendBatchSms({
        recipients,
        message: message.trim(),
        category,
        severity,
        senderId,
        broadcastBatchId,
        sentBy: req.user?._id,
        organizationId: userOrgId,
      });

      await auditService.logAction({
        userId: req.user?._id,
        action: 'SMS_BROADCAST_DISPATCH',
        resource: 'SmsLog',
        resourceId: broadcastBatchId,
        after: {
          batchId: broadcastBatchId,
          total: batchResult.total,
          sent: batchResult.sent,
          failed: batchResult.failed,
          category,
          severity,
          audienceType,
          audienceStatus,
          region,
          city,
        },
        ip: req.ip,
      });

      return res.json({
        success: true,
        isAsync: false,
        message: `Broadcast completed: ${batchResult.sent} sent, ${batchResult.failed} failed out of ${batchResult.total} recipients.`,
        batchId: broadcastBatchId,
        summary: batchResult,
      });
    }

    // For larger broadcast batches, execute in background with TPS rate limiting
    // Prevents HTTP 504 timeouts and allows real-time WebSocket progress tracking!
    sendBatchSms({
      recipients,
      message: message.trim(),
      category,
      severity,
      senderId,
      broadcastBatchId,
      sentBy: req.user?._id,
      organizationId: userOrgId,
    })
      .then(async (batchResult) => {
        await auditService.logAction({
          userId: req.user?._id,
          action: 'SMS_BROADCAST_COMPLETED',
          resource: 'SmsLog',
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
        console.error(`[SMS-BROADCAST] Background dispatch error on ${broadcastBatchId}:`, err);
      });

    res.json({
      success: true,
      isAsync: true,
      message: `Emergency broadcast initiated for ${recipients.length} recipients. Messages are actively dispatching in the background with live progress tracking.`,
      batchId: broadcastBatchId,
      totalCount: recipients.length,
    });
  } catch (error) {
    console.error('broadcastSms error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-logs/resend/:id - Resend single SMS (with optional content edit)
export const resendSms = async (req, res) => {
  try {
    const log = await SmsLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ message: 'SMS log entry not found' });
    }

    const {
      phone = log.recipientPhone,
      recipientName = log.recipientName,
      message = log.message,
      category = log.category,
      severity = log.severity,
      senderId = log.senderId,
    } = req.body || {};

    const result = await sendSingleSms({
      phone,
      recipientName,
      message,
      category,
      severity,
      messageType: log.messageType || 'single',
      senderId,
      broadcastBatchId: log.broadcastBatchId || '',
      sentBy: req.user?._id,
    });

    // Update original log retry tracking
    log.retryCount = (log.retryCount || 0) + 1;
    log.lastResentAt = new Date();
    if (result.success) {
      log.status = 'sent';
      log.errorDetails = '';
      log.messageId = result.messageId || log.messageId;
    }
    await log.save();

    await auditService.logAction({
      userId: req.user?._id,
      action: 'SMS_RESEND_SINGLE',
      resource: 'SmsLog',
      resourceId: log._id,
      after: { originalLogId: log._id, result },
      ip: req.ip,
    });

    res.json({
      success: result.success,
      message: result.success ? `SMS resent successfully to ${phone}` : `Resend attempt failed: ${result.error}`,
      result,
      updatedLog: log,
    });
  } catch (error) {
    console.error('resendSms error:', error);
    res.status(500).json({ message: error.message });
  }
};

// POST /api/sms-logs/bulk-resend - Resend multiple failed SMS logs
export const bulkResendSms = async (req, res) => {
  try {
    const { ids, allFailed = false, category } = req.body;

    let targetQuery = {};
    if (Array.isArray(ids) && ids.length > 0) {
      targetQuery._id = { $in: ids };
    } else if (allFailed) {
      targetQuery.status = 'failed';
      if (category && category !== 'all') {
        targetQuery.category = category;
      }
    } else {
      return res.status(400).json({ message: 'Please provide log IDs or specify allFailed: true' });
    }

    const failedLogs = await SmsLog.find(targetQuery).limit(100);

    if (failedLogs.length === 0) {
      return res.status(404).json({ message: 'No matching failed SMS logs found to resend.' });
    }

    let successCount = 0;
    let failCount = 0;
    const resendResults = [];

    for (const log of failedLogs) {
      try {
        const result = await sendSingleSms({
          phone: log.recipientPhone,
          recipientName: log.recipientName,
          message: log.message,
          category: log.category,
          severity: log.severity,
          messageType: log.messageType || 'single',
          senderId: log.senderId,
          sentBy: req.user?._id,
        });

        log.retryCount = (log.retryCount || 0) + 1;
        log.lastResentAt = new Date();
        if (result.success) {
          log.status = 'sent';
          log.errorDetails = '';
          log.messageId = result.messageId || log.messageId;
          successCount++;
        } else {
          failCount++;
        }
        await log.save();

        resendResults.push({ id: log._id, phone: log.recipientPhone, success: result.success });
      } catch (err) {
        failCount++;
        resendResults.push({ id: log._id, phone: log.recipientPhone, success: false, error: err.message });
      }
    }

    await auditService.logAction({
      userId: req.user?._id,
      action: 'SMS_BULK_RESEND',
      resource: 'SmsLog',
      after: { total: failedLogs.length, successCount, failCount },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Bulk resend complete: ${successCount} succeeded, ${failCount} failed out of ${failedLogs.length}.`,
      total: failedLogs.length,
      successCount,
      failCount,
      results: resendResults,
    });
  } catch (error) {
    console.error('bulkResendSms error:', error);
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/sms-logs/bulk-delete
export const bulkDeleteSmsLogs = async (req, res) => {
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

    const result = await SmsLog.deleteMany(deleteQuery);

    await auditService.logAction({
      userId: req.user?._id,
      action: 'SMS_BULK_DELETE',
      resource: 'SmsLog',
      after: { count: result.deletedCount, query: deleteQuery },
      ip: req.ip,
    });

    res.json({
      message: `Successfully deleted ${result.deletedCount} SMS log(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('bulkDeleteSmsLogs error:', error);
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

    await auditService.logAction({
      userId: req.user?._id,
      action: 'SMS_LOG_DELETE',
      resource: 'SmsLog',
      resourceId: req.params.id,
      before: log.toObject(),
      ip: req.ip,
    });

    res.json({ message: 'SMS log deleted successfully' });
  } catch (error) {
    console.error('deleteSmsLog error:', error);
    res.status(500).json({ message: error.message });
  }
};
