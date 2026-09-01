import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';

dotenv.config();

/**
 * Migration script to add granular dashboard card permissions
 * This script creates view permissions for each dashboard statistic card
 */
async function addDashboardCardPermissions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        // Define the permissions to create
        const permissionsToCreate = [
            { resource: 'organization', action: 'view', name: 'View Organizations' },
            { resource: 'sector', action: 'view', name: 'View Sectors' },
            { resource: 'department', action: 'view', name: 'View Departments' },
            { resource: 'user', action: 'view', name: 'View Users' },
            { resource: 'role', action: 'view', name: 'View Roles' }
        ];

        console.log('═══════════════════════════════════════════════════════');
        console.log('          Creating Dashboard Card Permissions          ');
        console.log('═══════════════════════════════════════════════════════\n');

        const createdPermissions = [];

        // Create permissions if they don't exist
        for (const permData of permissionsToCreate) {
            let permission = await Permission.findOne({
                resource: permData.resource,
                action: permData.action
            });

            if (!permission) {
                permission = await Permission.create(permData);
                console.log(`✓ Created: ${permData.name}`);
                createdPermissions.push(permission);
            } else {
                console.log(`- Already exists: ${permData.name}`);
                createdPermissions.push(permission);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('        Assigning Permissions to Roles                 ');
        console.log('═══════════════════════════════════════════════════════\n');

        // Get all roles
        const roles = await Role.find();
        console.log(`Found ${roles.length} roles\n`);

        let totalAssignments = 0;

        // Assign all permissions to all roles (you can customize this logic)
        for (const role of roles) {
            console.log(`\nProcessing role: ${role.name}`);
            let roleAssignments = 0;

            for (const permission of createdPermissions) {
                const existingAssignment = await RolePermission.findOne({
                    roleId: role._id,
                    permissionId: permission._id
                });

                if (!existingAssignment) {
                    await RolePermission.create({
                        roleId: role._id,
                        permissionId: permission._id
                    });
                    console.log(`  ✓ Assigned: ${permission.name}`);
                    roleAssignments++;
                    totalAssignments++;
                } else {
                    console.log(`  - Already has: ${permission.name}`);
                }
            }

            if (roleAssignments === 0) {
                console.log(`  ✓ Role already has all permissions`);
            }
        }

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('                    SUMMARY                            ');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`✓ Permissions created/verified: ${createdPermissions.length}`);
        console.log(`✓ New assignments made: ${totalAssignments}`);
        console.log(`✓ Total roles processed: ${roles.length}`);
        console.log('\n✅ Migration completed successfully!');
        console.log('\nDashboard cards will now be visible based on user permissions.');
        console.log('═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed\n');
    }
}

// Run the migration
addDashboardCardPermissions();
