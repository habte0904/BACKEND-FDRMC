import EmergencyContact from '../models/EmergencyContact.js';
import PortalContent from '../models/PortalContent.js';
import * as auditService from '../services/auditService.js';

const DEFAULT_CONTACTS = [
  {
    _id: 'default-police',
    title: 'Police',
    description: 'Immediate police dispatch and security support.',
    phoneNumber: '911',
    alternatePhoneNumber: '',
    iconKey: 'police',
    accentColor: '#2563EB',
    directoryType: 'national',
    regions: [],
    addressLine: '',
    availabilityText: '24/7 response line',
    sortOrder: 1,
    isActive: true,
  },
  {
    _id: 'default-fire',
    title: 'Fire',
    description: 'Fire outbreak response and rescue coordination.',
    phoneNumber: '911',
    alternatePhoneNumber: '',
    iconKey: 'fire',
    accentColor: '#EA580C',
    directoryType: 'national',
    regions: [],
    addressLine: '',
    availabilityText: '24/7 response line',
    sortOrder: 2,
    isActive: true,
  },
  {
    _id: 'default-hospital',
    title: 'Hospital',
    description: 'Emergency medical support and ambulance coordination.',
    phoneNumber: '911',
    alternatePhoneNumber: '',
    iconKey: 'hospital',
    accentColor: '#DC2626',
    directoryType: 'national',
    regions: [],
    addressLine: '',
    availabilityText: '24/7 response line',
    sortOrder: 3,
    isActive: true,
  },
];

const sanitizeIncomingPayload = (payload) => {
  const clean = payload && typeof payload === 'object' ? { ...payload } : {};
  delete clean._id;
  delete clean.createdAt;
  delete clean.updatedAt;

  return {
    title: (clean.title || '').toString().trim(),
    description: (clean.description || '').toString().trim(),
    phoneNumber: (clean.phoneNumber || '').toString().trim(),
    alternatePhoneNumber: (clean.alternatePhoneNumber || '').toString().trim(),
    iconKey: (clean.iconKey || 'phone').toString().trim().toLowerCase(),
    accentColor: (clean.accentColor || '#D7000F').toString().trim(),
    directoryType: (clean.directoryType || 'national').toString().trim().toLowerCase(),
    regions: Array.isArray(clean.regions)
      ? clean.regions
          .map((region) => (region || '').toString().trim())
          .filter(Boolean)
      : [],
    addressLine: (clean.addressLine || '').toString().trim(),
    availabilityText: (clean.availabilityText || '24/7 response line').toString().trim(),
    sortOrder: Number.isFinite(Number(clean.sortOrder)) ? Number(clean.sortOrder) : 0,
    isActive: clean.isActive !== false,
  };
};

const buildRegionMatcher = (region) => {
  if (!region) return {};
  const normalizedRegion = region.toString().trim();
  if (!normalizedRegion) return {};

  return {
    $or: [
      { directoryType: 'national' },
      { regions: { $size: 0 } },
      { regions: { $in: [new RegExp(`^${normalizedRegion}$`, 'i')] } },
    ],
  };
};

