import express from 'express';
import { check } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
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
    authorize('teacher', 'admin'),
    [
        check('title', 'Title is required').not().isEmpty(),
        check('code', 'Course code is required').not().isEmpty(),
        check('description', 'Description is required').not().isEmpty()
    ],
    createCourse
);

router
    .route('/:id')
    .put(
        authorize('teacher', 'admin'),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('code', 'Course code is required').not().isEmpty(),
            check('description', 'Description is required').not().isEmpty()
        ],
        updateCourse
    )
    .delete(authorize('teacher', 'admin'), deleteCourse);

// Student routes
router.post('/:id/enroll', authorize('student'), enrollInCourse);

// Teacher and admin routes
router.get('/:id/students', authorize('teacher', 'admin'), getCourseStudents);

export default router;
