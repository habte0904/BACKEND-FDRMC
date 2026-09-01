import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { normalizeHouseholdToAggregatedSchema } from './services/SpatialAggregationService.js';
dotenv.config();

try {
    await mongoose.connect(process.env.MONGO_URI);
    const col = mongoose.connection.db.collection('woredaprofiles');
    
    const all = await col.find({
        'location.house_no': { $exists: true, $ne: '', $nin: ['Aggregated Data'] }
    }).toArray();
    
    console.log('Total household profiles:', all.length);
    
    let totalPopSum = 0;
    let totalHHSum = 0;
    
    for (const p of all) {
        const normalized = normalizeHouseholdToAggregatedSchema(p);
        const demo = normalized.demographics;
        console.log(`\n--- ${normalized.location.subcity}/${normalized.location.woreda}/Block-${normalized.location.block}/House-${normalized.location.house_no} ---`);
        console.log(`  normalized total_population: ${demo?.total_population}`);
        console.log(`  normalized male_population: ${demo?.male_population}`);
        console.log(`  normalized female_population: ${demo?.female_population}`);
        console.log(`  normalized total_households: ${demo?.total_households}`);
        console.log(`  normalized children_0_17: ${demo?.children_0_17}`);
        console.log(`  had household_profile: ${!!normalized.household_profile}`);
        
        totalPopSum += (demo?.total_population || 0);
        totalHHSum += (demo?.total_households || 0);
    }
    
    console.log('\n=== TOTALS ===');
    console.log('Sum total_population:', totalPopSum);
    console.log('Sum total_households:', totalHHSum);
    
    process.exit(0);
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
