// Re-export all security-related middlewares
export { securityHeaders, setSecurityPolicies } from './securityHeaders.js';
export { rateLimiter, apiLimiter, loginLimiter } from './rateLimiter.js';
export { 
  requestSanitization, 
  configureCors, 
  sanitizeMongo, 
  sanitizeXSS, 
  preventParameterPollution 
} from './requestSanitization.js';

// Default export for easy importing
export default {
  // Security headers
  securityHeaders,
  setSecurityPolicies,
  
  // Rate limiting
  rateLimiter,
  apiLimiter,
  loginLimiter,
  
  // Request sanitization
  requestSanitization,
  configureCors,
  sanitizeMongo,
  sanitizeXSS,
  preventParameterPollution
};
