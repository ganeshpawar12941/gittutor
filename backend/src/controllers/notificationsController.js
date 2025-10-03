import { getUserNotifications, markAsRead, markAllAsRead } from '../utils/notification.js';

// GET /api/v2/notifications
export const listNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === true;

    const result = await getUserNotifications(req.user.id, { page, limit, unreadOnly });
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to fetch notifications' });
    }

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('listNotifications error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /api/v2/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    // Reuse getUserNotifications with limit=1 just to get count quickly
    const result = await getUserNotifications(req.user.id, { page: 1, limit: 1, unreadOnly: true });
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to fetch unread count' });
    }
    res.status(200).json({ success: true, count: result.pagination?.total || 0 });
  } catch (err) {
    console.error('getUnreadCount error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/v2/notifications/:id/read
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await markAsRead(id, req.user.id);
    if (!result.success) {
      const status = result.error === 'Notification not found' ? 404 : 400;
      return res.status(status).json({ success: false, message: result.error || 'Failed to mark as read' });
    }
    res.status(200).json({ success: true, data: result.notification });
  } catch (err) {
    console.error('markNotificationRead error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PATCH /api/v2/notifications/read-all
export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await markAllAsRead(req.user.id);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to mark all as read' });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('markAllNotificationsRead error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
