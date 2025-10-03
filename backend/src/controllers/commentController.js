import Comment from '../models/Comment.js';
import Video from '../models/Video.js';
import Course from '../models/Course.js';
import { validationResult } from 'express-validator';
import { notifyTeacherOnNewComment , notifyCommentOwnerOnReply } from '../utils/notification.js';

// @desc    Get comments for a video
// @route   GET /api/comments/video/:videoId
// @access  Public
export const getComments = async (req, res) => {
    try {
        const comments = await Comment.find({ video: req.params.videoId })
            .populate('user', 'name email')
            .sort('timestamp');

        res.status(200).json({
            success: true,
            count: comments.length,
            data: comments
        });
    } catch (err) {
        console.error('Get comments error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Add comment to video
// @route   POST /api/comments
// @access  Private
export const createComment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { content, videoId } = req.body;

        // Check if video exists
        const video = await Video.findById(videoId);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Check if user is enrolled in the course
        const isEnrolled = await Course.exists({
            _id: video.course,
            students: req.user.id
        });

        if (!isEnrolled && req.user.role !== 'admin' && video.uploadedBy.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to comment on this video'
            });
        }

        const comment = await Comment.create({
            content,
            video: videoId,
            user: req.user.id,
        });

        // Populate user details
        await comment.populate('user', 'name email');

        // Notify the teacher/uploader about the new comment (non-blocking)
        try {
            if (video.uploadedBy?.toString() !== req.user.id) {
                await notifyTeacherOnNewComment({
                    teacherId: video.uploadedBy,
                    courseId: video.course,
                    videoId: video._id,
                    commentId: comment._id,
                    commenterName: comment.user?.name || 'Someone'
                });
            }
        } catch (e) {
            console.error('notifyTeacherOnNewComment error:', e);
        }

        res.status(201).json({
            success: true,
            data: comment
        });
    } catch (err) {
        console.error('Add comment error:', err);
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

// @desc    Update comment
// @route   PUT /api/comments/:id
// @access  Private
export const updateComment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Make sure user is comment owner or admin
        if (comment.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this comment'
            });
        }

        // Update comment
        comment.content = req.body.content || comment.content;
        comment.isResolved = req.body.isResolved !== undefined ? req.body.isResolved : comment.isResolved;
        
        await comment.save();

        // Populate user details (Mongoose v6+)
        await comment.populate('user', 'name email');

        res.status(200).json({
            success: true,
            data: comment
        });
    } catch (err) {
        console.error('Update comment error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete comment
// @route   DELETE /api/comments/:id
// @access  Private
export const deleteComment = async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Make sure user is comment owner, video uploader, or admin
        const video = await Video.findById(comment.video);
        const isVideoOwner = video && video.uploadedBy.toString() === req.user.id;
        
        if (comment.user.toString() !== req.user.id && !isVideoOwner && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this comment'
            });
        }

        await comment.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error('Delete comment error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Like a comment
// @route   PUT /api/comments/:id/like
// @access  Private
export const likeComment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user has already liked the comment
        if (comment.likes.includes(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: 'You have already liked this comment'
            });
        }

        comment.likes.push(req.user.id);
        await comment.save();

        res.status(200).json({
            success: true,
            data: comment
        });
    } catch (err) {
        console.error('Like comment error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Reply to a comment
// @route   POST /api/comments/:id/reply
// @access  Private
export const replyToComment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { content } = req.body;

        let comment = await Comment.findById(req.params.id);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        // Check if user is enrolled in the course or is admin/teacher
        const video = await Video.findById(comment.video);
        const course = await Course.findById(video.course);
        
        const isEnrolled = course.students.includes(req.user.id);
        const isTeacherOrAdmin = req.user.role === 'teacher' || req.user.role === 'admin';
        const isVideoOwner = video.uploadedBy.toString() === req.user.id;
        
        if (!isEnrolled && !isTeacherOrAdmin && !isVideoOwner) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to reply to this comment'
            });
        }

        // Add reply
        const reply = {
            content,
            user: req.user.id
        };

        comment.replies.push(reply);
        await comment.save();

        // Populate user details in the reply
        const populatedComment = await Comment.findById(comment._id)
            .populate('replies.user', 'name email');
        
        // Get the newly added reply (last one in the array)
        const newReply = populatedComment.replies[populatedComment.replies.length - 1];

        // Notify original commenter when teacher/video owner/admin replies
        try {
            const isTeacherOrAdmin = req.user.role === 'teacher' || req.user.role === 'admin';
            const video = await Video.findById(comment.video);
            const isVideoOwner = video && video.uploadedBy?.toString() === req.user.id;
            if ((isTeacherOrAdmin || isVideoOwner) && comment.user?.toString() !== req.user.id) {
                const replierName = newReply?.user?.name || 'Instructor';
                await notifyCommentOwnerOnReply({
                    recipientUserId: comment.user,
                    courseId: video.course,
                    videoId: video._id,
                    commentId: comment._id,
                    replierName
                });
            }
        } catch (e) {
            console.error('notifyCommentOwnerOnReply error:', e);
        }

        res.status(201).json({
            success: true,
            data: newReply
        });
    } catch (err) {
        console.error('Add reply error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
