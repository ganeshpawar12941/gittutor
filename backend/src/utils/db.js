import mongoose from 'mongoose';
import { errorResponse } from './apiResponse.js';

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

/**
 * Handle database errors and send appropriate response
 * @param {Error} error - Database error
 * @param {Object} res - Express response object
 * @param {string} [customMessage] - Custom error message
 */
const handleDBError = (error, res, customMessage) => {
    console.error('Database Error:', error);
    
    if (error.name === 'ValidationError') {
        const errors = {};
        Object.keys(error.errors).forEach(key => {
            errors[key] = error.errors[key].message;
        });
        return errorResponse(res, 400, 'Validation Error', errors);
    }
    
    if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return errorResponse(res, 400, `${field} already exists`);
    }
    
    if (error.name === 'CastError') {
        return errorResponse(res, 400, 'Invalid ID format');
    }
    
    const message = customMessage || 'Database operation failed';
    errorResponse(res, 500, message);
};

/**
 * Paginate a mongoose query
 * @param {Object} query - Mongoose query
 * @param {Object} options - Pagination options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Number of items per page
 * @param {Object} [sort] - Sort criteria
 * @returns {Promise<Object>} Paginated results
 */
const paginate = async (query, { page = 1, limit = 10 } = {}, sort = {}) => {
    try {
        const count = await query.model.countDocuments(query.getQuery());
        const totalPages = Math.ceil(count / limit);
        const skip = (page - 1) * limit;

        const data = await query
            .clone()
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .exec();

        return {
            data,
            pagination: {
                total: count,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        };
    } catch (error) {
        console.error('Pagination error:', error);
        throw error;
    }
};

/**
 * Find a document by ID or throw a 404 error
 * @param {Model} Model - Mongoose model
 * @param {string} id - Document ID
 * @param {string} [populate] - Fields to populate
 * @returns {Promise<Object>} Found document
 */
const findByIdOr404 = async (Model, id, populate = '') => {
    try {
        const query = Model.findById(id);
        if (populate) {
            query.populate(populate);
        }
        
        const doc = await query;
        if (!doc) {
            const error = new Error(`${Model.modelName} not found`);
            error.statusCode = 404;
            throw error;
        }
        return doc;
    } catch (error) {
        if (error.name === 'CastError') {
            error.statusCode = 404;
            error.message = 'Invalid ID format';
        }
        throw error;
    }
};

/**
 * Soft delete a document
 * @param {Model} Model - Mongoose model
 * @param {string} id - Document ID
 * @param {string} userId - ID of the user performing the deletion
 * @returns {Promise<Object>} Updated document
 */
const softDelete = async (Model, id, userId) => {
    const doc = await findByIdOr404(Model, id);
    
    doc.deleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = userId;
    
    await doc.save({ validateBeforeSave: false });
    return doc;
};

/**
 * Restore a soft-deleted document
 * @param {Model} Model - Mongoose model
 * @param {string} id - Document ID
 * @returns {Promise<Object>} Restored document
 */
const restore = async (Model, id) => {
    const doc = await Model.findOne({ _id: id, deleted: true });
    
    if (!doc) {
        const error = new Error('No deleted document found with that ID');
        error.statusCode = 404;
        throw error;
    }
    
    doc.deleted = false;
    doc.deletedAt = undefined;
    doc.deletedBy = undefined;
    
    await doc.save({ validateBeforeSave: false });
    return doc;
};

/**
 * Check if a document with the given conditions exists
 * @param {Model} Model - Mongoose model
 * @param {Object} conditions - Conditions to check
 * @param {string} [errorMessage] - Custom error message
 * @returns {Promise<boolean>} True if document exists
 */
const checkExists = async (Model, conditions, errorMessage) => {
    const exists = await Model.exists(conditions);
    if (exists) {
        const error = new Error(errorMessage || 'Resource already exists');
        error.statusCode = 400;
        throw error;
    }
    return false;
};

/**
 * Start a database transaction session
 * @returns {Promise<Object>} Mongoose session
 */
const startSession = async () => {
    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
};

/**
 * Commit a transaction
 * @param {Object} session - Mongoose session
 */
const commitTransaction = async (session) => {
    await session.commitTransaction();
    session.endSession();
};

/**
 * Abort a transaction
 * @param {Object} session - Mongoose session
 * @param {Error} error - Error that caused the abort
 */
const abortTransaction = async (session, error) => {
    await session.abortTransaction();
    session.endSession();
    throw error;
};

export {
    connectDB,
    handleDBError,
    paginate,
    findByIdOr404,
    softDelete,
    restore,
    checkExists,
    startSession,
    commitTransaction,
    abortTransaction
};
