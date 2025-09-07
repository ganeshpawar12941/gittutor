import mongoose from 'mongoose';

const teacherEmailSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@git\.edu$/i, 'Please provide a valid teacher email']
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationExpire: Date,
    verifiedAt: Date,
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

export default mongoose.model('TeacherEmail', teacherEmailSchema);
