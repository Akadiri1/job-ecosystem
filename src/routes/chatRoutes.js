// src/routes/chatRoutes.js
const express = require('express');
const { protect } = require('../controllers/authController');
const { 
    getContacts, 
    getChatHistory, 
    getRecentChats, 
    markAsRead,
    addReaction,
    deleteMessage,
    editMessage,
    togglePin,
    toggleStar,
    getUnreadCount,
    createChannel,
    getChannels,
    getChannelMessages,
    addAllTeamToChannel,
    addChannelMember,
    getChannelMembers,
    deleteChannel,
    editChannel
} = require('../controllers/chatController');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/chat';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept images, audio, video, pdfs
        const allowedTypes = /jpeg|jpg|png|gif|mp3|wav|ogg|mp4|webm|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if(extname && mimetype){
            return cb(null, true);
        } else {
            cb(new Error('Only images, audio, video and PDFs are allowed'));
        }
    }
});

// Upload Attachment
router.post('/upload-attachment', protect, upload.single('file'), require('../controllers/chatController').uploadAttachment);

// Get list of contacts (Team members)
router.get('/contacts', protect, getContacts);

// Get recent chats for the authenticated user
router.get('/recent', protect, getRecentChats);

// Get message history with a specific user
router.get('/history/:userId', protect, getChatHistory);

// Mark messages as read
router.post('/read', protect, markAsRead);

// Get total unread count for header notification
router.get('/unread-count', protect, getUnreadCount);

// Message actions
router.post('/reaction', protect, addReaction);
router.delete('/message/:messageId', protect, deleteMessage);
router.put('/message/:messageId', protect, editMessage);
router.post('/message/:messageId/pin', protect, togglePin);
router.post('/message/:messageId/star', protect, toggleStar);

// Channel Support
router.post('/channels', protect, createChannel);
router.get('/channels', protect, getChannels);
router.get('/channels/:channelId/messages', protect, getChannelMessages);
router.post('/channels/:channelId/add-all', protect, addAllTeamToChannel);
router.post('/channels/:channelId/members', protect, addChannelMember);
router.get('/channels/:channelId/members', protect, getChannelMembers);
router.delete('/channels/:channelId', protect, deleteChannel);
router.put('/channels/:channelId', protect, editChannel);

module.exports = router;
