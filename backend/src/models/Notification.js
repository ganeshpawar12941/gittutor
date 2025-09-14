import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    readAt: {
        type: Date
    }
});

// Index for faster queries
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ course: 1, video: 1 });

export default mongoose.model('Notification', notificationSchema);
