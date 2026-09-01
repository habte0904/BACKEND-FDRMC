import mongoose from 'mongoose';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// We'll use Python to extract data to JSON, then Node to import
const EXCEL_PATH = 'C:/Users/Habtesh/Desktop/Woreda Profile.xlsx';
const JSON_OUTPUT = './woreda_data.json';

const pythonScript = `
import openpyxl
import json

wb = openpyxl.load_workbook(r'${EXCEL_PATH}', data_only=True)
data = {}

for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    if not rows: continue
    headers = [str(h).strip() if h else f"col_{i}" for i, h in enumerate(rows[0])]
    sheet_data = []
    for r in rows[1:]:
        if any(r):
            sheet_data.append(dict(zip(headers, r)))
    data[sheet_name.strip()] = sheet_data

with open('${JSON_OUTPUT}', 'w') as f:
    json.dump(data, f)
`;

try {
    console.log("Extracting data from Excel using Python...");
    fs.writeFileSync('./extract.py', pythonScript);
    execSync('python ./extract.py');

    const rawData = JSON.parse(fs.readFileSync(JSON_OUTPUT, 'utf8'));

    // Connect to DB
    dotenv.config();
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pdrm';
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    // Import models (we'll define inline to be safe or import if possible)
    // For a one-off, we can just use the collection directly or define the model
    const WoredaProfile = mongoose.model('WoredaProfile', new mongoose.Schema({}, { strict: false }));

    // The Excel has 1 record spread across sheets (id 1, 101)
    // Let's map it.
    console.log("Mapping data...");

    const admin = rawData['admin_location'][0];
    const comm = rawData['community'][0];
    const demo = rawData['demographics'][0];
    const livelihoods = rawData['livelihoods'];
    const services = rawData['Basic service'][0];
    const facilities = rawData['Critical_Facilities'];
    const vulnerable = rawData['vulnerable_groups'];
    const capacity = rawData['community_capacity'];

    const profile = {
        location: {
            region: admin['region'],
            zone: admin['zone'],
            woreda: admin['woreda'],
            kebele: admin['kebele'],
            got: admin['got']
        },
        assessment_date: comm['assessment_date'],
        remarks: comm['remarks'],
        demographics: {
            total_population: demo['total_population'],
            male_population: demo['male_population'],
            female_population: demo['female_population'],
            children_0_17: demo['children_0_17'],
            youth_18_29: demo['youth_18_29'],
            adults_30_59: demo['adults_30_59'],
            elderly_60_plus: demo['elderly_60_plus'],
            total_households: demo['total_households'],
            female_headed_households: parseInt(demo['Numberof_female_headed _households']) || 0,
            informal_settlement_population: 0, // Placeholder in Excel was "1 or %"
            low_income_households: demo['Low_income_households'],
            unemployment_rate: 0, // Placeholder in Excel was "%"
            internally_displaced_population: 0,
            education_levels: [
               { category: 'General', count: 0 }
            ]
        },
        livelihoods: livelihoods.map(l => ({
            livelihood_type: l['livelihood_type'],
            households: l['households'],
            percentage: l['percentage']
        })),
        basic_services: {
            water_source: services['water_source'],
            electricity: services['electricity'] === 'Yes',
            road_access: services['road_access'],
            drainage_system_coverage: services['drainage_system_coverage '] === 'yes',
            solid_waste_management_coverage: services['solid_waste_management_coverage'] === 'yes',
            telecommunications_access: services['Telecommunications_ access'] === 'yes',
            critical_lifeline_redundancy: services['critical_lifeline_redundancy'] === 'yes'
        },
        critical_facilities: facilities.map(f => ({
            facility_type: f['facility_type'],
            distance_to_nearest_emergency_service: 0,
            structural_safety: 'Fair',
            emergency_equipment_available: false
        })),
        vulnerable_groups: vulnerable.map(v => ({
            group_type: v['group_type'],
            number: v['number']
        })),
        community_capacity: capacity.map(c => ({
            capacity_type: c['capacity_type'],
            available: c['available'] === 'Yes',
            remarks: c['remarks']
        })),
        status: 'Submitted'
    };

    await WoredaProfile.create(profile);
    console.log("Import successful!");

} catch (err) {
    console.error("Import failed:", err);
} finally {
    mongoose.disconnect();
    if (fs.existsSync('./extract.py')) fs.unlinkSync('./extract.py');
    if (fs.existsSync('./woreda_data.json')) fs.unlinkSync('./woreda_data.json');
}
