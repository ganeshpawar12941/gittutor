import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import courseRoutes from './routes/courses.js';
import videoRoutes from './routes/videos.js';
import commentRoutes from './routes/comments.js';
import doubtRoutes from './routes/doubts.js';
import teacherRoutes from './routes/teacherRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Test route for environment variables
app.get('/api/v2/test-env', (req, res) => {
    res.json({
        ADMIN_SIGNUP_KEY: process.env.ADMIN_SIGNUP_KEY || 'Not set',
        NODE_ENV: process.env.NODE_ENV,
        allEnv: process.env
    });
});

// Routes
app.use('/api/v2/auth', authRoutes);
app.use('/api/v2/users', userRoutes);
app.use('/api/v2/courses', courseRoutes);
app.use('/api/v2/videos', videoRoutes);
app.use('/api/v2/comments', commentRoutes);
app.use('/api/v2/doubts', doubtRoutes);
app.use('/api/v2/teachers', teacherRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

export default app;
