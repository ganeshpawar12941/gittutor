import rateLimit from 'express-rate-limit';
import { error } from '../../utils/apiResponse.js';

// Helper function to send rate limit error response
const handleRateLimitExceeded = (res, message) => {
    return error(res, 429, message);
};

// Limit requests from same API
const apiLimiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests from this IP, please try again in an hour!',
    handler: (req, res) => {
        handleRateLimitExceeded(res, 'Too many requests, please try again later.');
    }
});

// Limit login attempts
const loginLimiter = rateLimit({
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    handler: (req, res) => {
        handleRateLimitExceeded(res, 'Too many login attempts, please try again later.');
    },
});

// Combined rate limiting middleware
export const rateLimiter = {
    api: apiLimiter,
    login: loginLimiter
};

// For backward compatibility
export { apiLimiter, loginLimiter };
