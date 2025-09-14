import { expect } from 'chai';
import jwt from 'jsonwebtoken';
import { protect } from '../src/middleware/auth/protect.js';
import { authorize } from '../src/middleware/auth/authorize.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Configure environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

// Test protect middleware
console.log('\n=== Testing protect middleware ===');

// Test 1: No authorization header
runTest('should reject request without authorization header', () => {
  let error = null;
  const req = { headers: {} };
  const res = {};
  const next = (err) => { error = err; };
  
  protect(req, res, next);
  
  if (!error) throw new Error('Expected an error but got none');
  if (error.message !== 'Not authorized to access this route') {
    throw new Error(`Unexpected error message: ${error.message}`);
  }
});

// Test 2: Invalid token format
runTest('should reject invalid token format', () => {
  let error = null;
  const req = { 
    headers: { 
      authorization: 'InvalidTokenFormat' 
    } 
  };
  const res = {};
  const next = (err) => { error = err; };
  
  protect(req, res, next);
  
  if (!error) throw new Error('Expected an error but got none');
  if (!error.message.includes('jwt')) {
    throw new Error(`Unexpected error message: ${error.message}`);
  }
});

// Test 3: Valid token
runTest('should accept valid token', () => {
  const testUser = { id: 'test123', role: 'user' };
  const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  const req = { 
    headers: { 
      authorization: `Bearer ${token}`
    },
    user: null
  };
  const res = {};
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  
  protect(req, res, next);
  
  if (!nextCalled) throw new Error('next() was not called');
  if (!req.user) throw new Error('User was not set on request');
  if (req.user.id !== testUser.id) throw new Error('User ID does not match');
});

// Test authorize middleware
console.log('\n=== Testing authorize middleware ===');

// Test 4: Authorized role
runTest('should allow access for authorized role', () => {
  const req = { user: { role: 'admin' } };
  const res = {};
  let nextCalled = false;
  const next = () => { nextCalled = true; };
  
  authorize('admin')(req, res, next);
  
  if (!nextCalled) throw new Error('next() was not called');
});

// Test 5: Unauthorized role
runTest('should reject unauthorized role', () => {
  const req = { user: { role: 'user' } };
  const res = {};
  let error = null;
  const next = (err) => { error = err; };
  
  authorize('admin')(req, res, next);
  
  if (!error) throw new Error('Expected an error but got none');
  if (!error.message.includes('not authorized')) {
    throw new Error(`Unexpected error message: ${error.message}`);
  }
});

// Test 6: No user
runTest('should reject when no user is set', () => {
  const req = { user: null };
  const res = {};
  let error = null;
  const next = (err) => { error = err; };
  
  authorize('admin')(req, res, next);
  
  if (!error) throw new Error('Expected an error but got none');
  if (!error.message.includes('Not authorized')) {
    throw new Error(`Unexpected error message: ${error.message}`);
  }
});

console.log('\n✅ All tests completed successfully!');
