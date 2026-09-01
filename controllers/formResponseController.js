import FormResponse from '../models/FormResponse.js';
import Template from '../models/Template.js';
import * as auditService from '../services/auditService.js';

// @desc    Submit a new form response
// @route   POST /api/responses
export const submitResponse = async (req, res) => {
    console.log("--- INCOMING SUBMISSION ---");
    console.log("Context Type:", req.body.moduleContextType);
    console.log("Template ID:", req.body.templateId);
    try {
        const {
            templateId,
            templateVersion,
            moduleContextId,
            moduleContextType,
            respondentMetadata,
            answers,
            isDraft
        } = req.body;

        // Verify template existence and status
        const template = await Template.findById(templateId);
        if (!template) {
            return res.status(404).json({ message: 'Template not found' });
        }

        if (template.status === 'Archived' && !isDraft) {
            return res.status(400).json({ message: 'Cannot submit to an archived template.' });
        }

        // Process answers to ensure unique ID per response
        const processedAnswers = new Map();
        if (answers) {
            Object.entries(answers).forEach(([key, val]) => {
                if (typeof val === 'object' && val !== null && val.answerId) {
                    processedAnswers.set(key, val);
                } else {
                    processedAnswers.set(key, {
                        value: val,
                        answerId: `ans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    });
                }
            });
        }

        const response = new FormResponse({
            templateId,
            templateVersion: templateVersion || template.version,
            moduleContextId,
            moduleContextType,
            respondentMetadata,
            answers: processedAnswers,
            isDraft: isDraft || false,
            submittedBy: req.user?._id
        });

        const savedResponse = await response.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: isDraft ? 'RESPONSE_DRAFT_CREATE' : 'RESPONSE_SUBMIT',
            resource: 'FormResponse',
            resourceId: savedResponse._id,
            after: savedResponse,
            ip: req.ip
        });

        // Increment usage count of template on final submission
        if (!isDraft) {
            await Template.findByIdAndUpdate(templateId, { $inc: { usageCount: 1 } });
        }

        res.status(201).json(savedResponse);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Get responses for a specific template or context
// @route   GET /api/responses
export const getResponses = async (req, res) => {
    try {
        const { templateId, moduleContextId, moduleContextType, isDraft } = req.query;
        let query = {};

        if (templateId && templateId !== 'all') query.templateId = templateId;
        if (moduleContextId) query.moduleContextId = moduleContextId;
        if (moduleContextType) query.moduleContextType = moduleContextType;
        if (typeof isDraft !== 'undefined') query.isDraft = isDraft === 'true';

        const responses = await FormResponse.find(query)
            .sort({ createdAt: -1 })
            .populate('submittedBy', 'fullname name email')
            .populate('templateId', 'name title category version modules');

        res.json(responses);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single response details
// @route   GET /api/responses/:id
export const getResponseById = async (req, res) => {
    try {
        const response = await FormResponse.findById(req.params.id)
            .populate('templateId', 'name version modules')
            .populate('submittedBy', 'fullname');

        if (!response) {
            return res.status(404).json({ message: 'Response not found' });
        }
        res.json(response);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a draft response
// @route   PUT /api/responses/:id
export const updateResponse = async (req, res) => {
    try {
        const response = await FormResponse.findById(req.params.id);
        if (!response) {
            return res.status(404).json({ message: 'Response not found' });
        }

        if (!response.isDraft && req.body.isDraft === false) {
            // Maybe allow editing submitted forms if user has permission, 
            // but usually submitted forms are immutable for audit.
            // For now, let's allow it if it's an update.
        }

        if (response.syncStatus === 'SYNCED') {
            response.syncStatus = 'UPDATED';
        }

        const { answers, ...rest } = req.body;
        
        // Process answers if they were sent
        if (answers) {
            const processedAnswers = response.answers || new Map();
            Object.entries(answers).forEach(([key, val]) => {
                // If value is already the structured object, keep it
                if (typeof val === 'object' && val !== null && val.answerId) {
                    processedAnswers.set(key, val);
                } else {
                    // Otherwise wrap/update the value but keep or generate ID
                    const existing = processedAnswers.get(key);
                    processedAnswers.set(key, {
                        value: val,
                        answerId: existing?.answerId || `ans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    });
                }
            });
            response.answers = processedAnswers;
        }

        const before = response.toObject();
        Object.assign(response, rest);
        const updatedResponse = await response.save();

        await auditService.logAction({
            userId: req.user?._id,
            action: 'RESPONSE_UPDATE',
            resource: 'FormResponse',
            resourceId: updatedResponse._id,
            before,
            after: updatedResponse,
            ip: req.ip
        });

        res.json(updatedResponse);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Export responses to CSV
// @route   GET /api/responses/export/:templateId
export const exportToCSV = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { Parser } = await import('json2csv');

        const responses = await FormResponse.find({ templateId, isDraft: false });
        const template = await Template.findById(templateId);

        if (!responses.length) {
            return res.status(404).json({ message: 'No responses found for this template' });
        }

        // Flatten answers for CSV
        const data = responses.map(r => {
            const flattened = {
                submission_id: r._id,
                submitted_at: r.submittedAt,
                enumerator: r.respondentMetadata?.fullName || 'N/A'
            };

            // Map answers to columns
            if (r.answers instanceof Map) {
                r.answers.forEach((val, key) => {
                    if (typeof val === 'object' && val !== null) {
                        flattened[key] = JSON.stringify(val);
                    } else {
                        flattened[key] = val;
                    }
                });
            } else if (typeof r.answers === 'object' && r.answers !== null) {
                Object.entries(r.answers).forEach(([key, val]) => {
                    if (typeof val === 'object' && val !== null) {
                        flattened[key] = JSON.stringify(val);
                    } else {
                        flattened[key] = val;
                    }
                });
            }

            return flattened;
        });

        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment(`${template?.name?.replace(/\s+/g, '_') || 'export'}_${Date.now()}.csv`);
        return res.send(csv);

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ message: 'Error generating export' });
    }
};

// @desc    Delete a response
// @route   DELETE /api/responses/:id
export const deleteResponse = async (req, res) => {
    try {
        const response = await FormResponse.findById(req.params.id);
        if (!response) {
            return res.status(404).json({ message: 'Response not found' });
        }

        const before = response.toObject();
        await FormResponse.findByIdAndDelete(req.params.id);

        await auditService.logAction({
            userId: req.user?._id,
            action: 'RESPONSE_DELETE',
            resource: 'FormResponse',
            resourceId: req.params.id,
            before,
            ip: req.ip
        });

        res.json({ message: 'Response deleted successfully from tracking' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
