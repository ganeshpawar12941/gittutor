const express = require('express');
const { check } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
    getComments,
    addComment,
    updateComment,
    deleteComment,
    addReply
} = require('../controllers/commentController');

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

module.exports = router;
