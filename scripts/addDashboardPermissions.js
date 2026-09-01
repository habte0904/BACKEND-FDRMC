import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';

dotenv.config();

/**
 * Migration script to add dashboard permissions
 * This script creates the 'dashboard' resource permission and assigns it to all roles
 */
async function addDashboardPermissions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Create dashboard view permission
        let dashboardPermission = await Permission.findOne({
            resource: 'dashboard',
            action: 'view'
        });

        if (!dashboardPermission) {
            dashboardPermission = await Permission.create({
                resource: 'dashboard',
                action: 'view',
                name: 'View Dashboard'
            });
            console.log('✓ Created dashboard view permission');
        } else {
            console.log('✓ Dashboard view permission already exists');
        }

        // Get all roles
        const roles = await Role.find();
        console.log(`Found ${roles.length} roles`);

        // Assign dashboard permission to all roles
        let assignedCount = 0;
        for (const role of roles) {
            const existingAssignment = await RolePermission.findOne({
                roleId: role._id,
                permissionId: dashboardPermission._id
            });

            if (!existingAssignment) {
                await RolePermission.create({
                    roleId: role._id,
                    permissionId: dashboardPermission._id
                });
                console.log(`  ✓ Assigned dashboard permission to role: ${role.name}`);
                assignedCount++;
            } else {
                console.log(`  - Role "${role.name}" already has dashboard permission`);
            }
        }

        console.log(`\n✓ Migration completed successfully!`);
        console.log(`  - Dashboard permission created/verified`);
        console.log(`  - Assigned to ${assignedCount} new role(s)`);
        console.log(`  - Total roles with dashboard access: ${roles.length}`);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

// Run the migration
addDashboardPermissions();
