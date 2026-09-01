import News from '../models/News.js';
import NewsReaction from '../models/NewsReaction.js';
import NewsComment from '../models/NewsComment.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Helper to generate URL-safe unique slugs
export const generateSlug = async (title, currentId = null) => {
  if (!title) title = 'news-article';
  let baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!baseSlug) baseSlug = 'news';

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const query = { slug };
    if (currentId) {
      query._id = { $ne: currentId };
    }
    const existing = await News.findOne(query);
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

// Calculate reading time in minutes
export const calculateReadingTime = (content = '') => {
  const plainText = content.replace(/<[^>]+>/g, '');
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200));
};

// --- PUBLIC NEWS SERVICES ---

// List only APPROVED and non-archived news for public page
export const listPublicNews = async (query = {}, options = {}) => {
  const page = parseInt(options.page || query.page, 10) || 1;
  const limit = Math.min(parseInt(options.limit || query.limit, 10) || 12, 50);
  const skip = (page - 1) * limit;

  const filter = {
    status: 'approved',
    isArchived: { $ne: true }
  };

  if (query.category && query.category !== 'All') {
    filter.category = query.category;
  }

  if (query.q && query.q.trim()) {
    const qRegex = new RegExp(query.q.trim(), 'i');
    filter.$or = [
      { title: qRegex },
      { subtitle: qRegex },
      { summary: qRegex },
      { content: qRegex },
      { tags: qRegex },
      { category: qRegex }
    ];
  }

  if (query.isFeatured !== undefined) {
    filter.isFeatured = query.isFeatured === 'true' || query.isFeatured === true;
  }

  const docs = await News.find(filter)
    .sort({ isPinned: -1, isFeatured: -1, publishedAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'fullname profileImage roles organization department')
    .lean();

  const total = await News.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;

  return { docs, total, page, limit, totalPages };
};

// Get single approved news article by slug OR ObjectId
export const getPublicNewsBySlugOrId = async (slugOrId) => {
  const cleanTerm = (slugOrId || '').trim();
  if (!cleanTerm) return null;

  const slugRegex = new RegExp(`^${cleanTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
  const orConditions = [{ slug: cleanTerm }, { slug: slugRegex }];

  if (mongoose.Types.ObjectId.isValid(cleanTerm)) {
    orConditions.push({ _id: cleanTerm });
  }

  const news = await News.findOne({
    status: 'approved',
    isArchived: { $ne: true },
    $or: orConditions
  })
    .populate('author', 'fullname profileImage roles organization department')
    .populate('createdBy', 'fullname profileImage')
    .populate('approvedBy', 'fullname')
    .lean();

  if (!news) return null;

  // Increment views count atomically
  await News.findByIdAndUpdate(news._id, {
    $inc: { views: 1, viewsCount: 1 }
  });

  return news;
};

// Get featured approved news article
export const getFeaturedPublicNews = async () => {
  let featured = await News.findOne({
    status: 'approved',
    isFeatured: true,
    isArchived: { $ne: true }
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .populate('author', 'fullname profileImage roles')
    .lean();

  if (!featured) {
    // Fallback to latest approved news
    featured = await News.findOne({
      status: 'approved',
      isArchived: { $ne: true }
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('author', 'fullname profileImage roles')
      .lean();
  }

  return featured;
};

// Get related public news articles (same category or shared tags)
export const getRelatedPublicNews = async (currentNewsId, category, tags = [], limit = 3) => {
  const filter = {
    _id: { $ne: currentNewsId },
    status: 'approved',
    isArchived: { $ne: true }
  };

  if (category) {
    filter.category = category;
  }

  let docs = await News.find(filter)
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit)
    .populate('author', 'fullname profileImage')
    .lean();

  if (docs.length < limit) {
    // Fallback query without category restriction
    const extraDocs = await News.find({
      _id: { $ne: currentNewsId, $nin: docs.map(d => d._id) },
      status: 'approved',
      isArchived: { $ne: true }
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit - docs.length)
      .populate('author', 'fullname profileImage')
      .lean();

    docs = [...docs, ...extraDocs];
  }

  return docs;
};

// Get distinct categories dynamically from approved admin posts with article counts
export const getPublicCategories = async () => {
  const counts = await News.aggregate([
    { $match: { status: 'approved', isArchived: { $ne: true } } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  const countMap = {};
  const dbCategories = [];

  counts.forEach(item => {
    if (item._id && item._id.trim()) {
      const cat = item._id.trim();
      countMap[cat] = item.count;
      if (!dbCategories.includes(cat)) {
        dbCategories.push(cat);
      }
    }
  });

  const defaultFallbacks = [
    'Announcements',
    'Disaster Risk Management',
    'Emergency Response',
    'Training',
    'Events'
  ];

  const mergedCategories = Array.from(new Set([...dbCategories, ...defaultFallbacks]));
  const categories = ['All', ...mergedCategories];

  return { categories, countMap };
};

// --- ADMIN NEWS SERVICES ---

export const listAdminNews = async (query = {}, options = {}) => {
  const page = parseInt(options.page || query.page, 10) || 1;
  const limit = Math.min(parseInt(options.limit || query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  if (query.category && query.category !== 'All') {
    filter.category = query.category;
  }

  if (query.q && query.q.trim()) {
    const qRegex = new RegExp(query.q.trim(), 'i');
    filter.$or = [
      { title: qRegex },
      { subtitle: qRegex },
      { summary: qRegex },
      { content: qRegex },
      { tags: qRegex }
    ];
  }

  const docs = await News.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'fullname profileImage email roles')
    .populate('approvedBy', 'fullname email')
    .populate('createdBy', 'fullname email')
    .lean();

  const total = await News.countDocuments(filter);
  const totalPages = Math.ceil(total / limit) || 1;

  // Status counts for admin header statistics
  const statusCounts = {
    all: await News.countDocuments({}),
    draft: await News.countDocuments({ status: 'draft' }),
    pending: await News.countDocuments({ status: 'pending' }),
    approved: await News.countDocuments({ status: 'approved' }),
    rejected: await News.countDocuments({ status: 'rejected' }),
    archived: await News.countDocuments({ status: 'archived' })
  };

  return { docs, total, page, limit, totalPages, statusCounts };
};

export const createNews = async (data, user) => {
  data.author = user?._id || data.author;
  data.createdBy = user?._id || data.createdBy;
  data.createdByUser = user?._id;
  data.lastUpdatedByUser = user?._id;

  if (!data.slug) {
    data.slug = await generateSlug(data.title);
  } else {
    data.slug = await generateSlug(data.slug);
  }

  if (!data.summary && data.content) {
    const plainText = data.content.replace(/<[^>]+>/g, '').trim();
    data.summary = plainText.length > 200 ? `${plainText.substring(0, 200)}...` : plainText;
  }

  data.readingTime = calculateReadingTime(data.content || '');

  // Default status: draft
  if (!data.status) data.status = 'draft';

  if (data.status === 'approved') {
    data.approvedBy = user?._id;
    data.approvedAt = new Date();
    data.publishedAt = data.publishedAt || new Date();
    data.isPublished = true;
  }

  const news = await News.create(data);
  return news;
};

export const updateNews = async (id, data, user) => {
  data.lastUpdatedByUser = user?._id;

  if (data.title && !data.slug) {
    data.slug = await generateSlug(data.title, id);
  }

  if (data.content) {
    data.readingTime = calculateReadingTime(data.content);
    if (!data.summary) {
      const plainText = data.content.replace(/<[^>]+>/g, '').trim();
      data.summary = plainText.length > 200 ? `${plainText.substring(0, 200)}...` : plainText;
    }
  }

  const updated = await News.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  return updated;
};

export const getNewsById = async (id) => {
  return await News.findById(id)
    .populate('author', 'fullname profileImage roles organization department')
    .populate('approvedBy', 'fullname email')
    .populate('createdBy', 'fullname email')
    .lean();
};

// WORKFLOW TRANSITIONS

export const submitNews = async (id, user) => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.status = 'pending';
  news.rejectionReason = '';
  news.lastUpdatedByUser = user?._id;
  await news.save();
  return news;
};

export const approveNews = async (id, user) => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.status = 'approved';
  news.approvedBy = user?._id;
  news.approvedAt = new Date();
  news.publishedAt = news.publishedAt || new Date();
  news.isPublished = true;
  news.isArchived = false;
  news.rejectionReason = '';
  news.lastUpdatedByUser = user?._id;

  await news.save();
  return news;
};

export const rejectNews = async (id, user, rejectionReason = '') => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.status = 'rejected';
  news.rejectionReason = rejectionReason || 'The article was rejected by the approver.';
  news.lastUpdatedByUser = user?._id;

  await news.save();
  return news;
};

export const publishNews = async (id, user) => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.status = 'approved';
  news.isPublished = true;
  news.publishedAt = new Date();
  news.lastUpdatedByUser = user?._id;
  await news.save();
  return news;
};

export const unpublishNews = async (id, user) => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.status = 'draft';
  news.isPublished = false;
  news.lastUpdatedByUser = user?._id;
  await news.save();
  return news;
};

export const archiveNews = async (id, user) => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.status = 'archived';
  news.isArchived = true;
  news.lastUpdatedByUser = user?._id;
  await news.save();
  return news;
};

export const deleteNewsPermanently = async (id) => {
  const news = await News.findByIdAndDelete(id);
  if (!news) throw new Error('News article not found');
  await NewsComment.deleteMany({ news: id });
  await NewsReaction.deleteMany({ news: id });
  return news;
};

export const pinNews = async (id, pin, user) => {
  const news = await News.findById(id);
  if (!news) throw new Error('News article not found');

  news.isPinned = !!pin;
  news.lastUpdatedByUser = user?._id;
  await news.save();
  return news;
};

// --- INTERACTIONS (REACTIONS & COMMENTS - Supports Guests) ---

export const reactToNews = async (newsId, userId = null, guestIdentifier = '', reactionType = 'like') => {
  const filter = { news: newsId };
  if (userId) {
    filter.user = userId;
  } else {
    filter.guestIdentifier = guestIdentifier || 'anonymous_guest';
  }

  const existing = await NewsReaction.findOne(filter);
  if (existing) {
    if (existing.reactionType === reactionType) {
      // Remove reaction (toggle off)
      await NewsReaction.deleteOne({ _id: existing._id });
      await decrementReactionCount(newsId, reactionType);
      return { action: 'removed', reactionType };
    } else {
      const prevType = existing.reactionType;
      existing.reactionType = reactionType;
      await existing.save();
      await decrementReactionCount(newsId, prevType);
      await incrementReactionCount(newsId, reactionType);
      return { action: 'updated', reactionType };
    }
  } else {
    await NewsReaction.create({
      news: newsId,
      user: userId,
      guestIdentifier: guestIdentifier || 'anonymous_guest',
      reactionType
    });
    await incrementReactionCount(newsId, reactionType);
    return { action: 'added', reactionType };
  }
};

const incrementReactionCount = async (newsId, reactionType) => {
  const key = `reactionCounts.${reactionType}`;
  await News.findByIdAndUpdate(newsId, {
    $inc: { [key]: 1, likes: reactionType === 'like' ? 1 : 0 }
  });
};

const decrementReactionCount = async (newsId, reactionType) => {
  const key = `reactionCounts.${reactionType}`;
  await News.findByIdAndUpdate(newsId, {
    $inc: { [key]: -1, likes: reactionType === 'like' ? -1 : 0 }
  });
};

// Add comment (Authenticated user or Guest)
export const addComment = async (newsId, userId = null, guestName = 'Public Visitor', content = '', parentComment = null) => {
  const comment = await NewsComment.create({
    news: newsId,
    user: userId,
    guestName: guestName || 'Public Visitor',
    content,
    parentComment
  });

  await News.findByIdAndUpdate(newsId, { $inc: { commentsCount: 1 } });

  const populated = await NewsComment.findById(comment._id)
    .populate('user', 'fullname profileImage')
    .lean();

  return populated;
};

// List comments for an article
export const listComments = async (newsId, page = 1, limit = 50) => {
  const skip = (page - 1) * limit;
  const comments = await NewsComment.find({ news: newsId, parentComment: null, isDeleted: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'fullname profileImage')
    .lean();

  // Populate replies for each comment
  for (let c of comments) {
    const replies = await NewsComment.find({ parentComment: c._id, isDeleted: false })
      .sort({ createdAt: 1 })
      .populate('user', 'fullname profileImage')
      .lean();
    c.replies = replies || [];
  }

  const total = await NewsComment.countDocuments({ news: newsId, parentComment: null, isDeleted: false });
  return { comments, total, page, limit };
};

// Reply to existing comment
export const replyToComment = async (commentId, userId = null, guestName = 'Public Visitor', content = '') => {
  const parent = await NewsComment.findById(commentId);
  if (!parent) throw new Error('Parent comment not found');

  const reply = await NewsComment.create({
    news: parent.news,
    user: userId,
    guestName: guestName || 'Public Visitor',
    content,
    parentComment: parent._id
  });

  await News.findByIdAndUpdate(parent.news, { $inc: { commentsCount: 1 } });

  const populated = await NewsComment.findById(reply._id)
    .populate('user', 'fullname profileImage')
    .lean();

  return populated;
};

export const shareNews = async (newsId) => {
  await News.findByIdAndUpdate(newsId, { $inc: { sharesCount: 1 } });
  return { success: true };
};
