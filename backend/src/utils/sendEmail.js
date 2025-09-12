import nodemailer from 'nodemailer';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'FROM_EMAIL', 'FROM_NAME'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Email sending will be disabled');
}

// Create a transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // ⚠️ Only for development, remove in production
  }
});

// Verify connection configuration
if (!missingVars.length) {
  transporter.verify(function (error, success) {
    if (error) {
      console.error('SMTP Connection Error:', error);
      console.error('Please check your SMTP settings in the .env file');
    } else {
      console.log('✅ SMTP Server is ready to take our messages');
    }
  });
}

// Promisify sendMail
const sendMailAsync = promisify(transporter.sendMail).bind(transporter);

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Subject
 * @param {string} options.message - Message (HTML or text)
 */
const sendEmail = async ({ email, subject, message }) => {
  try {
    // Build mail options properly ✅
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject,
      html: message
    };

    // Debug log (only in dev mode)
    if (process.env.NODE_ENV === 'development') {
      console.log('\n===== ATTEMPTING TO SEND EMAIL =====');
      console.log('Mail Options:', {
        ...mailOptions,
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`
      });
      console.log('=====================================\n');
    }

    // Verify connection before sending
    await transporter.verify();

    // Send email
    const info = await sendMailAsync(mailOptions);
    console.log('📧 Email sent successfully:', info.messageId);

    return true;

  } catch (error) {
    console.error('❌ Email sending failed:', error);

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
