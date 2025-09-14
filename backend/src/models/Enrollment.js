import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    },
    lastAccessed: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Prevent duplicate enrollments
enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

// Add a method to update last accessed time
enrollmentSchema.methods.updateLastAccessed = async function() {
    this.lastAccessed = Date.now();
    await this.save();
};

export default mongoose.model('Enrollment', enrollmentSchema);
