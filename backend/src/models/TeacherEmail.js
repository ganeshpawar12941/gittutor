import mongoose from 'mongoose';

const teacherEmailSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedAt: {
        type: Date,
        default: null
    },
    isVerified: {
        type: Boolean,
        default: true  // Admin-added emails are pre-verified
    }
}, {
    timestamps: true
});

export default mongoose.model('TeacherEmail', teacherEmailSchema);
