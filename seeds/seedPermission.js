import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Permission from '../models/Permission.js';
import { execSync } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract model name from a model file
 * @param {string} filePath - Path to the model file
 * @returns {string|null} - Model name or null if not found
 */
const getModelNameFromFile = (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        // Look for mongoose.model('ModelName', ...) pattern
        const match = content.match(/mongoose\.model\(['"](\w+)['"]/);
        return match ? match[1] : null;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return null;
    }
};

/**
 * Get all model names from the models directory
 * @returns {Array<string>} - Array of model names
 */
const getAllModels = () => {
    const modelsDir = path.join(__dirname, '../models');
    const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.js'));

    const models = [];
    for (const file of modelFiles) {
        const modelName = getModelNameFromFile(path.join(modelsDir, file));
        if (modelName) {
            models.push(modelName);
        }
    }

    return models;
};

const runMigration = async () => {
    try {
        console.log('🔄 Starting Hierarchical RBAC Migration...\n');
        console.log('📡 Connecting to MongoDB...');

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Step 1: Auto-generate permissions from models
        console.log('📝 Step 1: Auto-generating permissions from models...');
        const models = getAllModels();
        // resources to seed
        const customResources = ['dashboard', 'livedashboard', 'report', 'analytics', 'audit_log', 'sitesurvey'];
        const allResources = [...new Set([...models.map(m => m.toLowerCase()), ...customResources])];

        const actions = ['create', 'view', 'update', 'delete', 'import', 'sync', 'submit', 'approve', 'reject', 'publish', 'archive', 'pin', 'react', 'comment', 'share', 'moderate'];
        let permissionsCreated = 0;
        let permissionsSkipped = 0;

        // Auto-generate permissions
        for (const resource of allResources) {
            for (const action of actions) {
                const permissionName = `${resource}_${action}`;

                // Check if permission already exists
                const existingPermission = await Permission.findOne({
                    resource,
                    action
                });

                if (!existingPermission) {
                    await Permission.create({
                        resource,
                        action,
                        name: permissionName
                    });
                    permissionsCreated++;
                    console.log(`   ✅ Created: ${permissionName}`);
                } else if (existingPermission.name !== permissionName) {
                    existingPermission.name = permissionName;
                    await existingPermission.save();
                    console.log(`   🔄 Updated name: ${permissionName}`);
                    permissionsCreated++; // Count as modification
                } else {
                    permissionsSkipped++;
                }
            }
        }

        console.log(`\n✅ Permissions Summary:`);
        console.log(`   📝 Created: ${permissionsCreated} new permissions`);
        console.log(`   ⏭️  Skipped: ${permissionsSkipped} existing permissions\n`);

        // Step 2: Update all users without accessLevel
        console.log('📝 Step 2: Updating users without access levels...');
        const result = await User.updateMany(
            { accessLevel: { $exists: false } },
            {
                $set: {
                    accessLevel: 'expert',
                    organizationType: 'branch',
                    delegatedAuthority: {
                        canManageTeams: false,
                        canManageDepartments: false,
                        canApproveReports: false
                    },
                    managedDepartments: [],
                    managedTeams: []
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} users with default access levels\n`);

        // Step 3: Check for super admin
        console.log('📝 Step 3: Checking for super admin...');
        const superAdmin = await User.findOne({ accessLevel: 'super_admin' });

        if (!superAdmin) {
            console.log('⚠️  No super admin found!');
            console.log('🚀 Running seedAdmin script to create super admin...\n');

            try {
                // Run seedAdmin script
                execSync('node seedAdmin.js', {
                    stdio: 'inherit',
                    cwd: process.cwd()
                });
            } catch (error) {
                console.log('\n⚠️  seedAdmin script completed (check output above)');
            }
        } else {
            console.log(`✅ Super admin exists: ${superAdmin.email} (${superAdmin.fullname})\n`);
        }

        // Step 3: Show statistics
        console.log('📊 Migration Statistics:');
        const stats = await User.aggregate([
            {
                $group: {
                    _id: '$accessLevel',
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        console.log('\n   Access Level Distribution:');
        stats.forEach(stat => {
            const emoji = stat._id === 'super_admin' ? '👑' :
                stat._id === 'manager' ? '💼' :
                    stat._id === 'directorate' ? '📊' :
                        stat._id === 'team_leader' ? '👥' : '👤';
            console.log(`   ${emoji} ${stat._id || 'undefined'}: ${stat.count} users`);
        });

        const orgTypeStats = await User.aggregate([
            {
                $group: {
                    _id: '$organizationType',
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log('\n   Organization Type Distribution:');
        orgTypeStats.forEach(stat => {
            const emoji = stat._id === 'head_office' ? '🏢' : '🏪';
            console.log(`   ${emoji} ${stat._id || 'undefined'}: ${stat.count} users`);
        });

        await mongoose.disconnect();
        console.log('\n✅ Migration completed successfully!');
        console.log('🎉 Your hierarchical RBAC system is ready to use!\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 Next Steps:');
        console.log('   1. Login with super admin credentials');
        console.log('   2. Navigate to /admin/teams or /admin/hierarchy');
        console.log('   3. Start creating teams and managing hierarchy');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
