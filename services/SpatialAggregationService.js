/**
 * SpatialAggregationService.js
 * Implements the 5-layer spatial aggregation logic:
 * House -> Block -> Woreda -> Sub-city -> City
 */

// Helper to compute DR Risk Score
export const computeRiskScore = (h, e, v, c) => {
    const cap = c > 0 ? c : 1;
    const score = (h * e * v) / cap;
    return Math.round(score * 10) / 10;
};

// Hazard Index H = AVERAGE(top 3 H_hazard scores)
export const calculateHazardIndex = (hazards = []) => {
    const freqMap = { 'Daily': 5, 'Weekly': 4, 'Monthly': 3, 'Yearly': 2, 'Rarely': 1 };
    const sevMap = { 'Catastrophic': 5, 'Major': 4, 'Moderate': 3, 'Minor': 2, 'Insignificant': 1 };
    
    const scores = hazards.map(h => {
        const f = freqMap[h.frequency] || Number(h.frequency) || 1;
        const s = sevMap[h.severity] || Number(h.severity) || 1;
        const d = Number(h.duration) || 1;
        const se = Number(h.spatial_extent) || 1;
        return (f * 0.35) + (s * 0.35) + (d * 0.15) + (se * 0.15);
    }).sort((a, b) => b - a);
    
    const top3 = scores.slice(0, 3);
    const avg = top3.length > 0 ? top3.reduce((a, b) => a + b, 0) / top3.length : 1;
    return Math.round(avg * 10) / 10;
};

// Exposure Index E = (E_pop * 0.6) + (E_infra * 0.4)
export const calculateExposureIndex = (housingIndicators = {}, kiiInfra = {}) => {
    const pctExposed = Number(housingIndicators?.proximity_to_hazard_zones ?? 0);
    const E_pop = (pctExposed / 100) * 5;
    
    const health = Number(kiiInfra?.health) || 1;
    const water = Number(kiiInfra?.water) || 1;
    const energy = Number(kiiInfra?.energy) || 1;
    const emergency = Number(kiiInfra?.emergency) || 1;
    const communications = Number(kiiInfra?.communications) || 1;
    const E_infra = (health + water + energy + emergency + communications) / 5;
    
    const E = (E_pop * 0.6) + (E_infra * 0.4);
    return Math.round(E * 10) / 10;
};

