import express from 'express';
import multer from 'multer';
import { check } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import {
    uploadTeacherEmails,
    requestTeacherVerification,
    verifyTeacher,
    getTeacherEmails,
    addTeacherEmail
} from '../controllers/teacherController.js';

const router = express.Router();

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max file size
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        const allowedExtensions = ['.csv', '.xls', '.xlsx'];
        
        const isAllowedMimeType = allowedMimeTypes.includes(file.mimetype);
        const hasAllowedExtension = allowedExtensions.some(ext => 
            file.originalname.toLowerCase().endsWith(ext)
        );
        
        if (isAllowedMimeType || hasAllowedExtension) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'), false);
        }
    }
});

// Public routes for teacher verification
router.route('/request-verification')
    .post(
        [
            check('email', 'Please include a valid email').isEmail(),
            check('email', 'Teacher email must end with @git.edu').matches(/@git\.edu$/i)
        ],
        requestTeacherVerification
    );

router.route('/verify')
    .post(
        [
            check('email', 'Please include a valid email').isEmail(),
            check('code', 'Verification code is required').not().isEmpty()
        ],
        verifyTeacher
    );

// Admin routes
router.route('/emails')
    .get(protect, authorize('admin'), getTeacherEmails)
    .post(
        protect, 
        authorize('admin'),
        [
            check('email', 'Please include a valid email').isEmail(),
            check('email', 'Teacher email must end with @git.edu').matches(/@git\.edu$/i)
        ],
        addTeacherEmail
    );

router.route('/upload')
    .post(
        protect,
        authorize('admin'),
        upload.single('file'),
        uploadTeacherEmails
    );

export default router;
