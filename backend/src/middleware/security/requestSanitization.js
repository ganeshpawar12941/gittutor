import hpp from 'hpp';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

// Prevent parameter pollution
const preventParameterPollution = hpp({
    whitelist: [
        'duration',
        'ratingsQuantity',
        'ratingsAverage',
        'maxGroupSize',
        'difficulty',
        'price'
    ]
});

// Sanitize data against XSS
const sanitizeXSS = xss();

// Sanitize data against NoSQL injection
const sanitizeMongo = mongoSanitize({
    onSanitize: ({ req, key }) => {
        console.warn(`This request[${key}] is sanitized`, req);
    },
});

// Configure CORS
const configureCors = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        return res.status(200).json({});
    }
    next();
};

// Combined request sanitization middleware
export const requestSanitization = [
    preventParameterPollution,
    sanitizeXSS,
    sanitizeMongo,
    configureCors
];

// For backward compatibility
export { configureCors, sanitizeMongo, sanitizeXSS, preventParameterPollution };
