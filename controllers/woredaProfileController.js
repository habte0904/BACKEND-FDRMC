import WoredaProfile from '../models/WoredaProfile.js';
import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaAssessment from '../models/WoredaAssessment.js';
import ProfileMapping from '../models/ProfileMapping.js';
import FormResponse from '../models/FormResponse.js';
import * as MappingService from '../services/MappingService.js';
import * as AggregationService from '../services/SpatialAggregationService.js';
import * as auditService from '../services/auditService.js';
import * as XLSX from 'xlsx';

const normalizeLevel = (level) => {
    if (level === 'all' || level === 'city') return 'city';
    if (['subcity', 'woreda', 'block', 'household'].includes(level)) return level;
    return 'household';
};

const isRollupProfile = (profile) => {
    const level = profile?.aggregation_level || profile?.hierarchy_summary?.aggregation_level;
    if (['block', 'woreda', 'subcity', 'city'].includes(level)) return true;
    return String(profile?.location?.house_no || '').trim() === 'Aggregated Data';
};

const getRollupSourceProfiles = (profiles, sourceLevel = 'household') => {
    if (sourceLevel === 'household') {
        const rawProfiles = profiles.filter(profile => !isRollupProfile(profile));
        return rawProfiles.length ? rawProfiles : profiles;
    }
    return profiles;
};

const getParentLevel = (level) => {
    const normalized = normalizeLevel(level);
    if (normalized === 'block') return 'woreda';
    if (normalized === 'woreda') return 'subcity';
    if (normalized === 'subcity') return 'city';
    if (normalized === 'city') return null;
    return 'block';
};

const getAggregationLabel = (level) => {
    const normalized = normalizeLevel(level);
    return {
        household: 'Raw individual data',
        block: 'First aggregation unit',
        woreda: 'Block-to-woreda rollup',
        subcity: 'Woreda-to-subcity rollup',
        city: 'Sub-city-to-city rollup'
    }[normalized];
};

const getAggregationMethod = (level) => {
    const normalized = normalizeLevel(level);
    return {
        household: 'Primary survey record',
        block: 'Household rollup: SUM / COUNT / % / AVG',
        woreda: 'Household + CGD/KII enrichment',
        subcity: 'Woreda ranking + comparison',
        city: 'City-wide strategic rollup'
    }[normalized];
};

const getLevelDisplay = (level) => {
    const normalized = normalizeLevel(level);
    return {
        household: 'House',
        block: 'Block',
        woreda: 'Woreda',
        subcity: 'Sub-city',
        city: 'City'
    }[normalized];
};

const buildHouseholdHierarchySummary = (profile = {}) => {
    const location = profile.location || {};
    const demographics = profile.demographics || {};
    const riskIndex = profile.risk_index || {};
    const subcity = String(location.subcity || 'Unknown').trim() || 'Unknown';
    const woreda = String(location.woreda || 'Unknown').trim() || 'Unknown';
    const block = String(location.block || 'Unknown').trim() || 'Unknown';
    const parentKey = `${subcity}-${woreda}-${block}`;
    return {
        aggregation_level: 'household',
        parent_level: 'block',
        parent_key: parentKey,
        source_profiles: 1,
        total_households: Number(demographics.total_households || 1) || 1,
        total_population: Number(demographics.total_population || demographics.total_household_members || 0) || 0,
        vulnerability_score: Number(riskIndex.vulnerability_index || 0) || 0,
        exposure_score: Number(riskIndex.exposure_index || 0) || 0,
        capacity_score: Number(riskIndex.capacity_index || 0) || 0,
        hazard_score: Number(riskIndex.hazard_index || 0) || 0,
        dr_risk_score: Number(riskIndex.overall_woreda_risk_score || 0) || 0,
        rank_in_parent: null,
        aggregation_method: 'Primary survey record',
        added_at_level: 'Raw individual data',
        block_counts: {
            total_households: Number(demographics.total_households || 1) || 1,
            total_population: Number(demographics.total_population || demographics.total_household_members || 0) || 0,
            female_headed_households: Number(demographics.female_headed_households || 0) || 0,
            informal_settlement_population: Number(demographics.informal_settlement_population || 0) || 0,
            low_income_households: Number(demographics.low_income_households || 0) || 0
        }
    };
};

const calculateWoredaRiskIndex = (profile = {}) => {
    const h = AggregationService.calculateHazardIndex(profile.hazards);
    const e = AggregationService.calculateExposureIndex(profile.housing_indicators, profile.kii_infrastructure_exposure);
    const v = AggregationService.calculateVulnerabilityIndex(profile._source_items || [profile], profile.kii_environmental_indicators);
    const c = AggregationService.calculateCapacityIndex(profile.kii_capacity_indicators);
    const dr = AggregationService.computeRiskScore(h, e, v, c);

    return {
        risk_index: {
            ...(profile.risk_index || {}),
            hazard_index: Math.round(h * 10) / 10,
            exposure_index: Math.round(e * 10) / 10,
            vulnerability_index: Math.round(v * 10) / 10,
            capacity_index: Math.round(c * 10) / 10,
            overall_woreda_risk_score: dr
        },
        hierarchy_summary: {
            ...(profile.hierarchy_summary || {}),
            hazard_score: Math.round(h * 10) / 10,
            exposure_score: Math.round(e * 10) / 10,
            vulnerability_score: Math.round(v * 10) / 10,
            capacity_score: Math.round(c * 10) / 10,
            dr_risk_score: dr
        }
    };
};

const getProfileAggregationLevel = (profile) => profile?.aggregation_level || profile?.hierarchy_summary?.aggregation_level || 'household';

