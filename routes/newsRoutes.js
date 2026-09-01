import express from 'express';
import {
  listPublicNews,
  getPublicNewsDetail,
  getFeaturedPublicNews,
  getPublicCategories,
  getRelatedPublicNews,
  publicReact,
  publicAddComment,
  publicListComments,
  publicReplyComment,
  publicShare,
  listAdminNews,
  createNews,
  getNews,
  updateNews,
  deleteNews,
  deleteNewsPermanently,
  submitNews,
  approveNews,
  rejectNews,
  publishNews,
  unpublishNews,
  archiveNews,
  pinNews
} from '../controllers/newsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

const router = express.Router();

// --- PUBLIC UNPROTECTED ROUTES ---
router.get('/public', listPublicNews);
router.get('/featured', getFeaturedPublicNews);
router.get('/categories', getPublicCategories);
router.get('/search', listPublicNews);
router.get('/detail/:slug', getPublicNewsDetail);
router.get('/related/:id', getRelatedPublicNews);

// Public reactions, comments, replies & sharing (no login mandatory)
router.post('/:id/reactions', publicReact);
router.get('/:id/comments', publicListComments);
router.post('/:id/comments', publicAddComment);
router.post('/comments/:commentId/replies', publicReplyComment);
router.post('/:id/share', publicShare);

// Default GET /api/news returns public approved news
router.get('/', listPublicNews);

// --- PROTECTED ADMIN WORKFLOW ROUTES ---
// Admin news management list
router.get('/admin', protect, checkPermission('news', 'view'), listAdminNews);
router.get('/admin/list', protect, checkPermission('news', 'view'), listAdminNews);

// Create news
router.post('/', protect, checkPermission('news', 'create'), createNews);
router.post('/admin', protect, checkPermission('news', 'create'), createNews);

// Admin detail, edit, delete (archive & permanent delete)
router.get('/admin/:id', protect, checkPermission('news', 'view'), getNews);
router.put('/admin/:id', protect, checkPermission('news', 'update'), updateNews);
router.put('/:id', protect, checkPermission('news', 'update'), updateNews);
router.delete('/admin/:id/permanent', protect, checkPermission('news', 'delete'), deleteNewsPermanently);
router.delete('/:id/permanent', protect, checkPermission('news', 'delete'), deleteNewsPermanently);
router.delete('/admin/:id', protect, checkPermission('news', 'delete'), deleteNews);
router.delete('/:id', protect, checkPermission('news', 'delete'), deleteNews);

// Workflow actions
router.post('/admin/:id/submit', protect, checkPermission('news', 'submit'), submitNews);
router.post('/:id/submit', protect, checkPermission('news', 'submit'), submitNews);

router.post('/admin/:id/approve', protect, checkPermission('news', 'approve'), approveNews);
router.post('/:id/approve', protect, checkPermission('news', 'approve'), approveNews);

router.post('/admin/:id/reject', protect, checkPermission('news', 'reject'), rejectNews);
router.post('/:id/reject', protect, checkPermission('news', 'reject'), rejectNews);

router.post('/admin/:id/publish', protect, checkPermission('news', 'publish'), publishNews);
router.post('/:id/publish', protect, checkPermission('news', 'publish'), publishNews);

router.post('/admin/:id/unpublish', protect, checkPermission('news', 'publish'), unpublishNews);
router.post('/:id/unpublish', protect, checkPermission('news', 'publish'), unpublishNews);

router.post('/admin/:id/archive', protect, checkPermission('news', 'archive'), archiveNews);
router.post('/:id/archive', protect, checkPermission('news', 'archive'), archiveNews);

router.post('/admin/:id/pin', protect, checkPermission('news', 'pin'), pinNews);
router.post('/:id/pin', protect, checkPermission('news', 'pin'), pinNews);

// Fallback detail lookup by slug/id for public route: GET /api/news/:slug
router.get('/:slug', getPublicNewsDetail);

export default router;
