import express from 'express';
import { protect, authorize } from '../middleware/index.js';
import { enrollInCourse, checkEnrollment } from '../controllers/enrollmentController.js';

const router = express.Router();

// Protect all routes with authentication
router.use(protect);

// Enroll in a course (Student only)
router.post(
    '/',
    authorize('student'),
    enrollInCourse
);

// Check enrollment status (for frontend)
router.get(
    '/check/:courseId',
    checkEnrollment,
    (req, res) => {
        res.status(200).json({
            success: true,
            isEnrolled: true
        });
    }
);

export default router;
