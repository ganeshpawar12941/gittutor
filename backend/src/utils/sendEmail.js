import nodemailer from 'nodemailer';
import { promisify } from 'util';

// Validate required environment variables
const requiredVars = ['SMTP_USERNAME', 'SMTP_PASSWORD'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    console.error('Email sending will be disabled');
}

// Create a transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false // Only for development, remove in production
    }
});

// Verify connection configuration
if (!missingVars.length) {
    transporter.verify(function(error, success) {
        if (error) {
            console.error('SMTP Connection Error:', error);
            console.error('Please check your SMTP settings in the .env file');
            console.log('SMTP Configuration:', {
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                user: process.env.SMTP_USERNAME ? '***' : 'MISSING',
                pass: process.env.SMTP_PASSWORD ? '***' : 'MISSING'
            });
        } else {
            console.log('SMTP Server is ready to take our messages');
        }
    });
}

// Promisify the sendMail function
const sendMailAsync = promisify(transporter.sendMail).bind(transporter);

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Email message (can be HTML)
 * @returns {Promise} Promise that resolves when the email is sent
 */
const sendEmail = async ({ email, subject, message }) => {
    try {
        // Log email details in development
        if (process.env.NODE_ENV === 'development') {
            console.log('\n===== ATTEMPTING TO SEND EMAIL =====');
            console.log('SMTP Config:', {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE,
                user: process.env.SMTP_USERNAME ? '***' : 'MISSING',
                from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`
            });
            console.log('To:', email);
            console.log('Subject:', subject);
            console.log('=========================\n');
        }

        // Validate required environment variables
        const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'FROM_EMAIL', 'FROM_NAME'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);

        console.log('Sending email with options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject,
            hasMessage: !!message
        });

        // Test connection first
        try {
            await transporter.verify();
            console.log('SMTP connection verified');
        } catch (verifyError) {
            console.error('SMTP Connection Error:', {
                message: verifyError.message,
                code: verifyError.code,
                stack: verifyError.stack
            });
            throw new Error(`SMTP connection failed: ${verifyError.message}`);
        }

        // Send the email
        const info = await sendMailAsync(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return true;
        
    } catch (error) {
        const errorDetails = {
            message: error.message,
            code: error.code,
            stack: error.stack,
            response: error.response,
            command: error.command,
            smtp: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE,
                user: process.env.SMTP_USERNAME ? '***' : 'MISSING',
                fromEmail: process.env.FROM_EMAIL || 'NOT SET',
                fromName: process.env.FROM_NAME || 'NOT SET'
            }
        };
        
        console.error('❌ Email sending failed with details:', JSON.stringify(errorDetails, null, 2));
        
        // Provide more user-friendly error messages
        if (error.code === 'EAUTH') {
            throw new Error('Authentication failed. Please check your email credentials.');
        } else if (error.code === 'EENVELOPE') {
            throw new Error('Invalid email address or missing recipient.');
        } else if (error.code === 'ECONNECTION') {
            throw new Error('Could not connect to the email server. Please check your internet connection.');
        }
        
        throw new Error(`Email could not be sent: ${error.message}`);
    }
};

export default sendEmail;
