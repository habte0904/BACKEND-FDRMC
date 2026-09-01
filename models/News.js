import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
  type: { type: String, trim: true, default: '' },
  url: { type: String, trim: true, default: '' },
  thumbnail: { type: String, trim: true, default: '' },
  name: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 }
}, { _id: false });

const ReactionCountsSchema = new mongoose.Schema({
  like: { type: Number, default: 0 },
  love: { type: Number, default: 0 },
  celebrate: { type: Number, default: 0 },
  support: { type: Number, default: 0 },
  insightful: { type: Number, default: 0 }
}, { _id: false });

const NewsSchema = new mongoose.Schema({
  title: { type: String, trim: true, default: '', required: true },
  slug: { type: String, trim: true, unique: true, index: true },
  subtitle: { type: String, trim: true, default: '' },
  summary: { type: String, trim: true, default: '' },
  content: { type: String, trim: true, default: '' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },

  category: { type: String, trim: true, default: 'Announcements' },
  tags: { type: [String], default: [] },
  location: { type: String, trim: true, default: '' },
  visibility: { type: String, enum: ['Public','Organization','Branch','Department','Team','Private'], default: 'Public' },

  coverImage: { type: String, trim: true, default: '' },
  youtubeUrl: { type: String, trim: true, default: '' },
  videoUrl: { type: String, trim: true, default: '' },
  mediaType: { type: String, enum: ['image', 'youtube', 'video'], default: 'image' },
  gallery: [
    {
      url: { type: String, trim: true, default: '' },
      caption: { type: String, trim: true, default: '' }
    }
  ],
  attachments: { type: [AttachmentSchema], default: [] },

  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'archived'],
    default: 'draft',
    index: true
  },
  isFeatured: { type: Boolean, default: false, index: true },
  rejectionReason: { type: String, trim: true, default: '' },

  reactionCounts: { type: ReactionCountsSchema, default: () => ({}) },

  commentsCount: { type: Number, default: 0 },
  sharesCount: { type: Number, default: 0 },
  viewsCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  readingTime: { type: Number, default: 1 },
  allowComments: { type: Boolean, default: true },

  isPinned: { type: Boolean, default: false },
  isPublished: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false },

  publishedAt: { type: Date },
  scheduledAt: { type: Date },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  createdByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes for performance
NewsSchema.index({ author: 1 });
NewsSchema.index({ category: 1 });
NewsSchema.index({ createdAt: -1 });
NewsSchema.index({ publishedAt: -1 });
NewsSchema.index({ status: 1, publishedAt: -1 });
NewsSchema.index({ status: 1, category: 1 });
NewsSchema.index({ status: 1, isFeatured: 1 });
NewsSchema.index({ isPinned: -1, isPublished: -1 });

export default mongoose.model('News', NewsSchema);
