import * as liveDashboardService from '../services/liveDashboardService.js';
import { getBranchScope } from '../utils/branchScope.js';

/**
 * Build the scope object for the live dashboard service based on the user's branch assignment.
 * Branch users are restricted to their assigned subcity; Head Office / Super Admin see all.
 */
const resolveScopeQuery = async (req) => {
  const scope = {};
  if (!req.user) return scope;

  const branchScope = await getBranchScope(req.user);
  if (branchScope.isBranch && branchScope.subcityName) {
    const regex = new RegExp(`^${branchScope.subcityName.trim()}$`, 'i');
    // IncidentReport uses location.subCity; Woreda/Household use location.subcity
    scope.$or = [
      { 'location.subCity': regex },
      { 'location.subcity': regex },
    ];
    // Also inject into req.query so buildFilters() inside the service handles subcity filter
    req.query._branchSubcity = branchScope.subcityName;
  }
  return scope;
};

export const getSummary = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getSummaryStats(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Failed to fetch summary metrics', error: error.message });
  }
};

export const getMapData = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getMapIncidents(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ message: 'Failed to fetch incident map markers', error: error.message });
  }
};

export const getHazardAnalysis = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getHazardAnalysis(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching hazard analysis:', error);
    res.status(500).json({ message: 'Failed to fetch hazard breakdown', error: error.message });
  }
};

export const getTrends = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getTrendsData(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching incident trends:', error);
    res.status(500).json({ message: 'Failed to fetch trends data', error: error.message });
  }
};

export const getResponseMonitoring = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getResponseMonitoringData(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching response monitoring:', error);
    res.status(500).json({ message: 'Failed to fetch response monitoring', error: error.message });
  }
};

export const getSurveyMonitoring = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getSurveyMonitoringData(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching survey monitoring:', error);
    res.status(500).json({ message: 'Failed to fetch survey metrics', error: error.message });
  }
};

export const getActivityFeed = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getActivityFeedData(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({ message: 'Failed to fetch live activity feed', error: error.message });
  }
};

export const getWoredaAnalysis = async (req, res) => {
  try {
    const woredaName = req.params.woredaName || req.query.woreda;
    if (!woredaName) {
      return res.status(400).json({ message: 'Woreda parameter is required' });
    }
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getWoredaAnalysisData(woredaName, scope);
    res.json(data);
  } catch (error) {
    console.error('Error fetching woreda analysis:', error);
    res.status(500).json({ message: 'Failed to fetch woreda breakdown', error: error.message });
  }
};

export const getPublicOfficeWorkflow = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getPublicOfficeWorkflowData(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching public office workflow data:', error);
    res.status(500).json({ message: 'Failed to fetch public-office workflow', error: error.message });
  }
};

export const getAssessmentAnalytics = async (req, res) => {
  try {
    const scope = await resolveScopeQuery(req);
    const data = await liveDashboardService.getAssessmentAnalyticsData(scope, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching assessment analytics:', error);
    res.status(500).json({ message: 'Failed to fetch assessment analytics', error: error.message });
  }
};
