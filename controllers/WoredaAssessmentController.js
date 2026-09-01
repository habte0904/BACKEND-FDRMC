import WoredaAssessment from '../models/WoredaAssessment.js';

export const getWoredaAssessments = async (req, res) => {
    try {
        const { subcity, woreda, house_no, block } = req.query;
        const query = { ...(req.dataScope || {}) };
        if (subcity) query['location.subcity'] = new RegExp(`^${subcity}$`, 'i');
        if (woreda) query['location.woreda'] = new RegExp(`^${woreda}$`, 'i');
        if (block) query['location.block'] = new RegExp(`^${block}$`, 'i');
        if (house_no) query['location.house_no'] = new RegExp(`^${house_no}$`, 'i');

        const assessments = await WoredaAssessment.find(query).populate('createdBy', 'name email');
        res.json(assessments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const checkWoredaAssessmentHouseNo = async (req, res) => {
    try {
        const { woreda, subcity, house_no, excludeId } = req.query;
        if (!house_no || !house_no.trim() || ['none', 'n/a', 'no house no', 'no house number', 'unnumbered'].includes(house_no.trim().toLowerCase())) {
            return res.json({ exists: false, isUnnumbered: true });
        }

        const query = {
            'location.house_no': new RegExp(`^${house_no.trim()}$`, 'i')
        };
        if (woreda) {
            query['location.woreda'] = new RegExp(`^${woreda.trim()}$`, 'i');
        }
        if (subcity) {
            query['location.subcity'] = new RegExp(`^${subcity.trim()}$`, 'i');
        }
        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const existing = await WoredaAssessment.findOne(query).populate('createdBy', 'name email');
        if (existing) {
            return res.json({
                exists: true,
                assessment: {
                    _id: existing._id,
                    location: existing.location,
                    assessment_date: existing.assessment_date,
                    status: existing.status,
                    createdAt: existing.createdAt
                }
            });
        }

        return res.json({ exists: false });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getWoredaAssessmentById = async (req, res) => {
    try {
        const assessment = await WoredaAssessment.findById(req.params.id).populate('createdBy', 'name email');
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        res.json(assessment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createWoredaAssessment = async (req, res) => {
    try {
        const { allowUpdateIfDuplicate, ...bodyData } = req.body;
        const houseNo = bodyData.location?.house_no;
        const woreda = bodyData.location?.woreda;

        const isUnnumbered = !houseNo || !houseNo.trim() || ['none', 'n/a', 'no house no', 'no house number', 'unnumbered'].includes(houseNo.trim().toLowerCase());

        if (!isUnnumbered && woreda) {
            const existing = await WoredaAssessment.findOne({
                'location.woreda': new RegExp(`^${woreda.trim()}$`, 'i'),
                'location.house_no': new RegExp(`^${houseNo.trim()}$`, 'i')
            });

            if (existing) {
                if (allowUpdateIfDuplicate) {
                    const updated = await WoredaAssessment.findByIdAndUpdate(
                        existing._id,
                        { ...bodyData, updatedBy: req.user?._id },
                        { new: true, runValidators: true }
                    );
                    return res.status(200).json({ ...updated.toObject(), wasUpdated: true });
                } else {
                    return res.status(409).json({
                        message: `Woreda Assessment with House No "${houseNo}" already exists in ${woreda}.`,
                        conflict: true,
                        existingId: existing._id,
                        existingAssessment: {
                            _id: existing._id,
                            location: existing.location,
                            assessment_date: existing.assessment_date,
                            status: existing.status
                        }
                    });
                }
            }
        }

        const assessmentData = { ...bodyData, createdBy: req.user?._id };
        const assessment = new WoredaAssessment(assessmentData);
        const saved = await assessment.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateWoredaAssessment = async (req, res) => {
    try {
        const assessment = await WoredaAssessment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        res.json(assessment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteWoredaAssessment = async (req, res) => {
    try {
        const assessment = await WoredaAssessment.findByIdAndDelete(req.params.id);
        if (!assessment) return res.status(404).json({ message: 'Assessment not found' });
        res.json({ message: 'Assessment deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
