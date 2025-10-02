import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import ApiError from '../../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure storage for temporary files
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        try {
            const uploadDir = path.join(__dirname, '../../../uploads/temp');
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(new ApiError(500, 'Failed to create upload directory'));
        }
    },
    filename: function (req, file, cb) {
        try {
            const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
            const ext = path.extname(file.originalname).toLowerCase();
            const prefix = file.fieldname === 'thumbnail' ? 'thumb' : 'video';
            const filename = `${prefix}-${uniqueSuffix}${ext}`;
            cb(null, filename);
        } catch (error) {
            cb(new ApiError(400, 'Invalid filename'));
        }
    }
});

// File filter to allow video for field 'video' and image for field 'thumbnail'
const fileFilter = (req, file, cb) => {
    try {
        const videoTypes = [
            'video/mp4',
            'video/quicktime',
            'video/x-msvideo',
            'video/x-ms-wmv',
            'video/x-matroska',
            'video/webm',
            'video/3gpp',
            'video/3gpp2',
            'video/mpeg',
            'video/ogg'
        ];
        const imageTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp'
        ];

        if (file.fieldname === 'video' && videoTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        if (file.fieldname === 'thumbnail' && imageTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(new ApiError(400, 'Invalid file type for field'), false);
    } catch (error) {
        cb(error, false);
    }
};

/**
 * Middleware to parse form-data for video update (thumbnail optional)
 * - Does NOT require a video file
 * - Populates req.thumbnailFile if provided
 */
export const parseVideoUpdateForm = async (req, res, next) => {
    try {
        const parseFields = upload.fields([
            { name: 'thumbnail', maxCount: 1 }
        ]);

        await new Promise((resolve, reject) => {
            parseFields(req, res, (err) => {
                if (err) {
                    if (err instanceof multer.MulterError) {
                        if (err.code === 'LIMIT_FILE_SIZE') {
                            return reject(new ApiError(413, 'File size exceeds the 6GB limit'));
                        }
                        return reject(new ApiError(400, `Upload error: ${err.message}`));
                    }
                    return reject(err);
                }
                req.thumbnailFile = req.files?.thumbnail?.[0] || null;
                resolve();
            });
        });

        next();
    } catch (error) {
        if (req.thumbnailFile?.path) {
            try {
                await fs.unlink(req.thumbnailFile.path);
            } catch (cleanupErr) {
                console.error('Error during thumbnail cleanup after parse error:', cleanupErr);
            }
        }
        next(error instanceof ApiError ? error : new ApiError(500, 'Error parsing update form data'));
    }
};

// Configure multer upload with enhanced error handling
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 6 * 1024 * 1024 * 1024, // 6GB max file size
        files: 2, // Allow video + thumbnail
        fieldSize: 6 * 1024 * 1024 * 1024 // 6GB max field size
    }
});

/**
 * Middleware to handle video file upload
 * Adds file info to req.file and additional metadata to req.fileInfo
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const uploadVideo = async (req, res, next) => {
    try {
        // Handle the file upload for both fields
        const uploadFields = upload.fields([
            { name: 'video', maxCount: 1 },
            { name: 'thumbnail', maxCount: 1 }
        ]);
        
        // Wrap the callback in a Promise to handle async/await
        await new Promise((resolve, reject) => {
            uploadFields(req, res, (err) => {
                if (err) {
                    // Handle multer errors with specific error messages
                    if (err instanceof multer.MulterError) {
                        if (err.code === 'LIMIT_FILE_SIZE') {
                            return reject(new ApiError(413, 'File size exceeds the 6GB limit'));
                        }
                        return reject(new ApiError(400, `Upload error: ${err.message}`));
                    }
                    // Handle other errors
                    return reject(err);
                }
                
                const videoFile = req.files?.video?.[0];
                if (!videoFile) {
                    return reject(new ApiError(400, 'No video uploaded. Field name must be "video".'));
                }
                // Normalize for downstream compatibility
                req.file = videoFile;
                req.thumbnailFile = req.files?.thumbnail?.[0] || null;
                resolve();
            });
        });
        
        // If we get here, the upload was successful
        // Add file info to request object for controller
        req.fileInfo = {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            extension: path.extname(req.file.originalname).toLowerCase(),
            tempPath: req.file.path
        };
        
        next();
    } catch (error) {
        // Clean up any uploaded files if there was an error
        if (req.file?.path) {
            try {
                await fs.unlink(req.file.path).catch(cleanupErr => {
                    console.error('Error cleaning up file after upload error:', cleanupErr);
                });
            } catch (cleanupErr) {
                console.error('Error during file cleanup after upload error:', cleanupErr);
            }
        }
        // Also cleanup thumbnail file if present
        if (req.thumbnailFile?.path) {
            try {
                await fs.unlink(req.thumbnailFile.path).catch(cleanupErr => {
                    console.error('Error cleaning up thumbnail after upload error:', cleanupErr);
                });
            } catch (cleanupErr) {
                console.error('Error during thumbnail cleanup after upload error:', cleanupErr);
            }
        }
        
        // Handle our custom ApiError or other errors
        next(error instanceof ApiError ? error : new ApiError(500, 'Error processing file upload'));
    }
};

/**
 * Middleware to clean up temporary files in case of errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const cleanupTempFiles = async (req, res, next) => {
    try {
        // If there's a file in the request, clean it up
        if (req.file?.path) {
            try {
                await fs.access(req.file.path);
                await fs.unlink(req.file.path);
                console.log('Temporary file cleaned up successfully:', req.file.path);
            } catch (error) {
                // Ignore file not found errors, log others
                if (error.code !== 'ENOENT') {
                    console.error('Failed to clean up temporary file:', error);
                }
            }
        }
        
        // If there are multiple files via fields (object of arrays)
        if (req.files && !Array.isArray(req.files)) {
            for (const key of Object.keys(req.files)) {
                const arr = req.files[key];
                if (Array.isArray(arr)) {
                    for (const file of arr) {
                        try {
                            await fs.access(file.path);
                            await fs.unlink(file.path);
                            console.log('Temporary file cleaned up successfully:', file.path);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                console.error('Failed to clean up temporary file:', error);
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error during temp file cleanup:', error);
    } finally {
        next();
    }
};

