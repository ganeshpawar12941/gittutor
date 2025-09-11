import dotenv from 'dotenv';
import sendEmail from './src/utils/sendEmail.js';

// Load environment variables
dotenv.config();

async function testSendEmail() {
    try {
        console.log('Testing email sending...');
        
        const result = await sendEmail({
            email: process.env.SMTP_USERNAME, // Send to yourself for testing
            subject: 'Test Email from GitTutor',
            message: '<h1>Test Email</h1><p>This is a test email from GitTutor</p>'
        });
        
        console.log('Email sent successfully!', result);
    } catch (error) {
        console.error('Error sending test email:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
    }
}

testSendEmail();
