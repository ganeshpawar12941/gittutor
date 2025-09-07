import TeacherEmail from '../models/TeacherEmail.js';
import User from '../models/User.js';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';

// @desc    Upload teacher emails
// @route   POST /api/teachers/upload
// @access  Private/Admin
export const uploadTeacherEmails = async (req, res) => {
    try {
        // Ensure user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to perform this action. Admin access required.'
            });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
        }

        // Parse CSV file
        const emails = req.file.buffer
            .toString()
            .split('\n')
            .map(email => email.trim().toLowerCase())
            .filter(email => email.match(/^[^\s@]+@git\.edu$/i));

        // Create or update teacher emails
        const results = await Promise.all(
            emails.map(async (email) => {
                try {
                    const existing = await TeacherEmail.findOne({ email });
                    if (existing) return { email, status: 'exists' };
                    
                    const verificationToken = crypto.randomBytes(20).toString('hex');
                    await TeacherEmail.create({
                        email,
                        verificationToken,
                        verificationExpire: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
                        addedBy: req.user.id
                    });
                    return { email, status: 'added' };
                } catch (error) {
                    return { email, status: 'error', error: error.message };
                }
            })
        );

        res.status(200).json({
            success: true,
            results,
            message: 'Teacher emails processed successfully'
        });
    } catch (error) {
        console.error('Error uploading teacher emails:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Request teacher verification
// @route   POST /api/teachers/request-verification
// @access  Public
export const requestTeacherVerification = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email exists in teacher emails
        const teacherEmail = await TeacherEmail.findOne({ 
            email: email.toLowerCase(),
            isVerified: false
        });

        if (!teacherEmail) {
            return res.status(400).json({
                success: false,
                message: 'This email is not authorized for teacher access'
            });
        }

        // Generate verification token
        const verificationToken = crypto.randomBytes(20).toString('hex');
        teacherEmail.verificationToken = verificationToken;
        teacherEmail.verificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await teacherEmail.save();

        // Send verification email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-teacher?token=${verificationToken}`;
        
        try {
            await sendEmail({
                email: teacherEmail.email,
                subject: 'Verify Your Teacher Account',
                message: `Please click the following link to verify your teacher account: ${verificationUrl}`
            });

            res.status(200).json({
                success: true,
                message: 'Verification email sent. Please check your email.'
            });
        } catch (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({
                success: false,
                message: 'Error sending verification email'
            });
        }
    } catch (error) {
        console.error('Error requesting teacher verification:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Verify teacher email
// @route   GET /api/teachers/verify/:token
// @access  Public
export const verifyTeacher = async (req, res) => {
    try {
        const { token } = req.params;

        // Find teacher email by token
        const teacherEmail = await TeacherEmail.findOne({
            verificationToken: token,
            verificationExpire: { $gt: Date.now() }
        });

        if (!teacherEmail) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        // Update teacher email as verified
        teacherEmail.isVerified = true;
        teacherEmail.verifiedAt = Date.now();
        teacherEmail.verificationToken = undefined;
        teacherEmail.verificationExpire = undefined;
        await teacherEmail.save();

        // Update user role if exists
        await User.findOneAndUpdate(
            { email: teacherEmail.email },
            { $set: { role: 'teacher' } },
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now log in as a teacher.'
        });
    } catch (error) {
        console.error('Error verifying teacher email:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Add a single teacher email
// @route   POST /api/teachers/emails
// @access  Private/Admin
export const addTeacherEmail = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email format
        if (!email || !email.match(/^[^\s@]+@git\.edu$/i)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid teacher email ending with @git.edu'
            });
        }

        // Check if email already exists
        const existingEmail = await TeacherEmail.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            return res.status(400).json({
                success: false,
                message: 'This email is already in the system'
            });
        }

        // Create new teacher email
        const teacherEmail = await TeacherEmail.create({
            email: email.toLowerCase(),
            isVerified: false,
            addedBy: req.user.id
        });

        res.status(201).json({
            success: true,
            data: teacherEmail
        });
    } catch (error) {
        console.error('Error adding teacher email:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Get all teacher emails
// @route   GET /api/teachers/emails
// @access  Private/Admin
export const getTeacherEmails = async (req, res) => {
    try {
        // Ensure user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this resource. Admin access required.'
            });
        }

        const teacherEmails = await TeacherEmail.find()
            .sort({ createdAt: -1 })
            .populate('addedBy', 'name email');

        res.status(200).json({
            success: true,
            count: teacherEmails.length,
            data: teacherEmails
        });
    } catch (error) {
        console.error('Error getting teacher emails:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
