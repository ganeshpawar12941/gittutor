import multer from 'multer';
import { storage } from '../../utils/cloudinary.js';

// File filter for images
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Configure multer with Cloudinary storage
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
    }
});

// Middleware to handle single file upload
const uploadSingle = (fieldName) => (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message || 'Error uploading file'
            });
        }
        next();
    });
};

export { upload, uploadSingle };
