import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please provide a video title'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Please provide a video description'],
        maxlength: [2000, 'Description cannot be more than 2000 characters']
    },
    url: {
        type: String,
        required: [true, 'Please provide a video URL']
    },
    s3Key: {
        type: String,
        required: [true, 'S3 key is required']
    },
    bucket: {
        type: String,
        required: [true, 'S3 bucket name is required']
    },
    thumbnail: {
        type: String,
        default: 'default-thumbnail.jpg'
    },
    duration: {
        type: Number,
        required: [true, 'Please provide video duration in seconds'],
        min: [1, 'Duration must be at least 1 second']
    },
    size: {
        type: Number,
        required: [true, 'File size is required'],
        min: [1024, 'File size must be at least 1KB']
    },
    mimeType: {
        type: String,
        required: [true, 'MIME type is required']
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: [true, 'Course ID is required'],
        index: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Uploader ID is required'],
        index: true
    },
    views: {
        type: Number,
        default: 0,
        min: [0, 'Views cannot be negative']
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    isFree: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        default: 0,
        min: [0, 'Order cannot be negative']
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: [50, 'Tag cannot be more than 50 characters']
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Add text index for search functionality
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

const Video = mongoose.model('Video', videoSchema);

export default Video;
