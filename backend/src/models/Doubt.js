import mongoose from 'mongoose';

const doubtSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a title for your doubt'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please provide details about your doubt']
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video'
    },
    askedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved', 'closed'],
        default: 'open'
    },
    tags: [{
        type: String,
        trim: true
    }],
    answers: [{
        content: {
            type: String,
            required: true,
            trim: true
        },
        answeredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        isAccepted: {
            type: Boolean,
            default: false
        },
        upvotes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        downvotes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isResolved: {
        type: Boolean,
        default: false
    },
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for better query performance
doubtSchema.index({ course: 1, status: 1, isResolved: 1 });
doubtSchema.index({ askedBy: 1, status: 1 });

export default mongoose.model('Doubt', doubtSchema);
