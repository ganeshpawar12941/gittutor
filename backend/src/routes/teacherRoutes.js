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
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

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

// Public routes
router.route('/request-verification')
    .post(requestTeacherVerification);

router.route('/verify/:token')
    .get(verifyTeacher);

export default router;
