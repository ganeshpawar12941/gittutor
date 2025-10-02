import express from 'express';
import { check } from 'express-validator';
import { protect, authorize } from '../middleware/auth/index.js';
import { validateRequest } from '../middleware/validation/validateRequest.js';
import { uploadVideo as uploadVideoMiddleware, cleanupTempFiles, parseVideoUpdateForm } from '../middleware/upload/videoUpload.js';
import ApiError from '../utils/ApiError.js';

import {
    getVideos,
    getVideo,
    uploadVideo,
    updateVideo,
    deleteVideo,
    getVideosByCourse
} from '../controllers/videoController.js';

const router = express.Router();

// Validation middleware for video upload
const videoValidations = [
    check('title', 'Title is required and must be between 5 and 200 characters')
        .notEmpty()
        .isLength({ min: 5, max: 200 })
        .trim(),
    check('description', 'Description is required and must be between 10 and 2000 characters')
        .notEmpty()
        .isLength({ min: 10, max: 2000 })
        .trim(),
    check('course', 'Valid course ID is required')
        .isMongoId()
        .withMessage('Please provide a valid course ID'),
    check('duration', 'Duration is required and must be a positive number')
        .isInt({ min: 1 })
        .toInt(),
    check('isFree', 'isFree must be a boolean')
        .optional()
        .isBoolean()
        .toBoolean(),
    check('order', 'Order must be a non-negative number')
        .optional()
        .isInt({ min: 0 })
        .toInt()
];

// Wrap validations with validateRequest middleware
const validateVideoUpload = validateRequest(videoValidations);

// Validation rules for update
const videoUpdateValidations = [
    check('title', 'Title must be between 5 and 200 characters')
        .optional()
        .isLength({ min: 5, max: 200 })
        .trim(),
    check('description', 'Description must be between 10 and 2000 characters')
        .optional()
        .isLength({ min: 10, max: 2000 })
        .trim(),
    check('course', 'Please provide a valid course ID')
        .optional()
        .isMongoId(),
    check('duration', 'Duration must be a positive number')
        .optional()
        .isInt({ min: 1 })
        .toInt(),
    check('isFree', 'isFree must be a boolean')
        .optional()
        .isBoolean()
        .toBoolean(),
    check('order', 'Order must be a non-negative number')
        .optional()
        .isInt({ min: 0 })
        .toInt()
];

// Wrap update validations with validateRequest middleware
const validateVideoUpdate = validateRequest(videoUpdateValidations);

// Public routes
router.get('/', getVideos);
router.get('/:id', getVideo);
router.get('/course/:courseId', getVideosByCourse);

// Protected routes
router.use(protect);

// Teacher and admin routes
router.post(
    '/upload',
    authorize('teacher', 'admin'),
    // Upload middleware
    (req, res, next) => {
        uploadVideoMiddleware(req, res, (err) => {
            if (err) return next(err);
            next();
        });
    },
    // Validate request
    validateVideoUpload,
    // Process upload
    uploadVideo
);

router
    .route('/:id')
    .put(
        authorize('teacher', 'admin'),
        // allow multipart form-data with optional thumbnail for updates
        (req, res, next) => {
            parseVideoUpdateForm(req, res, (err) => {
                if (err) return next(err);
                next();
            });
        },
        validateVideoUpdate,
        updateVideo
    )
    .delete(authorize('teacher', 'admin'), deleteVideo);

// Error handling middleware
router.use((err, req, res, next) => {
    // Check if headers already sent
    if (res.headersSent) {
        console.error('Headers already sent in videos route, passing to next error handler');
        return next(err);
    }

    // Clean up temp files if they exist
    if (req.file?.path) {
        try {
            // Ensure cleanup happens synchronously before sending response
            cleanupTempFiles(req, res, () => {});
        } catch (cleanupError) {
            console.error('Error during temp file cleanup:', cleanupError);
        }
    }

    // Handle our custom ApiError
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: Object.values(err.errors).map(e => e.message)
        });
    }

    // Handle multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'File size too large. Maximum allowed size is 100MB.'
        });
    }

    // Handle invalid file type errors
    if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only video files are allowed.'
        });
    }

    // Handle multer errors
    if (err.name === 'MulterError') {
        return res.status(400).json({
            success: false,
            message: 'File Upload Error',
            error: err.message
        });
    }

    // Handle other errors
    console.error('Error in videos route:', err);
    return res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { error: err.stack })
    });
});

export default router;
