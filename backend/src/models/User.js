import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                // Always return true for admin role (skip validation)
                if (this.role === 'admin') return true;
                
                // For new documents, we'll validate in the controller
                if (this.isNew) return true;
                
                // For existing documents, validate based on role
                if (this.role === 'student') {
                    return /^[^\s@]+@students\.git\.edu$/i.test(v);
                } else if (this.role === 'teacher') {
                    return /^[^\s@]+@git\.edu$/i.test(v);
                }
                return true;
            },
            message: function(props) {
                if (this.role === 'student') {
                    return 'Student registration requires a @students.git.edu email address';
                } else if (this.role === 'teacher') {
                    return 'Teacher registration requires a @git.edu email address';
                }
                return 'Please provide a valid email address';
            }
        },
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false
    },
    // Teacher signup code (required for teacher registration)
    teacherSignupCode: {
        type: String,
        select: false
    },
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin'],
        default: 'student'
    },
    enrolledCourses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
    }],
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id, role: this.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
};

// Generate and hash email verification token
userSchema.methods.getEmailVerificationToken = function() {
    // Generate token
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to emailVerificationToken field
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    // Set expire (10 minutes)
    this.emailVerificationExpire = Date.now() + 10 * 60 * 1000;

    return verificationToken;
};

export default mongoose.model('User', userSchema);
