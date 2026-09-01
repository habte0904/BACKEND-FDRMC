import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaProfile from '../models/WoredaProfile.js';

export const getHouseholdProfiles = async (req, res) => {
    try {
        const { subcity, woreda, block, house_no } = req.query;
        const query = {};
        if (subcity) query['location.subcity'] = new RegExp(`^${subcity}$`, 'i');
        if (woreda) query['location.woreda'] = new RegExp(`^${woreda}$`, 'i');
        if (block) query['location.block'] = new RegExp(`^${block}$`, 'i');
        if (house_no) query['location.house_no'] = new RegExp(`^${house_no}$`, 'i');

        const profiles = await HouseholdProfile.find(query).populate('createdBy', 'name email');
        res.json(profiles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const checkHouseholdHouseNo = async (req, res) => {
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

        const existing = await HouseholdProfile.findOne(query).populate('createdBy', 'name email');
        if (existing) {
            return res.json({
                exists: true,
                profile: {
                    _id: existing._id,
                    location: existing.location,
                    assessment_date: existing.assessment_date,
                    status: existing.status,
                    createdAt: existing.createdAt
                }
            });
        }

        // Also check legacy WoredaProfile
        const legacyQuery = {
            'location.house_no': new RegExp(`^${house_no.trim()}$`, 'i'),
            aggregation_level: 'household'
        };
        if (woreda) legacyQuery['location.woreda'] = new RegExp(`^${woreda.trim()}$`, 'i');
        if (excludeId) legacyQuery._id = { $ne: excludeId };

        const legacyExisting = await WoredaProfile.findOne(legacyQuery);
        if (legacyExisting) {
            return res.json({
                exists: true,
                profile: {
                    _id: legacyExisting._id,
                    location: legacyExisting.location,
                    assessment_date: legacyExisting.assessment_date,
                    status: legacyExisting.status,
                    createdAt: legacyExisting.createdAt
                }
            });
        }

        return res.json({ exists: false });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getHouseholdProfileById = async (req, res) => {
    try {
        let profile = await HouseholdProfile.findById(req.params.id).populate('createdBy', 'name email');
        if (!profile) {
            // Fall back to legacy WoredaProfile household records
            profile = await WoredaProfile.findById(req.params.id);
        }
        if (!profile) return res.status(404).json({ message: 'Household profile not found' });
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const createHouseholdProfile = async (req, res) => {
    try {
        const { allowUpdateIfDuplicate, ...bodyData } = req.body;
        const houseNo = bodyData.location?.house_no || bodyData.identity_location?.house_no;
        const woreda = bodyData.location?.woreda || bodyData.identity_location?.woreda;

        const isUnnumbered = !houseNo || !houseNo.trim() || ['none', 'n/a', 'no house no', 'no house number', 'unnumbered'].includes(houseNo.trim().toLowerCase());

        if (!isUnnumbered && woreda) {
            const existing = await HouseholdProfile.findOne({
                'location.woreda': new RegExp(`^${woreda.trim()}$`, 'i'),
                'location.house_no': new RegExp(`^${houseNo.trim()}$`, 'i')
            });

            if (existing) {
                if (allowUpdateIfDuplicate) {
                    const updated = await HouseholdProfile.findByIdAndUpdate(
                        existing._id,
                        { ...bodyData, updatedBy: req.user?._id },
                        { new: true, runValidators: true }
                    );
                    return res.status(200).json({ ...updated.toObject(), wasUpdated: true });
                } else {
                    return res.status(409).json({
                        message: `Household Profile with House No "${houseNo}" already exists in ${woreda}.`,
                        conflict: true,
                        existingId: existing._id,
                        existingProfile: {
                            _id: existing._id,
                            location: existing.location,
                            assessment_date: existing.assessment_date,
                            status: existing.status
                        }
                    });
                }
            }
        }

        const profileData = { ...bodyData, createdBy: req.user?._id };
        const profile = new HouseholdProfile(profileData);
        const saved = await profile.save();
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const updateHouseholdProfile = async (req, res) => {
    try {
        let profile = await HouseholdProfile.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!profile) {
            const wp = await WoredaProfile.findById(req.params.id);
            if (wp) {
                wp.location = req.body.location || wp.location;
                wp.assessment_date = req.body.assessment_date || wp.assessment_date;
                wp.remarks = req.body.remarks || wp.remarks;
                wp.status = req.body.status || wp.status;
                
                wp.household_profile = {
                    ...(wp.household_profile || {}),
                    identity_location: req.body.identity_location || wp.household_profile?.identity_location,
                    demographics: req.body.demographics || wp.household_profile?.demographics,
                    livelihood_economy: req.body.livelihood_economy || wp.household_profile?.livelihood_economy,
                    housing_physical_conditions: req.body.housing_physical_conditions || wp.household_profile?.housing_physical_conditions,
                    preparedness: req.body.preparedness || wp.household_profile?.preparedness,
                    recovery_capacity: req.body.recovery_capacity || wp.household_profile?.recovery_capacity
                };
                
                profile = await wp.save();
            }
        }
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.json(profile);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteHouseholdProfile = async (req, res) => {
    try {
        let profile = await HouseholdProfile.findByIdAndDelete(req.params.id);
        if (!profile) {
            profile = await WoredaProfile.findByIdAndDelete(req.params.id);
        }
        if (!profile) return res.status(404).json({ message: 'Profile not found' });
        res.json({ message: 'Profile deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
