import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import TeacherEmail from '../models/TeacherEmail.js';

// Generate token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

import { isValidTeacherSignupCode, removeTeacherSignupCode } from '../utils/teacherSignupCode.js';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password } = req.body;
        const isTeacherSignup = req.originalUrl.includes('/register/teacher');

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Check if email is allowed for teacher registration
        if (isTeacherSignup) {
            const teacherEmail = await TeacherEmail.findOne({ 
                email: email.toLowerCase(),
                isVerified: true
            });

            if (!teacherEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'This email is not authorized for teacher access. Please request teacher access first.'
                });
            }
        }

        // Create user
        user = new User({
            name,
            email,
            password,
            role: isTeacherSignup ? 'teacher' : 'student'
        });

        // Generate verification token
        const verificationToken = user.getEmailVerificationToken();
        await user.save({ validateBeforeSave: false });

        // Create verification URL
        const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;

        // Send verification email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Email Verification',
                message: `Please verify your email by clicking on the following link: ${verificationUrl}`
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful! Please check your email to verify your account.'
            });
        } catch (err) {
            user.emailVerificationToken = undefined;
            user.emailVerificationExpire = undefined;
            await user.save({ validateBeforeSave: false });

            return res.status(500).json({
                success: false,
                message: 'Email could not be sent'
            });
        }
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email and password'
            });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if password matches
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email before logging in'
            });
        }

        // Create token
        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No user found with that email'
            });
        }

        // Get reset token
        const resetToken = user.getResetPasswordToken();

        await user.save({ validateBeforeSave: false });

        // Create reset URL
        const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/resetpassword/${resetToken}`;

        // Send email
        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset Token',
                message: `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`
            });

            res.status(200).json({
                success: true,
                message: 'Email sent'
            });
        } catch (err) {
            console.error('Send email error:', err);
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;

            await user.save({ validateBeforeSave: false });

            return res.status(500).json({
                success: false,
                message: 'Email could not be sent'
            });
        }
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
export const resetPassword = async (req, res) => {
    try {
        // Get hashed token
        const resetPasswordToken = crypto
            .createHash('sha256')
            .update(req.params.resettoken)
            .digest('hex');

        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid token or token has expired'
            });
        }

        // Set new password
        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        // Create token
        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
