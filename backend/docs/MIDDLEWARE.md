# Middleware Documentation

This document outlines the middleware structure and usage in the GitTutor backend application.

## Table of Contents
- [Overview](#overview)
- [Middleware Structure](#middleware-structure)
- [Available Middleware](#available-middleware)
  - [Authentication](#authentication)
  - [Authorization](#authorization)
  - [File Uploads](#file-uploads)
  - [Request Validation](#request-validation)
  - [Error Handling](#error-handling)
  - [Security](#security)
  - [Logging](#logging)
  - [Async Handler](#async-handler)
- [Usage Examples](#usage-examples)
- [Adding New Middleware](#adding-new-middleware)

## Overview

The middleware in this application is organized into logical modules based on their functionality. This modular approach makes the codebase more maintainable and easier to understand.

## Middleware Structure

```
src/
  middleware/
    ├── auth/                  # Authentication & Authorization
    │   ├── protect.js         # JWT authentication
    │   ├── authorize.js       # Role-based access control
    │   └── index.js           # Exports auth middlewares
    │
    ├── upload/                # File upload handling
    │   ├── upload.js          # Multer configuration
    │   └── index.js           # Exports upload middlewares
    │
    ├── validation/            # Request validation
    │   ├── validateRequest.js # Validation middleware
    │   └── index.js           # Exports validation middlewares
    │
    ├── error/                 # Error handling
    │   ├── errorHandler.js    # Global error handler
    │   └── index.js           # Exports error middlewares
    │
    ├── security/              # Security-related middleware
    │   ├── securityHeaders.js # Security headers
    │   ├── rateLimiter.js     # Rate limiting
    │   ├── requestSanitization.js # Request sanitization
    │   └── index.js           # Exports security middlewares
    │
    ├── logging/               # Logging middleware
    │   ├── logger.js          # Request/response logging
    │   └── index.js           # Exports logging middlewares
    │
    ├── async/                 # Async utilities
    │   ├── asyncHandler.js    # Async handler wrapper
    │   └── index.js           # Exports async utilities
    │
    └── index.js               # Main middleware export file
```

## Available Middleware

### Authentication

**protect** - Verifies JWT token and attaches user to request object

```javascript
import { protect } from '../middleware';

// Protect a route
router.get('/protected-route', protect, (req, res) => {
  // req.user is available here
});
```

### Authorization

**authorize** - Restricts access based on user roles

```javascript
import { protect, authorize } from '../middleware';

// Restrict to admin users only
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
  // Only accessible by admin users
});
```

### File Uploads

**uploadSingle** - Handles single file uploads with validation

```javascript
import { uploadSingle } from '../middleware';

// Handle file upload
router.post('/upload', uploadSingle('image'), (req, res) => {
  // req.file contains the uploaded file
});
```

### Request Validation

**validateRequest** - Validates request body/params/query

```javascript
import { check } from 'express-validator';
import { validateRequest } from '../middleware';

// Validate request body
router.post('/users', [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  validateRequest
], userController.createUser);
```

### Error Handling

**errorHandler** - Global error handler middleware

```javascript
import { errorHandler } from '../middleware';

// Add error handler last in the middleware chain
app.use(errorHandler);
```

### Security

Various security-related middleware:

```javascript
import { 
  setSecurityHeaders, 
  setSecurityPolicies,
  apiLimiter,
  loginLimiter,
  sanitizeXSS,
  sanitizeMongo,
  configureCors
} from '../middleware';

// Apply security middleware
app.use(configureCors);
app.use(setSecurityHeaders);
app.use(setSecurityPolicies);
app.use(apiLimiter);
app.use(sanitizeXSS);
app.use(sanitizeMongo);
```

### Logging

Request/response logging:

```javascript
import { consoleLogger, fileLogger } from '../middleware';

// Log requests
app.use(consoleLogger);
app.use(fileLogger);
```

### Async Handler

**asyncHandler** - Wraps async route handlers to handle errors

```javascript
import { asyncHandler } from '../middleware';

// Without asyncHandler
router.get('/', (req, res, next) => {
  someAsyncOperation()
    .then(result => res.json(result))
    .catch(next);
});

// With asyncHandler
router.get('/', asyncHandler(async (req, res) => {
  const result = await someAsyncOperation();
  res.json(result);
}));
```

## Adding New Middleware

1. Create a new file in the appropriate directory (or create a new directory if needed)
2. Implement your middleware function
3. Export it from the directory's `index.js`
4. Re-export it from the main `middleware/index.js` if needed

Example:

```javascript
// src/middleware/custom/myMiddleware.js
export const myMiddleware = (req, res, next) => {
  // Middleware logic here
  next();
};

// src/middleware/custom/index.js
export * from './myMiddleware';

// src/middleware/index.js
export { myMiddleware } from './custom';
```
