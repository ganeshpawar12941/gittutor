import { validationResult } from 'express-validator';
import { validationError } from '../utils/apiResponse.js';

/**
 * Middleware to validate request using express-validator
 * @param {Array} validations - Array of validation chains
 * @returns {Array} Array of middleware functions
 */
const validateRequest = (validations) => {
    return [
        // Run validations
        ...validations,
        
        // Process validation results
        (req, res, next) => {
            const errors = validationResult(req);
            
            if (errors.isEmpty()) {
                return next();
            }
            
            // Format errors
            const formattedErrors = {};
            errors.array().forEach(error => {
                if (!formattedErrors[error.param]) {
                    formattedErrors[error.param] = [];
                }
                formattedErrors[error.param].push(error.msg);
            });
            
            // Return validation error response
            return validationError(res, formattedErrors);
        }
    ];
};

export default validateRequest;
