import hpp from 'hpp';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';

// Prevent parameter pollution
export const preventParameterPollution = hpp({
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
export const sanitizeXSS = xss();

// Sanitize data against NoSQL injection
export const sanitizeMongo = mongoSanitize({
    onSanitize: ({ req, key }) => {
        console.warn(`This request[${key}] is sanitized`, req);
    }
});

// Prevent CORS issues
export const configureCors = (req, res, next) => {
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
