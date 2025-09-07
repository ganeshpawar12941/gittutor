const express = require('express');
const { check } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
    getDoubts,
    getDoubt,
    createDoubt,
    updateDoubt,
    deleteDoubt,
    addAnswer,
    updateAnswer,
    deleteAnswer,
    acceptAnswer,
    voteAnswer
} = require('../controllers/doubtController');

const router = express.Router();

// Protected routes
router.use(protect);

router
    .route('/')
    .get(getDoubts)
    .post(
        [
            check('title', 'Title is required').not().isEmpty(),
            check('description', 'Description is required').not().isEmpty(),
            check('courseId', 'Course ID is required').not().isEmpty()
        ],
        createDoubt
    );

router
    .route('/:id')
    .get(getDoubt)
    .put(
        [
            check('title', 'Title is required').not().isEmpty(),
            check('description', 'Description is required').not().isEmpty()
        ],
        updateDoubt
    )
    .delete(deleteDoubt);

// Answer routes
router.post(
    '/:id/answers',
    [
        check('content', 'Content is required').not().isEmpty()
    ],
    addAnswer
);

router
    .route('/:id/answers/:answerId')
    .put(
        [
            check('content', 'Content is required').not().isEmpty()
        ],
        updateAnswer
    )
    .delete(deleteAnswer);

// Accept answer
router.put('/:id/answers/:answerId/accept', acceptAnswer);

// Vote on answer
router.put(
    '/:id/answers/:answerId/vote',
    [
        check('vote', 'Vote type is required').isIn(['up', 'down'])
    ],
    voteAnswer
);

module.exports = router;
