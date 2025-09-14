import request from 'supertest';
import { expect } from 'chai';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { check } from 'express-validator';

// Configure environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create a test app
const app = express();

// Import middleware directly to avoid circular dependencies
import { protect } from '../src/middleware/auth/protect.js';
import { authorize } from '../src/middleware/auth/authorize.js';
import { errorHandler } from '../src/middleware/error/errorHandler.js';
import { configureCors } from '../src/middleware/security/requestSanitization.js';
import { setSecurityPolicies } from '../src/middleware/security/securityHeaders.js';
import { consoleLogger } from '../src/middleware/logging/logger.js';
import { validateRequest } from '../src/middleware/validation/validateRequest.js';
import { uploadSingle } from '../src/middleware/upload/upload.js';

// Import models
import User from '../src/models/User.js';
import jwt from 'jsonwebtoken';

// Apply middleware
app.use(express.json());
app.use(configureCors);
app.use(setSecurityPolicies);
app.use(consoleLogger);

// Test routes
app.get('/api/v2/users/me', protect, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

app.get('/api/v2/users', protect, authorize('admin'), (req, res) => {
  res.status(200).json({ success: true, users: [] });
});

app.post('/api/v2/auth/register', [
  check('name', 'Name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  validateRequest
], (req, res) => {
  res.status(200).json({ success: true });
});

app.get('/non-existent-route', (req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

// Error handler
app.use(errorHandler);

// Test user data
const testUser = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    role: 'user'
};

// Helper function to get auth token
const getAuthToken = async () => {
    // Create a test user if it doesn't exist
    let user = await User.findOne({ email: testUser.email });
    
    if (!user) {
        user = new User(testUser);
        await user.save();
    }
    
    // Generate JWT token
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
};

describe('Middleware Tests', () => {
    let authToken;
    
    before(async () => {
        // Get auth token before running tests
        authToken = await getAuthToken();
    });
    
    describe('Authentication Middleware', () => {
        it('should allow access with valid token', async () => {
            const res = await request(app)
                .get('/api/v2/users/me')
                .set('Authorization', `Bearer ${authToken}`);
                
            expect(res.status).to.equal(200);
        });
        
        it('should deny access without token', async () => {
            const res = await request(app)
                .get('/api/v2/users/me');
                
            expect(res.status).to.equal(401);
            expect(res.body.success).to.be.false;
        });
    });
    
    describe('Authorization Middleware', () => {
        it('should allow access to admin routes for admin users', async () => {
            // This test requires an admin user
            const adminToken = jwt.sign(
                { id: 'admin123', role: 'admin' },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            
            const res = await request(app)
                .get('/api/v2/users')
                .set('Authorization', `Bearer ${adminToken}`);
                
            expect(res.status).to.equal(200);
        });
        
        it('should deny access to admin routes for non-admin users', async () => {
            const res = await request(app)
                .get('/api/v2/users')
                .set('Authorization', `Bearer ${authToken}`);
                
            expect(res.status).to.equal(403);
            expect(res.body.success).to.be.false;
        });
    });
    
    describe('Validation Middleware', () => {
        it('should validate request body', async () => {
            const res = await request(app)
                .post('/api/v2/auth/register')
                .send({}); // Empty request body should fail validation
                
            expect(res.status).to.equal(400);
            expect(res.body.success).to.be.false;
            expect(res.body.errors).to.have.property('name');
            expect(res.body.errors).to.have.property('email');
            expect(res.body.errors).to.have.property('password');
        });
    });
    
    describe('Error Handling Middleware', () => {
        it('should handle 404 errors', async () => {
            const res = await request(app)
                .get('/non-existent-route');
                
            expect(res.status).to.equal(404);
            expect(res.body.success).to.be.false;
        });
    });
    
    describe('File Upload Middleware', () => {
        it('should validate file uploads', async () => {
            const res = await request(app)
                .post('/api/v2/courses')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('thumbnail', 'test/fixtures/invalid-file.txt'); // Non-image file
                
            expect(res.status).to.equal(400);
            expect(res.body.success).to.be.false;
        });
    });
});
