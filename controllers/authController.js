import User from '../models/User.js';
import Verification from '../models/Verification.js';
import PasswordReset from '../models/PasswordReset.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import * as userService from '../services/userService.js';
import * as emailService from '../services/emailService.js';
import * as auditService from '../services/auditService.js';
import { validateRegister, validateLogin, transformRegisterInput, transformLoginInput } from '../dto/authDTO.js';
import { formatUserResponse } from '../dto/userDTO.js';

dotenv.config();

// Register user
export const register = async (req, res) => {
    try {
        // Transform and validate input
        const transformed = transformRegisterInput(req.body);
        const validation = validateRegister(transformed);
        if (!validation.isValid) return res.status(400).json({ errors: validation.errors });

        // Check if user already exists
        const existingUser = await User.findOne({ email: transformed.email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        // Use DEFAULT_PASSWORD from environment if not explicitly provided
        const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
        const passwordToUse = transformed.password || defaultPassword;

        // Set default access level for public registration
        const userData = {
            ...transformed,
            password: passwordToUse,
            accessLevel: 'public' // Default access level for self-registered users
        };

        // userService.createUser handles password hashing
        const user = await userService.createUser(userData);

        // create Verification code and save to verification collection
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await Verification.create({
            userId: user._id,
            type: 'email',
            code,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        });

        // Send Verification Email
        await emailService.sendVerificationEmail(user.email, code);

        await auditService.logAction({
            userId: user._id,
            action: 'USER_REGISTER',
            resource: 'User',
            ip: req.ip,
            after: { email: user.email, fullname: user.fullname }
        });

        res.status(201).json({ message: 'User registered. Verification email sent.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Login user
export const login = async (req, res) => {
    try {
        const transformed = transformLoginInput(req.body);
        const validation = validateLogin(transformed);
        if (!validation.isValid) return res.status(400).json({ errors: validation.errors });

        // Need passwordHash to compare, userService.getUserById might not be enough if I need to explicitly checking password
        // But simpler to just use User model for finding with password here as this is specific auth logic
        const user = await User.findOne({ email: transformed.email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const valid = await bcrypt.compare(transformed.password, user.passwordHash);
        if (!valid) return res.status(400).json({ message: 'Invalid credentials' });

        // Enforce Email Verification Check
        if (user.status !== 'active') { // Assuming 'active' means verified
            return res.status(403).json({ message: 'Account not verified. Please verify your email first.' });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });

        user.lastLogin = new Date();
        await user.save();

        // Populate user for response using userService or standard find
        const fullUser = await userService.getUserById(user._id);
        const permissions = await userService.getUserPermissions(fullUser);

        await auditService.logAction({
            userId: user._id,
            action: 'USER_LOGIN',
            resource: 'Auth',
            ip: req.ip
        });

        res.json({ token, user: formatUserResponse(fullUser, permissions) });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Verify account
export const verifyAccount = async (req, res) => {
    try {
        const { email, code } = req.body;

        // Find user first to get ID
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const verification = await Verification.findOne({ userId: user._id, code });
        if (!verification) return res.status(400).json({ message: 'Invalid code' });

        if (verification.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Code expired' });
        }

        verification.verifiedAt = new Date();
        await verification.save();

        user.status = 'active';

        // Update onboarding status
        if (!user.onboarding) user.onboarding = {};
        user.onboarding.welcomeShown = true;

        await user.save();

        // Send Welcome Email with default password
        const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
        await emailService.sendWelcomeEmail(user.email, user.fullname, defaultPassword);

        await auditService.logAction({
            userId: user._id,
            action: 'USER_VERIFY',
            resource: 'User',
            ip: req.ip
        });

        res.json({ message: 'Account verified successfully. Welcome email with your login password has been sent.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Google OAuth Login / Register
export const googleAuth = async (req, res) => {
    try {
        const { credential, email, fullname, profileImage } = req.body;

        let userEmail = email;
        let userName = fullname;
        let userPicture = profileImage;

        // If a Google JWT credential (id_token) is supplied, decode or verify it
        if (credential) {
            try {
                // Decode Google JWT payload safely
                const parts = credential.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
                    if (payload && payload.email) {
                        userEmail = payload.email;
                        userName = payload.name || userName;
                        userPicture = payload.picture || userPicture;
                    }
                }
            } catch (err) {
                console.error("Error decoding Google credential:", err);
            }
        }

        if (!userEmail) {
            return res.status(400).json({ message: 'Valid Google email is required' });
        }

        userEmail = userEmail.trim().toLowerCase();

        // Check if user exists
        let user = await User.findOne({ email: userEmail });

        if (!user) {
            // Register new Google user as pending (requiring email verification)
            const defaultPassword = process.env.DEFAULT_PASSWORD || '123456';
            const userData = {
                fullname: userName || userEmail.split('@')[0],
                email: userEmail,
                profileImage: userPicture || undefined,
                password: defaultPassword,
                status: 'pending',
                accessLevel: 'public',
                onboarding: {
                    welcomeShown: true,
                    profileCompleted: true
                }
            };

            user = await userService.createUser(userData);

            // Generate 6-digit verification code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await Verification.create({
                userId: user._id,
                type: 'email',
                code,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            });

            // Send Verification Email
            await emailService.sendVerificationEmail(user.email, code);

            await auditService.logAction({
                userId: user._id,
                action: 'USER_GOOGLE_REGISTER_PENDING',
                resource: 'User',
                ip: req.ip,
                after: { email: user.email, fullname: user.fullname }
            });

            return res.status(200).json({
                requiresVerification: true,
                email: user.email,
                message: 'Account created. Verification code sent to your email.'
            });
        }

        // If user existed but is not active, send verification code
        if (user.status !== 'active') {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            await Verification.findOneAndUpdate(
                { userId: user._id, type: 'email' },
                {
                    code,
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                    $inc: { attempts: 1 }
                },
                { upsert: true, new: true }
            );

            await emailService.sendVerificationEmail(user.email, code);

            return res.status(200).json({
                requiresVerification: true,
                email: user.email,
                message: 'Account not verified. A verification code has been sent to your email.'
            });
        }

        // User is active, log in
        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });

        const fullUser = await userService.getUserById(user._id);
        const permissions = await userService.getUserPermissions(fullUser);

        await auditService.logAction({
            userId: user._id,
            action: 'USER_GOOGLE_LOGIN',
            resource: 'Auth',
            ip: req.ip
        });

        res.json({ token, user: formatUserResponse(fullUser, permissions) });
    } catch (error) {
        console.error("Google Auth error:", error);
        res.status(500).json({ message: error.message || 'Google authentication failed' });
    }
};

// Resend Verification Code
export const resendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.status === 'active') {
            return res.status(400).json({ message: 'Account already verified' });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Update existing verification or create new
        await Verification.findOneAndUpdate(
            { userId: user._id, type: 'email' },
            {
                code,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                $inc: { attempts: 1 }
            },
            { upsert: true, new: true }
        );

        await emailService.sendVerificationEmail(user.email, code);

        res.json({ message: 'Verification code resent' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });
        const resetToken = Math.random().toString(36).substr(2);

        await PasswordReset.create({
            userId: user._id,
            resetToken,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
        const resetURL = `${clientUrl}/reset-password?token=${resetToken}`;

        await emailService.sendPasswordResetEmail(user.email, resetURL);

        await auditService.logAction({
            userId: user._id,
            action: 'PASSWORD_RESET_REQUEST',
            resource: 'User',
            ip: req.ip
        });

        res.json({ message: 'Password reset link sent' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Reset Password
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const reset = await PasswordReset.findOne({ resetToken: token });

        if (!reset || reset.expiresAt < new Date()) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        const user = await User.findById(reset.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Mark token as used (optional, or just delete it)
        // reset.usedAt = new Date(); // If schema supports it
        // await reset.save();
        // Or delete it to prevent reuse
        await PasswordReset.deleteOne({ _id: reset._id });

        await emailService.sendResetSuccessEmail(user.email);

        await auditService.logAction({
            userId: user._id,
            action: 'PASSWORD_RESET_SUCCESS',
            resource: 'User',
            ip: req.ip
        });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Setup Account (Verify & Set Password)
export const setupAccount = async (req, res) => {
    try {
        const { token, password } = req.body;

        // Find user by verificationCode (which we are using as the token for setup)
        const user = await User.findOne({ verificationCode: token });
        if (!user) return res.status(404).json({ message: 'Invalid or expired setup token' });

        if (user.verificationExpires < new Date()) {
            return res.status(400).json({ message: 'Setup link expired' });
        }

        user.passwordHash = await bcrypt.hash(password, 10);
        user.status = 'active';
        user.verificationCode = undefined;
        user.verificationExpires = undefined;

        // Update onboarding status
        if (!user.onboarding) user.onboarding = {};
        user.onboarding.welcomeShown = true;
        user.onboarding.profileCompleted = true; // Assuming password set means completed for now

        await user.save();

        await emailService.sendWelcomeEmail(user.email, user.fullname);

        await auditService.logAction({
            userId: user._id,
            action: 'ACCOUNT_SETUP_SUCCESS',
            resource: 'User',
            ip: req.ip
        });

        res.json({ message: 'Account set up successfully. You can now login.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
