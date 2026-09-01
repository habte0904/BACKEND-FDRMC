import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';
import {
  getSummary,
  getMapData,
  getHazardAnalysis,
  getTrends,
  getResponseMonitoring,
  getSurveyMonitoring,
  getActivityFeed,
  getWoredaAnalysis,
  getPublicOfficeWorkflow,
  getAssessmentAnalytics,
} from '../controllers/liveDashboardController.js';

const router = express.Router();

// Apply auth and permission middleware (unrestricted city-wide data for live monitoring)
router.use(protect);
router.use(checkPermission('livedashboard', 'view'));

router.get('/summary', getSummary);
router.get('/map', getMapData);
router.get('/hazards', getHazardAnalysis);
router.get('/trends', getTrends);
router.get('/responses', getResponseMonitoring);
router.get('/surveys', getSurveyMonitoring);
router.get('/activity', getActivityFeed);
router.get('/woreda/:woredaName', getWoredaAnalysis);
router.get('/public-office-workflow', getPublicOfficeWorkflow);
router.get('/assessments', getAssessmentAnalytics);

export default router;
