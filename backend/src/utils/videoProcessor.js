import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { v4 as uuidv4 } from 'uuid';

// Configure ffmpeg path if needed
if (process.env.FFMPEG_PATH) {
    ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Get video metadata using ffprobe
 * @param {string} filePath - Path to the video file
 * @returns {Promise<Object>} Video metadata
 */
export const getVideoMetadata = async (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(new Error('Could not retrieve video metadata'));
            
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
            
            if (!videoStream) return reject(new Error('No video stream found'));
            
            resolve({
                format: metadata.format.format_name,
                duration: parseFloat(metadata.format.duration) || 0,
                size: metadata.format.size || 0,
                video: {
                    codec: videoStream.codec_name,
                    width: videoStream.width,
                    height: videoStream.height,
                    frameRate: videoStream.avg_frame_rate,
                },
                audio: audioStream ? {
                    codec: audioStream.codec_name,
                    channels: audioStream.channels,
                    sampleRate: audioStream.sample_rate,
                } : null
            });
        });
    });
};

/**
 * Generate a thumbnail from a video file
 * @param {string} filePath - Path to the video file
 * @param {Object} options - Thumbnail options
 * @returns {Promise<string>} Path to the generated thumbnail
 */
export const generateThumbnail = async (filePath, options = {}) => {
    return new Promise((resolve, reject) => {
        const {
            time = 1,
            folder = path.join(path.dirname(filePath), 'thumbnails'),
            width = 320,
            height = 180
        } = options;
        
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
        
        const thumbnailPath = path.join(folder, `${uuidv4()}.jpg`);
        
        ffmpeg(filePath)
            .on('error', reject)
            .on('end', () => resolve(thumbnailPath))
            .screenshots({
                timestamps: [time],
                filename: path.basename(thumbnailPath),
                folder: path.dirname(thumbnailPath),
                size: `${width}x${height}`,
                quality: 80
            });
    });
};

/**
 * Convert video to different format/resolution
 * @param {string} filePath - Path to the source video file
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} Conversion result
 */
export const convertVideo = async (filePath, options = {}) => {
    return new Promise((resolve, reject) => {
        const {
            format = 'mp4',
            outputFolder = path.dirname(filePath)
        } = options;
        
        if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });
        
        const outputPath = path.join(outputFolder, `${uuidv4()}.${format}`);
        const command = ffmpeg(filePath);
        
        command.videoCodec('libx264')
            .format(format)
            .outputOptions([
                '-preset fast',
                '-movflags +faststart',
                '-pix_fmt yuv420p'
            ])
            .audioCodec('aac')
            .audioBitrate(128)
            .audioChannels(2)
            .audioFrequency(44100)
            .save(outputPath)
            .on('error', reject)
            .on('end', () => resolve({ path: outputPath }));
    });
};

