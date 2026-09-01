import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const updateUsersAccessLevel = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Update all users without accessLevel to have 'public' as default
        const result = await User.updateMany(
            { accessLevel: { $exists: false } },
            { $set: { accessLevel: 'public' } }
        );

        console.log(`Updated ${result.modifiedCount} users with default accessLevel 'public'`);

        // Also update users with null or empty accessLevel
        const result2 = await User.updateMany(
            { $or: [{ accessLevel: null }, { accessLevel: '' }] },
            { $set: { accessLevel: 'public' } }
        );

        console.log(`Updated ${result2.modifiedCount} users with null/empty accessLevel to 'public'`);

        // Display all users with their access levels
        const users = await User.find({}, 'fullname email accessLevel');
        console.log('\nAll users:');
        users.forEach(user => {
            console.log(`- ${user.fullname} (${user.email}): ${user.accessLevel}`);
        });

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

updateUsersAccessLevel();
