import mongoose from 'mongoose';

const HelpArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Article title is required'],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: 'General',
    },
    summary: {
      type: String,
      trim: true,
      default: '',
    },
    content: {
      type: String,
      required: [true, 'Article content is required'],
    },
    visibility: {
      type: String,
      enum: ['everyone', 'admin_only'],
      default: 'everyone',
      index: true,
    },
    status: {
      type: String,
      enum: ['published', 'draft'],
      default: 'published',
      index: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    authorName: {
      type: String,
      default: 'System Administrator',
    },
  },
  {
    timestamps: true,
  }
);

HelpArticleSchema.index({ title: 'text', content: 'text', tags: 'text' });

const HelpArticle = mongoose.model('HelpArticle', HelpArticleSchema);

export default HelpArticle;
