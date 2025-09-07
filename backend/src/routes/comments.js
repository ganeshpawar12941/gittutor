import express from 'express';
import { check } from 'express-validator';
import { protect } from '../middleware/auth.js';
import {
    getComments,
    createComment as addComment,
    updateComment,
    deleteComment,
    replyToComment as addReply
} from '../controllers/commentController.js';

const router = express.Router();

// Public routes
router.get('/video/:videoId', getComments);

// Protected routes
router.use(protect);

router.post(
    '/',
    [
        check('content', 'Content is required').not().isEmpty(),
        check('videoId', 'Video ID is required').not().isEmpty(),
        check('timestamp', 'Timestamp is required').isNumeric()
    ],
    addComment
);

router
    .route('/:id')
    .put(
        [
            check('content', 'Content is required').not().isEmpty()
        ],
        updateComment
    )
    .delete(deleteComment);

router.post(
    '/:id/reply',
    [
        check('content', 'Content is required').not().isEmpty()
    ],
    addReply
);

export default router;
