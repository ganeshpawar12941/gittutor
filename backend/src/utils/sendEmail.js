import nodemailer from 'nodemailer';
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
      console.log('SMTP Server is ready to take our messages');
    }
  });
}

/**
 * Send an email
 * @param {Object} options
 * @param {string} options.email - Recipient email
 * @param {string} options.subject - Subject
 * @param {string} options.message - Message (HTML or text)
 */
const sendEmail = async ({ email, subject, message }) => {
  try {
    // Skip sending if required environment variables are missing
    if (missingVars.length > 0) {
      console.warn('⚠️  Email not sent - missing environment variables');
      return { success: false, message: 'Email service not configured' };
    }

    // Setup email data
    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: subject,
      text: message.replace(/<[^>]*>?/gm, ''), // plain text body
      html: message // html body
    };

    // Send email using the Promise-based API
    const info = await transporter.sendMail(mailOptions);
    
    console.log('📧 Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    throw new Error(`Email could not be sent: ${error.message}`);
  }
};

export default sendEmail;
