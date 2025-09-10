import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function updateVerificationCodeIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Get the collection
    const collection = mongoose.connection.db.collection('teacheremails');
    
    // Drop the existing index if it exists
    try {
      await collection.dropIndex('verificationCode_1');
      console.log('Dropped existing verificationCode index');
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') {
        console.log('No existing verificationCode index to drop');
      } else {
        throw err;
      }
    }

    // Create a new index with proper options
    await collection.createIndex(
      { verificationCode: 1 },
      { 
        unique: true,
        partialFilterExpression: { verificationCode: { $type: 'string' } }
      }
    );
    
    console.log('Created new verificationCode index with proper options');
    console.log('Index update completed successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating index:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

updateVerificationCodeIndex();
