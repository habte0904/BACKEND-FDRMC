import * as liveDashboardService from '../services/liveDashboardService.js';

export const getSummary = async (req, res) => {
  try {
    const data = await liveDashboardService.getSummaryStats({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Failed to fetch summary metrics', error: error.message });
  }
};

export const getMapData = async (req, res) => {
  try {
    const data = await liveDashboardService.getMapIncidents({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ message: 'Failed to fetch incident map markers', error: error.message });
  }
};

export const getHazardAnalysis = async (req, res) => {
  try {
    const data = await liveDashboardService.getHazardAnalysis({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching hazard analysis:', error);
    res.status(500).json({ message: 'Failed to fetch hazard breakdown', error: error.message });
  }
};

export const getTrends = async (req, res) => {
  try {
    const data = await liveDashboardService.getTrendsData({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching incident trends:', error);
    res.status(500).json({ message: 'Failed to fetch trends data', error: error.message });
  }
};

export const getResponseMonitoring = async (req, res) => {
  try {
    const data = await liveDashboardService.getResponseMonitoringData({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching response monitoring:', error);
    res.status(500).json({ message: 'Failed to fetch response monitoring', error: error.message });
  }
};

export const getSurveyMonitoring = async (req, res) => {
  try {
    const data = await liveDashboardService.getSurveyMonitoringData({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching survey monitoring:', error);
    res.status(500).json({ message: 'Failed to fetch survey metrics', error: error.message });
  }
};

export const getActivityFeed = async (req, res) => {
  try {
    const data = await liveDashboardService.getActivityFeedData({}, req.query);
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
    const data = await liveDashboardService.getWoredaAnalysisData(woredaName, {});
    res.json(data);
  } catch (error) {
    console.error('Error fetching woreda analysis:', error);
    res.status(500).json({ message: 'Failed to fetch woreda breakdown', error: error.message });
  }
};

export const getPublicOfficeWorkflow = async (req, res) => {
  try {
    const data = await liveDashboardService.getPublicOfficeWorkflowData({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching public office workflow data:', error);
    res.status(500).json({ message: 'Failed to fetch public-office workflow', error: error.message });
  }
};

export const getAssessmentAnalytics = async (req, res) => {
  try {
    const data = await liveDashboardService.getAssessmentAnalyticsData({}, req.query);
    res.json(data);
  } catch (error) {
    console.error('Error fetching assessment analytics data:', error);
    res.status(500).json({ message: 'Failed to fetch assessment analytics', error: error.message });
  }
};
