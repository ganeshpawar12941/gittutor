import { check } from 'express-validator';
import validateRequest from '../src/middleware/validation/validateRequest.js';

// Simple test runner
const runTest = (name, fn) => {
  console.log(`\nRunning test: ${name}`);
  try {
    fn();
    console.log('✅ Test passed');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
};

// Mock Express request, response, and next
const mockRequest = (body = {}) => ({
  body
});

const mockResponse = () => {
  const res = {
    statusCode: 200,
    jsonData: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      this.jsonData = data;
      return this;
    }
  };
  return res;
};

// Test 1: Validation passes with valid input
runTest('should pass validation with valid input', () => {
  const req = mockRequest({ 
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  });
  
  const res = mockResponse();
  let nextCalled = false;
  
  const validations = [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ];
  
  // Create middleware with validations
  const middleware = validateRequest(validations);
  
  // Run the middleware chain
  middleware[0](req, res, () => {}); // First validation
  middleware[1](req, res, () => {}); // Second validation
  middleware[2](req, res, () => {}); // Third validation
  middleware[3](req, res, () => {    // Validation result processor
    nextCalled = true;
  });
  
  if (!nextCalled) {
    throw new Error('Validation should have passed');
  }
});

// Test 2: Validation fails with invalid email
runTest('should fail validation with invalid email', () => {
  const req = mockRequest({ 
    name: 'Test User',
    email: 'invalid-email',
    password: 'password123'
  });
  
  const res = mockResponse();
  
  const validations = [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
  ];
  
  // Create middleware with validations
  const middleware = validateRequest(validations);
  
  // Run the middleware chain
  middleware[0](req, res, () => {}); // First validation
  middleware[1](req, res, () => {}); // Second validation
  middleware[2](req, res, () => {}); // Third validation
  middleware[3](req, res, () => {}); // Validation result processor
  
  if (res.statusCode !== 400 || !res.jsonData || !res.jsonData.success === false) {
    throw new Error('Expected 400 response with validation errors');
  }
  
  console.log('Validation response:', res.jsonData);
});

console.log('\n✅ All tests completed!');
