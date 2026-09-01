import mongoose from 'mongoose';

const woredaSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    subcity: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcity', required: true }
}, { timestamps: true });

// Ensure woreda name is unique within a subcity
woredaSchema.index({ name: 1, subcity: 1 }, { unique: true });

export default mongoose.model('Woreda', woredaSchema);
