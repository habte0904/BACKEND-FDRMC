import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import RolePermission from '../models/RolePermission.js';

dotenv.config();

const permissionsList = [
    // User
    { name: 'user_create', resource: 'User', action: 'create' },
    { name: 'user_view', resource: 'User', action: 'view' },
    { name: 'user_update', resource: 'User', action: 'update' },
    { name: 'user_delete', resource: 'User', action: 'delete' },

    // Team
    { name: 'team_create', resource: 'Team', action: 'create' },
    { name: 'team_view', resource: 'Team', action: 'view' },
    { name: 'team_update', resource: 'Team', action: 'update' },
    { name: 'team_delete', resource: 'Team', action: 'delete' },

    // Role
    { name: 'role_create', resource: 'Role', action: 'create' },
    { name: 'role_view', resource: 'Role', action: 'view' },
    { name: 'role_update', resource: 'Role', action: 'update' },
    { name: 'role_delete', resource: 'Role', action: 'delete' },

    // Site Survey
    { name: 'sitesurvey_create', resource: 'sitesurvey', action: 'create' },
    { name: 'sitesurvey_view', resource: 'sitesurvey', action: 'view' },
    { name: 'sitesurvey_update', resource: 'sitesurvey', action: 'update' },
    { name: 'sitesurvey_delete', resource: 'sitesurvey', action: 'delete' },
];

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB');

        // 1. Create Permissions
        console.log('\n--- Seeding Permissions ---');
        const permissionMap = {};

        for (const p of permissionsList) {
            const perm = await Permission.findOneAndUpdate(
                { name: p.name },
                p,
                { upsert: true, new: true }
            );
            permissionMap[p.name] = perm._id;
            console.log(`✓ Ensured Permission: ${p.name}`);
        }

        // 2. Create Roles
        console.log('\n--- Seeding Roles ---');
        const roles = [
            { name: 'Super Admin', description: 'Full Access' },
            { name: 'Branch Admin', description: 'Branch Level Admin' },
            { name: 'Manager', description: 'Manager Level' }
        ];

        for (const r of roles) {
            const role = await Role.findOneAndUpdate(
                { name: r.name },
                r,
                { upsert: true, new: true }
            );

            // Assign Permissions
            if (r.name === 'Super Admin') {
                // Assign ALL
                for (const permName in permissionMap) {
                    await RolePermission.findOneAndUpdate(
                        { roleId: role._id, permissionId: permissionMap[permName] },
                        {},
                        { upsert: true }
                    );
                }
                console.log(`✓ Assigned ALL permissions to ${r.name}`);
            } else if (r.name === 'Branch Admin') {
                // Assign User and Team permissions
                const branchPerms = ['user_create', 'user_view', 'user_update', 'team_create', 'team_view', 'team_update'];
                for (const permName of branchPerms) {
                    if (permissionMap[permName]) {
                        await RolePermission.findOneAndUpdate(
                            { roleId: role._id, permissionId: permissionMap[permName] },
                            {},
                            { upsert: true }
                        );
                    }
                }
                console.log(`✓ Assigned basic permissions to ${r.name}`);
            }
        }

        console.log('\n✓ Seeding Complete');
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

seed();
