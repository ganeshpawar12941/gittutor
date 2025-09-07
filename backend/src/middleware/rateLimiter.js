import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/apiResponse.js';

// Rate limiting configuration
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
    handler: (req, res) => {
        errorResponse(res, 429, 'Too many requests, please try again later');
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// More restrictive rate limiting for authentication routes
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 requests per hour for auth routes
    message: 'Too many login attempts from this IP, please try again after an hour',
    handler: (req, res) => {
        errorResponse(res, 429, 'Too many login attempts, please try again later');
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export { apiLimiter, authLimiter };
