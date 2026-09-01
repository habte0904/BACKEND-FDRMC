import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import RolePermission from '../models/RolePermission.js';

dotenv.config();

/**
 * Utility script to check permissions for a specific user
 * Usage: node scripts/checkUserPermissions.js <email>
 */
async function checkUserPermissions() {
    try {
        const userEmail = process.argv[2];

        if (!userEmail) {
            console.log('Usage: node scripts/checkUserPermissions.js <email>');
            console.log('Example: node scripts/checkUserPermissions.js user@example.com');
            process.exit(1);
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB\n');

        // Find user
        const user = await User.findOne({ email: userEmail })
            .populate('roles')
            .populate('organization')
            .populate('sector')
            .populate('department');

        if (!user) {
            console.log(`❌ User not found: ${userEmail}`);
            process.exit(1);
        }

        console.log('═══════════════════════════════════════════════════════');
        console.log('                    USER INFORMATION                    ');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Name:              ${user.fullname}`);
        console.log(`Email:             ${user.email}`);
        console.log(`Status:            ${user.status}`);
        console.log(`Access Level:      ${user.accessLevel}`);
        console.log(`Organization Type: ${user.organizationType}`);
        console.log(`Organization:      ${user.organization?.name || 'N/A'}`);
        console.log(`Sector:            ${user.sector?.name || 'N/A'}`);
        console.log(`Department:        ${user.department?.name || 'N/A'}`);
        console.log('');

        // Display roles
        console.log('═══════════════════════════════════════════════════════');
        console.log('                       ROLES                            ');
        console.log('═══════════════════════════════════════════════════════');
        if (user.roles && user.roles.length > 0) {
            user.roles.forEach((role, index) => {
                console.log(`${index + 1}. ${role.name} (${role.type || 'N/A'})`);
            });
        } else {
            console.log('❌ No roles assigned');
        }
        console.log('');

        // Get permissions
        console.log('═══════════════════════════════════════════════════════');
        console.log('                    PERMISSIONS                         ');
        console.log('═══════════════════════════════════════════════════════');

        if (user.accessLevel === 'super_admin') {
            console.log('✅ SUPER ADMIN - Has ALL permissions');
        } else if (user.roles && user.roles.length > 0) {
            const roleIds = user.roles.map(r => r._id);
            const rolePermissions = await RolePermission.find({
                roleId: { $in: roleIds }
            }).populate('permissionId');

            if (rolePermissions.length > 0) {
                // Group permissions by resource
                const permissionsByResource = {};
                rolePermissions.forEach(rp => {
                    const perm = rp.permissionId;
                    if (!permissionsByResource[perm.resource]) {
                        permissionsByResource[perm.resource] = [];
                    }
                    permissionsByResource[perm.resource].push(perm.action);
                });

                // Display grouped permissions
                Object.keys(permissionsByResource).sort().forEach(resource => {
                    const actions = [...new Set(permissionsByResource[resource])].sort();
                    console.log(`\n📋 ${resource.toUpperCase()}`);
                    actions.forEach(action => {
                        console.log(`   ✓ ${action}`);
                    });
                });

                console.log(`\n\nTotal Permissions: ${rolePermissions.length}`);
            } else {
                console.log('❌ No permissions assigned to user\'s roles');
            }
        } else {
            console.log('❌ Cannot determine permissions - no roles assigned');
        }

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('                  DASHBOARD ACCESS                      ');
        console.log('═══════════════════════════════════════════════════════');

        // Check dashboard permission specifically
        if (user.accessLevel === 'super_admin') {
            console.log('✅ Can access dashboard (Super Admin)');
        } else if (user.roles && user.roles.length > 0) {
            const dashboardPerm = await Permission.findOne({
                resource: 'dashboard',
                action: 'view'
            });

            if (dashboardPerm) {
                const roleIds = user.roles.map(r => r._id);
                const hasDashboardAccess = await RolePermission.findOne({
                    roleId: { $in: roleIds },
                    permissionId: dashboardPerm._id
                });

                if (hasDashboardAccess) {
                    console.log('✅ Can access dashboard');
                    console.log('\nDashboard Scope:');
                    console.log(`  - Will see data for: ${user.organization?.name || 'N/A'}`);
                    if (user.sector) {
                        console.log(`  - Filtered by sector: ${user.sector.name}`);
                    }
                    if (user.department && ['expert', 'team_leader'].includes(user.accessLevel)) {
                        console.log(`  - Limited to department: ${user.department.name}`);
                    }
                } else {
                    console.log('❌ Cannot access dashboard - permission not assigned');
                    console.log('\nTo fix: Assign "View Dashboard" permission to user\'s role');
                }
            } else {
                console.log('❌ Dashboard permission not found in system');
                console.log('\nTo fix: Run migration script: node scripts/addDashboardPermissions.js');
            }
        } else {
            console.log('❌ Cannot access dashboard - no roles assigned');
        }

        console.log('\n═══════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

// Run the script
checkUserPermissions();
