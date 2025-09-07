const Course = require('../models/Course');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all courses
// @route   GET /api/courses
// @access  Public
exports.getCourses = async (req, res) => {
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
exports.getCourse = async (req, res) => {
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
// @access  Private/Teacher
exports.createCourse = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Add user to req.body
        req.body.teacher = req.user.id;

        const course = await Course.create(req.body);

        res.status(201).json({
            success: true,
            data: course
        });
    } catch (err) {
        console.error('Create course error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update course
// @route   PUT /api/courses/:id
// @access  Private
exports.updateCourse = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Make sure user is course owner or admin
        if (course.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this course'
            });
        }

        course = await Course.findByIdAndUpdate(req.params.id, req.body, {
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
// @access  Private
exports.deleteCourse = async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Make sure user is course owner or admin
        if (course.teacher.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this course'
            });
        }

        await course.remove();

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
exports.enrollInCourse = async (req, res) => {
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
exports.getCourseStudents = async (req, res) => {
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
