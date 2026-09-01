import mongoose from 'mongoose';

const NewsReactionSchema = new mongoose.Schema({
  news: { type: mongoose.Schema.Types.ObjectId, ref: 'News', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestIdentifier: { type: String, trim: true, default: '' },
  reactionType: { type: String, enum: ['like','love','celebrate','support','insightful'], default: 'like' },
}, { timestamps: true });

NewsReactionSchema.index({ news: 1, user: 1 });
NewsReactionSchema.index({ news: 1, guestIdentifier: 1 });

export default mongoose.model('NewsReaction', NewsReactionSchema);
