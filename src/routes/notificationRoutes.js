const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.get('/', protect, notificationController.getNotifications);
router.put('/:id/read', protect, notificationController.markRead);
router.post('/subscribe', protect, notificationController.subscribe);
router.get('/preferences', protect, notificationController.getPreferences); // [NEW]
router.put('/preferences', protect, notificationController.updatePreferences); // [NEW]

module.exports = router;
