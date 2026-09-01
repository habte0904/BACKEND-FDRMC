import express from 'express';
import {
    getAssignedSites,
    getAssignedTemplates,
    getLookupValues,
    syncSurvey,
    createSyncLog,
    getSyncLogs
} from '../controllers/siteSurveyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/assigned-sites', protect, getAssignedSites);
router.get('/templates', protect, getAssignedTemplates);
router.get('/lookups', protect, getLookupValues);
router.post('/sync', protect, syncSurvey);
router.post('/sync-logs', protect, createSyncLog);
router.get('/sync-logs', protect, getSyncLogs);

export default router;
