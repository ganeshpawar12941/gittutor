const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        
        res.status(200).json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error('Get user error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, password, role } = req.body;

        // Check if user exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this email'
            });
        }

        // Create user
        user = await User.create({
            name,
            email,
            password,
            role: role || 'student',
            isEmailVerified: true // Admin created users are auto-verified
        });

        // Remove password from response
        user.password = undefined;

        res.status(201).json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error('Create user error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private
exports.updateUser = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, email, role } = req.body;

        // Build user object
        const userFields = {};
        if (name) userFields.name = name;
        if (email) userFields.email = email;
        if (role && req.user.role === 'admin') userFields.role = role;

        let user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Make sure user is updating their own profile or is admin
        if (user._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: userFields },
            { new: true, runValidators: true }
        ).select('-password');

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (err) {
        console.error('Update user error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent deleting own account via this route
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account via this route'
            });
        }

        await user.remove();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error('Delete user error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Enroll in a course
// @route   POST /api/users/enroll/:courseId
// @access  Private
exports.enrollInCourse = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const courseId = req.params.courseId;

        // Check if already enrolled
        if (user.enrolledCourses.includes(courseId)) {
            return res.status(400).json({
                success: false,
                message: 'Already enrolled in this course'
            });
        }

        user.enrolledCourses.push(courseId);
        await user.save();

        res.status(200).json({
            success: true,
            data: user.enrolledCourses
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

// @desc    Get enrolled courses
// @route   GET /api/users/my-courses
// @access  Private
exports.getEnrolledCourses = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('enrolledCourses');
        
        res.status(200).json({
            success: true,
            count: user.enrolledCourses.length,
            data: user.enrolledCourses
        });
    } catch (err) {
        console.error('Get enrolled courses error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
