import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const migrateUsersAccessLevel = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected to MongoDB\n');

        // Update ALL users to ensure they have accessLevel and organizationType
        const result = await User.updateMany(
            {
                $or: [
                    { accessLevel: { $exists: false } },
                    { accessLevel: null },
                    { accessLevel: '' }
                ]
            },
            {
                $set: {
                    accessLevel: 'public'
                }
            }
        );

        console.log(`✓ Updated ${result.modifiedCount} users with missing accessLevel\n`);

        // Also ensure organizationType is set
        const orgTypeResult = await User.updateMany(
            {
                $or: [
                    { organizationType: { $exists: false } },
                    { organizationType: null },
                    { organizationType: '' }
                ]
            },
            {
                $set: {
                    organizationType: 'branch'
                }
            }
        );

        console.log(`✓ Updated ${orgTypeResult.modifiedCount} users with missing organizationType\n`);

        // Display summary
        const allUsers = await User.find({}).select('fullname email accessLevel organizationType');
        console.log('=== User Summary ===\n');

        const accessLevelCounts = {};
        allUsers.forEach(user => {
            const level = user.accessLevel || 'UNDEFINED';
            accessLevelCounts[level] = (accessLevelCounts[level] || 0) + 1;
        });

        console.log('Access Level Distribution:');
        Object.entries(accessLevelCounts).forEach(([level, count]) => {
            console.log(`  ${level}: ${count}`);
        });

        console.log(`\nTotal Users: ${allUsers.length}\n`);

        // List all users
        console.log('=== All Users ===\n');
        allUsers.forEach(user => {
            console.log(`${user.fullname} (${user.email})`);
            console.log(`  Access Level: ${user.accessLevel || 'UNDEFINED'}`);
            console.log(`  Org Type: ${user.organizationType || 'UNDEFINED'}`);
            console.log('');
        });

        await mongoose.disconnect();
        console.log('✓ Disconnected from MongoDB');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

migrateUsersAccessLevel();
