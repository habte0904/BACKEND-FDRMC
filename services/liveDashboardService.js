import IncidentReport from '../models/IncidentReport.js';
import WoredaProfile from '../models/WoredaProfile.js';
import FormResponse from '../models/FormResponse.js';
import Site from '../models/Site.js';
import InspectionRequest from '../models/InspectionRequest.js';
import AlertSubscription from '../models/AlertSubscription.js';
import AuditLog from '../models/AuditLog.js';
import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaAssessment from '../models/WoredaAssessment.js';

/**
 * Build dynamic filters based on scope and query parameters
 */
const buildFilters = (scope = {}, filters = {}) => {
  const incidentMatch = { ...scope };
  const woredaMatch = { ...scope };
  const surveyMatch = { ...scope };

  if (filters.hazard) {
    incidentMatch.category = new RegExp(filters.hazard, 'i');
  }
  if (filters.severity) {
    incidentMatch.severity = filters.severity.toLowerCase();
  }
  if (filters.status) {
    incidentMatch.status = filters.status.toLowerCase();
  }
  if (filters.woreda) {
    const woredaRegex = new RegExp(filters.woreda, 'i');
    incidentMatch['location.city'] = woredaRegex;
    incidentMatch['location.addressLine'] = woredaRegex;
    woredaMatch['location.woreda'] = woredaRegex;
  }
  if (filters.subcity || filters.zone || filters.region) {
    const reg = new RegExp(filters.region || filters.subcity || filters.zone, 'i');
    incidentMatch['location.region'] = reg;
    woredaMatch['location.subcity'] = reg;
  }

  // Date range filtering
  if (filters.startDate || filters.endDate) {
    const dateRange = {};
    if (filters.startDate) {
      const parts = filters.startDate.split('-').map(Number);
      if (parts.length === 3) {
        dateRange.$gte = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      } else {
        const startD = new Date(filters.startDate);
        startD.setHours(0, 0, 0, 0);
        dateRange.$gte = startD;
      }
    }
    if (filters.endDate) {
      const parts = filters.endDate.split('-').map(Number);
      if (parts.length === 3) {
        dateRange.$lte = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
      } else {
        const endD = new Date(filters.endDate);
        endD.setHours(23, 59, 59, 999);
        dateRange.$lte = endD;
      }
    }
    
    incidentMatch.createdAt = dateRange;
    surveyMatch.$or = [{ submittedAt: dateRange }, { createdAt: dateRange }];
  }

  return { incidentMatch, woredaMatch, surveyMatch };
};

/**
 * Get aggregated summary metrics for KPI cards
 */
