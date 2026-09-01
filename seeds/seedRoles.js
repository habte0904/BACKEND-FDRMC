import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import RolePermission from '../models/RolePermission.js';

dotenv.config();

const roles = [
    {
        name: 'Branch Admin',
        type: 'branch',
        description: 'Branch level administrator with template management and user tracking capabilities.',
        permissions: [
            { resource: 'template', actions: ['view', 'create', 'update', 'import'] },
            { resource: 'formresponse', actions: ['view', 'create', 'update', 'delete'] },
            { resource: 'woredaprofile', actions: ['view', 'create', 'update', 'sync'] },
            { resource: 'user', actions: ['view'] },
            { resource: 'dashboard', actions: ['view'] }
        ]
    },
    {
        name: 'Expert',
        type: 'branch',
        description: 'Field expert responsible for data collection and synchronization.',
        permissions: [
            { resource: 'template', actions: ['view'] },
            { resource: 'formresponse', actions: ['view', 'create', 'update'] },
            { resource: 'woredaprofile', actions: ['view', 'sync'] },
            { resource: 'dashboard', actions: ['view'] }
        ]
    },
    {
        name: 'Enumerator',
        type: 'branch',
        description: 'Field staff focused strictly on data collection.',
        permissions: [
            { resource: 'template', actions: ['view'] },
            { resource: 'formresponse', actions: ['create', 'view'] },
            { resource: 'dashboard', actions: ['view'] }
        ]
    }
];

const seedRoles = async () => {
    try {
        console.log('🔄 Seeding functional roles and permissions...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        for (const roleDef of roles) {
            console.log(`\n🎭 Setting up role: ${roleDef.name}...`);
            
            // 1. Ensure Role exists
            let role = await Role.findOne({ name: roleDef.name });
            if (!role) {
                role = await Role.create({
                    name: roleDef.name,
                    type: roleDef.type,
                    description: roleDef.description
                });
                console.log(`   ✅ Created role: ${roleDef.name}`);
            } else {
                console.log(`   ℹ️  Role ${roleDef.name} already exists`);
            }

            // 2. Assign Permissions
            for (const permDef of roleDef.permissions) {
                for (const action of permDef.actions) {
                    const permission = await Permission.findOne({ 
                        resource: permDef.resource, 
                        action: action 
                    });

                    if (permission) {
                        const existingRP = await RolePermission.findOne({
                            roleId: role._id,
                            permissionId: permission._id
                        });

                        if (!existingRP) {
                            await RolePermission.create({
                                roleId: role._id,
                                permissionId: permission._id
                            });
                            console.log(`   ✅ Assigned: ${permDef.resource}_${action}`);
                        }
                    } else {
                        console.warn(`   ⚠️  Permission not found: ${permDef.resource}_${action}`);
                    }
                }
            }
        }

        console.log('\n✅ Role seeding completed successfully!');
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error seeding roles:', error);
        process.exit(1);
    }
};

seedRoles();