const deriveRegions = (contacts) => {
  return Array.from(
    new Set(
      contacts
        .flatMap((contact) => (Array.isArray(contact.regions) ? contact.regions : []))
        .map((region) => region.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
};

export const getPublicEmergencyDirectory = async (req, res) => {
  try {
    const region = (req.query.region || '').toString().trim();
    const query = { isActive: true, ...buildRegionMatcher(region) };
    const [contacts, portalContent] = await Promise.all([
      EmergencyContact.find(query).sort({ sortOrder: 1, title: 1 }).lean(),
      PortalContent.findOne({ key: 'default' }).lean()
    ]);
    const resolvedContacts = contacts.length > 0 ? contacts : DEFAULT_CONTACTS;
    const warningMessage = portalContent?.pages?.emergencyDirectory?.warningMessage || '';

    res.json({
      title: 'Emergency Contact Directory',
      description: 'View key emergency contacts and directories.',
      primaryAction: {
        label: 'Open service',
        href: region ? `tel:${resolvedContacts[0]?.phoneNumber || '911'}` : `tel:${resolvedContacts[0]?.phoneNumber || '911'}`,
      },
      helperText: region
        ? `Local services based on ${region}`
        : 'Local services based on your region',
      crisisText: 'Quick access in crisis.',
      warningMessage,
      region,
      availableRegions: contacts.length > 0 ? deriveRegions(contacts) : [],
      contacts: resolvedContacts,
    });
  } catch (error) {
    console.error('getPublicEmergencyDirectory error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getGlobalWarning = async (req, res) => {
  try {
    const doc = await PortalContent.findOne({ key: 'default' }).lean();
    res.json({ warningMessage: doc?.pages?.emergencyDirectory?.warningMessage || '' });
  } catch (error) {
    console.error('getGlobalWarning error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateGlobalWarning = async (req, res) => {
  try {
    const { warningMessage } = req.body;
    await PortalContent.updateOne(
      { key: 'default' },
      { $set: { 'pages.emergencyDirectory.warningMessage': (warningMessage || '').toString().trim() } },
      { upsert: true }
    );
    res.json({ warningMessage });
  } catch (error) {
    console.error('updateGlobalWarning error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const listEmergencyContacts = async (req, res) => {
  try {
    const { search, active, region } = req.query;
    const andConditions = [];

    if (active === 'true') andConditions.push({ isActive: true });
    if (active === 'false') andConditions.push({ isActive: false });

    const normalizedRegion = (region || '').toString().trim();
    if (normalizedRegion) {
      andConditions.push({
        $or: [
          { regions: { $in: [new RegExp(`^${normalizedRegion}$`, 'i')] } },
          { directoryType: 'national' },
          { regions: { $size: 0 } },
        ],
      });
    }

    if (search) {
      andConditions.push(
        {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { phoneNumber: { $regex: search, $options: 'i' } },
            { alternatePhoneNumber: { $regex: search, $options: 'i' } },
            { addressLine: { $regex: search, $options: 'i' } },
            { availabilityText: { $regex: search, $options: 'i' } },
            { regions: { $regex: search, $options: 'i' } },
          ],
        },
      );
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const contacts = await EmergencyContact.find(query).sort({ sortOrder: 1, title: 1 }).lean();

    res.json({
      contacts,
      availableRegions: deriveRegions(contacts),
    });
  } catch (error) {
    console.error('listEmergencyContacts error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createEmergencyContact = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});

    if (!payload.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!payload.phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const doc = await EmergencyContact.create({
      ...payload,
      ...(req.user?._id ? { createdByUser: req.user._id, lastUpdatedByUser: req.user._id } : {}),
    });

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMERGENCY_CONTACT_CREATE',
      resource: 'EmergencyContact',
      resourceId: doc._id,
      after: doc,
      ip: req.ip,
    });

    res.status(201).json(doc);
  } catch (error) {
    console.error('createEmergencyContact error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateEmergencyContact = async (req, res) => {
  try {
    const payload = sanitizeIncomingPayload(req.body || {});
    const beforeDoc = await EmergencyContact.findById(req.params.id);

    if (!beforeDoc) {
      return res.status(404).json({ message: 'Emergency contact not found' });
    }
    if (!payload.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!payload.phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const before = beforeDoc.toObject();
    const doc = await EmergencyContact.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...payload,
          ...(req.user?._id ? { lastUpdatedByUser: req.user._id } : {}),
        },
      },
      { new: true }
    );

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMERGENCY_CONTACT_UPDATE',
      resource: 'EmergencyContact',
      resourceId: doc._id,
      before,
      after: doc,
      ip: req.ip,
    });

    res.json(doc);
  } catch (error) {
    console.error('updateEmergencyContact error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteEmergencyContact = async (req, res) => {
  try {
    const doc = await EmergencyContact.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Emergency contact not found' });
    }

    const before = doc.toObject();
    await EmergencyContact.findByIdAndDelete(req.params.id);

    await auditService.logAction({
      userId: req.user?._id,
      action: 'EMERGENCY_CONTACT_DELETE',
      resource: 'EmergencyContact',
      resourceId: req.params.id,
      before,
      ip: req.ip,
    });

    res.json({ message: 'Emergency contact deleted' });
  } catch (error) {
    console.error('deleteEmergencyContact error:', error);
    res.status(500).json({ message: error.message });
  }
};
