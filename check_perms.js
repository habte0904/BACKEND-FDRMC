import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from './models/Permission.js';

dotenv.config();

const check = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const permissions = await Permission.find({}).limit(5);
    console.log(JSON.stringify(permissions, null, 2));
    await mongoose.disconnect();
};

check();
