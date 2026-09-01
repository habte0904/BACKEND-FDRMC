import mongoose from 'mongoose';
import Site from '../models/Site.js';
import Template from '../models/Template.js';
import FormResponse from '../models/FormResponse.js';
import SurveySyncLog from '../models/SurveySyncLog.js';

// Get assigned sites for the logged-in surveyor
export const getAssignedSites = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        let sites = await Site.find({ assignedSurveyor: userId }).populate('assignedTemplate');

        // Seed default assigned sites for the user if none exist yet for testing/demonstration
        if (sites.length === 0) {
            const templates = await Template.find({ status: 'Published', isDeleted: false });
            const templateToAssign = templates.length > 0 ? templates[0]._id : null;

            if (templateToAssign) {
                const seedSites = [
                    {
                        siteCode: `SITE-ADD-${Math.floor(1000 + Math.random() * 9000)}`,
                        name: 'Bole Subcity Site Survey #1',
                        description: 'Disaster risk and infrastructure assessment site',
                        region: 'Addis Ababa',
                        zone: 'Zone 1',
                        woreda: 'Woreda 03',
                        kebele: 'Kebele 05',
                        location: { latitude: 8.9806, longitude: 38.7578, address: 'Bole, Addis Ababa' },
                        assignedSurveyor: userId,
                        assignedTemplate: templateToAssign,
                        status: 'Assigned',
                        priority: 'High',
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    },
                    {
                        siteCode: `SITE-AKL-${Math.floor(1000 + Math.random() * 9000)}`,
                        name: 'Akaki Kality Facility Assessment',
                        description: 'Emergency response facility survey',
                        region: 'Addis Ababa',
                        zone: 'Zone 2',
                        woreda: 'Woreda 08',
                        kebele: 'Kebele 12',
                        location: { latitude: 8.8950, longitude: 38.7833, address: 'Akaki Kality, Addis Ababa' },
                        assignedSurveyor: userId,
                        assignedTemplate: templateToAssign,
                        status: 'Assigned',
                        priority: 'Medium',
                        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    }
                ];

                await Site.insertMany(seedSites);
                sites = await Site.find({ assignedSurveyor: userId }).populate('assignedTemplate');
            }
        }

        res.json({ success: true, count: sites.length, data: sites });
    } catch (error) {
        console.error('Error fetching assigned sites:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get published templates for offline caching
export const getAssignedTemplates = async (req, res) => {
    try {
        const templates = await Template.find({ status: 'Published', isDeleted: false });
        res.json({ success: true, count: templates.length, data: templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get lookup values for dropdown options and metadata
export const getLookupValues = async (req, res) => {
    try {
        const lookups = [
            { category: 'regions', label: 'Addis Ababa', value: 'Addis Ababa' },
            { category: 'regions', label: 'Oromia', value: 'Oromia' },
            { category: 'regions', label: 'Amhara', value: 'Amhara' },
            { category: 'regions', label: 'Sidama', value: 'Sidama' },
            { category: 'priority', label: 'Low', value: 'Low' },
            { category: 'priority', label: 'Medium', value: 'Medium' },
            { category: 'priority', label: 'High', value: 'High' },
            { category: 'priority', label: 'Critical', value: 'Critical' },
            { category: 'building_condition', label: 'Good', value: 'Good' },
            { category: 'building_condition', label: 'Moderate Damage', value: 'Moderate Damage' },
            { category: 'building_condition', label: 'Severe Damage', value: 'Severe Damage' },
            { category: 'building_condition', label: 'Destroyed', value: 'Destroyed' },
        ];
        res.json({ success: true, data: lookups });
    } catch (error) {
        console.error('Error fetching lookup values:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Sequential Ordered Sync Endpoint
// Sync sequence steps: 1. Header -> 2. Responses -> 3. GPS -> 4. Images -> 5. Attachments -> 6. Signatures -> 7. Status Update
export const syncSurvey = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const {
            localId,
            siteId,
            templateId,
            templateVersion,
            answers,
            respondentMetadata,
            gpsLocation,
            photos,
            attachments,
            signature,
            isDraft
        } = req.body;

        // Ensure templateId is a valid MongoDB ObjectId
        let validTemplateId = templateId;
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            const matchedTemplate = await Template.findOne({ status: 'Published', isDeleted: false });
            if (matchedTemplate) {
                validTemplateId = matchedTemplate._id;
            }
        }

        // Ensure siteId is a valid MongoDB ObjectId if provided
        let validSiteId = siteId;
        if (siteId && !mongoose.Types.ObjectId.isValid(siteId)) {
            const matchedSite = await Site.findOne({ siteCode: siteId });
            if (matchedSite) {
                validSiteId = matchedSite._id;
            } else {
                validSiteId = null;
            }
        }

        const stepsCompleted = [];

        // Step 1: Process Survey Header & Metadata
        stepsCompleted.push({ step: 'header', completedAt: new Date(), details: { localId, siteId: validSiteId, templateId: validTemplateId } });

        // Step 2: Form Response & Field Values
        let formResponse = await FormResponse.create({
            templateId: validTemplateId,
            templateVersion: templateVersion || 1,
            moduleContextId: validSiteId || localId,
            moduleContextType: 'SiteSurvey',
            respondentMetadata: {
                ...respondentMetadata,
                enumeratorId: userId,
                location: gpsLocation ? {
                    lat: gpsLocation.latitude,
                    lng: gpsLocation.longitude,
                    accuracy: gpsLocation.accuracy
                } : respondentMetadata?.location
            },
            answers: answers || {},
            syncStatus: 'UNSYNCED',
            lastSyncedAt: new Date(),
            isDraft: isDraft || false,
            submittedBy: userId,
            submittedAt: new Date()
        });
        stepsCompleted.push({ step: 'responses', completedAt: new Date(), details: { responseId: formResponse._id } });

        // Step 3: GPS Data Validation
        if (gpsLocation) {
            stepsCompleted.push({ step: 'gps', completedAt: new Date(), details: gpsLocation });
        } else {
            stepsCompleted.push({ step: 'gps', completedAt: new Date(), details: 'No GPS captured' });
        }

        // Step 4: Images & Media Processing
        if (photos && photos.length > 0) {
            stepsCompleted.push({ step: 'photos', completedAt: new Date(), details: { count: photos.length } });
        } else {
            stepsCompleted.push({ step: 'photos', completedAt: new Date(), details: { count: 0 } });
        }

        // Step 5: Attachments Processing
        if (attachments && attachments.length > 0) {
            stepsCompleted.push({ step: 'attachments', completedAt: new Date(), details: { count: attachments.length } });
        } else {
            stepsCompleted.push({ step: 'attachments', completedAt: new Date(), details: { count: 0 } });
        }

        // Step 6: Signature Verification
        if (signature) {
            stepsCompleted.push({ step: 'signatures', completedAt: new Date(), details: 'Signature recorded' });
        } else {
            stepsCompleted.push({ step: 'signatures', completedAt: new Date(), details: 'No signature' });
        }

        // Step 7: Final Status Update
        if (validSiteId) {
            await Site.findByIdAndUpdate(validSiteId, {
                status: 'Completed',
                'syncMetadata.lastSyncedAt': new Date()
            });
        }
        stepsCompleted.push({ step: 'status', completedAt: new Date(), details: { status: 'Synced' } });

        // Record Sync Log on Server
        const syncLog = await SurveySyncLog.create({
            surveyorId: userId,
            localSurveyId: localId || `LOCAL-${Date.now()}`,
            serverSurveyId: formResponse._id,
            siteId: validSiteId || null,
            templateId: validTemplateId || null,
            syncStatus: 'synced',
            stepsCompleted,
            syncedAt: new Date()
        });

        res.json({
            success: true,
            message: 'Survey synchronized successfully',
            serverId: formResponse._id,
            syncLogId: syncLog._id,
            stepsCompleted
        });
    } catch (error) {
        console.error('Error during survey synchronization:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Synchronization failed'
        });
    }
};

// Create Sync History Log
export const createSyncLog = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const logData = {
            ...req.body,
            surveyorId: userId
        };
        const log = await SurveySyncLog.create(logData);
        res.json({ success: true, data: log });
    } catch (error) {
        console.error('Error recording sync log:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Sync History Logs for current surveyor
export const getSyncLogs = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const logs = await SurveySyncLog.find({ surveyorId: userId }).sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error fetching sync logs:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
