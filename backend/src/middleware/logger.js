const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const rfs = require('rotating-file-stream');

// Ensure log directory exists
const logDirectory = path.join(__dirname, '..', '..', 'logs');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory, { recursive: true });

// Create a rotating write stream for request logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // Rotate daily
    path: logDirectory,
    compress: 'gzip', // Compress rotated files
    size: '10M', // Rotate when file size exceeds 10MB
    maxFiles: 30 // Keep logs for 30 days
});

// Custom token for request body (for logging POST/PUT requests)
morgan.token('req-body', (req) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        return JSON.stringify(req.body);
    }
    return '-';
});

// Custom token for user ID
morgan.token('user', (req) => {
    return req.user ? req.user.id : 'anonymous';
});

// Custom format for logs
const format = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - User: :user - Body: :req-body';

// Configure morgan for console logging (development)
const consoleLogger = morgan('dev', {
    skip: (req, res) => process.env.NODE_ENV === 'production' || req.path === '/health'
});

// Configure morgan for file logging
const fileLogger = morgan(format, {
    stream: accessLogStream,
    skip: (req) => process.env.NODE_ENV === 'test' || req.path === '/health'
});

// Error logging middleware
const errorLogger = (err, req, res, next) => {
    const errorLogStream = rfs.createStream('error.log', {
        interval: '1d',
        path: logDirectory,
        compress: 'gzip',
        size: '10M',
        maxFiles: 30
    });

    const errorLog = `[${new Date().toISOString()}] ${req.method} ${req.url} - ${err.stack || err.message}\n`;
    
    errorLogStream.write(errorLog);
    next(err);
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    // Log only in development or if explicitly enabled in production
    if (process.env.NODE_ENV !== 'test' && req.path !== '/health') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
};

module.exports = {
    consoleLogger,
    fileLogger,
    errorLogger,
    requestLogger
};
