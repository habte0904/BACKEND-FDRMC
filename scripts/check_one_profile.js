import mongoose from 'mongoose';
import dotenv from 'dotenv';
import WoredaProfile from '../models/WoredaProfile.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pdrm';

async function check() {
    try {
        await mongoose.connect(mongoUri);
        const profile = await WoredaProfile.findOne();
        if (profile) {
            console.log(JSON.stringify(profile, null, 2));
        } else {
            console.log("No profiles found");
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}
check();
