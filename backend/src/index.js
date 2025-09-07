import mongoose from 'mongoose';
import app from './app.js';

// Database connection
mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://gptech45_db_user:ganesh123@cluster2.a9m8vlr.mongodb.net/gittutor")
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
