import mongoose from 'mongoose';

const RolePermissionSchema = new mongoose.Schema({
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    permissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Permission', required: true }
});

export default mongoose.model('RolePermission', RolePermissionSchema);
