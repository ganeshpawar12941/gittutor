const { errorResponse } = require('../utils/apiResponse');
const { ValidationError } = require('mongoose').Error;
const { JsonWebTokenError, TokenExpiredError } = require('jsonwebtoken');

/**
 * Error handling middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Handle specific error types
    if (err instanceof ValidationError) {
        // Mongoose validation error
        const errors = {};
        Object.keys(err.errors).forEach((key) => {
            errors[key] = err.errors[key].message;
        });
        return errorResponse(res, 400, 'Validation Error', errors);
    }

    if (err.code === 11000) {
        // MongoDB duplicate key error
        const field = Object.keys(err.keyValue)[0];
        return errorResponse(res, 400, `${field} already exists`);
    }

    if (err.name === 'CastError') {
        // Invalid MongoDB ObjectId
        return errorResponse(res, 400, 'Invalid ID format');
    }

    if (err instanceof JsonWebTokenError) {
        // JWT error
        return errorResponse(res, 401, 'Invalid token');
    }

    if (err instanceof TokenExpiredError) {
        // JWT expired
        return errorResponse(res, 401, 'Token expired');
    }

    // Handle multer file upload errors
    if (err.name === 'MulterError') {
        return errorResponse(res, 400, `File upload error: ${err.message}`);
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    errorResponse(res, statusCode, message);
};

module.exports = errorHandler;
