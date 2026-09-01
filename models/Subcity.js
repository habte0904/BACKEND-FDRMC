import mongoose from 'mongoose';

const subcitySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true }
}, { timestamps: true });

export default mongoose.model('Subcity', subcitySchema);
