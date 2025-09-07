const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a video title'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Please provide a video description']
    },
    url: {
        type: String,
        required: [true, 'Please provide a video URL']
    },
    thumbnail: {
        type: String,
        default: 'default-thumbnail.jpg'
    },
    duration: {
        type: Number,
        required: [true, 'Please provide video duration in seconds']
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    views: {
        type: Number,
        default: 0
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        trim: true
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add text index for search functionality
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Video', videoSchema);
