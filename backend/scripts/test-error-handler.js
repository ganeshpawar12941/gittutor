import { expect } from 'chai';
import errorHandler from '../src/middleware/error/errorHandler.js';

// Mock Express request, response, and next
const mockRequest = () => ({});

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.body = null;
  
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

describe('Error Handler Middleware', () => {
  it('should handle 404 Not Found error', () => {
    const req = mockRequest();
    const res = mockResponse();
    const error = new Error('Not Found');
    error.statusCode = 404;
    
    errorHandler(error, req, res, () => {});
    
    expect(res.statusCode).to.equal(404);
    expect(res.body).to.have.property('success', false);
    expect(res.body).to.have.property('message', 'Not Found');
  });
  
  it('should handle 400 Bad Request error', () => {
    const req = mockRequest();
    const res = mockResponse();
    const error = new Error('Validation failed');
    error.statusCode = 400;
    
    errorHandler(error, req, res, () => {});
    
    expect(res.statusCode).to.equal(400);
    expect(res.body).to.have.property('success', false);
    expect(res.body).to.have.property('message', 'Validation failed');
  });
  
  it('should handle 401 Unauthorized error', () => {
    const req = mockRequest();
    const res = mockResponse();
    const error = new Error('Not authorized');
    error.statusCode = 401;
    
    errorHandler(error, req, res, () => {});
    
    expect(res.statusCode).to.equal(401);
    expect(res.body).to.have.property('success', false);
    expect(res.body).to.have.property('message', 'Not authorized');
  });
  
  it('should handle 403 Forbidden error', () => {
    const req = mockRequest();
    const res = mockResponse();
    const error = new Error('Forbidden');
    error.statusCode = 403;
    
    errorHandler(error, req, res, () => {});
    
    expect(res.statusCode).to.equal(403);
    expect(res.body).to.have.property('success', false);
    expect(res.body).to.have.property('message', 'Forbidden');
  });
  
  it('should handle 500 Internal Server Error by default', () => {
    const req = mockRequest();
    const res = mockResponse();
    const error = new Error('Some server error');
    
    // Don't set status code to test default case
    
    errorHandler(error, req, res, () => {});
    
    expect(res.statusCode).to.equal(500);
    expect(res.body).to.have.property('success', false);
    expect(res.body).to.have.property('message', 'Server Error');
  });
  
  it('should include error stack in development', () => {
    // Save original NODE_ENV
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    const req = mockRequest();
    const res = mockResponse();
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    
    errorHandler(error, req, res, () => {});
    
    expect(res.body).to.have.property('error', 'Test error');
    expect(res.body).to.have.property('stack', 'Error stack trace');
    
    // Restore NODE_ENV
    process.env.NODE_ENV = originalEnv;
  });
});
