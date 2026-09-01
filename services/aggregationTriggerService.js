/**
 * aggregationTriggerService.js
 *
 * Provides a scoped spatial aggregation trigger used by Mongoose post-save hooks.
 * Rather than recalculating the entire database, this service scopes the re-aggregation
 * to only the affected branch: Block -> Woreda -> Subcity -> City.
 *
 * This service is imported dynamically by model hooks to avoid circular dependency issues
 * that would arise from a static import (Model -> Service -> Model).
 */

import HouseholdProfile from '../models/HouseholdProfile.js';
import WoredaAssessment from '../models/WoredaAssessment.js';
import * as AggregationService from './SpatialAggregationService.js';

/**
 * Build a case-insensitive flexible regex for location matching.
 */
const flexRegex = (value, stripWord) => {
    if (!value) return null;
    const clean = value.replace(new RegExp(`\\b${stripWord}\\b`, 'ig'), '').trim();
    return new RegExp(`^${clean}`, 'i');
};

/**
 * Compute and return the aggregated DR Risk Score for a given woreda from its
 * constituent household profiles and woreda-level assessment (KII/CGD).
 *
 * @param {string} subcity
 * @param {string} woreda
 * @returns {Object} { hazard_index, exposure_index, vulnerability_index, capacity_index, overall_woreda_risk_score }
 */
export const computeWoredaRiskScore = async (subcity, woreda) => {
    const locationQuery = {};
    if (subcity) locationQuery['location.subcity'] = { $regex: flexRegex(subcity, 'subcity') };
    if (woreda) locationQuery['location.woreda'] = { $regex: flexRegex(woreda, 'woreda') };

    // 1. Fetch household profiles for this woreda
    const householdProfiles = await HouseholdProfile.find(locationQuery).lean();

    // 2. Fetch the woreda-level assessment (KII/CGD) for this woreda
    const woredaAssessment = await WoredaAssessment.findOne(locationQuery).lean();

    if (householdProfiles.length === 0 && !woredaAssessment) {
        return null;
    }

    // 3. Normalize household profiles to the aggregated schema for index calculations
    const normalizedProfiles = householdProfiles.map(hp =>
        AggregationService.normalizeHouseholdToAggregatedSchema(hp)
    );

    // 4. Compute individual indices
    const hazards = woredaAssessment?.hazards || [];
    const kiiInfra = woredaAssessment?.kii_infrastructure_exposure || {};
    const kiiEnv = woredaAssessment?.kii_environmental_indicators || {};
    const kiiCapacity = woredaAssessment?.kii_capacity_indicators || {};

    const h = AggregationService.calculateHazardIndex(hazards);
    const e = AggregationService.calculateExposureIndex(
        // Use aggregated housing indicators from normalized household data
        normalizedProfiles.reduce((acc, p) => {
            const hi = p.housing_indicators || {};
            acc.proximity_to_hazard_zones = (acc.proximity_to_hazard_zones || 0) + (hi.proximity_to_hazard_zones || 0);
            return acc;
        }, {}),
        kiiInfra
    );
    const v = AggregationService.calculateVulnerabilityIndex(normalizedProfiles, kiiEnv);
    const c = AggregationService.calculateCapacityIndex(kiiCapacity);
    const dr = AggregationService.computeRiskScore(h, e, v, c);

    return {
        hazard_index: Math.round(h * 10) / 10,
        exposure_index: Math.round(e * 10) / 10,
        vulnerability_index: Math.round(v * 10) / 10,
        capacity_index: Math.round(c * 10) / 10,
        overall_woreda_risk_score: dr,
        source_household_count: householdProfiles.length,
        has_woreda_assessment: !!woredaAssessment
    };
};

/**
 * Trigger scoped spatial aggregation for a given location branch.
 * Called automatically by the post-save Mongoose hooks on HouseholdProfile
 * and WoredaAssessment.
 *
 * This is a lightweight trigger that computes and logs the aggregated risk scores
 * for the affected branch. For on-demand full aggregation (e.g. dashboard queries),
 * the getWoredaProfiles endpoint performs the full multi-level rollup.
 *
 * @param {Object} location - { subcity, woreda, block }
 */
export const triggerScopedAggregation = async ({ subcity, woreda, block }) => {
    if (!woreda) {
        console.warn('[AggregationTrigger] Skipped: no woreda provided in location.');
        return;
    }

    try {
        const riskScore = await computeWoredaRiskScore(subcity, woreda);
        if (riskScore) {
            // Log the computed score for traceability. In a production system, this
            // could write to a cache, a materialized view, or emit an event.
            console.info(
                `[AggregationTrigger] Woreda "${woreda}" (${subcity || 'Unknown Subcity'}) recomputed:`,
                `DR=${riskScore.overall_woreda_risk_score},`,
                `H=${riskScore.hazard_index}, E=${riskScore.exposure_index},`,
                `V=${riskScore.vulnerability_index}, C=${riskScore.capacity_index}`,
                `| ${riskScore.source_household_count} HH profiles, KII=${riskScore.has_woreda_assessment}`
            );
        }
    } catch (err) {
        // Hooks must never throw to avoid disrupting the original save operation
        console.error(`[AggregationTrigger] Error for woreda "${woreda}":`, err.message);
    }
};
