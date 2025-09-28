import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure AWS S3 client
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
 * Uploads a file to S3 with multipart upload for large files
 * @param {Object} file - Multer file object
 * @param {String} folder - Folder path in S3 bucket (e.g., 'videos')
 * @returns {Promise<Object>} - Upload result with location and key
 */
const uploadToS3 = async (file, folder = 'videos') => {
    const fileStream = fs.createReadStream(file.path);
    const fileKey = `${folder}/${Date.now()}-${file.originalname}`;
    
    try {
        // Initiate multipart upload
        const multipartUpload = await s3Client.send(
            new CreateMultipartUploadCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileKey,
                ContentType: file.mimetype
            })
        );

        const uploadId = multipartUpload.UploadId;
        const fileSize = file.size;
        const partCount = Math.ceil(fileSize / CHUNK_SIZE);
        const parts = [];

        // Upload each part
        for (let partNumber = 1; partNumber <= partCount; partNumber++) {
            const start = (partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const partSize = end - start;
            
            let retries = 0;
            let lastError;
            
            while (retries < MAX_RETRIES) {
                try {
                    const uploadUrl = await getSignedUrl(
                        s3Client,
                        new UploadPartCommand({
                            Bucket: process.env.AWS_S3_BUCKET_NAME,
                            Key: fileKey,
                            PartNumber: partNumber,
                            UploadId: uploadId,
                            ContentLength: partSize
                        }),
                        { expiresIn: 3600 } // 1 hour URL expiration
                    );

                    // Upload the part
                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        body: fileStream.pipe(
                            new require('stream').Transform({
                                transform(chunk, encoding, callback) {
                                    this.push(chunk);
                                    callback();
                                }
                            })
                        ),
                        headers: {
                            'Content-Length': partSize,
                            'Content-Type': file.mimetype
                        }
                    });

                    if (!response.ok) throw new Error('Part upload failed');
                    
                    const eTag = response.headers.get('etag');
                    parts.push({ PartNumber: partNumber, ETag: eTag });
                    break;
                } catch (error) {
                    lastError = error;
                    retries++;
                    if (retries === MAX_RETRIES) {
                        await s3Client.send(
                            new AbortMultipartUploadCommand({
                                Bucket: process.env.AWS_S3_BUCKET_NAME,
                                Key: fileKey,
                                UploadId: uploadId
                            })
                        );
                        throw new Error(`Failed to upload part ${partNumber} after ${MAX_RETRIES} attempts: ${lastError.message}`);
                    }
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retries));
                }
            }
        }

        // Complete multipart upload
        await s3Client.send(
            new CompleteMultipartUploadCommand({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileKey,
                UploadId: uploadId,
                MultipartUpload: { Parts: parts }
            })
        );

        // Generate public URL
        const location = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
        
        return {
            location,
            key: fileKey,
            bucket: process.env.AWS_S3_BUCKET_NAME,
            size: file.size,
            mimetype: file.mimetype
        };
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw error;
    } finally {
        // Clean up the temp file
        if (file.path) {
            await fs.unlink(file.path);
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
