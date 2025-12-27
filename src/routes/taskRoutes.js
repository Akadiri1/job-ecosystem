// src/routes/taskRoutes.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { protect } = require('../controllers/authController');
const taskController = require('../controllers/taskController');
const taskCommentController = require('../controllers/taskCommentController');

const router = express.Router();

// --- MULTER CONFIG FOR ATTACHMENTS ---
const uploadDir = path.join(__dirname, '../public/uploads/task-attachments');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.id}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        // Allow images, documents, and common file types
        const allowed = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv'
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
        }
    }
});

// --- TASK ROUTES ---
router.post('/', protect, taskController.createTask);
router.get('/', protect, taskController.getTasks);
router.get('/my', protect, taskController.getMyTasks);
router.get('/:id', protect, taskController.getTask);
router.put('/:id', protect, taskController.updateTask);
router.patch('/:id/status', protect, taskController.updateTaskStatus);
router.patch('/:id/accept', protect, taskController.acceptTask);
router.delete('/:id', protect, taskController.deleteTask);

// --- COMMENT ROUTES ---
router.post('/:task_id/comments', protect, taskCommentController.addComment);
router.get('/:task_id/comments', protect, taskCommentController.getComments);
router.delete('/comments/:comment_id', protect, taskCommentController.deleteComment);
router.post('/comments/:comment_id/vote', protect, taskCommentController.toggleVote);

// --- ATTACHMENT UPLOAD ---
router.post('/upload', protect, upload.single('file'), taskCommentController.uploadAttachment);

module.exports = router;
