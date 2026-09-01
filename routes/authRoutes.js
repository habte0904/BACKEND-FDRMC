import express from 'express';
import { register, login, verifyAccount, forgotPassword, resetPassword, resendVerificationCode, setupAccount, googleAuth }
    from '../controllers/authController.js';
const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/verify', verifyAccount);
router.post('/resend', resendVerificationCode);
router.post('/forgot', forgotPassword);
router.post('/reset', resetPassword);
router.post('/setup-account', setupAccount);
export default router;