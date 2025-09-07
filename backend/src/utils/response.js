import { errorResponse } from './apiResponse.js';

/**
 * Send a success response with data
 * @param {Object} res - Express response object
 * @param {*} data - Data to send in the response
 * @param {number} [statusCode=200] - HTTP status code
 * @param {Object} [meta] - Additional metadata for pagination, etc.
 * @returns {Object} Express response
 */
const successResponse = (res, data, statusCode = 200, meta = {}) => {
    const response = {
        success: true,
        data,
    };

    // Add metadata if provided (useful for pagination, etc.)
    if (Object.keys(meta).length > 0) {
        response.meta = meta;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send a success response with paginated data
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {number} total - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Number of items per page
 * @param {Object} [additionalData] - Additional data to include in the response
 * @returns {Object} Express response
 */
const paginatedResponse = (res, items, total, page, limit, additionalData = {}) => {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return successResponse(
        res,
        { items, ...additionalData },
        200,
        {
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext,
                hasPrev,
            },
        }
    );
};

/**
 * Send a created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} [location] - Location header value
 * @returns {Object} Express response
 */
const createdResponse = (res, data, location = null) => {
    const response = res.status(201).json({
        success: true,
        data,
    });

    if (location) {
        response.location(location);
    }

    return response;
};

/**
 * Send a no content response (204)
 * @param {Object} res - Express response object
 * @returns {Object} Express response
 */
const noContentResponse = (res) => {
    return res.status(204).end();
};

/**
 * Send a bad request error response (400)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Object} [errors] - Validation errors
 * @returns {Object} Express response
 */
const badRequest = (res, message = 'Bad Request', errors = {}) => {
    return errorResponse(res, 400, message, errors);
};

/**
 * Send an unauthorized error response (401)
 * @param {Object} res - Express response object
 * @param {string} [message='Unauthorized'] - Error message
 * @returns {Object} Express response
 */
const unauthorized = (res, message = 'Unauthorized') => {
    return errorResponse(res, 401, message);
};

/**
 * Send a forbidden error response (403)
 * @param {Object} res - Express response object
 * @param {string} [message='Forbidden'] - Error message
 * @returns {Object} Express response
 */
const forbidden = (res, message = 'Forbidden') => {
    return errorResponse(res, 403, message);
};

/**
 * Send a not found error response (404)
 * @param {Object} res - Express response object
 * @param {string} [message='Resource not found'] - Error message
 * @returns {Object} Express response
 */
const notFound = (res, message = 'Resource not found') => {
    return errorResponse(res, 404, message);
};

/**
 * Send a conflict error response (409)
 * @param {Object} res - Express response object
 * @param {string} [message='Conflict'] - Error message
 * @returns {Object} Express response
 */
const conflict = (res, message = 'Conflict') => {
    return errorResponse(res, 409, message);
};

/**
 * Send a validation error response (422)
 * @param {Object} res - Express response object
 * @param {Object} errors - Validation errors
 * @param {string} [message='Validation failed'] - Error message
 * @returns {Object} Express response
 */
const validationError = (res, errors, message = 'Validation failed') => {
    return errorResponse(res, 422, message, errors);
};

/**
 * Send an internal server error response (500)
 * @param {Object} res - Express response object
 * @param {string} [message='Internal Server Error'] - Error message
 * @returns {Object} Express response
 */
const serverError = (res, message = 'Internal Server Error') => {
    return errorResponse(res, 500, message);
};

export {
    successResponse,
    paginatedResponse,
    createdResponse,
    noContentResponse,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict,
    validationError,
    serverError
};
