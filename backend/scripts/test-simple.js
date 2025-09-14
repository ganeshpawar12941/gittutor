console.log('Testing middleware...');

// Simple test to verify the file runs
console.log('✅ Test file is running!');

// Test basic authentication middleware
import protect from '../src/middleware/auth/protect.js';

console.log('✅ protect middleware imported successfully');

// Mock response object
const mockRes = {
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

// Test case 1: No authorization header
console.log('\nTest 1: No authorization header');
const req1 = { 
  headers: {}
};

console.log('Calling protect middleware...');
protect(req1, mockRes, () => {});

if (mockRes.statusCode === 401 && mockRes.jsonData && mockRes.jsonData.message) {
  console.log(`✅ Test passed: ${mockRes.jsonData.message}`);
} else {
  console.error('❌ Test failed: Expected 401 Unauthorized response');
  process.exit(1);
}

// Test case 2: Invalid token format
console.log('\nTest 2: Invalid token format');
const req2 = { 
  headers: {
    authorization: 'InvalidTokenFormat'
  }
};

// Reset mock response
mockRes.statusCode = 200;
mockRes.jsonData = null;

console.log('Calling protect middleware with invalid token format...');
protect(req2, mockRes, () => {});

if (mockRes.statusCode === 401 && mockRes.jsonData && mockRes.jsonData.message) {
  console.log(`✅ Test passed: ${mockRes.jsonData.message}`);
} else {
  console.error('❌ Test failed: Expected 401 Unauthorized for invalid token format');
  process.exit(1);
}

console.log('\n✅ All tests completed successfully!');
