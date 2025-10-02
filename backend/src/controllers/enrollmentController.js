import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import Video from '../models/Video.js';
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
        console.log('=== Starting notification process ===');
        console.log('Video ID:', videoId);
        console.log('Course ID:', courseId);
        console.log('Teacher ID:', teacherId);

        const course = await Course.findById(courseId).populate('teacher', 'name');
        const video = await Video.findById(videoId);
        
        if (!course || !video) {
            console.error('Course or video not found');
            console.error('Course:', course ? 'Found' : 'Not found');
            console.error('Video:', video ? 'Found' : 'Not found');
            return;
        }

        console.log('Course found:', course.title);
        console.log('Video found:', video.title);

        // Get all enrolled students (including inactive ones for notifications)
        const enrollments = await Enrollment.find({ 
            course: courseId,
            isActive: true 
        }).populate('student', 'email name');

        console.log(`Found ${enrollments.length} enrolled students`);
        
        // Debug: Check all enrollments for this course (without filter)
        const allEnrollments = await Enrollment.find({ course: courseId });
        console.log(`Total enrollments (including inactive): ${allEnrollments.length}`);
        
        // Debug: Check if courseId is correct format
        console.log('Course ID type:', typeof courseId);
        console.log('Course ID value:', courseId);
        
        if (enrollments.length === 0) {
            console.log('No active enrollments found. Checking database...');
            const sampleEnrollment = await Enrollment.findOne({});
            if (sampleEnrollment) {
                console.log('Sample enrollment found:', {
                    course: sampleEnrollment.course,
                    student: sampleEnrollment.student,
                    isActive: sampleEnrollment.isActive
                });
            } else {
                console.log('No enrollments exist in database at all');
            }
            return; // Exit early if no students to notify
        }
        
        enrollments.forEach((enrollment, index) => {
            console.log(`Student ${index + 1}:`, {
                name: enrollment.student?.name,
                email: enrollment.student?.email,
                id: enrollment.student?._id
            });
        });

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
        const notificationPromises = enrollments.map(async (enrollment, index) => {
            try {
                const student = enrollment.student;
                
                if (!student || !student.email) {
                    console.error(`Student ${index + 1} has no email address`);
                    return;
                }
                
                console.log(`Processing notification ${index + 1}/${enrollments.length} for ${student.email}`);
                
                // Save notification to database
                const notification = new Notification({
                    recipient: student._id,
                    course: courseId,
                    video: videoId,
                    title: `New Video: ${video.title}`,
                    message: `A new video has been uploaded to ${course.title} by ${course.teacher.name}`
                });
                await notification.save();
                console.log(`Database notification saved for ${student.email}`);

                // Send email
                const emailOptions = {
                    ...mailOptions,
                    to: student.email,
                    text: mailOptions.text.replace('{name}', student.name),
                    html: mailOptions.html.replace(/{name}/g, student.name)
                };

                const emailResult = await transporter.sendMail(emailOptions);
                console.log(`Email sent successfully to ${student.email}:`, emailResult.messageId);
                return emailResult;
            } catch (error) {
                console.error(`Error sending notification to student ${index + 1}:`, error.message);
                throw error;
            }
        });

        const results = await Promise.allSettled(notificationPromises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`Notification summary: ${successful} successful, ${failed} failed`);
        console.log(`Notifications completed for video ${videoId} in course ${courseId}`);
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