export const getSummaryStats = async (scope = {}, queryFilters = {}) => {
  const { incidentMatch, woredaMatch, surveyMatch } = buildFilters(scope, queryFilters);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const incidentTodayFilter = (queryFilters.startDate || queryFilters.endDate)
    ? incidentMatch
    : { ...incidentMatch, createdAt: { $gte: startOfDay } };

  const surveyTodayFilter = (queryFilters.startDate || queryFilters.endDate)
    ? surveyMatch
    : { ...surveyMatch, submittedAt: { $gte: startOfDay } };

  const [
    activeIncidents,
    criticalIncidents,
    incidentsToday,
    incidentCategoryAgg,
    woredaProfilesCount,
    householdProfilesCount,
    pendingSurveysCount,
    activeResponsesCount,
    surveysTodayCount,
    woredaList,
    incidentWoredaList,
    publicIncidentsCount,
    publicConcernsCount,
    inspectionRequestsCount,
    alertSubscriptionsCount
  ] = await Promise.all([
    IncidentReport.countDocuments({ ...incidentMatch, status: { $in: ['submitted', 'received', 'dispatched'] } }),
    IncidentReport.countDocuments({ ...incidentMatch, severity: 'critical', status: { $ne: 'closed' } }),
    IncidentReport.countDocuments(incidentTodayFilter),
    IncidentReport.aggregate([
      { $match: incidentMatch },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]),
    WoredaProfile.countDocuments(woredaMatch),
    HouseholdProfile.countDocuments(woredaMatch),
    Site.countDocuments({ status: { $in: ['Assigned', 'In Progress'] } }),
    IncidentReport.countDocuments({ ...incidentMatch, status: 'dispatched' }),
    FormResponse.countDocuments(surveyTodayFilter),
    WoredaProfile.distinct('location.woreda', woredaMatch),
    IncidentReport.distinct('location.city', incidentMatch),
    IncidentReport.countDocuments({ ...incidentMatch, reportType: 'incident' }),
    IncidentReport.countDocuments({ ...incidentMatch, reportType: 'concern' }),
    InspectionRequest.countDocuments(),
    AlertSubscription.countDocuments({ status: 'active' })
  ]);

  // Aggregate total population affected from Woreda profiles & Household profiles
  const [woredaPopAgg, householdPopAgg] = await Promise.all([
    WoredaProfile.aggregate([
      { $match: woredaMatch },
      { $group: { _id: null, totalPop: { $sum: '$demographics.total_population' } } }
    ]),
    HouseholdProfile.aggregate([
      { $match: woredaMatch },
      { $group: { _id: null, totalPop: { $sum: '$demographics.family_size' } } }
    ])
  ]);
  const affectedPeople = (woredaPopAgg[0]?.totalPop || 0) + (householdPopAgg[0]?.totalPop || 0);
  const uniqueWoredas = new Set([...(woredaList || []).filter(Boolean), ...(incidentWoredaList || []).filter(Boolean)]);

  return {
    activeIncidents,
    criticalIncidents,
    incidentsToday,
    affectedPeople,
    affectedWoredas: uniqueWoredas.size,
    pendingVerification: woredaProfilesCount + pendingSurveysCount,
    activeResponses: activeResponsesCount,
    pendingResponseRequests: activeIncidents - activeResponsesCount > 0 ? activeIncidents - activeResponsesCount : 0,
    siteSurveysToday: surveysTodayCount,
    totalHouseholdProfiles: householdProfilesCount,
    publicIncidentsCount,
    publicConcernsCount,
    inspectionRequestsCount,
    alertSubscriptionsCount
  };
};

/**
 * Get map incident features with coordinates and details
 */
export const getMapIncidents = async (scope = {}, queryFilters = {}) => {
  const { incidentMatch } = buildFilters(scope, queryFilters);

  const incidents = await IncidentReport.find(incidentMatch)
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  // Add default geographic center for Addis Ababa if latitude/longitude are null
  const defaultCoordinates = [
    { lat: 9.0300, lng: 38.7400 }, // Central Addis Ababa
    { lat: 9.0100, lng: 38.7600 },
    { lat: 9.0400, lng: 38.7200 },
    { lat: 8.9800, lng: 38.7900 },
    { lat: 9.0600, lng: 38.7500 },
  ];

  return incidents.map((inc, index) => {
    let lat = inc.location?.latitude;
    let lng = inc.location?.longitude;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      const fallback = defaultCoordinates[index % defaultCoordinates.length];
      lat = fallback.lat + (Math.random() - 0.5) * 0.05;
      lng = fallback.lng + (Math.random() - 0.5) * 0.05;
    }

    return {
      id: inc._id.toString(),
      reportCode: inc.reportCode || `INC-${inc._id.toString().substring(0, 6)}`,
      reportType: inc.reportType || 'incident',
      category: inc.category || inc.concernCategory || 'General Hazard',
      concernCategory: inc.concernCategory || '',
      severity: inc.severity || 'moderate',
      status: inc.status || 'submitted',
      details: inc.details || inc.concernDetails || 'No details specified',
      locationName: inc.location?.placeName || inc.location?.addressLine || inc.location?.subCity || inc.location?.city || 'Woreda Area',
      city: inc.location?.city || 'Addis Ababa',
      subCity: inc.location?.subCity || '',
      woreda: inc.location?.woreda || '',
      placeName: inc.location?.placeName || '',
      addressLine: inc.location?.addressLine || '',
      region: inc.location?.region || 'Addis Ababa',
      latitude: Number(lat),
      longitude: Number(lng),
      createdAt: inc.createdAt,
      affectedPeopleEstimate: inc.concernInfo?.peopleAffected || 'N/A'
    };
  });
};

