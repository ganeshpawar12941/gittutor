import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import { errorResponse } from './apiResponse.js';

const __filename = import.meta.url;
const __dirname = path.dirname(__filename);

// Allowed file types with their MIME types and extensions
const ALLOWED_FILE_TYPES = {
    // Images
    'image/jpeg': ['.jpeg', '.jpg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    // Archives
    'application/zip': ['.zip'],
    'application/x-rar-compressed': ['.rar'],
    // Videos
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
    'video/x-msvideo': ['.avi'],
    'video/x-ms-wmv': ['.wmv'],
    'video/x-flv': ['.flv'],
    'video/x-matroska': ['.mkv'],
    // Audio
    'audio/mpeg': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/ogg': ['.ogg'],
    'audio/webm': ['.weba']
};

// Maximum file sizes (in bytes)
const MAX_FILE_SIZES = {
    image: 10 * 1024 * 1024, // 10MB
    video: 500 * 1024 * 1024, // 500MB
    document: 20 * 1024 * 1024, // 20MB
    audio: 50 * 1024 * 1024, // 50MB
    default: 10 * 1024 * 1024 // 10MB
};

// File categories
const FILE_CATEGORIES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/x-flv', 'video/x-matroska'],
    document: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed'
    ],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
};

/**
 * Get the category of a file based on its MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {string} File category (image, video, document, audio, or unknown)
 */
const getFileCategory = (mimeType) => {
    for (const [category, mimeTypes] of Object.entries(FILE_CATEGORIES)) {
        if (mimeTypes.includes(mimeType)) {
            return category;
        }
    }
    return 'unknown';
};

/**
 * Get the maximum allowed file size for a given MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {number} Maximum file size in bytes
 */
const getMaxFileSize = (mimeType) => {
    const category = getFileCategory(mimeType);
    return MAX_FILE_SIZES[category] || MAX_FILE_SIZES.default;
};

/**
 * Validate a file against allowed types and size
 * @param {Object} file - File object from multer
 * @returns {Object} Validation result { isValid: boolean, error: string }
 */
const validateFile = (file) => {
    try {
        // Check if file exists
        if (!file) {
            return { isValid: false, error: 'No file provided' };
        }

        const { originalname, mimetype, size, path: filePath } = file;
        
        // Check if MIME type is allowed
        if (!ALLOWED_FILE_TYPES[mimetype]) {
            return { isValid: false, error: `File type '${mimetype}' is not allowed` };
        }

        // Check file extension
        const ext = path.extname(originalname).toLowerCase();
        if (!ALLOWED_FILE_TYPES[mimetype].includes(ext)) {
            return { 
                isValid: false, 
                error: `File extension '${ext}' is not allowed for MIME type '${mimetype}'` 
            };
        }

        // Check file size
        const maxSize = getMaxFileSize(mimetype);
        if (size > maxSize) {
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
            return { 
                isValid: false, 
                error: `File size exceeds the maximum allowed size of ${maxSizeMB}MB` 
            };
        }

        // Check file content (basic check for image files)
        if (mimetype.startsWith('image/') && filePath) {
            try {
                // This is a simple check to ensure the file is a valid image
                // In production, you might want to use a more robust library
                const fileContent = fs.readFileSync(filePath);
                if (fileContent.length === 0) {
                    return { isValid: false, error: 'File is empty' };
                }
            } catch (error) {
                return { isValid: false, error: 'Invalid file content' };
            }
        }

        return { isValid: true };
    } catch (error) {
        console.error('File validation error:', error);
        return { isValid: false, error: 'Error validating file' };
    }
};

/**
 * Middleware to validate file uploads
 * @param {string} fieldName - Name of the file field in the form
 * @param {boolean} isRequired - Whether the file is required
 * @returns {Function} Express middleware function
 */
const validateFileUpload = (fieldName, isRequired = true) => {
    return (req, res, next) => {
        try {
            const file = req.file || (req.files && req.files[fieldName]);
            
            if (!file && isRequired) {
                return errorResponse(res, 400, `File '${fieldName}' is required`);
            }
            
            if (file) {
                const validation = validateFile(file);
                if (!validation.isValid) {
                    // Clean up the uploaded file if validation fails
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                    return errorResponse(res, 400, validation.error);
                }
            }
            
            next();
        } catch (error) {
            console.error('File upload validation error:', error);
            errorResponse(res, 500, 'Error processing file upload');
        }
    };
};

/**
 * Middleware to validate multiple file uploads
 * @param {string} fieldName - Name of the file field in the form
 * @param {number} maxCount - Maximum number of files allowed
 * @param {boolean} isRequired - Whether at least one file is required
 * @returns {Function} Express middleware function
 */
const validateMultipleFileUploads = (fieldName, maxCount = 5, isRequired = true) => {
    return (req, res, next) => {
        try {
            const files = req.files && req.files[fieldName];
            
            if ((!files || files.length === 0) && isRequired) {
                return errorResponse(res, 400, `At least one file in '${fieldName}' is required`);
            }
            
            if (files && files.length > maxCount) {
                // Clean up any uploaded files
                files.forEach(file => {
                    if (file.path && fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                });
                return errorResponse(res, 400, `Maximum ${maxCount} files allowed in '${fieldName}'`);
            }
            
            if (files) {
                for (const file of files) {
                    const validation = validateFile(file);
                    if (!validation.isValid) {
                        // Clean up all uploaded files if any validation fails
                        files.forEach(f => {
                            if (f.path && fs.existsSync(f.path)) {
                                fs.unlinkSync(f.path);
                            }
                        });
                        return errorResponse(res, 400, validation.error);
                    }
                }
            }
            
            next();
        } catch (error) {
            console.error('Multiple file upload validation error:', error);
            errorResponse(res, 500, 'Error processing file uploads');
        }
    };
};

export {
    ALLOWED_FILE_TYPES,
    MAX_FILE_SIZES,
    FILE_CATEGORIES,
    getFileCategory,
    getMaxFileSize,
    validateFile,
    validateFileUpload,
    validateMultipleFileUploads
};
