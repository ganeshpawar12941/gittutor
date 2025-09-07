import express from 'express';
import { check } from 'express-validator';
import { protect, authorize } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
    getVideos,
    getVideo,
    uploadVideo,
    updateVideo,
    deleteVideo,
    getVideosByCourse
} from '../controllers/videoController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'videos');
        // Create uploads/videos directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate a unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to only allow video files
const fileFilter = (req, file, cb) => {
    const filetypes = /mp4|mov|avi|wmv|flv|mkv/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only video files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

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
    upload.single('video'),
    [
        check('title', 'Title is required').not().isEmpty(),
        check('description', 'Description is required').not().isEmpty(),
        check('course', 'Course ID is required').not().isEmpty(),
        check('duration', 'Duration is required').isNumeric()
    ],
    uploadVideo
);

router
    .route('/:id')
    .put(
        authorize('teacher', 'admin'),
        [
            check('title', 'Title is required').not().isEmpty(),
            check('description', 'Description is required').not().isEmpty()
        ],
        updateVideo
    )
    .delete(authorize('teacher', 'admin'), deleteVideo);

module.exports = router;
