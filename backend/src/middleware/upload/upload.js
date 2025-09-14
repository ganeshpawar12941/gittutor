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
    console.log('Starting file upload...');
    console.log('Request files:', req.files);
    console.log('Request body:', req.body);
    
    upload.single(fieldName)(req, res, (err) => {
        if (err) {
            console.error('File upload error details:', {
                name: err.name,
                message: err.message,
                code: err.code,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                rawError: process.env.NODE_ENV === 'development' ? err : undefined
            });
            
            let message = 'Error uploading file';
            
            if (err.code === 'LIMIT_FILE_SIZE') {
                message = 'File size is too large. Maximum size is 5MB.';
            } else if (err.message && typeof err.message === 'string') {
                if (err.message.includes('image files')) {
                    message = 'Only image files are allowed (jpg, jpeg, png, webp)';
                } else if (err.message.includes('credentials') || err.message.includes('api_key')) {
                    message = 'Invalid Cloudinary configuration. Please check your API credentials.';
                    console.error('Cloudinary configuration issue detected. Please verify your .env file has the correct CLOUDINARY_* variables set.');
                } else {
                    message = err.message;
                }
            }
            
            return res.status(400).json({
                success: false,
                message: message,
                error: process.env.NODE_ENV === 'development' ? (err.message || 'Unknown error') : undefined,
                errorDetails: process.env.NODE_ENV === 'development' ? {
                    name: err.name,
                    code: err.code
                } : undefined
            });
        }
        console.log('File upload successful:', req.file);
        next();
    });
};

export { upload, uploadSingle };
