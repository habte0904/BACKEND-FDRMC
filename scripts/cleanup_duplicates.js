
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'e:/DRM/PDRM/BACKEND/.env' });

async function checkDuplicates() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const pipeline = [
            {
                $group: {
                    _id: {
                        subcity: '$location.subcity',
                        woreda: '$location.woreda',
                        block: '$location.block',
                        house_no: '$location.house_no'
                    },
                    count: { $sum: 1 },
                    ids: { $push: '$_id' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ];

        const WoredaProfile = mongoose.model('WoredaProfile', new mongoose.Schema({
            location: {
                subcity: String,
                woreda: String,
                block: String,
                house_no: String
            }
        }));

        const duplicates = await WoredaProfile.aggregate(pipeline);
        console.log('Duplicates found:', JSON.stringify(duplicates, null, 2));

        if (duplicates.length > 0) {
            console.log('Cleaning up duplicates...');
            for (const dup of duplicates) {
                // Keep the first one, delete the rest
                const [keep, ...rest] = dup.ids;
                await WoredaProfile.deleteMany({ _id: { $in: rest } });
                console.log(`Kept ${keep}, removed ${rest.length} duplicates for location:`, dup._id);
            }
        } else {
            console.log('No duplicates found.');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkDuplicates();
