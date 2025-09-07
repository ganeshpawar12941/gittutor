const express = require('express');
const { check } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword
} = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post(
    '/register',
    [
        check('name', 'Name is required').not().isEmpty(),
        check('email', 'Please include a valid email').isEmail(),
        check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
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

// Protected routes
router.use(protect);

router.get('/me', getMe);

module.exports = router;
