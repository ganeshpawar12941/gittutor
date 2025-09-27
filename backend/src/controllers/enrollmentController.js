import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import nodemailer from 'nodemailer';

// Configure nodemailer
export const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    }
});

/**
 * Send notification to all enrolled students when a new video is uploaded
 * @param {string} videoId - The ID of the uploaded video
 * @param {string} courseId - The ID of the course
 * @param {string} teacherId - The ID of the teacher who uploaded the video
 */
export const notifyStudentsAboutNewVideo = async (videoId, courseId, teacherId) => {
    try {
        const course = await Course.findById(courseId).populate('teacher', 'name');
        const video = await Video.findById(videoId);
        
        if (!course || !video) {
            console.error('Course or video not found');
            return;
        }

        // Get all enrolled students
        const enrollments = await Enrollment.find({ course: courseId })
            .populate('student', 'email name');

        // Prepare email content
        const mailOptions = {
            from: `"GitTutor" <${process.env.EMAIL_USERNAME}>`,
            subject: `New Video Uploaded: ${video.title}`,
            text: `
                Hello {name},
                
                A new video "${video.title}" has been uploaded to the course "${course.title}" by ${course.teacher.name}.
                
                Click here to watch: ${process.env.FRONTEND_URL}/courses/${courseId}/videos/${videoId}
                
                Best regards,
                GitTutor Team
            `,
            html: `
                <div>
                    <h2>New Video Uploaded: ${video.title}</h2>
                    <p>Hello {name},</p>
                    <p>A new video "<strong>${video.title}</strong>" has been uploaded to the course "${course.title}" by ${course.teacher.name}.</p>
                    <p><a href="${process.env.FRONTEND_URL}/courses/${courseId}/videos/${videoId}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0;">Watch Now</a></p>
                    <p>Best regards,<br>GitTutor Team</p>
                </div>
            `
        };

        // Send email to each enrolled student
        const notificationPromises = enrollments.map(async (enrollment) => {
            const student = enrollment.student;
            
            // Save notification to database
            const notification = new Notification({
                recipient: student._id,
                course: courseId,
                video: videoId,
                title: `New Video: ${video.title}`,
                message: `A new video has been uploaded to ${course.title} by ${course.teacher.name}`
            });
            await notification.save();

            // Send email
            const emailOptions = {
                ...mailOptions,
                to: student.email,
                text: mailOptions.text.replace('{name}', student.name),
                html: mailOptions.html.replace(/{name}/g, student.name)
            };

            return transporter.sendMail(emailOptions);
        });

        await Promise.all(notificationPromises);
        console.log(`Notifications sent for video ${videoId} in course ${courseId}`);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
};

/**
 * Check if a student is enrolled in a course
 * @middleware
 */
export const checkEnrollment = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;

        const enrollment = await Enrollment.findOne({
            student: studentId,
            course: courseId,
            isActive: true
        });

        if (!enrollment && req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'You are not enrolled in this course or your enrollment is inactive'
            });
        }

        // Update last accessed time
        if (enrollment) {
            await enrollment.updateLastAccessed();
        }

        next();
    } catch (error) {
        console.error('Enrollment check error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking enrollment status'
        });
    }
};