/**
 * Get hazard category & concern category breakdown analytics
 */
export const getHazardAnalysis = async (scope = {}, queryFilters = {}) => {
  const { incidentMatch } = buildFilters(scope, queryFilters);

  const [incidentResult, concernResult] = await Promise.all([
    IncidentReport.aggregate([
      { $match: { ...incidentMatch, reportType: { $ne: 'concern' } } },
      {
        $group: {
          _id: { $ifNull: ['$category', 'General Hazard'] },
          totalIncidents: { $sum: 1 },
          criticalIncidents: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          },
          activeIncidents: {
            $sum: { $cond: [{ $in: ['$status', ['submitted', 'received', 'dispatched']] }, 1, 0] }
          }
        }
      },
      { $sort: { totalIncidents: -1 } }
    ]),
    IncidentReport.aggregate([
      { $match: { ...incidentMatch, reportType: 'concern' } },
      {
        $group: {
          _id: { $ifNull: ['$concernCategory', '$category'] },
          totalConcerns: { $sum: 1 },
          urgentConcerns: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalConcerns: -1 } }
    ])
  ]);

  return {
    incidents: incidentResult.map(item => ({
      hazardType: item._id,
      totalIncidents: item.totalIncidents,
      criticalIncidents: item.criticalIncidents,
      activeIncidents: item.activeIncidents
    })),
    concerns: concernResult.map(item => ({
      concernCategory: item._id || 'General Concern',
      totalConcerns: item.totalConcerns,
      urgentConcerns: item.urgentConcerns
    }))
  };
};

/**
 * Get time-series trends for incidents, concerns, and severity levels
 * Supports intervals: 'hourly' (time in day), 'daily' (day in month), 'monthly' (month in year), 'yearly' (year)
 */
