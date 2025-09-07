/**
 * Success response handler
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {Object} data - Response data
 * @param {Object} pagination - Pagination information (optional)
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = {}, pagination = null) => {
    const response = {
        success: true,
        message,
        data
    };

    if (pagination) {
        response.pagination = pagination;
    }

    res.status(statusCode).json(response);
};

/**
 * Error response handler
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {Object} errors - Additional error details (optional)
 */
const errorResponse = (res, statusCode = 500, message = 'Internal Server Error', errors = {}) => {
    res.status(statusCode).json({
        success: false,
        message,
        errors: Object.keys(errors).length === 0 ? undefined : errors
    });
};

// Common error responses
const notFound = (res, resource = 'Resource') => {
    errorResponse(res, 404, `${resource} not found`);
};

const unauthorized = (res, message = 'Not authorized to access this resource') => {
    errorResponse(res, 401, message);
};

const forbidden = (res, message = 'Forbidden') => {
    errorResponse(res, 403, message);
};

const badRequest = (res, message = 'Bad Request', errors = {}) => {
    errorResponse(res, 400, message, errors);
};

const validationError = (res, errors = {}) => {
    errorResponse(res, 422, 'Validation Error', errors);
};

const serverError = (res, error) => {
    console.error('Server Error:', error);
    errorResponse(res, 500, 'Internal Server Error');
};

export {
    successResponse as success,
    errorResponse as error,
    notFound,
    unauthorized,
    forbidden,
    badRequest,
    validationError,
    serverError
};
