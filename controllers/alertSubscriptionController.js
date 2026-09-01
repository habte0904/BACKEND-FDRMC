import AlertSubscription, { ALERT_CATEGORY_VALUES } from '../models/AlertSubscription.js';
import * as auditService from '../services/auditService.js';
import { sendSingleSms, sendBatchSms } from '../services/smppService.js';
import { sendEmail, sendBroadcastEmail, generateAlertEmailHtml } from '../services/emailService.js';

const sanitizeIncomingPayload = (payload) => {
  const clean = payload && typeof payload === 'object' ? { ...payload } : {};
  delete clean._id;
  delete clean.createdAt;
  delete clean.updatedAt;
  return clean;
};

const normalizeCategories = (categories) =>
  Array.isArray(categories)
    ? categories
        .map((category) => (category == null ? '' : String(category).trim()))
        .filter(Boolean)
    : undefined;

const validateCategories = (categories) => {
  if (!Array.isArray(categories)) return null;
  const invalidCategories = categories.filter((category) => !ALERT_CATEGORY_VALUES.includes(category));
  return invalidCategories.length > 0 ? invalidCategories : null;
};

// Public: create or update a subscription by email/phone
// POST /api/alert-subscriptions
export const upsertAlertSubscriptionPublic = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});
    if (payload.preferences && typeof payload.preferences === 'object') {
      const categories = normalizeCategories(payload.preferences.categories);
      if (categories) {
        const invalidCategories = validateCategories(categories);
        if (invalidCategories) {
          return res.status(400).json({
            message: 'Invalid alert categories provided',
            invalidCategories,
          });
        }
        payload.preferences.categories = categories;
      }
    }

    const email = (payload?.contact?.email || '').toString().trim().toLowerCase();
    const phone = (payload?.contact?.phone || '').toString().trim();

    if (!email && !phone) {
      return res.status(400).json({ message: 'Email or phone is required' });
    }

    const query = email
      ? { 'contact.email': email }
      : { 'contact.phone': phone };

    const now = new Date();
    if (payload?.consent?.accepted === true && !payload?.consent?.acceptedAt) {
      payload.consent.acceptedAt = now;
    }

    const doc = await AlertSubscription.findOneAndUpdate(
      query,
      {
        $set: {
          ...payload,
          contact: { ...(payload.contact || {}), ...(email ? { email } : {}) },
          ...(req.user?._id ? { createdByUser: req.user._id, lastUpdatedByUser: req.user._id } : {}),
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    await auditService.logAction({
        userId: req.user?._id || 'PUBLIC_SUBSCRIBER',
        action: 'ALERT_SUBSCRIPTION_UPSERT',
        resource: 'AlertSubscription',
        resourceId: doc._id,
        after: doc,
        ip: req.ip
    });

    res.status(200).json(doc);
  } catch (error) {
    console.error('upsertAlertSubscriptionPublic error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: list subscriptions
// GET /api/alert-subscriptions
export const listAlertSubscriptions = async (req, res) => {
  try {
    const { status, search, category, location } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (category && category !== 'all') {
      query['preferences.categories'] = category;
    }
    if (search) {
      query.$or = [
        { 'contact.fullName': { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } },
        { 'location.region': { $regex: search, $options: 'i' } },
        { 'location.subCity': { $regex: search, $options: 'i' } },
        { 'location.woreda': { $regex: search, $options: 'i' } },
      ];
    }

    const docs = await AlertSubscription.find(query).sort({ updatedAt: -1 }).lean();
    res.json(docs);
  } catch (error) {
    console.error('listAlertSubscriptions error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: get single subscription
// GET /api/alert-subscriptions/:id
export const getAlertSubscriptionById = async (req, res) => {
  try {
    const doc = await AlertSubscription.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: 'Subscription not found' });
    res.json(doc);
  } catch (error) {
    console.error('getAlertSubscriptionById error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: update subscription
// PUT /api/alert-subscriptions/:id
export const updateAlertSubscription = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});
    if (payload.preferences && typeof payload.preferences === 'object') {
      const categories = normalizeCategories(payload.preferences.categories);
      if (categories) {
        const invalidCategories = validateCategories(categories);
        if (invalidCategories) {
          return res.status(400).json({
            message: 'Invalid alert categories provided',
            invalidCategories,
          });
        }
        payload.preferences.categories = categories;
      }
    }
    const beforeDoc = await AlertSubscription.findById(req.params.id);
    if (!beforeDoc) return res.status(404).json({ message: 'Subscription not found' });
    const before = beforeDoc.toObject();

    const doc = await AlertSubscription.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    );

    await auditService.logAction({
        userId: req.user?._id,
        action: 'ALERT_SUBSCRIPTION_UPDATE',
        resource: 'AlertSubscription',
        resourceId: doc._id,
        before,
        after: doc,
        ip: req.ip
    });

    res.json(doc);
  } catch (error) {
    console.error('updateAlertSubscription error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Admin: permanently delete a subscription
// DELETE /api/alert-subscriptions/:id
export const deleteAlertSubscription = async (req, res) => {
  try {
    const doc = await AlertSubscription.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Subscription not found' });

    const before = doc.toObject();
    await doc.deleteOne();
    await auditService.logAction({
      userId: req.user?._id,
      action: 'ALERT_SUBSCRIPTION_DELETE',
      resource: 'AlertSubscription',
      resourceId: doc._id,
      before,
      ip: req.ip,
    });

    res.json({ message: 'Subscription deleted successfully' });
  } catch (error) {
    console.error('deleteAlertSubscription error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Broadcast Alert (SMS & Email) to Subscribed Clients by Category
// POST /api/alert-subscriptions/broadcast
export const broadcastAlert = async (req, res) => {
  try {
    const {
      title,
      subject,
      message,
      smsMessage,
      hazard,
      category,
      severity = 'high',
      channel = 'email', // 'sms', 'email', 'both', 'all'
      audience = 'active', // 'all', 'active', 'paused', 'unsubscribed'
      locationTarget = 'all',
      sourceAuthority = 'Disaster Management',
    } = req.body;

    const alertTitle = title || subject || 'Disaster Alert Warning';
    const alertMessage = message || '';
    const alertSmsMessage = smsMessage || message || '';
    const alertCategory = hazard || category || 'general';

    if (!alertMessage && !alertSmsMessage) {
      return res.status(400).json({ message: 'Alert message content is required' });
    }

    // Build database query to find matching subscribers
    const query = {};
    if (audience !== 'all') {
      query.status = audience;
    }
    if (alertCategory && alertCategory !== 'all') {
      query['preferences.categories'] = alertCategory;
    }

    const subscribers = await AlertSubscription.find(query).lean();

    // Filter location if specified
    const filteredSubscribers = locationTarget === 'all'
      ? subscribers
      : subscribers.filter((sub) => {
          const locString = [
            sub.location?.subCity,
            sub.location?.woreda,
            sub.location?.city,
            sub.location?.region,
          ].filter(Boolean).join('|').toLowerCase();
          return locString.includes(locationTarget.toLowerCase());
        });

    const broadcastBatchId = `BC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let smsSummary = { total: 0, sent: 0, failed: 0 };
    let emailSummary = { total: 0, sent: 0, failed: 0 };

    const shouldSendSms = channel === 'sms' || channel === 'both' || channel === 'all';
    const shouldSendEmail = channel === 'email' || channel === 'both' || channel === 'all';

    // 1. Send SMS Broadcast
    if (shouldSendSms) {
      const smsRecipients = filteredSubscribers
        .filter((sub) => sub.contact?.phone && sub.delivery?.smsEnabled !== false)
        .map((sub) => ({
          phone: sub.contact.phone,
          name: sub.contact.fullName || '',
        }));

      if (smsRecipients.length > 0) {
        smsSummary = await sendBatchSms({
          recipients: smsRecipients,
          message: alertSmsMessage || alertMessage,
          category: alertCategory,
          severity,
          broadcastBatchId,
          sentBy: req.user?._id,
        });
      }
    }

    // 2. Send Email Broadcast
    if (shouldSendEmail) {
      const emailRecipients = filteredSubscribers
        .filter((sub) => sub.contact?.email && sub.delivery?.emailEnabled !== false)
        .map((sub) => ({
          email: sub.contact.email,
          fullName: sub.contact.fullName || '',
        }));

      if (emailRecipients.length > 0) {
        emailSummary = await sendBroadcastEmail({
          recipients: emailRecipients,
          subject: alertTitle,
          message: alertMessage,
          category: alertCategory,
          severity,
          sourceAuthority,
          broadcastBatchId,
        });
      }
    }

    await auditService.logAction({
      userId: req.user?._id,
      action: 'ALERT_BROADCAST_SEND',
      resource: 'AlertSubscription',
      after: {
        broadcastBatchId,
        category: alertCategory,
        severity,
        channel,
        totalMatchedSubscribers: filteredSubscribers.length,
        smsSummary,
        emailSummary,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Broadcast completed. ${smsSummary.sent} SMS and ${emailSummary.sent} Emails sent successfully.`,
      broadcastBatchId,
      totalMatchedSubscribers: filteredSubscribers.length,
      smsSummary,
      emailSummary,
    });
  } catch (error) {
    console.error('broadcastAlert error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send single direct SMS to a specific subscriber
// POST /api/alert-subscriptions/:id/send-sms
export const sendSingleSmsToSubscriber = async (req, res) => {
  try {
    const { message, category = 'alert', severity = 'warning' } = req.body;
    const subscriber = await AlertSubscription.findById(req.params.id);

    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    const phone = subscriber.contact?.phone || subscriber.contact?.altPhone;
    if (!phone) {
      return res.status(400).json({ message: 'Subscriber does not have a registered phone number' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const result = await sendSingleSms({
      phone,
      recipientName: subscriber.contact?.fullName || '',
      message,
      category,
      severity,
      messageType: 'single',
      sentBy: req.user?._id,
    });

    await auditService.logAction({
      userId: req.user?._id,
      action: 'ALERT_SINGLE_SMS_SEND',
      resource: 'AlertSubscription',
      resourceId: subscriber._id,
      after: result,
      ip: req.ip,
    });

    if (result.success) {
      res.json({ success: true, message: `SMS sent successfully to ${phone}`, result });
    } else {
      res.status(500).json({ success: false, message: result.error || 'Failed to send SMS', result });
    }
  } catch (error) {
    console.error('sendSingleSmsToSubscriber error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Send single direct Email to a specific subscriber
// POST /api/alert-subscriptions/:id/send-email
export const sendSingleEmailToSubscriber = async (req, res) => {
  try {
    const { subject, message, category = 'alert', severity = 'warning' } = req.body;
    const subscriber = await AlertSubscription.findById(req.params.id);

    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    const email = subscriber.contact?.email;
    if (!email) {
      return res.status(400).json({ message: 'Subscriber does not have a registered email address' });
    }
    if (!subject || !message) {
      return res.status(400).json({ message: 'Subject and message are required' });
    }

    const html = generateAlertEmailHtml({
      title: subject,
      message,
      category,
      severity,
      sourceAuthority: 'Disaster Risk Management',
    });

    const info = await sendEmail({
      to: email,
      recipientName: subscriber.contact?.fullName || '',
      subject,
      text: message,
      html,
      type: 'Alert',
      category,
      severity,
    });

    await auditService.logAction({
      userId: req.user?._id,
      action: 'ALERT_SINGLE_EMAIL_SEND',
      resource: 'AlertSubscription',
      resourceId: subscriber._id,
      after: { messageId: info.messageId, email },
      ip: req.ip,
    });

    res.json({ success: true, message: `Email sent successfully to ${email}`, messageId: info.messageId });
  } catch (error) {
    console.error('sendSingleEmailToSubscriber error:', error);
    res.status(500).json({ message: error.message });
  }
};
