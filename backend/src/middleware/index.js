// Import all middleware components
import { protect, authorize } from './auth/index.js';
import errorHandler from './error/errorHandler.js';
import validateRequest from './validation/validateRequest.js';
import { uploadVideo, cleanupTempFiles } from './upload/videoUpload.js';
import { securityHeaders, requestSanitization, rateLimiter } from './security/index.js';
import { consoleLogger, fileLogger, errorLogger, requestLogger } from './logging/logger.js';
import asyncHandler from './async/asyncHandler.js';

// Export all middleware components
export {
  // Authentication
  protect,
  authorize,
  
  // Error handling
  errorHandler,
  
  // Validation
  validateRequest,
  
  // Upload
  uploadVideo,
  cleanupTempFiles,
  
  // Security
  securityHeaders,
  requestSanitization,
  rateLimiter,
  
  // Logging
  consoleLogger,
  fileLogger,
  errorLogger,
  requestLogger,
  
  // Async handler
  asyncHandler
};