export const getTrendsData = async (scope = {}, queryFilters = {}) => {
  const { incidentMatch } = buildFilters(scope, queryFilters);
  const interval = (queryFilters.interval || 'daily').toLowerCase();

  let dateFormat = '%Y-%m-%d';
  let matchCondition = { ...incidentMatch };

  if (interval === 'hourly' || interval === 'hour' || interval === 'time_in_day') {
    // Time in the day: Today or past 24 hours
    dateFormat = '%Y-%m-%d %H:00';
    if (!queryFilters.startDate && !queryFilters.endDate) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      matchCondition.createdAt = { $gte: startOfDay };
    }
  } else if (interval === 'monthly' || interval === 'month' || interval === 'month_in_year') {
    // Month in the year: Current year or past 12 months
    dateFormat = '%Y-%m';
    if (!queryFilters.startDate && !queryFilters.endDate) {
      const startOfYear = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0);
      matchCondition.createdAt = { $gte: startOfYear };
    }
  } else if (interval === 'yearly' || interval === 'year') {
    // Yearly: All recorded years
    dateFormat = '%Y';
  } else {
    // Daily: Day in the month (e.g. current month or past 30 days)
    dateFormat = '%Y-%m-%d';
    if (!queryFilters.startDate && !queryFilters.endDate) {
      const days = queryFilters.days ? parseInt(queryFilters.days, 10) : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      matchCondition.createdAt = { $gte: startDate };
    }
  }

  const trendAgg = await IncidentReport.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: {
          $dateToString: { format: dateFormat, date: '$createdAt' }
        },
        total: { $sum: 1 },
        incidents: {
          $sum: { $cond: [{ $ne: ['$reportType', 'concern'] }, 1, 0] }
        },
        concerns: {
          $sum: { $cond: [{ $eq: ['$reportType', 'concern'] }, 1, 0] }
        },
        critical: {
          $sum: { $cond: [{ $eq: [{ $toLower: '$severity' }, 'critical'] }, 1, 0] }
        },
        high: {
          $sum: { $cond: [{ $eq: [{ $toLower: '$severity' }, 'high'] }, 1, 0] }
        },
        moderate: {
          $sum: { $cond: [{ $eq: [{ $toLower: '$severity' }, 'moderate'] }, 1, 0] }
        },
        low: {
          $sum: { $cond: [{ $in: [{ $toLower: '$severity' }, ['low', 'minor']] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return trendAgg.map(t => ({
    date: t._id,
    interval,
    total: t.total,
    incidents: t.incidents || 0,
    concerns: t.concerns || 0,
    critical: t.critical || 0,
    high: t.high || 0,
    moderate: t.moderate || 0,
    low: t.low || 0
  }));
};

/**
 * Get response activities and monitoring breakdown
 */
export const getResponseMonitoringData = async (scope = {}, queryFilters = {}) => {
  const { incidentMatch } = buildFilters(scope, queryFilters);

  const [incidentStatusAgg, inspectionStatusAgg] = await Promise.all([
    IncidentReport.aggregate([
      { $match: incidentMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    InspectionRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const responseStatus = {
    submitted: 0,
    received: 0,
    dispatched: 0,
    closed: 0
  };

  incidentStatusAgg.forEach(item => {
    if (item._id in responseStatus) responseStatus[item._id] = item.count;
  });

  const inspectionStatus = {};
  inspectionStatusAgg.forEach(item => {
    inspectionStatus[item._id] = item.count;
  });

  return {
    responseStatus,
    inspectionStatus,
    activeResponses: responseStatus.dispatched,
    completedResponses: responseStatus.closed,
    pendingResponses: responseStatus.submitted + responseStatus.received
  };
};

/**
 * Get site survey and form response monitoring
 */
export const getSurveyMonitoringData = async (scope = {}, queryFilters = {}) => {
  const { surveyMatch, woredaMatch } = buildFilters(scope, queryFilters);

  const [surveySyncAgg, woredaStatusAgg, siteStatusAgg, onlineCount, offlineCount] = await Promise.all([
    FormResponse.aggregate([
      { $match: surveyMatch },
      { $group: { _id: '$syncStatus', count: { $sum: 1 } } }
    ]),
    WoredaProfile.aggregate([
      { $match: woredaMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Site.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    FormResponse.countDocuments({ ...surveyMatch, isOffline: false }),
    FormResponse.countDocuments({ ...surveyMatch, isOffline: true })
  ]);

  const syncBreakdown = { SYNCED: 0, UNSYNCED: 0, UPDATED: 0 };
  surveySyncAgg.forEach(item => {
    if (item._id in syncBreakdown) syncBreakdown[item._id] = item.count;
  });

  const woredaProfileStatus = { Draft: 0, Submitted: 0, Reviewed: 0 };
  woredaStatusAgg.forEach(item => {
    if (item._id in woredaProfileStatus) woredaProfileStatus[item._id] = item.count;
  });

  return {
    syncBreakdown,
    woredaProfileStatus,
    siteBreakdown: siteStatusAgg,
    onlineSubmissions: onlineCount,
    offlineSubmissions: offlineCount || (syncBreakdown.SYNCED + syncBreakdown.UNSYNCED + syncBreakdown.UPDATED)
  };
};

/**
 * Get live activity feed stream
 */
export const getActivityFeedData = async (scope = {}, queryFilters = {}) => {
  const [logs, incidents, surveys] = await Promise.all([
    AuditLog.find()
      .sort({ timestamp: -1 })
      .limit(10)
      .populate('userId', 'fullname email')
      .lean(),
    IncidentReport.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    FormResponse.find()
      .sort({ submittedAt: -1 })
      .limit(10)
      .populate('submittedBy', 'fullname email')
      .lean()
  ]);

  const activityFeed = [];

  incidents.forEach(inc => {
    activityFeed.push({
      id: `inc_${inc._id}`,
      type: 'incident',
      severity: inc.severity || 'moderate',
      title: `New Incident: ${inc.category || 'Hazard'}`,
      description: `Reported in ${inc.location?.city || inc.location?.region || 'Woreda'}. Status: ${inc.status}`,
      timestamp: inc.createdAt,
      location: inc.location?.city || inc.location?.addressLine || ''
    });
  });

  surveys.forEach(surv => {
    activityFeed.push({
      id: `surv_${surv._id}`,
      type: 'survey',
      severity: 'info',
      title: `Site Survey Submitted`,
      description: `Submitted by ${surv.submittedBy?.fullname || 'Enumerator'}`,
      timestamp: surv.submittedAt || surv.createdAt,
      location: ''
    });
  });

  logs.forEach(log => {
    activityFeed.push({
      id: `log_${log._id}`,
      type: 'audit',
      severity: log.severity || 'low',
      title: `${log.action} - ${log.resource}`,
      description: `Performed by ${log.userId?.fullname || 'System'}`,
      timestamp: log.timestamp || log.createdAt,
      location: ''
    });
  });

  // Sort merged stream descending by timestamp
  return activityFeed
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);
};

/**
 * Get drill-down details for a specific woreda
 */
export const getWoredaAnalysisData = async (woredaName, scope = {}) => {
  const woredaRegex = new RegExp(woredaName, 'i');

  const [profiles, incidents] = await Promise.all([
    WoredaProfile.find({ ...scope, 'location.woreda': woredaRegex }).lean(),
    IncidentReport.find({
      ...scope,
      $or: [
        { 'location.city': woredaRegex },
        { 'location.addressLine': woredaRegex }
      ]
    }).lean()
  ]);

  const activeIncidents = incidents.filter(i => ['submitted', 'received', 'dispatched'].includes(i.status)).length;
  const criticalIncidents = incidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length;

  let totalPopulation = 0;
  let totalHouseholds = 0;

  profiles.forEach(p => {
    totalPopulation += p.demographics?.total_population || 0;
    totalHouseholds += p.demographics?.total_households || 0;
  });

  return {
    woredaName,
    profilesCount: profiles.length,
    incidentsCount: incidents.length,
    activeIncidents,
    criticalIncidents,
    totalPopulation,
    totalHouseholds,
    profiles: profiles.slice(0, 5),
    recentIncidents: incidents.slice(0, 5)
  };
};

/**
 * Get Public Submissions vs Office Response Workflow metrics
 */
export const getPublicOfficeWorkflowData = async (scope = {}, queryFilters = {}) => {
  const { incidentMatch } = buildFilters(scope, queryFilters);

  const [
    publicIncidentsCount,
    publicConcernsCount,
    dispatchedIncidentsCount,
    closedIncidentsCount,
    inspectionStatusAgg,
    assignedInspectorsCount,
    activeAlertSubscribers,
    recentInspectionRequests
  ] = await Promise.all([
    IncidentReport.countDocuments({ ...incidentMatch, reportType: 'incident' }),
    IncidentReport.countDocuments({ ...incidentMatch, reportType: 'concern' }),
    IncidentReport.countDocuments({ ...incidentMatch, status: 'dispatched' }),
    IncidentReport.countDocuments({ ...incidentMatch, status: 'closed' }),
    InspectionRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    InspectionRequest.countDocuments({ assignedInspector: { $ne: '' } }),
    AlertSubscription.countDocuments({ status: 'active' }),
    InspectionRequest.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
  ]);

  const inspectionStatus = {
    Submitted: 0,
    'Under Review': 0,
    Assigned: 0,
    Scheduled: 0,
    Completed: 0,
    Rejected: 0
  };

  inspectionStatusAgg.forEach(item => {
    if (item._id in inspectionStatus) inspectionStatus[item._id] = item.count;
  });

  return {
    publicSubmissions: {
      incidents: publicIncidentsCount,
      concerns: publicConcernsCount,
      inspections: Object.values(inspectionStatus).reduce((a, b) => a + b, 0),
      alertSubscribers: activeAlertSubscribers
    },
    officeResponses: {
      dispatchedTeams: dispatchedIncidentsCount,
      closedIncidents: closedIncidentsCount,
      assignedInspectors: assignedInspectorsCount,
      inspectionBreakdown: inspectionStatus
    },
    recentInspections: recentInspectionRequests.map(r => ({
      id: r._id,
      trackingNumber: r.trackingNumber || `INS-${r._id.toString().substring(0, 6)}`,
      propertyAddress: r.propertyAddress,
      inspectionType: r.inspectionType,
      status: r.status,
      assignedInspector: r.assignedInspector || 'Unassigned',
      createdAt: r.createdAt
    }))
  };
};

/**
 * Get Household Level Assessment & Woreda Assessment aggregation data
 */
export const getAssessmentAnalyticsData = async (scope = {}, queryFilters = {}) => {
  const { woredaMatch } = buildFilters(scope, queryFilters);

  const [
    totalHouseholdProfiles,
    femaleHeadedCount,
    idpCount,
    informalSettlementCount,
    hasEmergencyPlanCount,
    totalWoredasAssessed,
    woredaAssessments
  ] = await Promise.all([
    HouseholdProfile.countDocuments(woredaMatch),
    HouseholdProfile.countDocuments({ ...woredaMatch, 'demographics.female_headed_household': 'Yes' }),
    HouseholdProfile.countDocuments({ ...woredaMatch, 'demographics.idp_status': 'Yes' }),
    HouseholdProfile.countDocuments({ ...woredaMatch, 'housing_physical_conditions.informal_settlement': 'Yes' }),
    HouseholdProfile.countDocuments({ ...woredaMatch, 'preparedness.family_emergency_plan_exists': 'Yes' }),
    WoredaAssessment.countDocuments(woredaMatch),
    WoredaAssessment.find(woredaMatch).lean()
  ]);

  // Calculate average KII capacity & infrastructure scores
  let totalKiiEws = 0;
  let totalKiiInstStrength = 0;
  let totalKiiInfra = 0;
  let totalDisasterLossETB = 0;
  let totalDisasterDeaths = 0;

  woredaAssessments.forEach(wa => {
    if (wa.kii_capacity_indicators) {
      totalKiiEws += wa.kii_capacity_indicators.ews || 3;
      totalKiiInstStrength += wa.kii_capacity_indicators.institutional_strength || 3;
    }
    if (wa.kii_infrastructure_exposure) {
      totalKiiInfra += wa.kii_infrastructure_exposure.emergency || 3;
    }
    if (Array.isArray(wa.disaster_history)) {
      wa.disaster_history.forEach(dh => {
        totalDisasterLossETB += dh.estimated_loss_etb || 0;
        totalDisasterDeaths += dh.deaths || 0;
      });
    }
  });

  const count = woredaAssessments.length || 1;

  return {
    householdAssessment: {
      totalHouseholdProfiles,
      femaleHeadedCount,
      idpCount,
      informalSettlementCount,
      hasEmergencyPlanCount,
      femaleHeadedPercentage: Math.round((femaleHeadedCount / (totalHouseholdProfiles || 1)) * 100),
      idpPercentage: Math.round((idpCount / (totalHouseholdProfiles || 1)) * 100),
      informalSettlementPercentage: Math.round((informalSettlementCount / (totalHouseholdProfiles || 1)) * 100),
      emergencyPlanPercentage: Math.round((hasEmergencyPlanCount / (totalHouseholdProfiles || 1)) * 100)
    },
    woredaAssessment: {
      totalWoredasAssessed,
      avgKiiEwsScore: Number((totalKiiEws / count).toFixed(1)),
      avgKiiInstitutionalScore: Number((totalKiiInstStrength / count).toFixed(1)),
      avgKiiInfrastructureScore: Number((totalKiiInfra / count).toFixed(1)),
      totalDisasterLossETB,
      totalDisasterDeaths
    }
  };
};
