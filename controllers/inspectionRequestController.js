import InspectionRequest from '../models/InspectionRequest.js';

const INSPECTION_TYPE_LABELS = {
  building_safety: 'Building Safety',
  fire_safety: 'Fire Safety',
  electrical: 'Electrical Inspection',
  sanitation: 'Sanitation Inspection',
  structural: 'Structural Assessment',
  occupancy: 'Occupancy Approval',
  other: 'Other',
};

const createTrackingNumber = () => {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INS-${stamp}-${random}`;
};

const sanitizeDoc = (doc) => ({
  _id: doc._id,
  trackingNumber: doc.trackingNumber,
  propertyAddress: doc.propertyAddress,
  inspectionType: doc.inspectionType,
  inspectionTypeLabel: INSPECTION_TYPE_LABELS[doc.inspectionType] || doc.inspectionType,
  preferredDate: doc.preferredDate,
  additionalNotes: doc.additionalNotes,
  requesterName: doc.requesterName,
  requesterPhone: doc.requesterPhone,
  requesterEmail: doc.requesterEmail,
  status: doc.status,
  assignedInspector: doc.assignedInspector,
  assignedInspectorContact: doc.assignedInspectorContact,
  certificateUrl: doc.certificateUrl,
  adminNotes: doc.adminNotes,
  submittedFrom: doc.submittedFrom,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const createPublicInspectionRequest = async (req, res) => {
  try {
    const {
      propertyAddress,
      inspectionType,
      preferredDate,
      additionalNotes = '',
      requesterName = '',
      requesterPhone = '',
      requesterEmail = '',
    } = req.body || {};

    if (!propertyAddress?.trim()) {
      return res.status(400).json({ message: 'Property address is required' });
    }

    if (!inspectionType?.trim()) {
      return res.status(400).json({ message: 'Inspection type is required' });
    }

    if (!preferredDate) {
      return res.status(400).json({ message: 'Preferred date is required' });
    }

    const preferred = new Date(preferredDate);
    if (Number.isNaN(preferred.getTime())) {
      return res.status(400).json({ message: 'Preferred date is invalid' });
    }

    let trackingNumber = createTrackingNumber();
    while (await InspectionRequest.exists({ trackingNumber })) {
      trackingNumber = createTrackingNumber();
    }

    const doc = await InspectionRequest.create({
      trackingNumber,
      propertyAddress: propertyAddress.trim(),
      inspectionType,
      preferredDate: preferred,
      additionalNotes: additionalNotes.trim(),
      requesterName: requesterName.trim(),
      requesterPhone: requesterPhone.trim(),
      requesterEmail: requesterEmail.trim(),
    });

    res.status(201).json({
      message: 'Inspection request submitted successfully',
      request: sanitizeDoc(doc),
    });
  } catch (error) {
    console.error('createPublicInspectionRequest error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const trackInspectionRequest = async (req, res) => {
  try {
    const trackingNumber = String(req.params.trackingNumber || '').trim().toUpperCase();
    if (!trackingNumber) {
      return res.status(400).json({ message: 'Tracking number is required' });
    }

    const doc = await InspectionRequest.findOne({ trackingNumber });
    if (!doc) {
      return res.status(404).json({ message: 'Inspection request not found' });
    }

    res.json({ request: sanitizeDoc(doc) });
  } catch (error) {
    console.error('trackInspectionRequest error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const listInspectionRequests = async (req, res) => {
  try {
    const { search, status, inspectionType } = req.query;
    const query = {};

    if (status) query.status = status;
    if (inspectionType) query.inspectionType = inspectionType;
    if (search) {
      query.$or = [
        { trackingNumber: { $regex: search, $options: 'i' } },
        { propertyAddress: { $regex: search, $options: 'i' } },
        { requesterName: { $regex: search, $options: 'i' } },
        { requesterPhone: { $regex: search, $options: 'i' } },
        { requesterEmail: { $regex: search, $options: 'i' } },
        { assignedInspector: { $regex: search, $options: 'i' } },
      ];
    }

    const requests = await InspectionRequest.find(query).sort({ createdAt: -1 });
    res.json({ requests: requests.map(sanitizeDoc) });
  } catch (error) {
    console.error('listInspectionRequests error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getInspectionRequestById = async (req, res) => {
  try {
    const doc = await InspectionRequest.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Inspection request not found' });
    }

    res.json(sanitizeDoc(doc));
  } catch (error) {
    console.error('getInspectionRequestById error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateInspectionRequest = async (req, res) => {
  try {
    const doc = await InspectionRequest.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ message: 'Inspection request not found' });
    }

    const allowedFields = [
      'status',
      'assignedInspector',
      'assignedInspectorContact',
      'certificateUrl',
      'adminNotes',
      'preferredDate',
    ];

    for (const field of allowedFields) {
      if (field in req.body) {
        doc[field] = req.body[field];
      }
    }

    await doc.save();
    res.json({
      message: 'Inspection request updated successfully',
      request: sanitizeDoc(doc),
    });
  } catch (error) {
    console.error('updateInspectionRequest error:', error);
    res.status(500).json({ message: error.message });
  }
};
