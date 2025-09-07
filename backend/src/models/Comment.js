import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    content: {
        type: String,
        required: [true, 'Please provide comment content'],
        trim: true
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    timestamp: {
        type: Number,
        required: [true, 'Please provide a timestamp for the comment'],
        min: 0
    },
    isResolved: {
        type: Boolean,
        default: false
    },
    replies: [{
        content: {
            type: String,
            required: true,
            trim: true
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add index for better query performance
commentSchema.index({ video: 1, timestamp: 1 });

export default mongoose.model('Comment', commentSchema);
