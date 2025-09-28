import express from 'express';
import { check } from 'express-validator';
import { protect, authorize } from '../middleware/auth/index.js';
import { validateRequest } from '../middleware/validation/validateRequest.js';
import { uploadVideo } from '../middleware/upload/videoUpload.js';
import {
    getCourses,
    getCourse,
    createCourse,
    updateCourse,
    deleteCourse,
    enrollInCourse,
    getCourseStudents
} from '../controllers/courseController.js';

const router = express.Router();

// Public routes
router.get('/', getCourses);
router.get('/:id', getCourse);

// Protected routes
router.use(protect);

// Teacher and admin routes
router.post(
    '/',
    authorize('admin'),
    uploadVideo, // Handle file upload
    [
        check('title', 'Title is required').not().isEmpty(),
        check('code', 'Course code is required').not().isEmpty(),
        check('description', 'Description is required').not().isEmpty(),
        check('thumbnail', 'Please upload a valid image file').optional()
    ],
    validateRequest, // Validate the request after file upload
    createCourse
);

router
    .route('/:id')
    .put(
        authorize('admin'),
        uploadVideo, // Handle file upload
        [
            check('title', 'Title is required').not().isEmpty(),
            check('code', 'Course code is required').not().isEmpty(),
            check('description', 'Description is required').not().isEmpty(),
            check('thumbnail', 'Please upload a valid image file').optional()
        ],
        validateRequest, // Validate the request after file upload
        updateCourse
    )
    .delete(authorize('admin'), deleteCourse);

// Student routes
router.post('/:id/enroll', authorize('student'), enrollInCourse);

// Teacher and admin routes
router.get('/:id/students', authorize('teacher', 'admin'), getCourseStudents);

export default router;
