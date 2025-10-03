import express from 'express';
import { protect } from '../middleware/auth/index.js';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../controllers/notificationsController.js';

const router = express.Router();

// All notification routes are protected
router.use(protect);

// List notifications with pagination and optional unreadOnly
router.get('/', listNotifications);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Mark one as read
router.patch('/:id/read', markNotificationRead);

// Mark all as read
router.patch('/read-all', markAllNotificationsRead);

export default router;
