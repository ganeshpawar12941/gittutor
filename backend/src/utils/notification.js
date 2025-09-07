const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { errorResponse } = require('./apiResponse');

// Email transporter configuration
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    }
});

/**
 * Send an email notification
 * @param {Object} options - Email options
 * @param {string|Array} options.to - Recipient email(s)
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @param {string} [options.text] - Plain text content (optional)
 * @returns {Promise<Object>} Result of the email sending operation
 */
const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            text: text || html.replace(/<[^>]*>/g, ''), // Convert HTML to plain text if text not provided
            html
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Create an in-app notification
 * @param {Object} options - Notification options
 * @param {string} options.userId - ID of the user to notify
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.type - Notification type (info, success, warning, error)
 * @param {Object} [options.data] - Additional data to store with the notification
 * @param {string} [options.relatedEntityType] - Type of related entity (e.g., 'course', 'video')
 * @param {string} [options.relatedEntityId] - ID of the related entity
 * @returns {Promise<Object>} Created notification
 */
const createInAppNotification = async ({
    userId,
    title,
    message,
    type = 'info',
    data = {},
    relatedEntityType = null,
    relatedEntityId = null
}) => {
    try {
        const notification = new Notification({
            user: userId,
            title,
            message,
            type,
            data,
            relatedEntityType,
            relatedEntityId,
            isRead: false
        });

        await notification.save();
        return { success: true, notification };
    } catch (error) {
        console.error('Error creating in-app notification:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Mark a notification as read
 * @param {string} notificationId - ID of the notification
 * @param {string} userId - ID of the user who owns the notification
 * @returns {Promise<Object>} Result of the operation
 */
const markAsRead = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, user: userId },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return { success: false, error: 'Notification not found' };
        }

        return { success: true, notification };
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - ID of the user
 * @returns {Promise<Object>} Result of the operation
 */
const markAllAsRead = async (userId) => {
    try {
        await Notification.updateMany(
            { user: userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        return { success: true };
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all notifications for a user with pagination
 * @param {string} userId - ID of the user
 * @param {Object} options - Query options
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=10] - Number of items per page
 * @param {boolean} [options.unreadOnly=false] - Only return unread notifications
 * @returns {Promise<Object>} Paginated notifications
 */
const getUserNotifications = async (userId, { page = 1, limit = 10, unreadOnly = false } = {}) => {
    try {
        const query = { user: userId };
        if (unreadOnly) {
            query.isRead = false;
        }

        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Notification.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            success: true,
            data: notifications,
            pagination: {
                total,
                page,
                limit,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        console.error('Error getting user notifications:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send a notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs to notify
 * @param {Object} notificationData - Notification data
 * @param {boolean} [sendEmailNotification=false] - Whether to send email notifications
 * @returns {Promise<Object>} Result of the operation
 */
const sendBulkNotification = async (userIds, notificationData, sendEmailNotification = false) => {
    try {
        const users = await User.find({ _id: { $in: userIds } });
        const notifications = [];
        const emailPromises = [];

        // Create notifications for all users
        for (const user of users) {
            const notification = new Notification({
                user: user._id,
                ...notificationData
            });
            notifications.push(notification);

            // Send email if enabled and user has email
            if (sendEmailNotification && user.email) {
                emailPromises.push(
                    sendEmail({
                        to: user.email,
                        subject: notificationData.title,
                        html: notificationData.message,
                        text: notificationData.message.replace(/<[^>]*>/g, '')
                    })
                );
            }
        }

        // Save all notifications
        await Notification.insertMany(notifications);

        // Wait for all emails to be sent
        if (emailPromises.length > 0) {
            await Promise.all(emailPromises);
        }

        return { success: true, count: notifications.length };
    } catch (error) {
        console.error('Error sending bulk notification:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendEmail,
    createInAppNotification,
    markAsRead,
    markAllAsRead,
    getUserNotifications,
    sendBulkNotification
};
