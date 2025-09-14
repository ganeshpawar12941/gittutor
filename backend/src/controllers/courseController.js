import Course from '../models/Course.js';
import User from '../models/User.js';
import { validationResult } from 'express-validator';
import { cloudinary } from '../utils/cloudinary.js';

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
export const getCourses = async (req, res) => {
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
        let query = Course.find(JSON.parse(queryStr)).populate('teacher', 'name email');

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
        const total = await Course.countDocuments(JSON.parse(queryStr));

        query = query.skip(startIndex).limit(limit);

        // Executing query
        const courses = await query;

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
            count: courses.length,
            pagination,
            data: courses
        });
    } catch (err) {
        console.error('Get courses error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get single course
// @route   GET /api/courses/:id
// @access  Public
export const getCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id)
            .populate('teacher', 'name email')
            .populate('students', 'name email');

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        res.status(200).json({
            success: true,
            data: course
        });
    } catch (err) {
        console.error('Get course error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Create course
// @route   POST /api/courses
// @access  Private/Admin
export const createCourse = async (req, res) => {
    try {
        // Only allow admins to create courses
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can create courses'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there are validation errors and a file was uploaded, delete it
            if (req.file) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(400).json({ errors: errors.array() });
        }

        // Prepare course data
        const courseData = {
            ...req.body,
            teacher: req.user.id
        };

        // If thumbnail was uploaded, add it to course data
        if (req.file) {
            courseData.thumbnail = {
                url: req.file.path,
                public_id: req.file.filename
            };
        }

        const course = await Course.create(courseData);

        res.status(201).json({
            success: true,
            data: course
        });
    } catch (err) {
        console.error('Create course error:', err);
        
        // If there was a file uploaded but an error occurred, try to remove it from Cloudinary
        if (req.file) {
            try {
                await cloudinary.uploader.destroy(req.file.filename);
            } catch (cloudinaryErr) {
                console.error('Error cleaning up uploaded file:', cloudinaryErr);
            }
        }
        
        let message = 'Server error';
        if (err.name === 'ValidationError') {
            message = Object.values(err.errors).map(val => val.message).join(', ');
        } else if (err.code === 11000) {
            message = 'Duplicate field value entered';
        } else if (err.message.includes('timed out')) {
            message = 'Request to file storage service timed out';
        }
        
        res.status(500).json({
            success: false,
            message: message,
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private/Admin
export const updateCourse = async (req, res) => {
    try {
        // Only allow admins to update courses
        if (req.user.role !== 'admin') {
            // Cleanup uploaded file if any
            if (req.file) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(403).json({
                success: false,
                message: 'Only administrators can update courses'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // Cleanup uploaded file if there are validation errors
            if (req.file) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(400).json({ errors: errors.array() });
        }

        let course = await Course.findById(req.params.id);

        if (!course) {
            // Cleanup uploaded file if course not found
            if (req.file) {
                await cloudinary.uploader.destroy(req.file.filename);
            }
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Prepare update data
        const updateData = { ...req.body };
        
        // Handle thumbnail update if a new one was uploaded
        if (req.file) {
            // Delete old thumbnail if it exists and is not the default
            if (course.thumbnail && course.thumbnail.public_id && 
                !course.thumbnail.public_id.startsWith('default-')) {
                await cloudinary.uploader.destroy(course.thumbnail.public_id);
            }
            
            updateData.thumbnail = {
                url: req.file.path,
                public_id: req.file.filename
            };
        }

        course = await Course.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: course
        });
    } catch (err) {
        console.error('Update course error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete course
// @route   DELETE /api/courses/:id
// @access  Private/Admin
export const deleteCourse = async (req, res) => {
    try {
        // Only allow admins to delete courses
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only administrators can delete courses'
            });
        }

        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Delete thumbnail from Cloudinary if it exists and is not the default
        if (course.thumbnail && course.thumbnail.public_id && 
            !course.thumbnail.public_id.startsWith('default-')) {
            try {
                await cloudinary.uploader.destroy(course.thumbnail.public_id);
            } catch (err) {
                console.error('Error deleting thumbnail from Cloudinary:', err);
                // Continue with course deletion even if thumbnail deletion fails
            }
        }

        await Course.deleteOne({ _id: course._id });

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error('Delete course error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Enroll in course
// @route   PUT /api/courses/:id/enroll
// @access  Private
export const enrollInCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Check if already enrolled
        if (course.students.includes(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: 'Already enrolled in this course'
            });
        }

        // Add to course students
        course.students.push(req.user.id);
        await course.save();

        // Add course to user's enrolled courses
        await User.findByIdAndUpdate(
            req.user.id,
            { $addToSet: { enrolledCourses: course._id } },
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Successfully enrolled in course'
        });
    } catch (err) {
        console.error('Enroll in course error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get course students
// @route   GET /api/courses/:id/students
// @access  Private
export const getCourseStudents = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).populate('students', 'name email');

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Make sure user is course teacher or admin
        if (course.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to view this course\'s students'
            });
        }

        res.status(200).json({
            success: true,
            count: course.students.length,
            data: course.students
        });
    } catch (err) {
        console.error('Get course students error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
