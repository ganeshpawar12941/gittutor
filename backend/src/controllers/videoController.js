import Video from '../models/Video.js';
import Course from '../models/Course.js';
import { validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { notifyStudentsAboutNewVideo } from './enrollmentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// @desc    Get all videos
// @route   GET /api/videos
// @access  Public
export const getVideos = async (req, res) => {
    try {
        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit'];

        // Loop over removeFields and delete them from reqQuery
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string
        let queryStr = JSON.stringify(reqQuery);

        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        // Finding resource
        let query = Video.find(JSON.parse(queryStr))
            .populate('course', 'title code')
            .populate('uploadedBy', 'name email');

        // Select Fields
        if (req.query.select) {
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
        }

        // Sort
        if (req.query.sort) {
            const sortBy = req.query.sort.split(',').join(' ');
            query = query.sort(sortBy);
        } else {
            query = query.sort('-createdAt');
        }

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const total = await Video.countDocuments(JSON.parse(queryStr));

        query = query.skip(startIndex).limit(limit);

        // Executing query
        const videos = await query;

        // Pagination result
        const pagination = {};

        if (endIndex < total) {
            pagination.next = {
                page: page + 1,
                limit
            };
        }

        if (startIndex > 0) {
            pagination.prev = {
                page: page - 1,
                limit
            };
        }

        res.status(200).json({
            success: true,
            count: videos.length,
            pagination,
            data: videos
        });
    } catch (err) {
        console.error('Get videos error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get single video
// @route   GET /api/videos/:id
// @access  Public
export const getVideo = async (req, res) => {
    try {
        const video = await Video.findById(req.params.id)
            .populate('course', 'title code')
            .populate('uploadedBy', 'name email');

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Increment view count
        video.views += 1;
        await video.save();

        res.status(200).json({
            success: true,
            data: video
        });
    } catch (err) {
        console.error('Get video error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Upload video
// @route   POST /api/videos/upload
// @access  Private/Teacher
export const uploadVideo = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { title, description, duration, course, tags = [] } = req.body;
        const uploadedBy = req.user.id;

        // Check if course exists and user is the teacher of the course
        const courseObj = await Course.findById(course);
        if (!courseObj) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Check if the user is the teacher of the course or an admin
        if (courseObj.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to add videos to this course'
            });
        }

        // Handle file upload
        if (!req.files || !req.files.video) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a video file'
            });
        }

        const videoFile = req.files.video;
        
        // Check file type
        const fileTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        if (!fileTypes.includes(videoFile.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a valid video file (MP4, WebM, or OGG)'
            });
        }

        // Check file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (videoFile.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: 'Video size should be less than 50MB'
            });
        }

        // Create custom filename
        const fileExt = path.extname(videoFile.name);
        const fileName = `video_${Date.now()}${fileExt}`;
        const uploadPath = path.join(__dirname, '../uploads/videos', fileName);

        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(__dirname, '../uploads/videos');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Move the file to uploads directory
        await videoFile.mv(uploadPath);

        // Create video in database
        const video = await Video.create({
            title,
            description,
            url: `/uploads/videos/${fileName}`,
            duration,
            course,
            uploadedBy,
            tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())
        });

        // Populate the video with course and uploadedBy details
        const populatedVideo = await Video.findById(video._id)
            .populate('course', 'title')
            .populate('uploadedBy', 'name');

        // Notify enrolled students about the new video (in background)
        try {
            await notifyStudentsAboutNewVideo(video._id, course, uploadedBy);
        } catch (notifyError) {
            console.error('Error sending notifications:', notifyError);
            // Don't fail the request if notification fails
        }

        res.status(201).json({
            success: true,
            data: populatedVideo
        });
    } catch (err) {
        console.error('Upload video error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error during video upload'
        });
    }
};

// @desc    Update video
// @route   PUT /api/videos/:id
// @access  Private
export const updateVideo = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Make sure user is video uploader or admin
        if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this video'
            });
        }

        // Update video
        video = await Video.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: video
        });
    } catch (err) {
        console.error('Update video error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete video
// @route   DELETE /api/videos/:id
// @access  Private
export const deleteVideo = async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Make sure user is video uploader or admin
        if (video.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this video'
            });
        }

        // Remove video file
        const filePath = path.join(__dirname, '..', '..', video.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove video from course
        await Course.findByIdAndUpdate(video.course, {
            $pull: { videos: video._id }
        });

        // Delete video record
        await video.remove();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error('Delete video error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get videos by course
// @route   GET /api/videos/course/:courseId
// @access  Public
export const getVideosByCourse = async (req, res) => {
    try {
        const videos = await Video.find({ course: req.params.courseId })
            .populate('uploadedBy', 'name email')
            .sort('-createdAt');

        res.status(200).json({
            success: true,
            count: videos.length,
            data: videos
        });
    } catch (err) {
        console.error('Get videos by course error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