// Vulnerability Index V = (V_soc * 0.30) + (V_phy * 0.30) + (V_eco * 0.25) + (V_env * 0.15)
export const calculateVulnerabilityIndex = (sourceItems = [], kiiEnv = {}) => {
    const count = sourceItems.length;
    if (count === 0) return 1;

    let totalPop = sourceItems.reduce((sum, h) => sum + (h.demographics?.total_population || h.household_profile?.demographics?.total_household_members || 0), 0);
    if (totalPop === 0) totalPop = 1;

    const totalHH = sourceItems.reduce((sum, h) => sum + (h.demographics?.total_households || 1), 0);

    // pctFemaleHeaded
    const femaleHeadedCount = sourceItems.filter(h => h.household_profile?.demographics?.female_headed_household === 'Yes' || h.demographics?.female_headed_households > 0).length;
    const pctFemaleHeaded = femaleHeadedCount / count;

    // pctElderly
    const elderlyCount = sourceItems.reduce((sum, h) => sum + (h.household_profile?.demographics?.elderly_60_plus || h.demographics?.elderly_60_plus || 0), 0);
    const pctElderly = elderlyCount / totalPop;

    // pctIDP
    const idpCount = sourceItems.filter(h => h.household_profile?.demographics?.idp_status === 'Yes' || h.demographics?.internally_displaced_population > 0).length;
    const pctIDP = idpCount / count;

    // pctUnemployed
    const unemployedCount = sourceItems.filter(h => h.household_profile?.demographics?.employment_status === 'Unemployed' || h.demographics?.unemployment_rate === 100).length;
    const pctUnemployed = unemployedCount / count;

    const V_soc = ((pctFemaleHeaded + pctElderly + pctIDP + pctUnemployed) / 4) * 5;

    // Physical
    const nonDurableCount = sourceItems.filter(h => {
        const wall = String(h.household_profile?.housing_physical_conditions?.wall_material_type || (h.housing_indicators?.percent_non_durable_materials === 100 ? 'wood' : '')).toLowerCase();
        return ['wood', 'mud', 'plastic', 'chika'].some(m => wall.includes(m));
    }).length;
    const pctNonDurable = nonDurableCount / count;

    const oldCount = sourceItems.filter(h => (h.household_profile?.housing_physical_conditions?.building_age_years || 0) > 30 || h.housing_indicators?.age_buildings_over_30_years === 100).length;
    const pctOld = oldCount / count;

    const nonCompliantCount = sourceItems.filter(h => {
        const comp = h.household_profile?.housing_physical_conditions?.building_code_compliance || '';
        return comp === 'No' || comp === 'Non-compliant' || h.housing_indicators?.compliance_with_building_codes === 0;
    }).length;
    const pctNonCompliant = nonCompliantCount / count;

    const V_phy = ((pctNonDurable + pctOld + pctNonCompliant) / 3) * 5;

    // Economic
    const lowIncomeCount = sourceItems.filter(h => {
        const inc = String(h.household_profile?.livelihood_economy?.household_income_level || '').toLowerCase();
        return ['low', 'very low', 'below', '<'].some(lvl => inc.includes(lvl)) || h.demographics?.low_income_households > 0;
    }).length;
    const pctLowIncome = lowIncomeCount / count;

    const dailyLabourCount = sourceItems.filter(h => h.household_profile?.livelihood_economy?.daily_labour_dependency === 'Yes' || h.economic_risk_indicators?.daily_labor_dependency === 'High').length;
    const pctDailyLabour = dailyLabourCount / count;

    const uninsuredCount = sourceItems.filter(h => {
        const ins = h.household_profile?.livelihood_economy?.insurance_coverage || '';
        return ins === 'No' || ins === '' || h.economic_risk_indicators?.insurance_coverage_level === 'Low';
    }).length;
    const pctUninsured = uninsuredCount / count;

    const V_eco = ((pctLowIncome + pctDailyLabour + pctUninsured) / 3) * 5;

    // Environmental
    const drainage = Number(kiiEnv?.drainage) || 1;
    const greenCover = Number(kiiEnv?.green_cover) || 1;
    const wasteMgmt = Number(kiiEnv?.waste_mgmt) || 1;
    const pollution = Number(kiiEnv?.pollution) || 1;
    const V_env = (drainage + greenCover + wasteMgmt + pollution) / 4;

    const V = (V_soc * 0.30) + (V_phy * 0.30) + (V_eco * 0.25) + (V_env * 0.15);
    return Math.round(V * 10) / 10;
};

// Capacity Index C
export const calculateCapacityIndex = (kiiCapacity = {}) => {
    const ews = Number(kiiCapacity?.ews) || 1;
    const drm_committee = Number(kiiCapacity?.drm_committee) || 1;
    const focal_persons = Number(kiiCapacity?.focal_persons) || 1;
    const training_freq = Number(kiiCapacity?.training_freq) || 1;
    const shelters = Number(kiiCapacity?.shelters) || 1;
    const community_structures = Number(kiiCapacity?.community_structures) || 1;
    const C_prep = (ews + drm_committee + focal_persons + training_freq + shelters + community_structures) / 6;

    const emergency_services = Number(kiiCapacity?.emergency_services) || 1;
    const inter_sector_coordination = Number(kiiCapacity?.inter_sector_coordination) || 1;
    const institutional_strength = Number(kiiCapacity?.institutional_strength) || 1;
    const C_resp = (emergency_services + inter_sector_coordination + institutional_strength) / 3;

    const recovery_plan = Number(kiiCapacity?.recovery_plan) || 1;
    const budget = Number(kiiCapacity?.budget) || 1;
    const drm_mainstreaming = Number(kiiCapacity?.drm_mainstreaming) || 1;
    const C_rec = (recovery_plan + budget + drm_mainstreaming) / 3;

    const C = (C_prep * 0.40) + (C_resp * 0.35) + (C_rec * 0.25);
    return Math.round(C * 10) / 10;
};

