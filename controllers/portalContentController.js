import PortalContent from '../models/PortalContent.js';
import * as auditService from '../services/auditService.js';
import WoredaProfile from '../models/WoredaProfile.js';

export const getPortalContent = async (req, res) => {
  try {
    const doc = await PortalContent.findOne({ key: 'default' }).lean();
    // attach latest WoredaProfile updated timestamp if available
    try {
      const latest = await WoredaProfile.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean();
      if (latest && latest.updatedAt) {
        const d = new Date(latest.updatedAt);
        const formatted = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')} UTC`;
        if (!doc) {
          res.json({ lastSynced: formatted });
          return;
        }
        if (!doc.pages) doc.pages = {};
        if (!doc.pages.riskInformation) doc.pages.riskInformation = {};
        doc.pages.riskInformation.lastSynced = formatted;
      }
    } catch (e) {
      // ignore attach failures
    }
    res.json(doc || null);
  } catch (error) {
    console.error('getPortalContent error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const upsertPortalContent = async (req, res) => {
  try {
    const payload = req.body || {};
    delete payload._id;
    delete payload.key;
    delete payload.createdAt;
    delete payload.updatedAt;

    const beforeDoc = await PortalContent.findOne({ key: 'default' });
    const before = beforeDoc ? beforeDoc.toObject() : null;

    const doc = await PortalContent.findOneAndUpdate(
      { key: 'default' },
      { $set: { key: 'default', ...payload } },
      { new: true, upsert: true }
    );

    await auditService.logAction({
        userId: req.user?._id,
        action: 'PORTAL_CONTENT_UPDATE',
        resource: 'PortalContent',
        before,
        after: doc,
        ip: req.ip
    });

    res.json(doc);
  } catch (error) {
    console.error('upsertPortalContent error:', error);
    res.status(500).json({ message: error.message });
  }
};
