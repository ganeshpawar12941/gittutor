import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { errorResponse } from './apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure AWS S3 client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Ensure upload directory exists
const ensureUploadDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Generate a unique filename
const generateUniqueFilename = (originalname) => {
    const ext = path.extname(originalname);
    return `${uuidv4()}${ext}`;
};

// Upload file to S3
const uploadToS3 = async (file, folder = '') => {
    try {
        const fileContent = fs.readFileSync(file.path);
        const key = folder ? `${folder}/${file.filename}` : file.filename;
        
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: fileContent,
            ContentType: file.mimetype,
            ACL: 'public-read'
        };
        
        await s3Client.send(new PutObjectCommand(params));
        
        // Generate public URL
        const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
        
        // Clean up local file
        fs.unlinkSync(file.path);
        
        return {
            url: publicUrl,
            key: key,
            size: file.size,
            mimetype: file.mimetype
        };
    } catch (error) {
        console.error('S3 Upload Error:', error);
        throw new Error('Failed to upload file to S3');
    }
};

// Upload file to local storage
const uploadToLocal = async (file, folder = '') => {
    try {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads', folder);
        ensureUploadDir(uploadDir);
        
        const filename = generateUniqueFilename(file.originalname);
        const filePath = path.join(uploadDir, filename);
        
        // Move file from temp location to uploads directory
        await fs.promises.rename(file.path, filePath);
        
        // Generate public URL
        const publicUrl = `/uploads/${folder ? `${folder}/` : ''}${filename}`;
        
        return {
            url: publicUrl,
            path: filePath,
            size: file.size,
            mimetype: file.mimetype
        };
    } catch (error) {
        console.error('Local Upload Error:', error);
        throw new Error('Failed to upload file locally');
    }
};

// Delete file from S3
const deleteFromS3 = async (key) => {
    try {
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        };
        
        await s3Client.send(new DeleteObjectCommand(params));
        return true;
    } catch (error) {
        console.error('S3 Delete Error:', error);
        throw new Error('Failed to delete file from S3');
    }
};

// Delete local file
const deleteLocalFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Local Delete Error:', error);
        throw new Error('Failed to delete local file');
    }
};

// Generate pre-signed URL for private files
const generatePresignedUrl = async (key, expiresIn = 3600) => {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });
        
        const url = await getSignedUrl(s3Client, command, { expiresIn });
        return url;
    } catch (error) {
        console.error('Generate Presigned URL Error:', error);
        throw new Error('Failed to generate pre-signed URL');
    }
};

// Main upload function (uses S3 if configured, otherwise falls back to local)
const uploadFile = async (file, folder = '') => {
    if (process.env.STORAGE_PROVIDER === 's3' && process.env.AWS_BUCKET_NAME) {
        return uploadToS3(file, folder);
    } else {
        return uploadToLocal(file, folder);
    }
};

// Main delete function
const deleteFile = async (filePath) => {
    if (process.env.STORAGE_PROVIDER === 's3' && process.env.AWS_BUCKET_NAME) {
        // Extract key from S3 URL or use the path as key
        const key = filePath.includes('amazonaws.com/') 
            ? filePath.split('amazonaws.com/')[1] 
            : filePath;
        return deleteFromS3(key);
    } else {
        // For local files, use the full path
        const fullPath = path.join(__dirname, '..', '..', filePath);
        return deleteLocalFile(fullPath);
    }
};

// Get file URL (for local files, returns absolute URL)
const getFileUrl = (filePath, req) => {
    if (!filePath) return null;
    
    if (filePath.startsWith('http') || filePath.startsWith('https')) {
        return filePath; // Already a full URL
    }
    
    if (process.env.STORAGE_PROVIDER === 's3' && !filePath.includes('amazonaws.com')) {
        return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filePath}`;
    }
    
    // For local files, construct full URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}${filePath}`;
};

export {
    uploadFile,
    deleteFile,
    getFileUrl,
    generatePresignedUrl
};
