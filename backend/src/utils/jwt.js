import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { unauthorized, forbidden } from './apiResponse.js';

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<string>} JWT token
 */
export const generateToken = async (userId, role) => {
    try {
        const token = await signToken(
            { id: userId, role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || '30d' }
        );
        return token;
    } catch (error) {
        console.error('Error generating token:', error);
        throw new Error('Error generating token');
    }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Decoded token payload
 */
export const verifyJwtToken = async (token) => {
    try {
        const decoded = await verifyToken(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        console.error('Error verifying token:', error);
        throw new Error('Invalid or expired token');
    }
};

/**
 * Middleware to protect routes
 * Verifies the JWT token and attaches the user to the request object
 */
export const protect = async (req, res, next) => {
    try {
        let token;
        
        // Get token from header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Get token from cookie
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        // Check if token exists
        if (!token) {
            return unauthorized(res, 'Not authorized to access this route');
        }

        try {
            // Verify token
            const decoded = await verifyJwtToken(token);

            // Get user from the token
            const user = await User.findById(decoded.id).select('-password');

            if (!user) {
                return unauthorized(res, 'User not found');
            }

            // Check if user changed password after the token was issued
            if (user.changedPasswordAfter(decoded.iat)) {
                return unauthorized(res, 'User recently changed password. Please log in again.');
            }

            // Attach user to request object
            req.user = user;
            next();
        } catch (error) {
            console.error('Token verification error:', error);
            return unauthorized(res, 'Not authorized, token failed');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return unauthorized(res, 'Not authorized, authentication failed');
    }
};

/**
 * Middleware to restrict routes to specific roles
 * @param {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return forbidden(res, `User role ${req.user.role} is not authorized to access this route`);
        }
        next();
    };
};

