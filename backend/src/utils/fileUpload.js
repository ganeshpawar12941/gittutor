const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure storage for different file types
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadDir = '';
        
        // Determine upload directory based on file type
        if (file.mimetype.startsWith('image/')) {
            uploadDir = path.join(__dirname, '..', '..', 'uploads', 'images');
        } else if (file.mimetype.startsWith('video/')) {
            uploadDir = path.join(__dirname, '..', '..', 'uploads', 'videos');
        } else if (file.mimetype.startsWith('application/')) {
            uploadDir = path.join(__dirname, '..', '..', 'uploads', 'documents');
        } else {
            uploadDir = path.join(__dirname, '..', '..', 'uploads', 'others');
        }

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate a unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + uuidv4();
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
    // Allowed file types
    const filetypes = /jpeg|jpg|png|gif|mp4|mov|avi|wmv|flv|mkv|pdf|doc|docx|ppt|pptx|xls|xlsx|txt/;
    
    // Check file extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only the following file types are allowed: ' + filetypes));
    }
};

// Configure multer with the storage and file filter
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 100 // 100MB limit
    }
});

// Middleware to handle single file upload
const uploadFile = (fieldName) => {
    return upload.single(fieldName);
};

// Middleware to handle multiple file uploads
const uploadFiles = (fieldName, maxCount = 5) => {
    return upload.array(fieldName, maxCount);
};

// Middleware to handle multiple fields with different file types
const uploadFields = (fields) => {
    return upload.fields(fields);
};

// Function to delete a file
const deleteFile = (filePath) => {
    const fullPath = path.join(__dirname, '..', '..', filePath);
    
    return new Promise((resolve, reject) => {
        fs.unlink(fullPath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Function to get file URL
const getFileUrl = (req, filePath) => {
    if (!filePath) return null;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/${filePath.replace(/\\/g, '/')}`;
};

module.exports = {
    uploadFile,
    uploadFiles,
    uploadFields,
    deleteFile,
    getFileUrl
};
