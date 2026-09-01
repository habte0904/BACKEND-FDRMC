import User from '../models/User.js';
import Verification from '../models/Verification.js';
import PasswordReset from '../models/PasswordReset.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export const registerUser = async ({ fullname, email, phone, password }) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ fullname, email, phone, passwordHash });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await Verification.create({
    userId: user._id,
    type: 'email',
    code,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000)
  });
  return user;
};

export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error('User not found');
  if (user.status !== 'active') throw new Error('Account is not active');
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid credentials');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  user.lastLogin = new Date();
  await user.save();
  return { token, user };
};

