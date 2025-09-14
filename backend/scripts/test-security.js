import { expect } from 'chai';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { xss } from 'express-xss-sanitizer';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

// Import security middlewares
import { securityHeaders } from '../src/middleware/security/securityHeaders.js';
import { rateLimiter } from '../src/middleware/security/rateLimiter.js';
import { requestSanitization } from '../src/middleware/security/requestSanitization.js';

describe('Security Middleware', () => {
  describe('securityHeaders', () => {
    it('should apply Helmet security headers', () => {
      // Mock Express app
      const app = {
        use: (middleware) => {
          // Check if the middleware is a function (Helmet returns a function)
          expect(middleware).to.be.a('function');
        }
      };
      
      securityHeaders(app);
    });
  });

  describe('rateLimiter', () => {
    it('should create a rate limiter with default options', () => {
      const limiter = rateLimiter();
      expect(limiter).to.be.an('object');
      expect(limiter).to.have.property('windowMs', 10 * 60 * 1000); // 10 minutes
      expect(limiter).to.have.property('max', 100);
    });

    it('should create a rate limiter with custom options', () => {
      const customLimiter = rateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50
      });
      
      expect(customLimiter).to.be.an('object');
      expect(customLimiter).to.have.property('windowMs', 15 * 60 * 1000);
      expect(customLimiter).to.have.property('max', 50);
    });
  });

  describe('requestSanitization', () => {
    it('should apply request sanitization middleware', () => {
      // Mock Express app
      const app = {
        use: (middleware) => {
          // middleware should be a function
          expect(middleware).to.be.a('function');
        }
      };
      
      requestSanitization(app);
    });
  });
});

describe('XSS Protection', () => {
  it('should have XSS protection headers', () => {
    const req = {};
    const res = {
      setHeader: (header, value) => {
        if (header === 'X-XSS-Protection') {
          expect(value).to.equal('1; mode=block');
        }
      },
      headersSent: false
    };
    
    const next = () => {};
    
    // Apply XSS protection middleware
    helmet.xssFilter()(req, res, next);
  });
});

describe('No Sniff', () => {
  it('should set X-Content-Type-Options header to nosniff', () => {
    const req = {};
    const res = {
      setHeader: (header, value) => {
        if (header === 'X-Content-Type-Options') {
          expect(value).to.equal('nosniff');
        }
      },
      headersSent: false
    };
    
    const next = () => {};
    
    // Apply noSniff middleware
    helmet.noSniff()(req, res, next);
  });
});

describe('Frameguard', () => {
  it('should set X-Frame-Options header to DENY by default', () => {
    const req = {};
    const res = {
      setHeader: (header, value) => {
        if (header === 'X-Frame-Options') {
          expect(value).to.equal('DENY');
        }
      },
      headersSent: false
    };
    
    const next = () => {};
    
    // Apply frameguard middleware
    helmet.frameguard({ action: 'deny' })(req, res, next);
  });
});