export const aggregateHouseToBlock = (households) => {
    const totalHH = households.length;
    if (totalHH === 0) return null;

    const totalPop = households.reduce((sum, hh) => sum + (hh.demographics?.total_population || 0), 0);
    const informalHH = households.filter(hh => hh.household_profile?.housing_physical_conditions?.informal_settlement === 'Yes').length;
    const hazardExposedHH = households.filter(hh => hh.household_profile?.housing_physical_conditions?.proximity_to_hazard_zone === 'Yes').length;
    
    // Using resilience_enumerator_assessment_1_5 as V_score proxy if available, otherwise 1
    const totalVScore = households.reduce((sum, hh) => sum + (hh.household_profile?.recovery_capacity?.resilience_enumerator_assessment_1_5 || 1), 0);

    return {
        total_population: totalPop,
        percent_informal_housing: (informalHH / totalHH) * 100,
        percent_hazard_exposed: (hazardExposedHH / totalHH) * 100,
        avg_vulnerability_score: totalVScore / totalHH,
        total_households: totalHH
    };
};

export const aggregateBlockToWoreda = (blocks) => {
    const totalHH = blocks.reduce((sum, b) => sum + (b.demographics?.total_households || 0), 0);
    if (totalHH === 0) return null;

    const totalPop = blocks.reduce((sum, b) => sum + (b.demographics?.total_population || 0), 0);
    
    // Poverty rate %: aggregated from household level counts if available in blocks
    const povertyHH = blocks.reduce((sum, b) => sum + (b.demographics?.low_income_households || 0), 0);

    return {
        total_population: totalPop,
        total_households: totalHH,
        poverty_rate: (povertyHH / totalHH) * 100,
    };
};

export const aggregateWoredaToSubcity = (woredas) => {
    if (woredas.length === 0) return null;

    const totalPop = woredas.reduce((sum, w) => sum + (w.demographics?.total_population || 0), 0);
    
    // Avg risk score: AVERAGE(DR_woreda) weighted by woreda population
    const weightedDRSum = woredas.reduce((sum, w) => sum + ((w.risk_index?.overall_woreda_risk_score || 0) * (w.demographics?.total_population || 0)), 0);
    const avgRiskScore = totalPop > 0 ? weightedDRSum / totalPop : 0;

    // % woredas high/very high risk: COUNT(DR >= 16) / COUNT(all woredas) * 100
    const highRiskWoredas = woredas.filter(w => (w.risk_index?.overall_woreda_risk_score || 0) >= 16).length;
    const percentHighRisk = (highRiskWoredas / woredas.length) * 100;

    return {
        total_population: totalPop,
        avg_risk_score: avgRiskScore,
        percent_high_risk: percentHighRisk
    };
};

