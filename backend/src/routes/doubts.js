import express from 'express';
import { check } from 'express-validator';
import { protect } from '../middleware/auth.js';
import {
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
} from '../controllers/doubtController.js';

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
