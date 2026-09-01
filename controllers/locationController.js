import Subcity from '../models/Subcity.js';
import Woreda from '../models/Woreda.js';

// Seed list of Addis Ababa's 11 subcities
const DEFAULT_SUBCITIES = [
    'Addis Ketema',
    'Akaki Kality',
    'Arada',
    'Bole',
    'Gullele',
    'Kirkos',
    'Kolfe Keranio',
    'Lemi Kura',
    'Lideta',
    'Nifas Silk-Lafto',
    'Yeka'
];

// Helper to seed locations if none exist
export const seedDefaultLocations = async () => {
    try {
        const count = await Subcity.countDocuments();
        if (count === 0) {
            console.log('No subcities found. Seeding default Addis Ababa subcities...');
            const subcityDocs = [];
            for (const name of DEFAULT_SUBCITIES) {
                const sub = await Subcity.create({ name });
                subcityDocs.push(sub);
                
                // Seed a few sample woredas per subcity
                await Woreda.create({ name: 'Woreda 01', subcity: sub._id });
                await Woreda.create({ name: 'Woreda 02', subcity: sub._id });
                await Woreda.create({ name: 'Woreda 03', subcity: sub._id });
            }
            console.log('Default subcities and sample woredas seeded successfully.');
        }
    } catch (err) {
        console.error('Error seeding default locations:', err);
    }
};

// @desc    Get all subcities
// @route   GET /api/locations/subcities
export const getSubcities = async (req, res) => {
    try {
        const subcities = await Subcity.find().sort({ name: 1 });
        res.json(subcities);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a subcity
// @route   POST /api/locations/subcities
export const createSubcity = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Name is required' });

        const existing = await Subcity.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
        if (existing) return res.status(400).json({ message: 'Subcity already exists' });

        const subcity = await Subcity.create({ name: name.trim() });
        res.status(201).json(subcity);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a subcity
// @route   DELETE /api/locations/subcities/:id
export const deleteSubcity = async (req, res) => {
    try {
        const subcity = await Subcity.findById(req.params.id);
        if (!subcity) return res.status(404).json({ message: 'Subcity not found' });

        // Also delete woredas under this subcity
        await Woreda.deleteMany({ subcity: subcity._id });
        await Subcity.findByIdAndDelete(req.params.id);

        res.json({ message: 'Subcity and its associated woredas deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all woredas
// @route   GET /api/locations/woredas
export const getWoredas = async (req, res) => {
    try {
        const { subcityId } = req.query;
        const query = {};
        if (subcityId) query.subcity = subcityId;

        const woredas = await Woreda.find(query).populate('subcity', 'name').sort({ name: 1 });
        res.json(woredas);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a woreda
// @route   POST /api/locations/woredas
export const createWoreda = async (req, res) => {
    try {
        const { name, subcityId } = req.body;
        if (!name || !subcityId) return res.status(400).json({ message: 'Name and subcityId are required' });

        const subcity = await Subcity.findById(subcityId);
        if (!subcity) return res.status(404).json({ message: 'Parent subcity not found' });

        const existing = await Woreda.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            subcity: subcityId
        });
        if (existing) return res.status(400).json({ message: 'Woreda already exists under this subcity' });

        const woreda = await Woreda.create({ name: name.trim(), subcity: subcityId });
        const populated = await Woreda.findById(woreda._id).populate('subcity', 'name');
        res.status(201).json(populated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete a woreda
// @route   DELETE /api/locations/woredas/:id
export const deleteWoreda = async (req, res) => {
    try {
        const woreda = await Woreda.findById(req.params.id);
        if (!woreda) return res.status(404).json({ message: 'Woreda not found' });

        await Woreda.findByIdAndDelete(req.params.id);
        res.json({ message: 'Woreda deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get complete administrative location hierarchy
// @route   GET /api/locations/hierarchy
export const getLocationHierarchy = async (req, res) => {
    try {
        const subcities = await Subcity.find().sort({ name: 1 }).lean();
        const woredas = await Woreda.find().sort({ name: 1 }).lean();

        const hierarchy = subcities.map(sub => {
            return {
                ...sub,
                woredas: woredas.filter(w => w.subcity.toString() === sub._id.toString())
            };
        });

        res.json(hierarchy);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
