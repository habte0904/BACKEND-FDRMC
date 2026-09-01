import User from '../models/User.js';
import bcrypt from 'bcryptjs';

export const createUser = async (data) => {
  // If phone is empty string or whitespace, remove it so sparse index doesn't conflict
  if (!data.phone || (typeof data.phone === 'string' && data.phone.trim() === '')) {
    delete data.phone;
  } else if (typeof data.phone === 'string') {
    data.phone = data.phone.trim();
  }

  // Hash password if provided
  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    data.passwordHash = await bcrypt.hash(data.password, salt);
    delete data.password; // Remove plain text password
  }

  // Handle profile image
  if (data.profileImage && data.profileImage.path) {
    data.profileImage = data.profileImage.path.replace(/\\/g, '/'); // Normalize path
  }

  return await User.create(data);
};

export const getAllUsers = async (filter = {}) => {
  return await User.find(filter)
    .populate('roles')
    .populate('organization')
    .populate('sector')
    .populate('department')
    .populate('team');
};

export const getUserById = async (id) => {
  return await User.findById(id)
    .populate('roles')
    .populate('organization')
    .populate('sector')
    .populate('department')
    .populate('team');
};

export const updateUserById = async (id, data) => {
  // If password is being updated, hash it
  if (data.password) {
    const salt = await bcrypt.genSalt(10);
    data.passwordHash = await bcrypt.hash(data.password, salt);
    delete data.password;
  }

  // Handle profile image
  if (data.profileImage && data.profileImage.path) {
    data.profileImage = data.profileImage.path.replace(/\\/g, '/'); // Normalize path
  }

  return await User.findByIdAndUpdate(id, data, { new: true })
    .populate('roles')
    .populate('organization')
    .populate('sector')
    .populate('department')
    .populate('team');
};

import RolePermission from '../models/RolePermission.js';

export const deleteUserById = async (id) => {
  return await User.findByIdAndDelete(id);
};

export const getUserPermissions = async (user) => {
  if (!user || !user.roles || user.roles.length === 0) return [];

  const roleIds = user.roles.map(r => r._id);
  const rolePermissions = await RolePermission.find({ roleId: { $in: roleIds } })
    .populate('permissionId');

  return [...new Set(rolePermissions.map(rp => rp.permissionId.name))];
};
