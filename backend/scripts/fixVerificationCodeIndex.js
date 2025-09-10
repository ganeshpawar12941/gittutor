import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixVerificationCodeIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Drop the existing index
    await mongoose.connection.db.collection('teacheremails').dropIndex('verificationCode_1');
    console.log('Dropped existing verificationCode index');

    // Create a new sparse index
    await mongoose.connection.db.collection('teacheremails').createIndex(
      { verificationCode: 1 },
      { 
        unique: true, 
        sparse: true,
        partialFilterExpression: { verificationCode: { $type: 'string' } }
      }
    );
    console.log('Created new verificationCode index');

    console.log('Index update completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating index:', error);
    process.exit(1);
  }
}

fixVerificationCodeIndex();
