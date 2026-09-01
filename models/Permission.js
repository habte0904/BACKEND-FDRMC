import mongoose from 'mongoose';

const PermissionSchema = new mongoose.Schema({
    resource: { type: String, required: true },
    action: { type: String, required: true },
    name: { type: String, required: true }
});

export default mongoose.model('Permission', PermissionSchema);