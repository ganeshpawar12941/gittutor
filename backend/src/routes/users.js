const express = require('express');
const { check } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    enrollInCourse,
    getEnrolledCourses
} = require('../controllers/userController');

const router = express.Router();

// All routes are protected and require authentication
router.use(protect);

// Admin only routes
router.use(authorize('admin'));

router
    .route('/')
    .get(getUsers)
    .post(
        [
            check('name', 'Name is required').not().isEmpty(),
            check('email', 'Please include a valid email').isEmail(),
            check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
            check('role', 'Please include a valid role').isIn(['student', 'teacher', 'admin'])
        ],
        createUser
    );

router
    .route('/:id')
    .get(getUser)
    .put(
        [
            check('name', 'Name is required').not().isEmpty(),
            check('email', 'Please include a valid email').isEmail(),
            check('role', 'Please include a valid role').isIn(['student', 'teacher', 'admin'])
        ],
        updateUser
    )
    .delete(deleteUser);

// Student routes
router.post('/enroll/:courseId', authorize('student'), enrollInCourse);
router.get('/my-courses', authorize('student'), getEnrolledCourses);

module.exports = router;
