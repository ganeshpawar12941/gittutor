const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { errorResponse } = require('./apiResponse');

// Configure AWS S3 client if needed
let s3Client;
if (process.env.STORAGE_PROVIDER === 's3') {
    s3Client = new S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    });
}

/**
 * Stream a file from the local filesystem
 * @param {string} filePath - Path to the file
 * @param {Object} res - Express response object
 */
const streamLocalFile = (filePath, res) => {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return errorResponse(res, 404, 'File not found');
        }

        // Get file stats
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = res.req.headers.range;

        // Get file extension and mime type
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mime.lookup(ext) || 'application/octet-stream';

        // Set headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);

        // Handle range requests for video/audio streaming
        if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            
            // Create read stream for the specified range
            const file = fs.createReadStream(filePath, { start, end });
            
            // Set response headers for partial content
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize
            });
            
            // Stream the file chunk
            file.pipe(res);
        } else {
            // Stream the entire file
            const file = fs.createReadStream(filePath);
            file.pipe(res);
        }
    } catch (error) {
        console.error('Error streaming file:', error);
        return errorResponse(res, 500, 'Error streaming file');
    }
};

/**
 * Stream a file from S3
 * @param {string} key - S3 object key
 * @param {Object} res - Express response object
 */
const streamS3File = async (key, res) => {
    try {
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        };

        // Get the object to determine its size and type
        const headObject = await s3Client.send(new GetObjectCommand({
            ...params,
            Range: 'bytes=0-0' // Just get headers
        }));

        const fileSize = parseInt(headObject.ContentRange.split('/')[1]);
        const contentType = headObject.ContentType || 'application/octet-stream';
        const range = res.req.headers.range;

        // Set headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(key)}"`);
        res.setHeader('Accept-Ranges', 'bytes');

        // Handle range requests for video/audio streaming
        if (range && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = (end - start) + 1;
            
            // Set response headers for partial content
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize
            });
            
            // Stream the file chunk from S3
            const s3Object = await s3Client.send(new GetObjectCommand({
                ...params,
                Range: `bytes=${start}-${end}`
            }));
            
            s3Object.Body.pipe(res);
        } else {
            // Stream the entire file from S3
            const s3Object = await s3Client.send(new GetObjectCommand(params));
            s3Object.Body.pipe(res);
        }
    } catch (error) {
        console.error('Error streaming file from S3:', error);
        return errorResponse(res, 500, 'Error streaming file');
    }
};

/**
 * Stream a file to the response
 * @param {string} filePath - Path to the file or S3 key
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object (optional)
 */
const streamFile = async (filePath, res, req = {}) => {
    try {
        // Check if using S3 or local storage
        if (process.env.STORAGE_PROVIDER === 's3' && filePath) {
            // If it's a full S3 URL, extract the key
            const key = filePath.includes('amazonaws.com/') 
                ? filePath.split('amazonaws.com/')[1] 
                : filePath;
            
            await streamS3File(key, res);
        } else {
            // For local files, use the full path
            const fullPath = path.join(__dirname, '..', '..', filePath);
            streamLocalFile(fullPath, res);
        }
    } catch (error) {
        console.error('Error in streamFile:', error);
        return errorResponse(res, 500, 'Error streaming file');
    }
};

/**
 * Download a file
 * @param {string} filePath - Path to the file or S3 key
 * @param {Object} res - Express response object
 * @param {string} [filename] - Custom filename for download
 */
const downloadFile = async (filePath, res, filename = null) => {
    try {
        // Check if using S3 or local storage
        if (process.env.STORAGE_PROVIDER === 's3') {
            // If it's a full S3 URL, extract the key
            const key = filePath.includes('amazonaws.com/') 
                ? filePath.split('amazonaws.com/')[1] 
                : filePath;
            
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
                ResponseContentDisposition: `attachment; filename="${filename || path.basename(key)}"`
            };
            
            const s3Object = await s3Client.send(new GetObjectCommand(params));
            
            // Set headers for download
            res.setHeader('Content-Type', s3Object.ContentType || 'application/octet-stream');
            res.setHeader('Content-Length', s3Object.ContentLength);
            res.setHeader('Content-Disposition', `attachment; filename="${filename || path.basename(key)}"`);
            
            // Stream the file
            s3Object.Body.pipe(res);
        } else {
            // For local files
            const fullPath = path.join(__dirname, '..', '..', filePath);
            
            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                return errorResponse(res, 404, 'File not found');
            }
            
            // Get file stats
            const stat = fs.statSync(fullPath);
            
            // Set headers for download
            const ext = path.extname(fullPath).toLowerCase();
            const contentType = mime.lookup(ext) || 'application/octet-stream';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `attachment; filename="${filename || path.basename(fullPath)}"`);
            
            // Stream the file
            const fileStream = fs.createReadStream(fullPath);
            fileStream.pipe(res);
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        return errorResponse(res, 500, 'Error downloading file');
    }
};

module.exports = {
    streamFile,
    downloadFile
};
