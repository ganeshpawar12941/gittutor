import express from 'express';
import { check } from 'express-validator';
import { protect, authorize } from '../middleware/auth/index.js';
import { validateRequest } from '../middleware/validation/validateRequest.js';
import {
    getUsers,
    getUser,
    updateUser,
    deleteUser,
    getEnrolledCourses
} from '../controllers/userController.js';

const router = express.Router();

// All routes are protected and require authentication
router.use(protect);

// Admin only routes
router.use(authorize('admin'));

router
    .route('/')
    .get(getUsers)

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
router.get('/my-courses', authorize('student'), getEnrolledCourses);

export default router;
