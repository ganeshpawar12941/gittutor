// Simple test runner
const runTest = (name, fn) => {
  console.log(`\nRunning test: ${name}`);
  try {
    fn();
    console.log('✅ Test passed');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
};

// Mock Express request, response, and next
const mockRequest = (body = {}) => ({
  body,
  query: {},
  params: {}
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

// Simple validation middleware test
const testValidation = () => {
  const req = mockRequest({ 
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  });
  
  const res = mockResponse();
  let nextCalled = false;
  
  // Simple validation function
  const validate = (req, res, next) => {
    if (!req.body.name) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }
    if (!req.body.email || !req.body.email.includes('@')) {
      res.status(400).json({ success: false, message: 'Valid email is required' });
      return;
    }
    if (!req.body.password || req.body.password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }
    next();
  };
  
  // Test valid input
  validate(req, res, () => { nextCalled = true; });
  
  if (!nextCalled) {
    throw new Error('Validation should have passed with valid input');
  }
  
  // Test invalid email
  req.body.email = 'invalid-email';
  nextCalled = false;
  validate(req, res, () => { nextCalled = true; });
  
  if (nextCalled || res.statusCode !== 400) {
    throw new Error('Validation should have failed with invalid email');
  }
  
  console.log('Validation response:', res.jsonData);
  
  return true;
};

// Run the test
const success = runTest('Direct validation test', testValidation);

if (success) {
  console.log('\n✅ All tests completed successfully!');
} else {
  console.log('\n❌ Some tests failed');
  process.exit(1);
}
