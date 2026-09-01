import mongoose from 'mongoose';

const RoleSchema = new mongoose.Schema({
    name: { type: String, unique: true, required: true },
    type: { type: String }, // head_office | branch | subcity | woreda
    description: String
});

export default mongoose.model('Role', RoleSchema);
