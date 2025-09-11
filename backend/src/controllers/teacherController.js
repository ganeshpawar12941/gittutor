import TeacherEmail from '../models/TeacherEmail.js';
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

        const processEmail = (input) => {
            try {
                // Skip empty lines
                if (!input || typeof input !== 'string' || input.trim() === '') return null;
                
                let email = input.trim().toLowerCase();
                
                // If it's just a username, add the default domain
                if (!email.includes('@') && email.length > 0) {
                    email = `${email}@git.edu`;
                }
                
                // Basic email format validation
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    console.log(`Invalid email format: ${email}`);
                    return null;
                }
                
                return email;
            } catch (error) {
                console.error(`Error processing email input: ${input}`, error);
                return null;
            }
        };

        if (fileExtension === 'csv') {
            // Parse CSV file
            emails = fileBuffer
                .toString()
                .split('\n')
                .map(processEmail)
                .filter(Boolean);
        } else if (['xls', 'xlsx'].includes(fileExtension)) {
            // Parse Excel file
            try {
                const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                
                // Process all non-empty cells in the sheet
                emails = data
                    .flat()
                    .map(cell => cell.toString())
                    .map(processEmail)
                    .filter(Boolean);
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
                const processedEmail = processEmail(email);
                if (!processedEmail) {
                    results.push({ email, status: 'error', error: 'Invalid email format' });
                    continue;
                }

                // Check if email already exists
                const existing = await TeacherEmail.findOne({ email: processedEmail });
                if (existing) {
                    results.push({ email: processedEmail, status: 'exists' });
                    continue;
                }
                
                // Create new teacher email
                const teacherEmail = new TeacherEmail({
                    email: processedEmail,
                    addedBy: req.user.id,
                    isVerified: true  // Mark as verified since admin is adding
                });
                
                await teacherEmail.save();
                results.push({ email: processedEmail, status: 'added' });
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


// @desc    Add a single teacher email
// @route   POST /api/teachers/emails
// @access  Private/Admin
export const addTeacherEmail = async (req, res) => {
    try {
        const { email } = req.body;

        // Validate email format
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
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