const getAggregationKey = (profile, level) => {
    const normalizedLevel = normalizeLevel(level);
    const location = profile?.location || {};
    const subcity = String(location.subcity || 'Unknown').trim() || 'Unknown';
    const woreda = String(location.woreda || 'Unknown').trim() || 'Unknown';
    const block = String(location.block || 'Unknown').trim() || 'Unknown';
    if (normalizedLevel === 'city') return 'city';
    if (normalizedLevel === 'subcity') return subcity;
    if (normalizedLevel === 'woreda') return `${subcity}-${woreda}`;
    if (normalizedLevel === 'block') return `${subcity}-${woreda}-${block}`;
    return `${subcity}-${woreda}-${block}-${String(location.house_no || '').trim() || 'house'}`;
};

const mergeUniqueArrayItems = (target = [], source = [], keyField) => {
    const result = [...(target || [])];
    (source || []).forEach(item => {
        if (!result.find(existing => existing?.[keyField] === item?.[keyField])) {
            result.push(item);
        }
    });
    return result;
};

const mergeDirectEnrichment = (computedProfiles, enrichmentProfiles, level) => {
    if (!enrichmentProfiles?.length && level !== 'woreda') return computedProfiles;

    const map = new Map();
    if (enrichmentProfiles) {
        enrichmentProfiles.forEach(profile => {
            map.set(getAggregationKey(profile, level), profile);
        });
    }

    return computedProfiles.map(profile => {
        const key = getAggregationKey(profile, level);
        const enrichment = map.get(key);

        let merged = { ...profile };
        if (enrichment) {
            merged = {
                ...profile,
                raw_survey: {
                    ...(profile.raw_survey || {}),
                    ...(enrichment.raw_survey || {})
                },
                survey_metadata: {
                    ...(profile.survey_metadata || {}),
                    ...(enrichment.survey_metadata || {})
                },
                hazards: mergeUniqueArrayItems(profile.hazards, enrichment.hazards, 'hazard_name'),
                vulnerability_assessments: mergeUniqueArrayItems(profile.vulnerability_assessments, enrichment.vulnerability_assessments, 'hazard_name'),
                community_capacity: mergeUniqueArrayItems(profile.community_capacity, enrichment.community_capacity, 'capacity_type'),
                critical_facilities: mergeUniqueArrayItems(profile.critical_facilities, enrichment.critical_facilities, 'facility_type'),
                risk_assessments: mergeUniqueArrayItems(profile.risk_assessments, enrichment.risk_assessments, 'hazard_name'),
                economic_risk_indicators: {
                    ...(profile.economic_risk_indicators || {}),
                    ...(enrichment.economic_risk_indicators || {})
                },
                environmental_indicators: {
                    ...(profile.environmental_indicators || {}),
                    ...(enrichment.environmental_indicators || {})
                },
                infrastructure_exposure: {
                    ...(profile.infrastructure_exposure || {}),
                    ...(enrichment.infrastructure_exposure || {})
                },
                community_voice_interventions: {
                    ...(profile.community_voice_interventions || {}),
                    ...(enrichment.community_voice_interventions || {})
                },
                preparedness_indicators: {
                    ...(profile.preparedness_indicators || {}),
                    ...(enrichment.preparedness_indicators || {})
                },
                recovery_indicators: {
                    ...(profile.recovery_indicators || {}),
                    ...(enrichment.recovery_indicators || {})
                },
                risk_index: {
                    ...(profile.risk_index || {}),
                    ...(enrichment.risk_index || {})
                },
                kii_capacity_indicators: enrichment.kii_capacity_indicators || profile.kii_capacity_indicators,
                kii_infrastructure_exposure: enrichment.kii_infrastructure_exposure || profile.kii_infrastructure_exposure,
                kii_environmental_indicators: enrichment.kii_environmental_indicators || profile.kii_environmental_indicators,
                cgd_community_voice: enrichment.cgd_community_voice || profile.cgd_community_voice,
            };
        }

        // Apply Woreda Level computation logic: H, E, V, C -> DR
        if (level === 'woreda') {
            const h = AggregationService.calculateHazardIndex(merged.hazards);
            const e = AggregationService.calculateExposureIndex(merged.housing_indicators, merged.kii_infrastructure_exposure);
            const v = AggregationService.calculateVulnerabilityIndex(profile._source_items || [merged], merged.kii_environmental_indicators);
            const c = AggregationService.calculateCapacityIndex(merged.kii_capacity_indicators);
            const dr = AggregationService.computeRiskScore(h, e, v, c);

            merged.risk_index = {
                ...merged.risk_index,
                hazard_index: Math.round(h * 10) / 10,
                exposure_index: Math.round(e * 10) / 10,
                vulnerability_index: Math.round(v * 10) / 10,
                capacity_index: Math.round(c * 10) / 10,
                overall_woreda_risk_score: dr
            };
            merged.hierarchy_summary.dr_risk_score = dr;
            merged.hierarchy_summary.vulnerability_score = merged.risk_index.vulnerability_index;
            merged.hierarchy_summary.exposure_score = merged.risk_index.exposure_index;
            merged.hierarchy_summary.capacity_score = merged.risk_index.capacity_index;
            merged.hierarchy_summary.hazard_score = merged.risk_index.hazard_index;
        }

        return merged;
    });
};



