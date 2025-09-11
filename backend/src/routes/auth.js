import express from 'express';
import { check } from 'express-validator';
import { protect } from '../middleware/auth.js';
import {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
    verifyEmail
} from '../controllers/authController.js';

const router = express.Router();

// Public routes
// Student registration (default)
router.post(
    '/register',
    [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
    ],
    register
);

// Teacher registration (requires email verification)
router.post(
    '/register/teacher',
    [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
    ],
    register
);

// Admin registration (requires admin key in request body)
router.post(
    '/register/admin',
    [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 8 or more characters').isLength({ min: 8 }),
        check('adminKey', 'Admin key is required').not().isEmpty()
    ],
    register
);

router.post(
    '/login',
    [
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Password is required').exists()
    ],
    login
);

router.post(
    '/forgotpassword',
    [
        check('email', 'Please include a valid email').isEmail()
    ],
    forgotPassword
);

router.put(
    '/resetpassword/:resettoken',
    [
        check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
    ],
    resetPassword
);

// Email verification route (public)
router.get('/verify-email/:verificationToken', verifyEmail);

// Protected routes
router.use(protect);
router.get('/me', getMe);

export default router;
