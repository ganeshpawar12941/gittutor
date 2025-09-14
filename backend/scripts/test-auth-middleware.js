import { expect } from 'chai';
import { protect, authorize } from '../src/middleware/auth/index.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Mock Express request, response, and next
const mockRequest = (headers = {}) => ({
  headers,
  user: null
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

const mockNext = () => {
  let called = false;
  let error = null;
  
  const next = (err) => {
    called = true;
    error = err;
  };
  
  next.called = () => called;
  next.error = () => error;
  
  return next;
};

describe('Authentication Middleware', () => {
  describe('protect middleware', () => {
    it('should call next() with error if no authorization header', (done) => {
      const req = mockRequest();
      const res = mockResponse();
      
      protect(req, res, (err) => {
        try {
          expect(err).to.be.an('error');
          expect(err.message).to.equal('Not authorized to access this route');
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    
    it('should call next() with error if token is invalid', (done) => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();
      
      protect(req, res, (err) => {
        try {
          expect(err).to.be.an('error');
          expect(err.message).to.include('jwt malformed');
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    
    it('should set req.user if token is valid', (done) => {
      const testUser = { id: '123', role: 'user' };
      const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1h' });
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      
      protect(req, res, (err) => {
        try {
          expect(err).to.be.undefined;
          expect(req.user).to.exist;
          expect(req.user.id).to.equal(testUser.id);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
  
  describe('authorize middleware', () => {
    it('should call next() if user has required role', (done) => {
      const req = { user: { role: 'admin' } };
      const res = mockResponse();
      
      authorize('admin')(req, res, (err) => {
        try {
          expect(err).to.be.undefined;
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    
    it('should call next() with error if user does not have required role', (done) => {
      const req = { user: { role: 'user' } };
      const res = mockResponse();
      
      authorize('admin')(req, res, (err) => {
        try {
          expect(err).to.be.an('error');
          expect(err.message).to.equal('User with role user is not authorized to access this route');
          done();
        } catch (error) {
          done(error);
        }
      });
    });
    
    it('should call next() with error if user is not authenticated', (done) => {
      const req = { user: null };
      const res = mockResponse();
      
      authorize('admin')(req, res, (err) => {
        try {
          expect(err).to.be.an('error');
          expect(err.message).to.equal('Not authorized to access this route');
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});
