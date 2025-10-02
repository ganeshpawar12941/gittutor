import Video from '../models/Video.js';
import Course from '../models/Course.js';
import { validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { notifyStudentsAboutNewVideo } from './enrollmentController.js';
import { uploadToS3, deleteFromS3, getSignedGetUrl } from '../utils/awsS3.js';
import { cloudinary } from '../utils/cloudinary.js';
import ApiError from '../utils/ApiError.js';
import { unlink } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @desc    Get all videos with filtering, sorting, and pagination
 * @route   GET /api/videos
 * @access  Public
 */
export const getVideos = async (req, res, next) => {
    try {
        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude from filtering
        const removeFields = ['select', 'sort', 'page', 'limit'];
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string and add $ to operators
        let queryStr = JSON.stringify(reqQuery);
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        // Base query with filtering
        let query = Video.find(JSON.parse(queryStr))
            .populate('course', 'title code')
            .populate('uploadedBy', 'name email');

        // Field selection
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        // Sorting
        const sortBy = req.query.sort ? 
            req.query.sort.split(',').join(' ') : 
            '-createdAt';
        query = query.sort(sortBy);

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const total = await Video.countDocuments(JSON.parse(queryStr));

        query = query.skip(startIndex).limit(limit);

        // Execute query
        const videos = await query;

        // Build pagination result
        const pagination = {};
        const endIndex = page * limit;

        if (endIndex < total) {
            pagination.next = { page: page + 1, limit };
        }

        if (startIndex > 0) {
            pagination.prev = { page: page - 1, limit };
        }

        res.status(200).json({
            success: true,
            count: videos.length,
            pagination,
            data: videos
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get single video by ID and increment view count
 * @route   GET /api/videos/:id
 * @access  Public
 */
export const getVideo = async (req, res, next) => {
    try {
        const video = await Video.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        )
        .populate('course', 'title code')
        .populate('uploadedBy', 'name email');

        if (!video) {
            throw new ApiError(404, 'Video not found');
        }

        // Attach a signed URL for secure playback/download (expires in 1 hour)
        const signedUrl = video?.s3Key ? await getSignedGetUrl(video.s3Key, 3600) : undefined;

        res.status(200).json({
            success: true,
            data: video,
            signedUrl
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return next(new ApiError(404, 'Video not found'));
        }
        next(error);
    }
};

/**
 * @desc    Upload video
 * @route   POST /api/videos/upload
 * @access  Private/Teacher
 */
export const uploadVideo = async (req, res, next) => {
    try {
        const { title, description, course, duration, isFree, order, thumbnail } = req.body;

        // Check if course exists and populate teacher
        const courseExists = await Course.findById(course).populate('teacher', 'id');
        if (!courseExists) {
            console.error(`Course not found with ID: ${course}`);
            throw new ApiError(404, 'Course not found');
        }

        // Debug logging
        console.log('Course Teacher ID:', courseExists.teacher?._id || 'No teacher');
        console.log('Request User ID:', req.user?.id);

        // Check if user is the teacher of the course
        if (!courseExists.teacher || courseExists.teacher._id.toString() !== req.user.id) {
            console.error(`User ${req.user?.id} is not authorized to add videos to course ${course}`);
            throw new ApiError(403, 'Not authorized to add videos to this course');
        }

        if (!req.file) {
            throw new ApiError(400, 'Please upload a video file');
        }

        let uploadResult;
        let uploadedThumbnailUrl = '';
        try {
            // Upload to S3
            uploadResult = await uploadToS3(req.file, `courses/${course}/videos`);

            // If a thumbnail file is provided, upload to Cloudinary
            if (req.thumbnailFile?.path) {
                try {
                    const thumbRes = await cloudinary.uploader.upload(req.thumbnailFile.path, {
                        folder: 'gittutor/thumbnails',
                        resource_type: 'image',
                        transformation: [{ width: 800, height: 450, crop: 'fill' }],
                        quality: 'auto:good'
                    });
                    uploadedThumbnailUrl = thumbRes.secure_url;
                } catch (thumbErr) {
                    console.error('Thumbnail upload failed:', thumbErr);
                    // Continue without thumbnail
                } finally {
                    // Cleanup temp thumbnail regardless of success/failure
                    try {
                        if (req.thumbnailFile?.path) await unlink(req.thumbnailFile.path);
                    } catch (e) {
                        console.error('Error cleaning up temp thumbnail:', e);
                    }
                }
            }

            // Create video record in database
            const video = await Video.create({
                title,
                description,
                course,
                duration,
                isFree: isFree || false,
                order: order || 0,
                url: uploadResult.location,
                s3Key: uploadResult.key,
                bucket: uploadResult.bucket,
                thumbnail: uploadedThumbnailUrl || thumbnail || '',
                uploadedBy: req.user.id,
                size: uploadResult.size,
                mimeType: uploadResult.mimetype || req.file.mimetype,
                durationInSeconds: duration || 0
            });

            // Populate the course and uploadedBy fields
            const populatedVideo = await Video.findById(video._id)
                .populate('course', 'title code')
                .populate('uploadedBy', 'name email');

            // Notify enrolled students about the new video (non-blocking)
            notifyStudentsAboutNewVideo(video._id, course, req.user.id).catch(err => {
                console.error('Error sending notifications:', err);
            });

            // Generate a signed URL for this video (expires in 1 hour)
            const signedUrl = video.s3Key ? await getSignedGetUrl(video.s3Key, 3600) : undefined;

            res.status(201).json({
                success: true,
                data: populatedVideo,
                signedUrl
            });
        } catch (error) {
            // If there's an error after S3 upload, clean up the S3 file
            if (uploadResult?.key) {
                await deleteFromS3(uploadResult.key).catch(console.error);
            }
            throw error;
        }
    } catch (error) {
        // Clean up the uploaded file if it exists
        if (req.file?.path) {
            try {
                await unlink(req.file.path);
            } catch (cleanupErr) {
                console.error('Error cleaning up temp file:', cleanupErr);
            }
        }
        // Clean up thumbnail temp file if present
        if (req.thumbnailFile?.path) {
            try {
                await unlink(req.thumbnailFile.path);
            } catch (cleanupErr) {
                console.error('Error cleaning up temp thumbnail:', cleanupErr);
            }
        }
        next(error);
    }
};

/**
 * @desc    Update video details
 * @route   PUT /api/videos/:id
 * @access  Private
 */
export const updateVideo = async (req, res, next) => {
    try {
        const { title, description, duration, isFree, order, isPublished, thumbnail } = req.body || {};

        // Find video and check existence
        const video = await Video.findById(req.params.id);
        if (!video) {
            throw new ApiError(404, 'Video not found');
        }

        // Verify user is the course teacher
        const course = await Course.findById(video.course);
        if (!course) {
            throw new ApiError(404, 'Associated course not found');
        }

        if (!course.teacher || course.teacher.toString() !== req.user.id) {
            throw new ApiError(403, 'Not authorized to update this video');
        }

        // Prepare update object with only provided fields
        const updateFields = { updatedAt: Date.now() };
        if (title !== undefined) updateFields.title = title;
        if (description !== undefined) updateFields.description = description;
        if (duration !== undefined) updateFields.duration = duration;
        if (isFree !== undefined) updateFields.isFree = isFree;
        if (order !== undefined) updateFields.order = order;
        if (isPublished !== undefined) updateFields.isPublished = isPublished;
        if (thumbnail !== undefined) updateFields.thumbnail = thumbnail;

        // If a thumbnail file is attached via form-data, upload to Cloudinary
        if (req.thumbnailFile?.path) {
            try {
                const thumbRes = await cloudinary.uploader.upload(req.thumbnailFile.path, {
                    folder: 'gittutor/thumbnails',
                    resource_type: 'image',
                    transformation: [{ width: 800, height: 450, crop: 'fill' }],
                    quality: 'auto:good'
                });
                updateFields.thumbnail = thumbRes.secure_url;
            } catch (thumbErr) {
                console.error('Thumbnail upload (update) failed:', thumbErr);
            } finally {
                try {
                    await unlink(req.thumbnailFile.path);
                } catch (cleanupErr) {
                    console.error('Error cleaning up temp thumbnail (update):', cleanupErr);
                }
            }
        }

        // Update video
        const updatedVideo = await Video.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        )
        .populate('course', 'title code')
        .populate('uploadedBy', 'name email');

        if (!updatedVideo) {
            throw new ApiError(500, 'Failed to update video');
        }

        res.status(200).json({
            success: true,
            data: updatedVideo
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete a video and its associated S3 file
 * @route   DELETE /api/videos/:id
 * @access  Private
 */
export const deleteVideo = async (req, res, next) => {
    try {
        // Find video with course populated for permission check
        const video = await Video.findById(req.params.id).populate('course', 'teacher');
        
        if (!video) {
            throw new ApiError(404, 'Video not found');
        }

        // Verify user is the course teacher or admin
        if (!video.course.teacher || (video.course.teacher.toString() !== req.user.id && req.user.role !== 'admin')) {
            throw new ApiError(403, 'Not authorized to delete this video');
        }

        // Delete from S3 if it exists
        if (video.s3Key) {
            await deleteFromS3(video.s3Key).catch(err => {
                console.error('Error deleting from S3:', err);
                // Continue with database deletion even if S3 deletion fails
            });
        }

        // Delete from database
        await Video.deleteOne({ _id: video._id });

        res.status(200).json({
            success: true,
            data: { id: video._id }
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return next(new ApiError(404, 'Invalid video ID'));
        }
        next(error);
    }
};

/**
 * @desc    Get all videos for a specific course
 * @route   GET /api/videos/course/:courseId
 * @access  Public
 */
export const getVideosByCourse = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        
        // Check if course exists
        const course = await Course.findById(courseId);
        if (!course) {
            throw new ApiError(404, 'Course not found');
        }

        // Build query
        const query = { course: courseId };
        
        // Non-teachers and unauthenticated users only see published videos
        const isInstructor = req.user && 
            (req.user.role === 'admin' || 
             (course.teacher && course.teacher.toString() === req.user.id));
        
        if (!isInstructor) {
            query.isPublished = true;
        }

        // Get videos with optional sorting
        const sortBy = req.query.sort || 'order';
        const videos = await Video.find(query)
            .sort(sortBy)
            .populate('uploadedBy', 'name email')
            .select('-s3Key -bucket'); // Exclude sensitive fields

        res.status(200).json({
            success: true,
            count: videos.length,
            data: videos
        });
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return next(new ApiError(400, 'Invalid course ID'));
        }
        next(error);
    }
};
