import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import TeacherEmail from '../models/TeacherEmail.js';
import ErrorResponse from '../utils/errorResponse.js';

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
    const isAdminRegistration = req.originalUrl.includes('/register/admin');
    const isTeacherSignup = req.originalUrl.includes('/register/teacher');

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, adminKey } = req.body;

        // Skip domain validation for admin
        if (!isAdminRegistration) {
            const emailParts = email.split('@');
            if (emailParts.length !== 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address.'
                });
            }

            const emailDomain = emailParts[1].toLowerCase();
            const expectedDomain = isTeacherSignup ? 'git.edu' : 'students.git.edu';

            if (emailDomain !== expectedDomain) {
                return res.status(400).json({
                    success: false,
                    message: `Registration requires a @${expectedDomain} email address.`
                });
            }
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Check if teacher email is verified
        let teacherEmail;
        if (isTeacherSignup) {
            teacherEmail = await TeacherEmail.findOne({
                email: email.toLowerCase(),
                isVerified: true,
                isUsed: false
            });

            if (!teacherEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'This email is not authorized for teacher access or has already been used.'
                });
            }
        }

        // Create user with correct role
        const userRole = isAdminRegistration ? 'admin' : (isTeacherSignup ? 'teacher' : 'student');
        
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: userRole
        });

        // Mark teacher email as used after successful user creation
        if (isTeacherSignup && teacherEmail) {
            teacherEmail.isUsed = true;
            await teacherEmail.save();
        }

        // Teacher requires email verification
        if (isTeacherSignup) {
            const verificationToken = user.getEmailVerificationToken();
            await user.save({ validateBeforeSave: false });

            const verificationUrl = `${req.protocol}://${req.get('host')}/api/auth/verify-email/${verificationToken}`;

            await sendEmail({
                email: user.email,
                subject: 'Email Verification',
                message: `Please verify your email by clicking on the following link: ${verificationUrl}`
            });

            return res.status(201).json({
                success: true,
                message: 'Registration successful! Please check your email to verify your account.'
            });
        } else {
            // Admins + Students don't need verification
            return res.status(201).json({
                success: true,
                message: 'Registration successful! You can now log in.'
            });
        }
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
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
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if email is verified (for teachers)
        if (user.role === 'teacher' && !user.isEmailVerified) {
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
                role: user.role,
                isEmailVerified: user.isEmailVerified
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
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
        console.error('Forgot password error:', err);
        
        if (user) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpire = undefined;
            await user.save({ validateBeforeSave: false });
        }

        res.status(500).json({
            success: false,
            message: 'Email could not be sent'
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
                message: 'Invalid or expired token'
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

// @desc    Verify email
// @route   GET /api/auth/verify-email/:verificationToken
// @access  Public
export const verifyEmail = async (req, res, next) => {
    try {
        // Get hashed token
        const verificationToken = crypto
            .createHash('sha256')
            .update(req.params.verificationToken)
            .digest('hex');

        const user = await User.findOne({
            emailVerificationToken: verificationToken,
            emailVerificationExpire: { $gt: Date.now() }
        });

        if (!user) {
            return next(new ErrorResponse('Invalid or expired verification token', 400));
        }

        // Update user
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save();

        // Create token for automatic login
        const token = user.getSignedJwtToken();

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isEmailVerified: user.isEmailVerified
            },
            message: 'Email verified successfully. You are now logged in.'
        });
    } catch (err) {
        console.error('Email verification error:', err);
        return next(new ErrorResponse('Email verification failed', 500));
    }
};

