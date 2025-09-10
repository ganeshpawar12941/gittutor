import TeacherEmail from '../models/TeacherEmail.js';
import User from '../models/User.js';
import crypto from 'crypto';
import sendEmail from '../utils/sendEmail.js';
import XLSX from 'xlsx';

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
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        let emails = [];
        const fileBuffer = req.file.buffer;
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();

        if (fileExtension === 'csv') {
            // Parse CSV file
            emails = fileBuffer
                .toString()
                .split('\n')
                .map(email => email.trim().toLowerCase())
                .filter(email => email.match(/^[^\s@]+@git\.edu$/i));
        } else if (['xls', 'xlsx'].includes(fileExtension)) {
            // Parse Excel file
            try {
                const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                
                // Assuming first column contains emails
                emails = data
                    .flat()
                    .map(email => email.toString().trim().toLowerCase())
                    .filter(email => email.match(/^[^\s@]+@git\.edu$/i));
            } catch (error) {
                console.error('Error parsing Excel file:', error);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Error parsing Excel file. Please ensure it is a valid Excel file.' 
                });
            }
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid file type. Only CSV and Excel files are allowed.' 
            });
        }

        // Create or update teacher emails
        const results = [];
        
        for (const email of emails) {
            try {
                // Check if email already exists
                const existing = await TeacherEmail.findOne({ email });
                if (existing) {
                    results.push({ email, status: 'exists' });
                    continue;
                }
                
                // Create new teacher email with verification code
                const teacherEmail = new TeacherEmail({
                    email,
                    addedBy: req.user.id
                });
                
                // Generate and set verification code
                teacherEmail.generateVerificationCode();
                
                // Save the document
                await teacherEmail.save();
                results.push({ email, status: 'added' });
            } catch (error) {
                console.error(`Error processing email ${email}:`, error);
                results.push({ 
                    email, 
                    status: 'error', 
                    error: error.message 
                });
            }
        }

        res.status(200).json({
            success: true,
            results,
            message: `Successfully processed ${emails.length} teacher emails`
        });
    } catch (error) {
        console.error('Error uploading teacher emails:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Request teacher verification code
// @route   POST /api/teachers/request-verification
// @access  Public
export const requestTeacherVerification = async (req, res) => {
    try {
        const { email } = req.body;

        // Check if email exists in teacher emails
        const teacherEmail = await TeacherEmail.findOne({ 
            email: email.toLowerCase()
        });

        if (!teacherEmail) {
            return res.status(400).json({
                success: false,
                message: 'This email is not authorized for teacher access. Please contact the administrator.'
            });
        }

        // Check if email is already verified and used
        if (teacherEmail.isUsed) {
            return res.status(400).json({
                success: false,
                message: 'This email has already been used for teacher registration.'
            });
        }

        // Generate and save verification code
        const verificationCode = teacherEmail.generateVerificationCode();
        await teacherEmail.save();

        // Log the verification code for debugging
        console.log(`Verification code for ${teacherEmail.email}: ${verificationCode}`);

        // Send verification email with code
        try {
            await sendEmail({
                email: teacherEmail.email,
                subject: 'Your Teacher Verification Code',
                message: `Your verification code is: ${verificationCode}\n\nThis code will expire in 24 hours.`
            });

            res.status(200).json({
                success: true,
                message: 'Verification code sent. Please check your email.'
            });
        } catch (error) {
            console.error('Error sending verification email:', error);
            res.status(500).json({
                success: false,
                message: 'Error sending verification code. Please try again.'
            });
        }
    } catch (error) {
        console.error('Error requesting teacher verification:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// @desc    Verify teacher with one-time code
// @route   POST /api/teachers/verify
// @access  Public
export const verifyTeacher = async (req, res) => {
    try {
        const { email, code } = req.body;

        // Find teacher email by email and code
        const teacherEmail = await TeacherEmail.findOne({
            email: email.toLowerCase(),
            verificationCode: code,
            verificationExpires: { $gt: Date.now() },
            isUsed: false
        });

        if (!teacherEmail) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        // Mark as verified but not used yet
        teacherEmail.isVerified = true;
        teacherEmail.verifiedAt = Date.now();
        teacherEmail.verificationCode = undefined;
        await teacherEmail.save();

        res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now complete your teacher registration.'
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
