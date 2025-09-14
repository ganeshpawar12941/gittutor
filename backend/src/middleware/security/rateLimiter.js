import rateLimit from 'express-rate-limit';
import { errorResponse } from '../../utils/apiResponse.js';

// Limit requests from same API
const apiLimiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests from this IP, please try again in an hour!',
    handler: (req, res) => {
        errorResponse(res, 429, 'Too many requests, please try again later.');
    }
});

// Limit login attempts
const loginLimiter = rateLimit({
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    handler: (req, res) => {
        errorResponse(res, 429, 'Too many login attempts, please try again later.');
    }
});

export { apiLimiter, loginLimiter };
