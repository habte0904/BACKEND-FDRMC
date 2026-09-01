import express from 'express';
import {
  getHelpArticles,
  getAdminHelpArticles,
  getHelpArticleBySlugOrId,
  createHelpArticle,
  updateHelpArticle,
  deleteHelpArticle,
} from '../controllers/helpArticleController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public & user route: view help articles (filtered by requesting role)
router.get('/', getHelpArticles);

// Admin-only route: get all articles including drafts
router.get('/admin/all', protect, admin, getAdminHelpArticles);

// View single article
router.get('/:slugOrId', getHelpArticleBySlugOrId);

// Admin CRUD routes
router.post('/', protect, admin, createHelpArticle);
router.put('/:id', protect, admin, updateHelpArticle);
router.delete('/:id', protect, admin, deleteHelpArticle);

export default router;
