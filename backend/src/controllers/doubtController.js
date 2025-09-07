const Doubt = require('../models/Doubt');
const Course = require('../models/Course');
const Video = require('../models/Video');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all doubts
// @route   GET /api/doubts
// @access  Private
exports.getDoubts = async (req, res) => {
    try {
        // Copy req.query
        const reqQuery = { ...req.query };

        // Fields to exclude
        const removeFields = ['select', 'sort', 'page', 'limit'];

        // Loop over removeFields and delete them from reqQuery
        removeFields.forEach(param => delete reqQuery[param]);

        // For students, only show their own doubts or doubts in their enrolled courses
        if (req.user.role === 'student') {
            // Get courses the student is enrolled in
            const user = await User.findById(req.user.id).populate('enrolledCourses');
            const enrolledCourseIds = user.enrolledCourses.map(course => course._id);
            
            // Only show doubts from enrolled courses or doubts asked by the student
            reqQuery.$or = [
                { course: { $in: enrolledCourseIds } },
                { askedBy: req.user.id }
            ];
        }
        // For teachers, only show doubts from courses they teach
        else if (req.user.role === 'teacher') {
            // Get courses taught by the teacher
            const courses = await Course.find({ teacher: req.user.id });
            const courseIds = courses.map(course => course._id);
            
            reqQuery.course = { $in: courseIds };
        }

        // Create query string
        let queryStr = JSON.stringify(reqQuery);

        // Create operators ($gt, $gte, etc)
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

        // Finding resource
        let query = Doubt.find(JSON.parse(queryStr))
            .populate('course', 'title code')
            .populate('video', 'title')
            .populate('askedBy', 'name email')
            .populate('answers.answeredBy', 'name email');

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
        const total = await Doubt.countDocuments(JSON.parse(queryStr));

        query = query.skip(startIndex).limit(limit);

        // Executing query
        const doubts = await query;

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
            count: doubts.length,
            pagination,
            data: doubts
        });
    } catch (err) {
        console.error('Get doubts error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Get single doubt
// @route   GET /api/doubts/:id
// @access  Private
exports.getDoubt = async (req, res) => {
    try {
        const doubt = await Doubt.findById(req.params.id)
            .populate('course', 'title code')
            .populate('video', 'title')
            .populate('askedBy', 'name email')
            .populate('answers.answeredBy', 'name email');

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Check if user has access to this doubt
        if (doubt.askedBy._id.toString() !== req.user.id) {
            // For students, check if they are in the same course
            if (req.user.role === 'student') {
                const user = await User.findById(req.user.id);
                const hasAccess = user.enrolledCourses.some(courseId => 
                    courseId.toString() === doubt.course._id.toString()
                );
                
                if (!hasAccess) {
                    return res.status(401).json({
                        success: false,
                        message: 'Not authorized to access this doubt'
                    });
                }
            }
            // For teachers, check if they teach the course
            else if (req.user.role === 'teacher') {
                const course = await Course.findOne({
                    _id: doubt.course,
                    teacher: req.user.id
                });
                
                if (!course) {
                    return res.status(401).json({
                        success: false,
                        message: 'Not authorized to access this doubt'
                    });
                }
            }
            // Admins can access all doubts
            else if (req.user.role !== 'admin') {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized to access this doubt'
                });
            }
        }

        res.status(200).json({
            success: true,
            data: doubt
        });
    } catch (err) {
        console.error('Get doubt error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Create doubt
// @route   POST /api/doubts
// @access  Private
exports.createDoubt = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, description, courseId, videoId, tags } = req.body;

        // Check if course exists and user is enrolled (for students)
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // For students, check if they are enrolled in the course
        if (req.user.role === 'student') {
            const isEnrolled = course.students.some(studentId => 
                studentId.toString() === req.user.id
            );
            
            if (!isEnrolled) {
                return res.status(401).json({
                    success: false,
                    message: 'You must be enrolled in this course to ask doubts'
                });
            }
        }
        // For teachers, check if they teach the course
        else if (req.user.role === 'teacher' && course.teacher.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to ask doubts in this course'
            });
        }

        // Check if video exists and belongs to the course (if provided)
        if (videoId) {
            const video = await Video.findOne({
                _id: videoId,
                course: courseId
            });

            if (!video) {
                return res.status(400).json({
                    success: false,
                    message: 'Video not found in this course'
                });
            }
        }

        // Create doubt
        const doubt = await Doubt.create({
            title,
            description,
            course: courseId,
            video: videoId,
            askedBy: req.user.id,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        });

        // Populate the created doubt
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('course', 'title code')
            .populate('video', 'title')
            .populate('askedBy', 'name email');

        // TODO: Send notification to course teacher

        res.status(201).json({
            success: true,
            data: populatedDoubt
        });
    } catch (err) {
        console.error('Create doubt error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Course or video not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update doubt
// @route   PUT /api/doubts/:id
// @access  Private
exports.updateDoubt = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        let doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Make sure user is the one who asked the doubt or admin
        if (doubt.askedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this doubt'
            });
        }

        // Update doubt
        doubt.title = req.body.title || doubt.title;
        doubt.description = req.body.description || doubt.description;
        doubt.status = req.body.status || doubt.status;
        doubt.tags = req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : doubt.tags;
        
        await doubt.save();

        // Populate the updated doubt
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('course', 'title code')
            .populate('video', 'title')
            .populate('askedBy', 'name email')
            .populate('answers.answeredBy', 'name email');

        res.status(200).json({
            success: true,
            data: populatedDoubt
        });
    } catch (err) {
        console.error('Update doubt error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete doubt
// @route   DELETE /api/doubts/:id
// @access  Private
exports.deleteDoubt = async (req, res) => {
    try {
        const doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Make sure user is the one who asked the doubt or admin
        if (doubt.askedBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this doubt'
            });
        }

        await doubt.remove();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error('Delete doubt error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Add answer to doubt
// @route   POST /api/doubts/:id/answers
// @access  Private
exports.addAnswer = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { content } = req.body;

        let doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Check if user has access to answer this doubt
        // For students, they can only answer if they are in the same course
        if (req.user.role === 'student') {
            const user = await User.findById(req.user.id);
            const hasAccess = user.enrolledCourses.some(courseId => 
                courseId.toString() === doubt.course.toString()
            );
            
            if (!hasAccess) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized to answer this doubt'
                });
            }
        }
        // For teachers, they can only answer if they teach the course
        else if (req.user.role === 'teacher') {
            const course = await Course.findOne({
                _id: doubt.course,
                teacher: req.user.id
            });
            
            if (!course) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized to answer this doubt'
                });
            }
        }

        // Create answer
        const answer = {
            content,
            answeredBy: req.user.id
        };

        doubt.answers.push(answer);
        
        // If the answer is from a teacher and the doubt was open, mark it as in-progress
        if (req.user.role === 'teacher' && doubt.status === 'open') {
            doubt.status = 'in-progress';
        }
        
        await doubt.save();

        // Populate the answer with user details
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('answers.answeredBy', 'name email');
        
        // Get the newly added answer (last one in the array)
        const newAnswer = populatedDoubt.answers[populatedDoubt.answers.length - 1];

        // TODO: Send notification to the user who asked the doubt

        res.status(201).json({
            success: true,
            data: newAnswer
        });
    } catch (err) {
        console.error('Add answer error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Update answer
// @route   PUT /api/doubts/:id/answers/:answerId
// @access  Private
exports.updateAnswer = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { content } = req.body;

        let doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Find the answer
        const answerIndex = doubt.answers.findIndex(
            answer => answer._id.toString() === req.params.answerId
        );

        if (answerIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Answer not found'
            });
        }

        // Make sure user is the one who answered or admin
        if (doubt.answers[answerIndex].answeredBy.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this answer'
            });
        }

        // Update answer
        doubt.answers[answerIndex].content = content || doubt.answers[answerIndex].content;
        
        await doubt.save();

        // Populate the updated answer with user details
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('answers.answeredBy', 'name email');
        
        const updatedAnswer = populatedDoubt.answers.find(
            answer => answer._id.toString() === req.params.answerId
        );

        res.status(200).json({
            success: true,
            data: updatedAnswer
        });
    } catch (err) {
        console.error('Update answer error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Delete answer
// @route   DELETE /api/doubts/:id/answers/:answerId
// @access  Private
exports.deleteAnswer = async (req, res) => {
    try {
        let doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Find the answer
        const answerIndex = doubt.answers.findIndex(
            answer => answer._id.toString() === req.params.answerId
        );

        if (answerIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Answer not found'
            });
        }

        // Make sure user is the one who answered, admin, or the teacher of the course
        const isAnswerOwner = doubt.answers[answerIndex].answeredBy.toString() === req.user.id;
        let isCourseTeacher = false;
        
        if (!isAnswerOwner && req.user.role !== 'admin') {
            const course = await Course.findOne({
                _id: doubt.course,
                teacher: req.user.id
            });
            
            isCourseTeacher = !!course;
            
            if (!isCourseTeacher) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized to delete this answer'
                });
            }
        }

        // Remove answer
        doubt.answers.splice(answerIndex, 1);
        
        // If there are no more answers and the doubt was in-progress, set it back to open
        if (doubt.answers.length === 0 && doubt.status === 'in-progress') {
            doubt.status = 'open';
        }
        
        await doubt.save();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (err) {
        console.error('Delete answer error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Mark answer as accepted
// @route   PUT /api/doubts/:id/answers/:answerId/accept
// @access  Private
exports.acceptAnswer = async (req, res) => {
    try {
        let doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Find the answer
        const answerIndex = doubt.answers.findIndex(
            answer => answer._id.toString() === req.params.answerId
        );

        if (answerIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Answer not found'
            });
        }

        // Make sure user is the one who asked the doubt
        if (doubt.askedBy.toString() !== req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to accept this answer'
            });
        }

        // Mark answer as accepted
        doubt.answers[answerIndex].isAccepted = true;
        
        // Mark doubt as resolved
        doubt.status = 'resolved';
        doubt.isResolved = true;
        doubt.resolvedAt = Date.now();
        doubt.resolvedBy = req.user.id;
        
        await doubt.save();

        // Populate the updated doubt with user details
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('answers.answeredBy', 'name email')
            .populate('resolvedBy', 'name email');

        // TODO: Send notification to the user who provided the answer

        res.status(200).json({
            success: true,
            data: populatedDoubt.answers[answerIndex]
        });
    } catch (err) {
        console.error('Accept answer error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// @desc    Vote on answer
// @route   PUT /api/doubts/:id/answers/:answerId/vote
// @access  Private
exports.voteAnswer = async (req, res) => {
    try {
        const { vote } = req.body; // 'up' or 'down'

        if (!['up', 'down'].includes(vote)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid vote type (up or down)'
            });
        }

        let doubt = await Doubt.findById(req.params.id);

        if (!doubt) {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }

        // Find the answer
        const answerIndex = doubt.answers.findIndex(
            answer => answer._id.toString() === req.params.answerId
        );

        if (answerIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Answer not found'
            });
        }

        // Check if user has already voted
        const hasUpvoted = doubt.answers[answerIndex].upvotes.some(
            userId => userId.toString() === req.user.id
        );
        
        const hasDownvoted = doubt.answers[answerIndex].downvotes.some(
            userId => userId.toString() === req.user.id
        );

        // Update votes
        if (vote === 'up') {
            if (hasUpvoted) {
                // Remove upvote
                doubt.answers[answerIndex].upvotes = doubt.answers[answerIndex].upvotes.filter(
                    userId => userId.toString() !== req.user.id
                );
            } else {
                // Add upvote and remove downvote if exists
                doubt.answers[answerIndex].upvotes.push(req.user.id);
                doubt.answers[answerIndex].downvotes = doubt.answers[answerIndex].downvotes.filter(
                    userId => userId.toString() !== req.user.id
                );
            }
        } else {
            if (hasDownvoted) {
                // Remove downvote
                doubt.answers[answerIndex].downvotes = doubt.answers[answerIndex].downvotes.filter(
                    userId => userId.toString() !== req.user.id
                );
            } else {
                // Add downvote and remove upvote if exists
                doubt.answers[answerIndex].downvotes.push(req.user.id);
                doubt.answers[answerIndex].upvotes = doubt.answers[answerIndex].upvotes.filter(
                    userId => userId.toString() !== req.user.id
                );
            }
        }
        
        await doubt.save();

        // Populate the updated answer with user details
        const populatedDoubt = await Doubt.findById(doubt._id)
            .populate('answers.answeredBy', 'name email');
        
        const updatedAnswer = populatedDoubt.answers.find(
            answer => answer._id.toString() === req.params.answerId
        );

        res.status(200).json({
            success: true,
            data: {
                answer: updatedAnswer,
                userVote: hasUpvoted ? 'up' : hasDownvoted ? 'down' : null
            }
        });
    } catch (err) {
        console.error('Vote answer error:', err);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Doubt not found'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};
