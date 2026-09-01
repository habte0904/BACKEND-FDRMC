import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const cleanPhoneIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        // Unset phone field for any user where phone is empty string ""
        const result = await User.updateMany(
            { phone: "" },
            { $unset: { phone: 1 } }
        );
        console.log(`Updated ${result.modifiedCount} user records with empty phone string.`);

        process.exit(0);
    } catch (err) {
        console.error('Error cleaning phone indexes:', err);
        process.exit(1);
    }
};

cleanPhoneIndexes();
