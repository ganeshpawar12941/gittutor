import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

async function testEmail() {
    console.log('Testing email configuration...');
    
    // Check required environment variables
    const requiredVars = ['SMTP_USERNAME', 'SMTP_PASSWORD', 'FROM_EMAIL'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars.join(', '));
        console.log('Current SMTP Configuration:', {
            SMTP_USERNAME: process.env.SMTP_USERNAME ? '***' : 'MISSING',
            SMTP_PASSWORD: process.env.SMTP_PASSWORD ? '***' : 'MISSING',
            FROM_EMAIL: process.env.FROM_EMAIL || 'MISSING'
        });
        return;
    }

    // Create test transporter
    const testAccount = await nodemailer.createTestAccount();
    
    // Use test account if no credentials provided
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USERNAME,
            pass: process.env.SMTP_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        // Verify connection
        console.log('🔍 Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ Server is ready to take our messages');
        
        // Send test email
        console.log('📤 Sending test email...');
        const info = await transporter.sendMail({
            from: `"Test Sender" <${process.env.FROM_EMAIL}>`,
            to: process.env.SMTP_USERNAME, // Send to self for testing
            subject: 'Test Email from GitTutor',
            text: 'This is a test email from GitTutor',
            html: '<b>This is a test email from GitTutor</b>'
        });
        
        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        
    } catch (error) {
        console.error('❌ Error sending test email:', error);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔑 Authentication failed. Please check:');
            console.error('1. Ensure you are using an App Password, not your regular Gmail password');
            console.error('2. Make sure 2-factor authentication is enabled on your Google account');
            console.error('3. Generate a new App Password for your application');
            console.error('4. Check for any spaces or special characters in your .env file');
        }
    }
}

testEmail().catch(console.error);
