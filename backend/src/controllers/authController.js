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
            // Basic email format validation
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address.'
                });
            }

            // If it's a student registration, enforce students.git.edu domain
            if (!isTeacherSignup) {
                const emailParts = email.split('@');
                const emailDomain = emailParts[1].toLowerCase();
                const expectedDomain = 'students.git.edu';

                if (emailDomain !== expectedDomain) {
                    return res.status(400).json({
                        success: false,
                        message: `Student registration requires a @${expectedDomain} email address.`
                    });
                }
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

        // Check if teacher email is authorized
        if (isTeacherSignup) {
            const teacherEmail = await TeacherEmail.findOne({
                email: email.toLowerCase(),
                isUsed: false
            });

            if (!teacherEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'This email is not authorized for teacher access or has already been used.'
                });
            }
        }

        // Check if teacher email exists and is available
        let teacherEmailDoc = null;
        if (isTeacherSignup) {
            teacherEmailDoc = await TeacherEmail.findOne({
                email: email.toLowerCase(),
                isUsed: false
            });

            if (!teacherEmailDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Teacher email not found or already in use.'
                });
            }
        }

        // Create user with correct role
        const userRole = isAdminRegistration ? 'admin' : (isTeacherSignup ? 'teacher' : 'student');
        
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: userRole,
            isEmailVerified: isAdminRegistration || !isTeacherSignup, // Auto-verify admin and student accounts
            emailVerificationToken: isTeacherSignup ? crypto.randomBytes(32).toString('hex') : undefined,
            emailVerificationExpire: isTeacherSignup ? Date.now() + 10 * 60 * 1000 : undefined, // 10 minutes
            teacherEmailId: isTeacherSignup ? teacherEmailDoc._id : undefined // Store reference to teacher email
        });

        // Teacher requires email verification
        if (isTeacherSignup) {
            const verificationToken = user.getEmailVerificationToken();
            await user.save({ validateBeforeSave: false });

            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const verificationUrl = `${baseUrl}/api/auth/verify-email/${verificationToken}`;

            const emailMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4a6fdc;">Welcome to GitTutor!</h2>
                    <p>Thank you for registering as a teacher. Here's your verification token for Postman testing:</p>
                    
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
                        <p><strong>Verification Token:</strong></p>
                        <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${verificationToken}</p>
                        
                        <p><strong>Full Verification URL (for Postman):</strong></p>
                        <p style="word-break: break-all; background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">${verificationUrl}</p>
                        
                        <p><strong>To verify in Postman:</strong></p>
                        <ol>
                            <li>Open Postman</li>
                            <li>Create a new GET request</li>
                            <li>Enter the URL above</li>
                            <li>Send the request</li>
                        </ol>
                    </div>
                    
                    <p>This link will expire in 10 minutes.</p>
                    <p>If you didn't create an account, you can safely ignore this email.</p>
                    <p>Best regards,<br>The GitTutor Team</p>
                </div>
            `;

            try {
                await sendEmail({
                    email: user.email,
                    subject: 'Verify Your GitTutor Account',
                    message: emailMessage
                });

                return res.status(201).json({
                    success: true,
                    token: user.getSignedJwtToken(),
                    verificationToken: verificationToken, // Include token in response for testing
                    verificationUrl: verificationUrl,     // Include full URL in response for testing
                    message: 'Registration successful! Please check your email to verify your account.'
                });
            } catch (emailError) {
                console.error('Email sending failed:', emailError);
                // Still return success but include verification token in the response
                return res.status(201).json({
                    success: true,
                    token: user.getSignedJwtToken(),
                    verificationToken: verificationToken,
                    verificationUrl: verificationUrl,
                    message: 'Registration successful! However, we encountered an issue sending the verification email. Please use the verification token provided to verify your account.'
                });
            }
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
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if email is verified (for teachers)
        if (user.role === 'teacher' && !user.isEmailVerified) {
            // Generate a new verification token if needed
            const verificationToken = user.getEmailVerificationToken();
            await user.save({ validateBeforeSave: false });
            
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const verificationUrl = `${baseUrl}/api/auth/verify-email/${verificationToken}`;
            
            return res.status(401).json({
                success: false,
                message: 'Please verify your email before logging in',
                verificationUrl: verificationUrl
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
        console.log('Verification request received for token:', req.params.verificationToken);
        
        if (!req.params.verificationToken) {
            console.log('No verification token provided');
            return res.status(400).json({
                success: false,
                message: 'Verification token is required'
            });
        }

        // Get hashed token
        const verificationToken = crypto
            .createHash('sha256')
            .update(req.params.verificationToken)
            .digest('hex');

        console.log('Looking for user with token hash:', verificationToken);

        const user = await User.findOne({
            emailVerificationToken: verificationToken,
            emailVerificationExpire: { $gt: Date.now() }
        }).select('+emailVerificationToken +emailVerificationExpire');

        if (!user) {
            console.log('No user found with the provided token or token expired');
            // Check if token exists but is expired
            const expiredUser = await User.findOne({
                emailVerificationToken: verificationToken
            });

            if (expiredUser) {
                console.log('Token found but expired at:', expiredUser.emailVerificationExpire);
                return res.status(400).json({
                    success: false,
                    code: 'TOKEN_EXPIRED',
                    message: 'Verification token has expired. Please request a new verification email.'
                });
            }

            return res.status(400).json({
                success: false,
                code: 'INVALID_TOKEN',
                message: 'Invalid verification token'
            });
        }

        console.log(`Verifying email for user: ${user.email}`);

        // Update user verification status
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        
        try {
            // If this is a teacher, mark their email as used
            if (user.role === 'teacher' && user.teacherEmailId) {
                await TeacherEmail.findByIdAndUpdate(user.teacherEmailId, {
                    isUsed: true,
                    usedAt: new Date()
                });
                console.log(`Marked teacher email as used for user: ${user.email}`);
            }
            
            await user.save({ validateBeforeSave: false });
            console.log(`Email verified successfully for user: ${user.email}`);
            
        } catch (saveError) {
            console.error('Error during verification process:', saveError);
            throw new Error('Failed to complete verification process');
        }

        // Generate JWT token for automatic login
        const token = user.getSignedJwtToken();
        
        const userResponse = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified
        };

        return res.status(200).json({
            success: true,
            token,
            user: userResponse,
            message: 'Email verified successfully! You can now log in with your credentials.'
        });
    } catch (err) {
        console.error('Email verification error:', {
            error: err.message,
            stack: err.stack,
            token: req.params.verificationToken,
            timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
            success: false,
            code: 'SERVER_ERROR',
            message: 'An error occurred while verifying your email. Please try again later.'
        });
    }
};
