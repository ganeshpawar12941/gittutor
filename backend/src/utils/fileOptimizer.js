const sharp = require('sharp');
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminWebp = require('imagemin-webp');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { errorResponse } = require('./apiResponse');

/**
 * Optimize an image file
 * @param {string} filePath - Path to the image file
 * @param {Object} options - Optimization options
 * @param {number} [options.quality=80] - Image quality (1-100)
 * @param {number} [options.width] - Resize width (maintains aspect ratio)
 * @param {number} [options.height] - Resize height (maintains aspect ratio)
 * @param {string} [options.format] - Output format (jpeg, png, webp)
 * @returns {Promise<string>} - Path to the optimized image
 */
const optimizeImage = async (filePath, options = {}) => {
    try {
        const {
            quality = 80,
            width,
            height,
            format
        } = options;

        // Ensure the output directory exists
        const outputDir = path.join(path.dirname(filePath), 'optimized');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate output filename
        const ext = format || path.extname(filePath).replace('.', '') || 'jpg';
        const outputFile = path.join(outputDir, `${uuidv4()}.${ext}`);

        // Create sharp instance
        let image = sharp(filePath);

        // Resize if dimensions are provided
        if (width || height) {
            image = image.resize({
                width: width || null,
                height: height || null,
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Convert to the specified format with quality settings
        switch (ext.toLowerCase()) {
            case 'jpeg':
            case 'jpg':
                await image.jpeg({ quality, mozjpeg: true }).toFile(outputFile);
                break;
            case 'png':
                await image.png({ quality, compressionLevel: 9 }).toFile(outputFile);
                break;
            case 'webp':
                await image.webp({ quality }).toFile(outputFile);
                break;
            default:
                // For unsupported formats, just copy the file
                fs.copyFileSync(filePath, outputFile);
        }

        // Further optimize with imagemin
        if (['jpeg', 'jpg', 'png', 'webp'].includes(ext.toLowerCase())) {
            const plugins = [];
            
            if (['jpeg', 'jpg'].includes(ext.toLowerCase())) {
                plugins.push(imageminMozjpeg({ quality }));
                plugins.push(imageminJpegtran({ progressive: true }));
            } else if (ext.toLowerCase() === 'png') {
                plugins.push(imageminPngquant({
                    quality: [0.6, 0.8]
                }));
            } else if (ext.toLowerCase() === 'webp') {
                plugins.push(imageminWebp({ quality }));
            }

            if (plugins.length > 0) {
                await imagemin([outputFile], {
                    destination: outputDir,
                    plugins: plugins
                });
            }
        }

        return outputFile;
    } catch (error) {
        console.error('Error optimizing image:', error);
        throw new Error('Failed to optimize image');
    }
};

/**
 * Compress a PDF file
 * @param {string} filePath - Path to the PDF file
 * @param {Object} options - Compression options
 * @returns {Promise<string>} - Path to the compressed PDF
 */
const compressPdf = async (filePath, options = {}) => {
    // This is a placeholder for PDF compression logic
    // In a real application, you would use a library like ghostscript or a cloud service
    // For now, we'll just return the original file path
    return filePath;
};

/**
 * Optimize a video file
 * @param {string} filePath - Path to the video file
 * @param {Object} options - Optimization options
 * @returns {Promise<string>} - Path to the optimized video
 */
const optimizeVideo = async (filePath, options = {}) => {
    // This is a placeholder for video optimization logic
    // In a real application, you would use a library like ffmpeg or a cloud service
    // For now, we'll just return the original file path
    return filePath;
};

/**
 * Optimize a file based on its type
 * @param {string} filePath - Path to the file
 * @param {Object} options - Optimization options
 * @returns {Promise<string>} - Path to the optimized file
 */
const optimizeFile = async (filePath, options = {}) => {
    try {
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        
        switch (ext) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'webp':
                return await optimizeImage(filePath, options);
            case 'pdf':
                return await compressPdf(filePath, options);
            case 'mp4':
            case 'mov':
            case 'avi':
                return await optimizeVideo(filePath, options);
            default:
                // For unsupported file types, return the original path
                return filePath;
        }
    } catch (error) {
        console.error('Error optimizing file:', error);
        throw new Error('Failed to optimize file');
    }
};

/**
 * Generate thumbnails for images and videos
 * @param {string} filePath - Path to the file
 * @param {Object} options - Thumbnail options
 * @returns {Promise<string>} - Path to the generated thumbnail
 */
const generateThumbnail = async (filePath, options = {}) => {
    try {
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const { width = 300, height = 200 } = options;
        
        // Create thumbnails directory if it doesn't exist
        const thumbnailsDir = path.join(path.dirname(filePath), 'thumbnails');
        if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
        }
        
        const thumbnailPath = path.join(thumbnailsDir, `${uuidv4()}.jpg`);
        
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            // Generate thumbnail for images
            await sharp(filePath)
                .resize(width, height, {
                    fit: 'cover',
                    position: 'center'
                })
                .jpeg({ quality: 80 })
                .toFile(thumbnailPath);
        } else if (['mp4', 'mov', 'avi'].includes(ext)) {
            // Generate thumbnail for videos (placeholder)
            // In a real application, you would use ffmpeg to extract a frame
            // For now, we'll just create a placeholder
            await sharp({
                create: {
                    width,
                    height,
                    channels: 3,
                    background: { r: 200, g: 200, b: 200 }
                }
            })
            .composite([{
                input: Buffer.from(
                    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#f0f0f0"/>
                        <text x="50%" y="50%" font-family="Arial" font-size="16" text-anchor="middle" dy=".3em" fill="#666">
                            Video Thumbnail
                        </text>
                    </svg>`
                ),
                top: 0,
                left: 0
            }])
            .jpeg()
            .toFile(thumbnailPath);
        } else {
            // For unsupported file types, create a generic thumbnail
            await sharp({
                create: {
                    width,
                    height,
                    channels: 3,
                    background: { r: 200, g: 200, b: 200 }
                }
            })
            .jpeg()
            .toFile(thumbnailPath);
        }
        
        return thumbnailPath;
    } catch (error) {
        console.error('Error generating thumbnail:', error);
        throw new Error('Failed to generate thumbnail');
    }
};

module.exports = {
    optimizeImage,
    compressPdf,
    optimizeVideo,
    optimizeFile,
    generateThumbnail
};
