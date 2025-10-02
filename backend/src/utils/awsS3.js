import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure AWS S3 client
if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
    throw new Error('Missing required AWS configuration. Please set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME environment variables.');
}

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

// Constants
const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Uploads a file to S3 with automatic multipart upload for large files
 * @param {Object} file - Multer file object
 * @param {String} folder - Folder path in S3 bucket (e.g., 'videos')
 * @returns {Promise<Object>} - Upload result with location and key
 */
const uploadToS3 = async (file, folder = 'videos') => {
    if (!file || !file.path) {
        throw new Error('No file provided or file path is missing');
    }
    
    const fileStream = fs.createReadStream(file.path);
    const fileKey = `${folder}/${Date.now()}-${file.originalname.replace(/[^\w\d.-]/g, '_')}`;
    
    try {
        // Use AWS SDK's Upload class which handles multipart uploads automatically
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileKey,
                Body: fileStream,
                ContentType: file.mimetype
            },
            // Configure multipart upload settings
            queueSize: 4, // Concurrent part uploads
            partSize: CHUNK_SIZE, // 10MB parts
            leavePartsOnError: false // Clean up failed uploads
        });

        // Monitor upload progress (optional)
        upload.on('httpUploadProgress', (progress) => {
            if (progress.loaded && progress.total) {
                const percentage = Math.round((progress.loaded / progress.total) * 100);
                console.log(`Upload progress: ${percentage}%`);
            }
        });

        // Wait for upload to complete
        const result = await upload.done();

        // Non-public S3 object URL (requires signed URL or bucket policy to access)
        const location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
        
        return {
            location,
            key: fileKey,
            bucket: process.env.AWS_S3_BUCKET_NAME,
            size: file.size,
            mimetype: file.mimetype,
            etag: result.ETag
        };
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
    } finally {
        // Clean up the temp file
        if (file.path) {
            try {
                await fs.promises.unlink(file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up temp file:', cleanupError);
            }
        }
    }
};

/**
 * Deletes a file from S3
 * @param {String} key - File key in S3
 * @returns {Promise<Boolean>} - True if successful
 */
const deleteFromS3 = async (key) => {
    try {
        await s3Client.send(
            new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: key
            })
        );
        return true;
    } catch (error) {
        console.error('Error deleting from S3:', error);
        throw error;
    }
};

export {
    uploadToS3,
    deleteFromS3
};

/**
 * Generate a presigned GET URL for an S3 object key
 * @param {string} key - S3 object key
 * @param {number} expiresIn - Expiration in seconds (default 3600 = 1h)
 * @returns {Promise<string>} - Signed URL
 */
export const getSignedGetUrl = async (key, expiresIn = 3600) => {
    const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key
    });
    return getSignedUrl(s3Client, command, { expiresIn });
};
