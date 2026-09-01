import mongoose from 'mongoose';

const PasswordResetSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    resetToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null }
});

export default mongoose.model('PasswordReset', PasswordResetSchema);
