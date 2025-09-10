import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fixTeacherEmail() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const TeacherEmail = (await import('../src/models/TeacherEmail.js')).default;
    
    // Update the teacher email record
    const result = await TeacherEmail.findOneAndUpdate(
      { email: 'teacher@git.edu' },
      {
        $set: {
          isVerified: true,
          isUsed: false,
          verificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        }
      },
      { new: true, upsert: true }
    );

    console.log('Updated teacher email record:');
    console.log(result);
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating teacher email:', error);
    process.exit(1);
  }
}

fixTeacherEmail();
