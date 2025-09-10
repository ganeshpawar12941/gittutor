import mongoose from 'mongoose';
import crypto from 'crypto';

const teacherEmailSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@git\.edu$/i, 'Please provide a valid teacher email']
    },
    verificationCode: {
        type: String,
        unique: true,
        sparse: true,
        index: {
            unique: true,
            partialFilterExpression: { verificationCode: { $type: 'string' } }
        }
    },
    verificationExpires: {
        type: Date,
        default: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verifiedAt: Date,
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isUsed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Generate verification code
teacherEmailSchema.methods.generateVerificationCode = function() {
    // Generate a 6-digit code
    this.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    this.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    return this.verificationCode;
};

export default mongoose.model('TeacherEmail', teacherEmailSchema);
