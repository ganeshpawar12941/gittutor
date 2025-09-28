import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import { createReadStream, createWriteStream } from 'fs';
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { errorResponse } from './apiResponse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure AWS S3 client if environment variables are set
let s3Client;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
}

/**
 * Check if a file exists at the given path
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} True if file exists, false otherwise
 */
const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Read a file asynchronously
 * @param {string} filePath - Path to the file
 * @param {string} [encoding='utf8'] - File encoding
 * @returns {Promise<string|Buffer>} File content
 */
const readFile = async (filePath, encoding = 'utf8') => {
    try {
        return await fs.readFile(filePath, { encoding });
    } catch (error) {
        throw new Error(`Error reading file: ${error.message}`);
    }
};

/**
 * Write data to a file asynchronously
 * @param {string} filePath - Path to the file
 * @param {string|Buffer} data - Data to write
 * @param {string} [encoding='utf8'] - File encoding
 * @returns {Promise<void>}
 */
const writeFile = async (filePath, data, encoding = 'utf8') => {
    try {
        // Create directory if it doesn't exist
        const dir = path.dirname(filePath);
        if (!fsSync.existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
        }
        
        await fs.writeFile(filePath, data, { encoding });
    } catch (error) {
        throw new Error(`Error writing file: ${error.message}`);
    }
};

/**
 * Delete a file asynchronously
 * @param {string} filePath - Path to the file
 * @returns {Promise<void>}
 */
const deleteFile = async (filePath) => {
    try {
        if (await fileExists(filePath)) {
            await fs.unlink(filePath);
        }
    } catch (error) {
        throw new Error(`Error deleting file: ${error.message}`);
    }
};

/**
 * Upload a file to S3
 * @param {Buffer|string} fileData - File data to upload
 * @param {string} key - S3 object key
 * @param {string} [contentType] - MIME type of the file
 * @param {string} [bucket] - S3 bucket name
 * @returns {Promise<Object>} Upload result with key and URL
 */
const uploadToS3 = async (fileData, key, contentType = null, bucket = null) => {
    if (!s3Client) {
        throw new Error('S3 client is not configured');
    }

    const bucketName = bucket || process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('S3 bucket name is required');
    }

    const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileData,
        ContentType: contentType || mime.lookup(key) || 'application/octet-stream',
    };

    try {
        await s3Client.send(new PutObjectCommand(params));
        
        // Generate a public URL for the uploaded file
        const url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
        
        return {
            key,
            url,
            bucket: bucketName,
            contentType: params.ContentType,
            size: Buffer.byteLength(fileData),
        };
    } catch (error) {
        throw new Error(`Error uploading to S3: ${error.message}`);
    }
};

/**
 * Get a file from S3
 * @param {string} key - S3 object key
 * @param {string} [bucket] - S3 bucket name
 * @returns {Promise<Buffer>} File data
 */
const getFromS3 = async (key, bucket = null) => {
    if (!s3Client) {
        throw new Error('S3 client is not configured');
    }

    const bucketName = bucket || process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('S3 bucket name is required');
    }

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    try {
        const response = await s3Client.send(new GetObjectCommand(params));
        const chunks = [];
        
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        
        return Buffer.concat(chunks);
    } catch (error) {
        if (error.name === 'NoSuchKey') {
            throw new Error(`File not found: ${key}`);
        }
        throw new Error(`Error getting file from S3: ${error.message}`);
    }
};

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 * @param {string} [bucket] - S3 bucket name
 * @returns {Promise<boolean>} True if deleted successfully
 */
const deleteFromS3 = async (key, bucket = null) => {
    if (!s3Client) {
        throw new Error('S3 client is not configured');
    }

    const bucketName = bucket || process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('S3 bucket name is required');
    }

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    try {
        await s3Client.send(new DeleteObjectCommand(params));
        return true;
    } catch (error) {
        throw new Error(`Error deleting file from S3: ${error.message}`);
    }
};

/**
 * Generate a pre-signed URL for an S3 object
 * @param {string} key - S3 object key
 * @param {number} [expiresIn=3600] - URL expiration time in seconds
 * @param {string} [bucket] - S3 bucket name
 * @returns {Promise<string>} Pre-signed URL
 */
const getSignedS3Url = async (key, expiresIn = 3600, bucket = null) => {
    if (!s3Client) {
        throw new Error('S3 client is not configured');
    }

    const bucketName = bucket || process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('S3 bucket name is required');
    }

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    try {
        const command = new GetObjectCommand(params);
        return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
        throw new Error(`Error generating pre-signed URL: ${error.message}`);
    }
};

/**
 * Check if a file exists in S3
 * @param {string} key - S3 object key
 * @param {string} [bucket] - S3 bucket name
 * @returns {Promise<boolean>} True if file exists
 */
const s3FileExists = async (key, bucket = null) => {
    if (!s3Client) {
        throw new Error('S3 client is not configured');
    }

    const bucketName = bucket || process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('S3 bucket name is required');
    }

    const params = {
        Bucket: bucketName,
        Key: key,
    };

    try {
        await s3Client.send(new HeadObjectCommand(params));
        return true;
    } catch (error) {
        if (error.name === 'NotFound') {
            return false;
        }
        throw new Error(`Error checking file existence in S3: ${error.message}`);
    }
};

/**
 * Generate a unique filename with extension
 * @param {string} originalName - Original filename
 * @param {string} [prefix=''] - Optional prefix for the filename
 * @returns {string} Unique filename
 */
const generateUniqueFilename = (originalName, prefix = '') => {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const uniqueId = uuidv4().substring(0, 8);
    return `${prefix}${baseName}-${uniqueId}${ext}`.toLowerCase();
};

/**
 * Get file information (size, MIME type, etc.)
 * @param {string} filePath - Path to the file
 * @returns {Promise<Object>} File information
 */
const getFileInfo = async (filePath) => {
    try {
        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase().substring(1);
        
        return {
            path: filePath,
            name: path.basename(filePath),
            size: stats.size,
            type: mime.lookup(ext) || 'application/octet-stream',
            extension: ext,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
        };
    } catch (error) {
        throw new Error(`Error getting file info: ${error.message}`);
    }
};

export {
    // Local file operations
    fileExists,
    readFile,
    writeFile,
    deleteFile,
    getFileInfo,
    generateUniqueFilename,
    
    // S3 operations
    s3Client,
    uploadToS3,
    getFromS3,
    deleteFromS3,
    getSignedS3Url,
    s3FileExists,
};
