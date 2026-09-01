import * as newsService from '../services/newsService.js';
import News from '../models/News.js';

// --- PUBLIC CONTROLLERS ---

export const listPublicNews = async (req, res) => {
  try {
    const result = await newsService.listPublicNews(req.query);
    res.json(result);
  } catch (err) {
    console.error('List public news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getPublicNewsDetail = async (req, res) => {
  try {
    const slugOrId = req.params.slug || req.params.id;
    const news = await newsService.getPublicNewsBySlugOrId(slugOrId);
    if (!news) {
      return res.status(404).json({ message: 'News article not found' });
    }
    res.json(news);
  } catch (err) {
    console.error('Get public news detail error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getFeaturedPublicNews = async (req, res) => {
  try {
    const news = await newsService.getFeaturedPublicNews();
    res.json(news || null);
  } catch (err) {
    console.error('Get featured public news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getPublicCategories = async (req, res) => {
  try {
    const categories = await newsService.getPublicCategories();
    res.json(categories);
  } catch (err) {
    console.error('Get public categories error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getRelatedPublicNews = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, tags } = req.query;
    const tagList = tags ? String(tags).split(',') : [];
    const related = await newsService.getRelatedPublicNews(id, category, tagList);
    res.json(related);
  } catch (err) {
    console.error('Get related news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const publicReact = async (req, res) => {
  try {
    const { id } = req.params;
    const { reactionType, guestIdentifier } = req.body;
    const userId = req.user?._id || null;
    const guestId = guestIdentifier || req.ip || 'anonymous';
    const result = await newsService.reactToNews(id, userId, guestId, reactionType || 'like');
    res.json(result);
  } catch (err) {
    console.error('Public react error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const publicAddComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, guestName, parentComment } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    const userId = req.user?._id || null;
    const authorName = req.user?.fullname || guestName || 'Public Visitor';
    const comment = await newsService.addComment(id, userId, authorName, content, parentComment || null);
    res.status(201).json(comment);
  } catch (err) {
    console.error('Public add comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const publicListComments = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const result = await newsService.listComments(id, page, limit);
    res.json(result);
  } catch (err) {
    console.error('Public list comments error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const publicReplyComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content, guestName } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply content is required' });
    }
    const userId = req.user?._id || null;
    const authorName = req.user?.fullname || guestName || 'Public Visitor';
    const reply = await newsService.replyToComment(commentId, userId, authorName, content);
    res.status(201).json(reply);
  } catch (err) {
    console.error('Public reply comment error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const publicShare = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await newsService.shareNews(id);
    res.json(result);
  } catch (err) {
    console.error('Public share error:', err);
    res.status(500).json({ message: err.message });
  }
};

// --- ADMIN CONTROLLERS ---

export const listAdminNews = async (req, res) => {
  try {
    const result = await newsService.listAdminNews(req.query);
    res.json(result);
  } catch (err) {
    console.error('List admin news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const createNews = async (req, res) => {
  try {
    const payload = req.body;
    payload.organization = req.user?.organization || payload.organization;
    payload.author = req.user?._id || payload.author;
    const created = await newsService.createNews(payload, req.user);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getNews = async (req, res) => {
  try {
    const news = await newsService.getNewsById(req.params.id);
    if (!news) return res.status(404).json({ message: 'News not found' });
    res.json(news);
  } catch (err) {
    console.error('Get admin news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const updateNews = async (req, res) => {
  try {
    const id = req.params.id;
    const updated = await newsService.updateNews(id, req.body, req.user);
    res.json(updated);
  } catch (err) {
    console.error('Update admin news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteNews = async (req, res) => {
  try {
    const id = req.params.id;
    const archived = await newsService.archiveNews(id, req.user);
    res.json({ message: 'News archived successfully', archived });
  } catch (err) {
    console.error('Archive news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteNewsPermanently = async (req, res) => {
  try {
    const id = req.params.id;
    await newsService.deleteNewsPermanently(id);
    res.json({ message: 'News article permanently deleted' });
  } catch (err) {
    console.error('Delete news permanently error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const submitNews = async (req, res) => {
  try {
    const id = req.params.id;
    const submitted = await newsService.submitNews(id, req.user);
    res.json({ message: 'Submitted for approval', news: submitted });
  } catch (err) {
    console.error('Submit news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const approveNews = async (req, res) => {
  try {
    const id = req.params.id;
    const approved = await newsService.approveNews(id, req.user);
    res.json({ message: 'News article approved successfully', news: approved });
  } catch (err) {
    console.error('Approve news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const rejectNews = async (req, res) => {
  try {
    const id = req.params.id;
    const { rejectionReason } = req.body;
    const rejected = await newsService.rejectNews(id, req.user, rejectionReason);
    res.json({ message: 'News article rejected', news: rejected });
  } catch (err) {
    console.error('Reject news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const publishNews = async (req, res) => {
  try {
    const id = req.params.id;
    const published = await newsService.publishNews(id, req.user);
    res.json(published);
  } catch (err) {
    console.error('Publish news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const unpublishNews = async (req, res) => {
  try {
    const id = req.params.id;
    const unpublished = await newsService.unpublishNews(id, req.user);
    res.json(unpublished);
  } catch (err) {
    console.error('Unpublish news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const archiveNews = async (req, res) => {
  try {
    const id = req.params.id;
    const archived = await newsService.archiveNews(id, req.user);
    res.json(archived);
  } catch (err) {
    console.error('Archive news error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const pinNews = async (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body;
    const result = await newsService.pinNews(id, action === 'pin', req.user);
    res.json(result);
  } catch (err) {
    console.error('Pin news error:', err);
    res.status(500).json({ message: err.message });
  }
};