export const aggregateSubcityToCity = (woredas) => {
    if (woredas.length === 0) return null;

    // City risk distribution: COUNT(DR by level: Low/Med/High/VH) across all woredas
    const distribution = { Low: 0, Medium: 0, High: 0, VeryHigh: 0 };
    woredas.forEach(w => {
        const dr = w.risk_index?.overall_woreda_risk_score || 0;
        if (dr < 8) distribution.Low++;
        else if (dr < 16) distribution.Medium++;
        else if (dr < 24) distribution.High++;
        else distribution.VeryHigh++;
    });

    // City-wide avg capacity: AVERAGE(C_woreda) across all woredas
    const totalCapacity = woredas.reduce((sum, w) => sum + (w.risk_index?.capacity_index || 0), 0);
    const avgCapacity = woredas.length > 0 ? totalCapacity / woredas.length : 0;

    // City hazard heatmap: COUNT(woreda where H_hazard_type >= 3) per hazard type
    // Hazard prevalence: we'll check if hazard_index is high or specific hazards are high
    const hazardHeatmap = {};
    woredas.forEach(w => {
        (w.hazards || []).forEach(h => {
            // If the specific hazard severity is high (e.g. >= 3/5)
            const sevMap = { 'Catastrophic': 5, 'Major': 4, 'Moderate': 3, 'Minor': 2, 'Insignificant': 1 };
            const s = sevMap[h.severity] || (parseInt(h.severity) || 1);
            if (s >= 3) {
                hazardHeatmap[h.hazard_name] = (hazardHeatmap[h.hazard_name] || 0) + 1;
            }
        });
    });

    return {
        risk_distribution: distribution,
        avg_capacity: avgCapacity,
        hazard_heatmap: hazardHeatmap
    };
};

