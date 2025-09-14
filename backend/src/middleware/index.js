// Export all middlewares from one place

// Authentication & Authorization
export { default as protect } from './auth/protect.js';
export { default as authorize } from './auth/authorize.js';

// File Uploads
export { upload, uploadSingle } from './upload/upload.js';

// Request Validation
export { default as validateRequest } from './validation/validateRequest.js';

// Error Handling
export { default as errorHandler } from './error/errorHandler.js';

// Security
export { 
    setSecurityHeaders, 
    setSecurityPolicies 
} from './security/securityHeaders.js';

export { 
    apiLimiter, 
    loginLimiter 
} from './security/rateLimiter.js';

export { 
    preventParameterPollution, 
    sanitizeXSS, 
    sanitizeMongo, 
    configureCors 
} from './security/requestSanitization.js';

// Logging
export { 
    consoleLogger, 
    fileLogger, 
    errorLogger, 
    requestLogger,
    format as logFormat
} from './logging/logger.js';

// Async Handler
export { default as asyncHandler } from './async/asyncHandler.js';
