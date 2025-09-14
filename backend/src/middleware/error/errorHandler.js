import { error } from '../../utils/apiResponse.js';
import { Error as MongooseError } from 'mongoose';
import jwt from 'jsonwebtoken';

const { JsonWebTokenError, TokenExpiredError } = jwt;

/**
 * Error handling middleware for Express
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        const errors = {};
        Object.keys(err.errors).forEach((key) => {
            errors[key] = err.errors[key].message;
        });
        return errorResponse(res, 400, 'Validation Error', errors);
    }

    // MongoDB Duplicate Key Error
    if (err.code === 11000) {
        const field = err.keyValue ? Object.keys(err.keyValue)[0] : 'field';
        return errorResponse(res, 400, `${field} already exists`);
    }

    // Invalid MongoDB ObjectId
    if (err.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid ID format');
    }

    // JWT Expired Error (check first!)
    if (err instanceof TokenExpiredError) {
        return errorResponse(res, 401, 'Token expired');
    }

    // JWT Error
    if (err instanceof JsonWebTokenError) {
        return errorResponse(res, 401, 'Invalid token');
    }

    // Multer File Upload Error
    if (err.name === 'MulterError') {
        return errorResponse(res, 400, `File upload error: ${err.message}`);
    }

    // Default / Unknown Error
    return errorResponse(
        res,
        err.statusCode || 500,
        err.message || 'Internal Server Error'
    );
};

export default errorHandler;
