const express = require('express');
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
    getCourses,
    getCourse,
    createCourse,
    updateCourse,
    deleteCourse,
    enrollInCourse,
    getCourseStudents
} = require('../controllers/courseController');

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

module.exports = router;
