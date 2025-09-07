import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { promisify } from 'util';
import User from '../models/User.js';
import { errorResponse } from './apiResponse.js';

// Promisify bcrypt functions
const genSalt = promisify(bcrypt.genSalt);
const hash = promisify(bcrypt.hash);
const compare = promisify(bcrypt.compare);

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateToken = (userId, role) => {
    return jwt.sign(
        { id: userId, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Decoded token payload
 */
const verifyToken = (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return reject(new Error('Invalid or expired token'));
            resolve(decoded);
        });
    });
};

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
    const salt = await genSalt(10);
    return await hash(password, salt);
};

/**
 * Compare password with hashed password
 * @param {string} candidatePassword - Plain text password to compare
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match, false otherwise
 */
const comparePasswords = async (candidatePassword, hashedPassword) => {
    return await compare(candidatePassword, hashedPassword);
};

/**
 * Generate a random token for password reset or email verification
 * @param {number} [length=32] - Length of the token
 * @returns {string} Random token
 */
const generateRandomToken = (length = 32) => {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
};

/**
 * Authentication middleware
 * @param {Array<string>} [allowedRoles=[]] - Array of allowed roles
 * @returns {Function} Express middleware function
 */
const protect = (allowedRoles = []) => {
    return async (req, res, next) => {
        try {
            // 1) Get token from header
            let token;
            if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
                token = req.headers.authorization.split(' ')[1];
            } else if (req.cookies?.token) {
                token = req.cookies.token;
            }

            if (!token) {
                return errorResponse(res, 401, 'You are not logged in. Please log in to get access.');
            }

            // 2) Verify token
            const decoded = await verifyToken(token);

            // 3) Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return errorResponse(res, 401, 'The user belonging to this token no longer exists.');
            }

            // 4) Check if user changed password after the token was issued
            if (currentUser.changedPasswordAfter(decoded.iat)) {
                return errorResponse(res, 401, 'User recently changed password. Please log in again.');
            }

            // 5) Check if user role is allowed
            if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
                return errorResponse(res, 403, 'You do not have permission to perform this action');
            }

            // 6) Grant access to protected route
            req.user = currentUser;
            next();
        } catch (error) {
            return errorResponse(res, 401, 'Invalid or expired token. Please log in again.');
        }
    };
};

/**
 * Generate password reset token and hash it
 * @returns {Object} Reset token and hashed token
 */
const generatePasswordResetToken = () => {
    const resetToken = generateRandomToken(32);
    const hashedToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Token expires in 10 minutes
    const resetTokenExpires = Date.now() + 10 * 60 * 1000;

    return {
        resetToken,
        hashedToken,
        resetTokenExpires
    };
};

/**
 * Generate email verification token
 * @returns {Object} Verification token and hashed token
 */
const generateEmailVerificationToken = () => {
    const verificationToken = generateRandomToken(32);
    const hashedToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

    // Token expires in 24 hours
    const emailVerificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;

    return {
        verificationToken,
        hashedToken,
        emailVerificationTokenExpires
    };
};

export {
    generateToken,
    verifyToken,
    hashPassword,
    comparePasswords,
    generateRandomToken,
    protect,
    generatePasswordResetToken,
    generateEmailVerificationToken
};
