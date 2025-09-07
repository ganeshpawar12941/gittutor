import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
                // Check if the user is a student or teacher/admin
                if (this.role === 'student') {
                    return /^[^\s@]+@students\.git\.edu$/i.test(v);
                } else if (this.role === 'teacher' || this.role === 'admin') {
                    return /^[^\s@]+@git\.edu$/i.test(v);
                }
                return true; // Allow other roles (if any) without email validation
            },
            message: function(props) {
                if (this.role === 'student') {
                    return 'Please enter your college email';
                } else if (this.role === 'teacher' || this.role === 'admin') {
                    return 'Please enter your college email';
                }
                return 'Please provide a valid college email ';
            }
        },
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
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

export default mongoose.model('User', userSchema);
