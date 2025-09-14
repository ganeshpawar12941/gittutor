import { expect } from 'chai';
import { check, validationResult } from 'express-validator';
import { validateRequest } from '../src/middleware/validation/validateRequest.js';

// Mock Express request, response, and next
const mockRequest = (body = {}) => ({
  body
});

const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

describe('Validation Middleware', () => {
  it('should pass validation with valid input', (done) => {
    const req = mockRequest({ 
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    });
    
    const res = mockResponse();
    
    const validations = [
      check('name', 'Name is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
      check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
    ];
    
    // Apply validations
    Promise.all(validations.map(validation => validation.run(req)))
      .then(() => {
        validateRequest(req, res, (err) => {
          try {
            expect(err).to.be.undefined;
            done();
          } catch (error) {
            done(error);
          }
        });
      });
  });
  
  it('should fail validation with invalid email', (done) => {
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
    
    // Apply validations
    Promise.all(validations.map(validation => validation.run(req)))
      .then(() => {
        validateRequest(req, res, (err) => {
          try {
            // Should not reach here, should return response
            done(new Error('Expected validation to fail but it passed'));
          } catch (error) {
            done();
          }
        });
        
        // Should send response with errors
        if (res.statusCode === 400 && res.body && res.body.errors) {
          done();
        } else {
          done(new Error('Expected 400 response with errors'));
        }
      });
  });
  
  it('should handle multiple validation errors', (done) => {
    const req = mockRequest({ 
      name: '',
      email: '',
      password: '123'
    });
    
    const res = mockResponse();
    
    const validations = [
      check('name', 'Name is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
      check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
    ];
    
    // Apply validations
    Promise.all(validations.map(validation => validation.run(req)))
      .then(() => {
        validateRequest(req, res, (err) => {
          // Should not reach here, should return response
          done(new Error('Expected validation to fail but it passed'));
        });
        
        // Should send response with multiple errors
        if (res.statusCode === 400 && res.body && res.body.errors) {
          const errors = Object.keys(res.body.errors);
          if (errors.length >= 2) {
            done();
          } else {
            done(new Error(`Expected multiple errors but got ${errors.length}`));
          }
        } else {
          done(new Error('Expected 400 response with errors'));
        }
      });
  });
});