const aggregateProfiles = (profiles, level, sourceLevel = 'household') => {
    const grouped = {};
    const normalizedLevel = normalizeLevel(level);
    const sourceProfiles = getRollupSourceProfiles(profiles, sourceLevel);

    const normalizedSourceProfiles = sourceProfiles.map(p => {
        if (sourceLevel === 'household') {
            return AggregationService.normalizeHouseholdToAggregatedSchema(p);
        }
        return p;
    });

    // Deduplicate profiles by full location to avoid double counting
    const uniqueProfiles = [];
    const seenLocations = new Set();
    normalizedSourceProfiles.forEach(p => {
        const sc = (p.location?.subcity || '').toLowerCase().replace(/\bsub[\s-]?city\b/g, '').trim();
        const wo = (p.location?.woreda || '').toLowerCase().replace(/\bworeda\b/g, '').trim();
        const bl = (p.location?.block || '').toLowerCase().replace(/\bblock\b/g, '').trim();
        const hn = (p.location?.house_no || '').toString().toLowerCase().trim();
        const locKey = `${sc}-${wo}-${bl}-${hn}`;
        if (!seenLocations.has(locKey)) {
            seenLocations.add(locKey);
            uniqueProfiles.push(p);
        }
    });

    uniqueProfiles.forEach(p => {
        const normalize = (str, type) => {
            if (!str) return 'Unknown';
            let norm = str.toLowerCase().replace(/_/g, ' ').trim();
            if (type === 'subcity') norm = norm.replace(/\bsub[\s-]?city\b/gi, '').trim();
            if (type === 'woreda') norm = norm.replace(/\bworeda\b/gi, '').trim();
            if (type === 'block') norm = norm.replace(/\bblock\b/gi, '').trim();
            return norm.split(/\s+/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Unknown';
        };

        const subcity = normalize(p.location?.subcity, 'subcity');
        const woreda = normalize(p.location?.woreda, 'woreda');
        const block = normalizedLevel === 'block' ? normalize(p.location?.block, 'block') : 'Unknown';

        let key = 'city';
        if (normalizedLevel === 'subcity') key = subcity;
        else if (normalizedLevel === 'woreda') key = `${subcity}-${woreda}`;
        else if (normalizedLevel === 'block') key = `${subcity}-${woreda}-${block}`;

        if (!grouped[key]) {
            const parentLevel = getParentLevel(normalizedLevel);
            const parentKey = parentLevel === 'city'
                ? 'city'
                : parentLevel === 'subcity'
                    ? subcity
                    : parentLevel === 'woreda'
                        ? `${subcity}-${woreda}`
                        : parentLevel === 'block'
                            ? `${subcity}-${woreda}-${block}`
                            : null;
            grouped[key] = {
                _id: key,
                location: {
                    subcity: normalizedLevel === 'city' ? 'City' : subcity,
                    woreda: normalizedLevel === 'woreda' || normalizedLevel === 'block' ? woreda : 'All Woredas',
                    block: normalizedLevel === 'block' ? block : 'All Blocks',
                    house_no: 'Aggregated Data'
                },
                assessment_date: p.assessment_date || new Date(),
                remarks: `Aggregated data at ${normalizedLevel} level.`,
                status: 'Reviewed',
                aggregation_level: normalizedLevel,
                demographics: {
                    total_population: 0, male_population: 0, female_population: 0,
                    children_0_17: 0, youth_18_29: 0, adults_30_59: 0, elderly_60_plus: 0,
                    total_households: 0, female_headed_households: 0, informal_settlement_population: 0,
                    low_income_households: 0, unemployment_rate: 0, internally_displaced_population: 0,
                    education_levels: []
                },
                livelihoods: [],
                basic_services: { water_source: 'Mixed', electricity_count: 0, road_access: 'Mixed', drainage_count: 0, waste_count: 0, telecom_count: 0, lifeline_count: 0 },
                critical_facilities: [],
                vulnerable_groups: [],
                community_capacity: [],
                hazards: [],
                vulnerability_assessments: [],
                housing_indicators: { percent_non_durable_materials: 0, age_buildings_over_30_years: 0, compliance_with_building_codes: 0, housing_density_overcrowding: 0, informal_housing_coverage: 0, proximity_to_hazard_zones: 0, fire_resistant_materials_availability: 0 },
                economic_risk_indicators: {}, environmental_indicators: {}, preparedness_indicators: {}, recovery_indicators: {},
                risk_index: { hazard_index: 0, vulnerability_index: 0, exposure_index: 0, capacity_index: 0, overall_woreda_risk_score: 0 },
                risk_assessments: [],
                hierarchy_summary: {
                    aggregation_level: normalizedLevel,
                    parent_level: parentLevel,
                    parent_key: parentKey,
                    source_profiles: 0,
                    total_households: 0,
                    total_population: 0,
                    vulnerability_score: 0,
                    exposure_score: 0,
                    capacity_score: 0,
                    hazard_score: 0,
                    dr_risk_score: 0,
                    rank_in_parent: null,
                    aggregation_method: getAggregationMethod(normalizedLevel),
                    added_at_level: getAggregationLabel(normalizedLevel),
                    block_counts: {
                        total_households: 0,
                        total_population: 0,
                        female_headed_households: 0,
                        informal_settlement_population: 0,
                        low_income_households: 0
                    }
                },
                _count: 0,
                _source_items: []
            };
        }

        const g = grouped[key];
        g._count += 1;
        g._source_items.push(p);

        if (new Date(p.assessment_date) > new Date(g.assessment_date)) g.assessment_date = p.assessment_date;

        // Demographics
        if (p.demographics) {
            const d = p.demographics;
            ['total_population', 'male_population', 'female_population', 'children_0_17', 'youth_18_29', 'adults_30_59', 'elderly_60_plus', 'total_households', 'female_headed_households', 'informal_settlement_population', 'low_income_households', 'unemployment_rate', 'internally_displaced_population'].forEach(k => {
                g.demographics[k] += (d[k] || 0);
            });
            if (d.education_levels) {
                d.education_levels.forEach(ed => {
                    const existing = g.demographics.education_levels.find(e => e.category === ed.category);
                    if (existing) existing.count += (ed.count || 0);
                    else g.demographics.education_levels.push({ category: ed.category, count: (ed.count || 0) });
                });
            }
        }

        // Livelihoods
        if (p.livelihoods) {
            p.livelihoods.forEach(l => {
                const existing = g.livelihoods.find(el => el.livelihood_type === l.livelihood_type);
                if (existing) existing.households += (l.households || 0);
                else g.livelihoods.push({ livelihood_type: l.livelihood_type, households: (l.households || 0), percentage: 0 });
            });
        }

        // Basic Services
        if (p.basic_services) {
            const s = p.basic_services;
            if (s.electricity) g.basic_services.electricity_count++;
            if (s.drainage_system_coverage) g.basic_services.drainage_count++;
            if (s.solid_waste_management_coverage) g.basic_services.waste_count++;
            if (s.telecommunications_access) g.basic_services.telecom_count++;
            if (s.critical_lifeline_redundancy) g.basic_services.lifeline_count++;
        }

        // Vulnerable Groups
        if (p.vulnerable_groups) {
            p.vulnerable_groups.forEach(vg => {
                const existing = g.vulnerable_groups.find(evg => evg.group_type === vg.group_type);
                if (existing) existing.number += (vg.number || 0);
                else g.vulnerable_groups.push({ group_type: vg.group_type, number: (vg.number || 0) });
            });
        }

        // Risk Index
        if (p.risk_index) {
            Object.keys(g.risk_index).forEach(k => g.risk_index[k] += (p.risk_index[k] || 0));
        }

        // Housing Indicators
        if (p.housing_indicators) {
            Object.keys(g.housing_indicators).forEach(k => g.housing_indicators[k] += (p.housing_indicators[k] || 0));
        }

        // Indicators
        ['economic_risk_indicators', 'environmental_indicators', 'preparedness_indicators', 'recovery_indicators'].forEach(cat => {
            if (p[cat]) {
                Object.entries(p[cat]).forEach(([key, val]) => {
                    if (val) {
                        if (!g[cat][key]) g[cat][key] = {};
                        g[cat][key][val] = (g[cat][key][val] || 0) + 1;
                    }
                });
            }
        });

        // Unique collections
        const collectUnique = (targetArr, sourceArr, keyField) => {
            if (!sourceArr) return;
            sourceArr.forEach(item => {
                if (!targetArr.find(t => t[keyField] === item[keyField])) {
                    targetArr.push(item);
                }
            });
        };
        collectUnique(g.critical_facilities, p.critical_facilities, 'facility_type');
        collectUnique(g.hazards, p.hazards, 'hazard_name');
        collectUnique(g.community_capacity, p.community_capacity, 'capacity_type');
        collectUnique(g.vulnerability_assessments, p.vulnerability_assessments, 'hazard_name');
        collectUnique(g.risk_assessments, p.risk_assessments, 'hazard_name');
    });

    // Finalize logic
    const finalized = Object.values(grouped).map(g => {
        if (g._count > 0) {
            g.hierarchy_summary.source_profiles = g._count;
            g.hierarchy_summary.total_population = g.demographics.total_population;
            g.hierarchy_summary.total_households = g.demographics.total_households;
            g.hierarchy_summary.block_counts = {
                total_households: g.demographics.total_households,
                total_population: g.demographics.total_population,
                female_headed_households: g.demographics.female_headed_households,
                informal_settlement_population: g.demographics.informal_settlement_population,
                low_income_households: g.demographics.low_income_households
            };

            g.demographics.unemployment_rate = Math.round(g.demographics.unemployment_rate / g._count);

            const totalLivelihoodHH = g.livelihoods.reduce((acc, l) => acc + l.households, 0);
            if (totalLivelihoodHH > 0) {
                g.livelihoods.forEach(l => l.percentage = Math.round((l.households / totalLivelihoodHH) * 100));
            }

            g.basic_services = {
                water_source: g.basic_services.water_source,
                road_access: g.basic_services.road_access,
                electricity: g.basic_services.electricity_count > (g._count / 2),
                drainage_system_coverage: g.basic_services.drainage_count > (g._count / 2),
                solid_waste_management_coverage: g.basic_services.waste_count > (g._count / 2),
                telecommunications_access: g.basic_services.telecom_count > (g._count / 2),
                critical_lifeline_redundancy: g.basic_services.lifeline_count > (g._count / 2)
            };

            // Spatial Type aggregation formulas
            if (normalizedLevel === 'block') {
                const blockStats = AggregationService.aggregateHouseToBlock(g._source_items);
                if (blockStats) {
                    g.demographics.total_population = blockStats.total_population;
                    g.housing_indicators.informal_housing_coverage = blockStats.percent_informal_housing;
                    g.housing_indicators.proximity_to_hazard_zones = blockStats.percent_hazard_exposed;
                    g.risk_index.vulnerability_index = Math.round(blockStats.avg_vulnerability_score * 10) / 10;
                    g.hierarchy_summary.total_population = blockStats.total_population;
                    g.hierarchy_summary.vulnerability_score = g.risk_index.vulnerability_index;
                }
            } else if (normalizedLevel === 'woreda') {
                const woredaStats = AggregationService.aggregateBlockToWoreda(g._source_items);
                if (woredaStats) {
                    // Keep low_income_households as count for correct rollup aggregation
                    Object.keys(g.risk_index).forEach(k => g.risk_index[k] = Math.round(g.risk_index[k] / g._count * 10) / 10);
                }
            } else if (normalizedLevel === 'subcity') {
                const subcityStats = AggregationService.aggregateWoredaToSubcity(g._source_items);
                if (subcityStats) {
                    g.risk_index.overall_woreda_risk_score = Math.round(subcityStats.avg_risk_score * 10) / 10;
                    g.remarks = `Sub-city rollup. ${Math.round(subcityStats.percent_high_risk)}% Woredas at High Risk.`;
                }
            } else if (normalizedLevel === 'city') {
                const cityStats = AggregationService.aggregateSubcityToCity(g._source_items);
                if (cityStats) {
                    g.risk_index.capacity_index = Math.round(cityStats.avg_capacity * 10) / 10;
                    g.remarks = `City-wide strategic rollup. Risk Dist: VH:${cityStats.risk_distribution.VeryHigh}, H:${cityStats.risk_distribution.High}, M:${cityStats.risk_distribution.Medium}, L:${cityStats.risk_distribution.Low}`;
                }
            }

            g.hierarchy_summary.hazard_score = g.risk_index.hazard_index;
            g.hierarchy_summary.vulnerability_score = g.risk_index.vulnerability_index;
            g.hierarchy_summary.exposure_score = g.risk_index.exposure_index;
            g.hierarchy_summary.capacity_score = g.risk_index.capacity_index;
            g.hierarchy_summary.dr_risk_score = g.risk_index.overall_woreda_risk_score;

            // Majority vote for categorical items
            ['economic_risk_indicators', 'environmental_indicators', 'preparedness_indicators', 'recovery_indicators'].forEach(cat => {
                const finalCat = {};
                Object.entries(g[cat]).forEach(([key, votes]) => {
                    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
                    finalCat[key] = sorted[0][0]; // Take majority
                });
                g[cat] = finalCat;
            });
        }
        delete g._count;
        delete g._source_items;
        return g;
    });

    const parentBuckets = new Map();
    finalized.forEach(item => {
        const parentKey = item.hierarchy_summary?.parent_key;
        if (!parentKey) return;
        if (!parentBuckets.has(parentKey)) parentBuckets.set(parentKey, []);
        parentBuckets.get(parentKey).push(item);
    });

    parentBuckets.forEach(bucket => {
        bucket
            .sort((a, b) => (b.hierarchy_summary?.dr_risk_score || 0) - (a.hierarchy_summary?.dr_risk_score || 0))
            .forEach((item, idx) => {
                item.hierarchy_summary.rank_in_parent = idx + 1;
            });
    });

    return finalized;
};

// @desc    Get all Woreda Profiles
// @route   GET /api/woreda-profiles
export const getWoredaProfiles = async (req, res) => {
    try {
        const { subcity, woreda, block, status, level } = req.query;
        let query = { ...(req.dataScope || {}) };

        const buildFlexRegex = (value, type) => {
            const clean = value.replace(new RegExp(`\\b${type}\\b`, 'ig'), '').trim();
            const num = parseInt(clean, 10);
            if (!isNaN(num)) {
                return new RegExp(`(^|\\D)0*${num}(\\D|$)`, 'i');
            }
            return new RegExp(`^${clean}`, 'i');
        };

        if (subcity) query['location.subcity'] = { $regex: new RegExp(`^${subcity.replace(/\bsub[\s-]?city\b/ig, '').trim()}`, 'i') };
        if (woreda) query['location.woreda'] = { $regex: buildFlexRegex(woreda, 'woreda') };
        if (block) query['location.block'] = { $regex: buildFlexRegex(block, 'block') };

        if (status) query.status = status;

        if (['all', 'city', 'subcity', 'woreda', 'block'].includes(level)) {
            // Get raw household profiles from both HouseholdProfile and WoredaProfile collections
            const householdProfilesFromHP = await HouseholdProfile.find(query)
                .populate('createdBy', 'fullname');
            const wpQuery = {
                ...query,
                $and: [
                    {
                        $or: [
                            { aggregation_level: 'household' },
                            { aggregation_level: { $exists: false } },
                            { aggregation_level: null }
                        ]
                    },
                    { 'location.house_no': { $exists: true, $ne: '', $nin: ['Aggregated Data', 'All Blocks'] } }
                ]
            };
            const householdProfilesFromWP = await WoredaProfile.find(wpQuery)
                .populate('createdBy', 'fullname');
            const householdProfiles = [...householdProfilesFromHP, ...householdProfilesFromWP];

            // Get direct woreda assessments from WoredaAssessment collection
            let woredaQuery = {};
            if (subcity) woredaQuery['location.subcity'] = { $regex: new RegExp(`^${subcity.replace(/\bsub[\s-]?city\b/ig, '').trim()}`, 'i') };
            if (woreda) woredaQuery['location.woreda'] = { $regex: buildFlexRegex(woreda, 'woreda') };
            if (status) woredaQuery.status = status;

            const directWoredaProfiles = await WoredaAssessment.find(woredaQuery)
                .populate('createdBy', 'fullname');

            const directBlockProfiles = [];
            const directSubcityProfiles = [];
            const directCityProfiles = [];

            const blockProfiles = aggregateProfiles(householdProfiles, 'block', 'household');
            const enrichedBlockProfiles = mergeDirectEnrichment(blockProfiles, directBlockProfiles, 'block');
            if (level === 'block') return res.json(enrichedBlockProfiles);

            const woredaProfiles = aggregateProfiles(enrichedBlockProfiles, 'woreda', 'block');
            const enrichedWoredaProfiles = mergeDirectEnrichment(woredaProfiles, directWoredaProfiles, 'woreda');
            if (level === 'woreda') return res.json(enrichedWoredaProfiles);

            const subcityProfiles = aggregateProfiles(enrichedWoredaProfiles, 'subcity', 'woreda');
            const enrichedSubcityProfiles = mergeDirectEnrichment(subcityProfiles, directSubcityProfiles, 'subcity');
            if (level === 'subcity') return res.json(enrichedSubcityProfiles);

            const cityProfiles = aggregateProfiles(enrichedSubcityProfiles, 'city', 'subcity');
            const enrichedCityProfiles = mergeDirectEnrichment(cityProfiles, directCityProfiles, 'city');
            return res.json(enrichedCityProfiles);
        }

        // Return raw household profiles from both HouseholdProfile and WoredaProfile collections
        const householdProfilesFromHP = await HouseholdProfile.find(query)
            .sort({ updatedAt: -1 })
            .populate('createdBy', 'fullname');
        const wpQuery = {
            ...query,
            $and: [
                {
                    $or: [
                        { aggregation_level: 'household' },
                        { aggregation_level: { $exists: false } },
                        { aggregation_level: null }
                    ]
                },
                { 'location.house_no': { $exists: true, $ne: '', $nin: ['Aggregated Data', 'All Blocks'] } }
            ]
        };
        const householdProfilesFromWP = await WoredaProfile.find(wpQuery)
            .sort({ updatedAt: -1 })
            .populate('createdBy', 'fullname');
        const householdProfiles = [...householdProfilesFromHP, ...householdProfilesFromWP]
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

        const uniqueHouseholds = [];
        const seen = new Set();
        for (const p of householdProfiles) {
            const sc = (p.location?.subcity || '').toLowerCase().replace(/\bsub[\s-]?city\b/g, '').trim();
            const wo = (p.location?.woreda || '').toLowerCase().replace(/\bworeda\b/g, '').trim();
            const bl = (p.location?.block || '').toLowerCase().replace(/\bblock\b/g, '').trim();
            const hn = (p.location?.house_no || '').toString().toLowerCase().trim();
            const hKey = `${sc}-${wo}-${bl}-${hn}`;
            if (!seen.has(hKey)) {
                seen.add(hKey);
                uniqueHouseholds.push(AggregationService.normalizeHouseholdToAggregatedSchema(p));
            }
        }
        return res.json(uniqueHouseholds);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get latest WoredaProfiles update timestamp (public)
// @route   GET /api/woreda-profiles/last-updated
export const getWoredaProfilesLastUpdated = async (req, res) => {
    try {
        const latest = await WoredaProfile.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean();
        if (!latest || !latest.updatedAt) return res.json({ lastUpdated: null });
        return res.json({ lastUpdated: latest.updatedAt });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single Woreda Profile
export const getWoredaProfileById = async (req, res) => {
    try {
        let profile = await WoredaProfile.findById(req.params.id)
            .populate('assessed_by', 'fullname')
            .populate('createdBy', 'fullname');

        if (!profile) {
            // Check HouseholdProfile collection
            profile = await HouseholdProfile.findById(req.params.id)
                .populate('createdBy', 'fullname');
        }

        if (!profile) {
            // Check WoredaAssessment collection
            profile = await WoredaAssessment.findById(req.params.id)
                .populate('createdBy', 'fullname');
        }

        if (!profile) return res.status(404).json({ message: 'Woreda Profile not found' });

        const level = profile.aggregation_level || profile.hierarchy_summary?.aggregation_level || 'household';
        const isHousehold = level === 'household' || (profile.location?.house_no && profile.location.house_no !== 'Aggregated Data' && profile.location.house_no !== '');

        if (isHousehold) {
            res.json(AggregationService.normalizeHouseholdToAggregatedSchema(profile));
        } else {
            res.json(profile);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new Woreda Profile
export const createWoredaProfile = async (req, res) => {
    try {
        const { location } = req.body;
        const matchCriteria = {
            'location.subcity': location.subcity,
            'location.woreda': location.woreda,
            'location.block': location.block || '',
            'location.house_no': location.house_no || ''
        };
        const existing = await WoredaProfile.findOne(matchCriteria);
        if (existing) {
            return res.status(400).json({
                message: `Duplicate location detected.`
            });
        }
        const profileData = {
            ...req.body,
            aggregation_level: req.body.aggregation_level || 'household',
            hierarchy_summary: req.body.hierarchy_summary || buildHouseholdHierarchySummary(req.body),
            createdBy: req.user?._id,
            assessed_by: req.user?._id
        };
        if (profileData.aggregation_level === 'woreda') {
            const computed = calculateWoredaRiskIndex(profileData);
            profileData.risk_index = computed.risk_index;
            profileData.hierarchy_summary = computed.hierarchy_summary;
        }
        const profile = new WoredaProfile(profileData);
        const saved = await profile.save();
        await auditService.logAction({
            userId: req.user?._id, action: 'WOREDA_PROFILE_CREATE',
            resource: 'WoredaProfile', resourceId: saved._id, after: saved, ip: req.ip
        });
        res.status(201).json(saved);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update Woreda Profile
export const updateWoredaProfile = async (req, res) => {
    try {
        const profile = await WoredaProfile.findById(req.params.id);
        if (!profile) return res.status(404).json({ message: 'Woreda Profile not found' });
        const before = profile.toObject();
        Object.assign(profile, req.body);
        if (profile.aggregation_level === 'woreda') {
            const computed = calculateWoredaRiskIndex(profile.toObject());
            profile.risk_index = computed.risk_index;
            profile.hierarchy_summary = computed.hierarchy_summary;
        }
        const updated = await profile.save();
        await auditService.logAction({
            userId: req.user?._id, action: 'WOREDA_PROFILE_UPDATE',
            resource: 'WoredaProfile', resourceId: updated._id, before, after: updated, ip: req.ip
        });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Delete Woreda Profile
export const deleteWoredaProfile = async (req, res) => {
    try {
        const profile = await WoredaProfile.findById(req.params.id);
        if (!profile) return res.status(404).json({ message: 'Woreda Profile not found' });
        const before = profile.toObject();
        await WoredaProfile.findByIdAndDelete(req.params.id);
        await auditService.logAction({
            userId: req.user?._id, action: 'WOREDA_PROFILE_DELETE',
            resource: 'WoredaProfile', resourceId: req.params.id, before, ip: req.ip
        });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get summary stats
export const getWoredaProfileStats = async (req, res) => {
    try {
        const scopeFilter = req.dataScope || {};
        const matchStage = Object.keys(scopeFilter).length > 0 ? [{ $match: scopeFilter }] : [];
        
        const [hpTotal, waTotal, wpTotal, hpPop, wpPop] = await Promise.all([
            HouseholdProfile.countDocuments(scopeFilter),
            WoredaAssessment.countDocuments(scopeFilter),
            WoredaProfile.countDocuments(scopeFilter),
            HouseholdProfile.aggregate([...matchStage, { $group: { _id: null, sum: { $sum: '$demographics.total_household_members' } } }]),
            WoredaProfile.aggregate([...matchStage, { $group: { _id: null, sum: { $sum: '$demographics.total_population' } } }])
        ]);

        const totalPopulation = (hpPop[0]?.sum || 0) + (wpPop[0]?.sum || 0);
        res.json({
            total: hpTotal + waTotal + wpTotal,
            totalHouseholdProfiles: hpTotal,
            totalWoredaAssessments: waTotal,
            totalPopulation
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Import from Excel
export const importWoredaProfile = async (req, res) => {
    try {
        // Legacy bulk import logic remained for compatibility
        res.status(501).json({ message: 'Import logic requires update to 5-layer model' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Sync from Interview
export const syncFromInterview = async (req, res) => {
    try {
        const { responseId, mappingId, dryRun } = req.body;
        const response = await FormResponse.findById(responseId);
        if (!response) return res.status(404).json({ message: 'Not found' });
        const mapping = await ProfileMapping.findById(mappingId);
        if (!mapping) return res.status(404).json({ message: 'Not found' });

        const answersObj = Object.fromEntries(response.answers);
        const syncResult = MappingService.transformData(answersObj, mapping);
        const transformedData = syncResult.data;

        transformedData.assessed_by = response.respondentMetadata?.enumeratorId || req.user?._id;
        transformedData.createdBy = req.user?._id;
        transformedData.assessment_date = response.submittedAt;
        transformedData.status = 'Draft';

        let saved;
        const target = mapping.targetModel || 'WoredaProfile';

        if (target === 'HouseholdProfile') {
            if (!transformedData.location) {
                transformedData.location = {
                    subcity: response.respondentMetadata?.location?.subcity || '',
                    woreda: response.respondentMetadata?.location?.woreda || 'Unknown Woreda',
                    block: response.respondentMetadata?.location?.block || '',
                    house_no: response.respondentMetadata?.location?.house_no || ''
                };
            }
            saved = await HouseholdProfile.create(transformedData);
        } else if (target === 'WoredaAssessment') {
            if (!transformedData.location) {
                transformedData.location = {
                    subcity: response.respondentMetadata?.location?.subcity || '',
                    woreda: response.respondentMetadata?.location?.woreda || 'Unknown Woreda',
                    block: response.respondentMetadata?.location?.block || '',
                    house_no: response.respondentMetadata?.location?.house_no || ''
                };
            }
            saved = await WoredaAssessment.create(transformedData);
        } else {
            // Legacy WoredaProfile flow
            transformedData.aggregation_level = transformedData.aggregation_level || 'household';
            transformedData.hierarchy_summary = buildHouseholdHierarchySummary(transformedData);
            if (transformedData.aggregation_level === 'woreda') {
                const computed = calculateWoredaRiskIndex(transformedData);
                transformedData.risk_index = computed.risk_index;
                transformedData.hierarchy_summary = computed.hierarchy_summary;
            }
            saved = await WoredaProfile.create(transformedData);
        }

        // Update the FormResponse sync status
        response.syncStatus = 'SYNCED';
        response.lastSyncedAt = new Date();
        response.moduleContextId = saved._id;
        response.moduleContextType = target === 'HouseholdProfile' ? 'Household' : (target === 'WoredaAssessment' ? 'Woreda' : 'Feedback');
        await response.save();

        res.status(201).json(saved);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk Import Data into Pending Review Queue
export const bulkImportData = async (req, res) => {
    try {
        const { type, items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'No items provided for import' });
        }
        const batchId = `BATCH-${Date.now()}`;
        const createdCount = [];

        for (const item of items) {
            if (type === 'household') {
                const subcity = item.Subcity || item.subcity || '';
                const woreda = item.Woreda || item.woreda || 'Unknown Woreda';
                const block = item.Block || item.block || 'Block 01';
                const house_no = item['House No'] || item.house_no || `H-${Math.floor(100 + Math.random() * 900)}`;

                const doc = await HouseholdProfile.create({
                    location: { subcity, woreda, block, house_no },
                    assessment_date: item['Survey Date (YYYY-MM-DD)'] || item.survey_date || new Date(),
                    identity_location: {
                        subcity, woreda, block, house_no,
                        enumerator_name: item['Enumerator Name'] || item.enumerator_name || '',
                        survey_date: item['Survey Date (YYYY-MM-DD)'] || item.survey_date || new Date(),
                        respondent_consent_status: item['Consent (Yes/No)'] || item.consent || 'Yes'
                    },
                    demographics: {
                        total_household_members: Number(item['Total Household Members'] || item.family_size || 1),
                        female_headed_household: item['Female-Headed Household (Yes/No)'] || item.female_headed || 'No',
                        idp_status: item['IDP Status (Yes/No)'] || item.idp_status || 'No',
                        employment_status: item['Employment Status'] || item.employment_status || 'Employed'
                    },
                    livelihood_economy: {
                        primary_livelihood_type: item['Primary Livelihood'] || item.livelihood || 'Laborer',
                        household_income_level: item['Household Income Level'] || item.income_level || 'Low',
                        small_business_ownership: item['Small Business Ownership (Yes/No)'] || 'No',
                        daily_labour_dependency: item['Daily Labour Dependency (Yes/No)'] || 'No',
                        insurance_coverage: item['Insurance Coverage'] || 'No'
                    },
                    housing_physical_conditions: {
                        wall_material_type: item['Wall Material Type'] || 'Wood and Mud',
                        roof_material_type: item['Roof Material Type'] || 'Corrugated Iron',
                        building_age_years: Number(item['Building Age (Years)'] || 15),
                        building_code_compliance: item['Building Code Compliance (Yes/No)'] || 'No',
                        informal_settlement: item['Informal Settlement (Yes/No)'] || 'No',
                        proximity_to_hazard_zone: item['Proximity to Hazard Zone (Yes/No)'] || 'No'
                    },
                    preparedness: {
                        knows_nearest_emergency_shelter: item['Knows Emergency Shelter (Yes/No)'] || 'No',
                        family_emergency_plan_exists: item['Family Emergency Plan (Yes/No)'] || 'No'
                    },
                    recovery_capacity: {
                        government_safety_net_access: item['Government Safety Net Access (Yes/No)'] || 'No'
                    },
                    status: 'Pending Review',
                    import_batch_id: batchId,
                    createdBy: req.user?._id
                });
                createdCount.push(doc);
            } else {
                const subcity = item.Subcity || item.subcity || '';
                const woreda = item.Woreda || item.woreda || 'Unknown Woreda';
                const doc = await WoredaAssessment.create({
                    location: { subcity, woreda },
                    assessment_date: item['Survey Date (YYYY-MM-DD)'] || item.survey_date || new Date(),
                    remarks: item.Remarks || item.remarks || 'Imported via Excel Batch',
                    status: 'Pending Review',
                    import_batch_id: batchId,
                    createdBy: req.user?._id
                });
                createdCount.push(doc);
            }
        }

        res.status(201).json({
            success: true,
            batchId,
            count: createdCount.length,
            message: `Imported ${createdCount.length} records in 'Pending Review' status.`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve or Reject Single Assessment
export const updateApprovalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection_reason } = req.body;
        if (!['Approved', 'Rejected', 'Reviewed', 'Draft', 'Pending Review'].includes(status)) {
            return res.status(400).json({ message: 'Invalid approval status' });
        }

        let doc = await HouseholdProfile.findById(id);
        let collectionType = 'HouseholdProfile';

        if (!doc) {
            doc = await WoredaAssessment.findById(id);
            collectionType = 'WoredaAssessment';
        }
        if (!doc) {
            doc = await WoredaProfile.findById(id);
            collectionType = 'WoredaProfile';
        }

        if (!doc) return res.status(404).json({ message: 'Assessment record not found' });

        doc.status = status;
        doc.reviewed_by = req.user?._id;
        doc.reviewed_at = new Date();
        if (rejection_reason) doc.rejection_reason = rejection_reason;

        const updated = await doc.save();

        if (status === 'Approved' || status === 'Reviewed') {
            try {
                const { triggerScopedAggregation } = await import('../services/aggregationTriggerService.js');
                await triggerScopedAggregation({
                    subcity: doc.location?.subcity,
                    woreda: doc.location?.woreda,
                    block: doc.location?.block
                });
            } catch (aggErr) {
                console.error('[Approval] Spatial aggregation recalculation failed:', aggErr.message);
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve or Reject Batch Assessments
export const approveBatch = async (req, res) => {
    try {
        const { ids, status, rejection_reason } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No record IDs provided' });
        }
        if (!['Approved', 'Rejected', 'Reviewed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status for batch update' });
        }

        const updatePayload = {
            status,
            reviewed_by: req.user?._id,
            reviewed_at: new Date(),
            ...(rejection_reason ? { rejection_reason } : {})
        };

        const resHP = await HouseholdProfile.updateMany({ _id: { $in: ids } }, updatePayload);
        const resWA = await WoredaAssessment.updateMany({ _id: { $in: ids } }, updatePayload);
        const resWP = await WoredaProfile.updateMany({ _id: { $in: ids } }, updatePayload);

        const totalModified = (resHP.modifiedCount || 0) + (resWA.modifiedCount || 0) + (resWP.modifiedCount || 0);

        if (status === 'Approved' || status === 'Reviewed') {
            try {
                const { triggerScopedAggregation } = await import('../services/aggregationTriggerService.js');
                await triggerScopedAggregation({ subcity: null, woreda: null, block: null });
            } catch (err) {
                console.error('[BatchApproval] Aggregation failed:', err.message);
            }
        }

        res.json({
            success: true,
            updatedCount: totalModified,
            message: `Successfully set ${totalModified} assessments to ${status}.`
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