export const normalizeHouseholdToAggregatedSchema = (profileDoc) => {
    if (!profileDoc) return profileDoc;
    let p = profileDoc.toObject ? profileDoc.toObject() : profileDoc;

    if (!p.household_profile && (p.identity_location || p.livelihood_economy || p.housing_physical_conditions)) {
        p.household_profile = {
            identity_location: p.identity_location,
            demographics: p.demographics,
            livelihood_economy: p.livelihood_economy,
            housing_physical_conditions: p.housing_physical_conditions,
            preparedness: p.preparedness,
            recovery_capacity: p.recovery_capacity
        };
    } else if (!p.household_profile) {
        // Build synthetic household_profile from p's root fields
        const rDemo = p.demographics || {};
        const rLivelihoods = p.livelihoods || [];
        const rServices = p.basic_services || {};
        const rHousing = p.housing_indicators || {};
        const rCapacity = p.community_capacity || [];
        const rHazards = p.hazards || [];
        const rPreparedness = p.preparedness_indicators || {};
        const rRecovery = p.recovery_indicators || {};

        p.household_profile = {
            identity_location: {
                subcity: p.location?.subcity || '',
                woreda: p.location?.woreda || '',
                block: p.location?.block || '',
                house_no: p.location?.house_no || '',
                survey_date: p.assessment_date || p.createdAt || new Date(),
                respondent_consent_status: 'Yes'
            },
            demographics: {
                total_household_members: rDemo.total_population || 0,
                male_members: rDemo.male_population || 0,
                female_members: rDemo.female_population || 0,
                children_0_17: rDemo.children_0_17 || 0,
                youth_18_29: rDemo.youth_18_29 || 0,
                elderly_60_plus: rDemo.elderly_60_plus || 0,
                female_headed_household: rDemo.female_headed_households > 0 ? 'Yes' : 'No',
                idp_status: rDemo.internally_displaced_population > 0 ? 'Yes' : 'No',
                education_level_of_head: rDemo.education_levels?.[0]?.category || '',
                employment_status: rDemo.unemployment_rate > 0 ? 'Unemployed' : 'Employed'
            },
            livelihood_economy: {
                primary_livelihood_type: rLivelihoods[0]?.livelihood_type || '',
                secondary_livelihood_type: rLivelihoods[1]?.livelihood_type || '',
                household_income_level: rDemo.low_income_households > 0 ? 'Low' : 'Medium',
                small_business_ownership: p.economic_risk_indicators?.concentration_small_informal_businesses === 'High' ? 'Yes' : 'No',
                small_business_type: '',
                daily_labour_dependency: p.economic_risk_indicators?.daily_labor_dependency === 'High' ? 'Yes' : 'No',
                income_disruption_by_disaster: '',
                insurance_coverage: p.economic_risk_indicators?.insurance_coverage_level === 'Low' ? 'No' : 'Yes',
                access_to_credit_safety_nets: ''
            },
            housing_physical_conditions: {
                wall_material_type: rHousing.percent_non_durable_materials > 0 ? 'Wood/Mud' : 'Concrete',
                roof_material_type: '',
                building_age_years: rHousing.age_buildings_over_30_years > 0 ? 35 : 10,
                building_code_compliance: rHousing.compliance_with_building_codes >= 100 ? 'Yes' : 'No',
                informal_settlement: rHousing.informal_housing_coverage > 0 ? 'Yes' : 'No',
                sleeping_rooms: 2,
                proximity_to_hazard_zone: rHousing.proximity_to_hazard_zones > 0 ? 'Yes' : 'No',
                drainage_water_electricity_access: rServices.electricity ? 'Electricity' : ''
            },
            preparedness: {
                knows_nearest_emergency_shelter: rPreparedness.emergency_shelters_availability === 'High' ? 'Yes' : 'No',
                knows_local_evacuation_route: rPreparedness.evacuation_routes_mapped === 'High' ? 'Yes' : 'No',
                drm_training_received_type: rCapacity.some(c => c.capacity_type === 'Kebele DRM Committee') ? 'DRM Training' : 'None',
                family_emergency_plan_exists: rCapacity.some(c => c.capacity_type === 'Family Emergency Plan') ? 'Yes' : 'No',
                emergency_supplies_stockpiled: rPreparedness.stockpiled_emergency_supplies === 'High' ? 'Yes' : 'No',
                early_warning_received_channel: rServices.telecommunications_access ? 'SMS' : 'None',
                community_awareness_self_rated_1_5: rPreparedness.community_awareness_level === 'High' ? 4 : 2
            },
            recovery_capacity: {
                past_disaster_experience_type: rHazards[0]?.hazard_name || '',
                recovery_duration_months: 0,
                self_help_savings_group_membership: rRecovery.community_self_help_groups === 'High' ? 'Yes' : 'No',
                government_safety_net_access: rRecovery.access_to_credit_safety_nets === 'High' ? 'Yes' : 'No',
                income_diversification_2plus_sources: rRecovery.livelihood_diversification === 'High' ? 'Yes' : 'No',
                resilience_enumerator_assessment_1_5: 3
            }
        };
    }

    // Extract values
    const hp = p.household_profile;
    const location = p.location || {};
    const assessment_date = p.assessment_date || new Date();

    const hpDemo = hp.demographics || {};

    // Use total_household_members as the authoritative total population for household records.
    // If not set, fall back to male+female sum, then to the stored demographics field.
    const rawTotal = Number(hpDemo.total_household_members || 0);
    const rawMale  = Number(hpDemo.male_members  || p.demographics?.male_population  || 0);
    const rawFemale= Number(hpDemo.female_members || p.demographics?.female_population|| 0);

    // Derive a consistent totalPop: prefer explicit total, otherwise sum of gendered counts
    const totalPop = rawTotal > 0 ? rawTotal : (rawMale + rawFemale) || Number(p.demographics?.total_population || 0);

    // Cap gendered counts: they must not exceed totalPop individually.
    // When the user entered unreasonably large numbers, scale them down proportionally.
    let malePop  = rawMale;
    let femalePop= rawFemale;
    if (totalPop > 0 && (malePop + femalePop) > totalPop) {
        const genderSum = malePop + femalePop;
        malePop   = Math.round((malePop   / genderSum) * totalPop);
        femalePop = totalPop - malePop; // ensure they add up exactly
    }

    // Cap age-group fields
    const capAge = (val, field) => Math.min(Number(hpDemo[field] || p.demographics?.[field] || 0), totalPop);
    const children_0_17  = capAge(0, 'children_0_17');
    const youth_18_29    = capAge(0, 'youth_18_29');
    const elderly_60_plus= capAge(0, 'elderly_60_plus');
    const adults_30_59   = Math.max(0, totalPop - children_0_17 - youth_18_29 - elderly_60_plus);

    const isFemaleHeaded = hpDemo.female_headed_household === 'Yes';
    const isInformal = hp.housing_physical_conditions?.informal_settlement === 'Yes';
    
    const isLowIncome = hp.livelihood_economy?.household_income_level && 
        ['low', 'very low', 'below', '<'].some(lvl => String(hp.livelihood_economy.household_income_level).toLowerCase().includes(lvl));
    const isUnemployed = hpDemo.employment_status === 'Unemployed';
    const isIDP = hpDemo.idp_status === 'Yes';

    const education_levels = [];
    if (hpDemo.education_level_of_head) {
        education_levels.push({ category: hpDemo.education_level_of_head, count: 1 });
    }

    const demographics = {
        total_population: totalPop,
        male_population: malePop,
        female_population: femalePop,
        children_0_17,
        youth_18_29,
        adults_30_59,
        elderly_60_plus,
        total_households: 1,
        female_headed_households: isFemaleHeaded ? 1 : 0,
        informal_settlement_population: isInformal ? totalPop : 0,
        low_income_households: isLowIncome ? 1 : 0,
        unemployment_rate: isUnemployed ? 100 : 0,
        internally_displaced_population: isIDP ? totalPop : 0,
        education_levels
    };

    // 2. Livelihoods
    const livelihoods = [];
    if (hp.livelihood_economy?.primary_livelihood_type) {
        livelihoods.push({
            livelihood_type: hp.livelihood_economy.primary_livelihood_type,
            households: 1,
            percentage: 100
        });
    } else if (p.livelihoods && p.livelihoods.length > 0) {
        p.livelihoods.forEach(l => livelihoods.push(l));
    }

    // 3. Basic Services
    const hpCond = hp.housing_physical_conditions || {};
    const accessStr = (hpCond.drainage_water_electricity_access || '').toLowerCase();
    const hasElectricity = accessStr.includes('electricity') || accessStr.includes('power') || accessStr.includes('electric') || p.basic_services?.electricity;
    const hasDrainage = accessStr.includes('drainage') || accessStr.includes('sewer') || p.basic_services?.drainage_system_coverage;
    const hasWater = accessStr.includes('water') || (p.basic_services?.water_source && p.basic_services.water_source !== 'None/Other');
    const hasTelecom = hp.preparedness?.early_warning_received_channel ? true : (p.basic_services?.telecommunications_access || false);

    const basic_services = {
        water_source: hasWater ? (p.basic_services?.water_source || 'Piped Network') : 'None/Other',
        electricity: !!hasElectricity,
        road_access: p.basic_services?.road_access || 'All-weather',
        drainage_system_coverage: !!hasDrainage,
        solid_waste_management_coverage: p.basic_services?.solid_waste_management_coverage || false,
        telecommunications_access: !!hasTelecom,
        critical_lifeline_redundancy: p.basic_services?.critical_lifeline_redundancy || false
    };

    // 4. Critical Facilities
    const critical_facilities = p.critical_facilities || [];

    // 5. Vulnerable Groups
    const vulnerable_groups = p.vulnerable_groups && p.vulnerable_groups.length > 0 ? p.vulnerable_groups : [];
    if (vulnerable_groups.length === 0) {
        if (isFemaleHeaded) {
            vulnerable_groups.push({ group_type: 'Women-headed HH', number: 1 });
        }
        if (elderly_60_plus > 0 && totalPop === 1) {
            vulnerable_groups.push({ group_type: 'Elderly living alone', number: 1 });
        }
    }

    // 6. Community Capacity
    const community_capacity = p.community_capacity && p.community_capacity.length > 0 ? p.community_capacity : [];
    if (community_capacity.length === 0) {
        const prep = hp.preparedness || {};
        if (prep.family_emergency_plan_exists === 'Yes') {
            community_capacity.push({ capacity_type: 'Family Emergency Plan', available: true, remarks: 'Prepared at HH level' });
        }
        if (prep.drm_training_received_type && prep.drm_training_received_type !== 'None') {
            community_capacity.push({ capacity_type: 'Kebele DRM Committee', available: true, remarks: 'HH member trained' });
        }
    }

    // 7. Hazards
    const hazards = p.hazards && p.hazards.length > 0 ? p.hazards : [];
    if (hazards.length === 0) {
        if (hp.recovery_capacity?.past_disaster_experience_type) {
            hazards.push({
                hazard_name: hp.recovery_capacity.past_disaster_experience_type,
                frequency: 'Rarely',
                severity: 'Moderate',
                seasonality: 'Unknown',
                historical_events: 'Experienced by household'
            });
        }
    }

    // 8. Housing Indicators
    const wallNonDurable = ['wood', 'mud', 'plastic', 'chika'].some(m => String(hpCond.wall_material_type || '').toLowerCase().includes(m));
    const buildingAgeOver30 = (hpCond.building_age_years || 0) > 30;
    const codeCompliance = hpCond.building_code_compliance === 'Yes' || hpCond.building_code_compliance === 'Compliant' ? 100 : 0;
    const proximityHazard = hpCond.proximity_to_hazard_zone === 'Yes' ? 100 : 0;

    const housing_indicators = {
        percent_non_durable_materials: p.housing_indicators?.percent_non_durable_materials ?? (wallNonDurable ? 100 : 0),
        age_buildings_over_30_years: p.housing_indicators?.age_buildings_over_30_years ?? (buildingAgeOver30 ? 100 : 0),
        compliance_with_building_codes: p.housing_indicators?.compliance_with_building_codes ?? codeCompliance,
        housing_density_overcrowding: p.housing_indicators?.housing_density_overcrowding ?? ((totalPop / Math.max(1, hpCond.sleeping_rooms || 1)) > 3 ? 100 : 0),
        informal_housing_coverage: p.housing_indicators?.informal_housing_coverage ?? (isInformal ? 100 : 0),
        proximity_to_hazard_zones: p.housing_indicators?.proximity_to_hazard_zones ?? proximityHazard,
        fire_resistant_materials_availability: p.housing_indicators?.fire_resistant_materials_availability ?? (hpCond.fire_resistant_materials === 'Yes' ? 100 : 0)
    };

    // 9. Indicators maps
    const economic_risk_indicators = {
        concentration_small_informal_businesses: p.economic_risk_indicators?.concentration_small_informal_businesses || (hp.livelihood_economy?.small_business_ownership === 'Yes' ? 'Medium' : 'Low'),
        market_exposure: p.economic_risk_indicators?.market_exposure || 'Low',
        daily_labor_dependency: p.economic_risk_indicators?.daily_labor_dependency || (hp.livelihood_economy?.daily_labour_dependency === 'Yes' ? 'High' : 'Low'),
        business_interruption_risk: p.economic_risk_indicators?.business_interruption_risk || 'Low',
        industrial_hazard_exposure: p.economic_risk_indicators?.industrial_hazard_exposure || 'Low',
        insurance_coverage_level: p.economic_risk_indicators?.insurance_coverage_level || (hp.livelihood_economy?.insurance_coverage === 'Yes' ? 'Low' : 'High')
    };

    const environmental_indicators = {
        green_space_per_capita: p.environmental_indicators?.green_space_per_capita || 'Fair',
        wetland_encroachment: p.environmental_indicators?.wetland_encroachment || 'Low',
        soil_sealing_coverage: p.environmental_indicators?.soil_sealing_coverage || 'Medium',
        waste_dumping_sites: p.environmental_indicators?.waste_dumping_sites || 'Low',
        urban_drainage_blockage_frequency: p.environmental_indicators?.urban_drainage_blockage_frequency || 'Low',
        pollution_hotspots: p.environmental_indicators?.pollution_hotspots || 'Low'
    };

    const prep = hp.preparedness || {};
    const preparedness_indicators = {
        emergency_shelters_availability: p.preparedness_indicators?.emergency_shelters_availability || (prep.knows_nearest_emergency_shelter === 'Yes' ? 'High' : 'Low'),
        evacuation_routes_mapped: p.preparedness_indicators?.evacuation_routes_mapped || (prep.knows_local_evacuation_route === 'Yes' ? 'High' : 'Low'),
        firefighting_equipment_availability: p.preparedness_indicators?.firefighting_equipment_availability || 'Low',
        ambulance_coverage: p.preparedness_indicators?.ambulance_coverage || 'Low',
        emergency_drills_frequency: p.preparedness_indicators?.emergency_drills_frequency || 'Low',
        community_awareness_level: p.preparedness_indicators?.community_awareness_level || ((prep.community_awareness_self_rated_1_5 || 1) >= 3 ? 'Medium' : 'Low'),
        stockpiled_emergency_supplies: p.preparedness_indicators?.stockpiled_emergency_supplies || (prep.emergency_supplies_stockpiled === 'Yes' ? 'High' : 'Low')
    };

    const recovery_indicators = {
        post_disaster_recovery_plans: p.recovery_indicators?.post_disaster_recovery_plans || 'Low',
        livelihood_diversification: p.recovery_indicators?.livelihood_diversification || (hp.recovery_capacity?.income_diversification_2plus_sources === 'Yes' ? 'High' : 'Low'),
        access_to_credit_safety_nets: p.recovery_indicators?.access_to_credit_safety_nets || (hp.livelihood_economy?.access_to_credit_safety_nets ? 'Medium' : 'Low'),
        community_self_help_groups: p.recovery_indicators?.community_self_help_groups || (hp.recovery_capacity?.self_help_savings_group_membership === 'Yes' ? 'High' : 'Low'),
        urban_upgrading_programs: p.recovery_indicators?.urban_upgrading_programs || 'Low',
        climate_adaptation_initiatives: p.recovery_indicators?.climate_adaptation_initiatives || 'Low'
    };

    // 10. Risk Index
    let risk_index = p.risk_index || {};
    if (!risk_index.overall_woreda_risk_score || risk_index.overall_woreda_risk_score === 0) {
        const h = prep.knows_nearest_emergency_shelter === 'No' ? 5 : 2;
        const e = proximityHazard ? 8 : 2;
        const v_soc = isLowIncome ? 6 : 2;
        const v_phy = wallNonDurable ? 6 : 2;
        const v_eco = isUnemployed ? 6 : 2;
        const v_env = 2;
        const v = (v_soc * 0.3) + (v_phy * 0.3) + (v_eco * 0.25) + (v_env * 0.15);
        const capacityCount = [
            prep.family_emergency_plan_exists === 'Yes',
            prep.knows_nearest_emergency_shelter === 'Yes',
            prep.knows_local_evacuation_route === 'Yes',
            hp.recovery_capacity?.self_help_savings_group_membership === 'Yes'
        ].filter(Boolean).length;
        const c = Math.max(1, capacityCount * 2.5);
        const dr = Math.round(((h * e * v) / c) * 10) / 10;

        risk_index = {
            hazard_index: h,
            exposure_index: e,
            vulnerability_index: v,
            capacity_index: c,
            overall_woreda_risk_score: dr
        };
    }

    return {
        ...p,
        location,
        assessment_date,
        remarks: p.remarks || 'Household profile source',
        status: p.status,
        aggregation_level: 'household',
        demographics,
        livelihoods,
        basic_services,
        critical_facilities,
        vulnerable_groups,
        community_capacity,
        hazards,
        housing_indicators,
        economic_risk_indicators,
        environmental_indicators,
        preparedness_indicators,
        recovery_indicators,
        risk_index,
        hierarchy_summary: p.hierarchy_summary,
        household_profile: hp
    };
};
