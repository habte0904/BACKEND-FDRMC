import mongoose from 'mongoose';

const NewsCommentSchema = new mongoose.Schema({
  news: { type: mongoose.Schema.Types.ObjectId, ref: 'News', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  guestName: { type: String, trim: true, default: 'Public Visitor' },
  parentComment: { type: mongoose.Schema.Types.ObjectId, ref: 'NewsComment', default: null },
  content: { type: String, trim: true, required: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

NewsCommentSchema.index({ news: 1, createdAt: -1 });

export default mongoose.model('NewsComment', NewsCommentSchema);
