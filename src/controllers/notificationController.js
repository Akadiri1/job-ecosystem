const { Op } = require('sequelize');
const { webpush } = require('../config/push');

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { Notification } = req.db_models;

        const notifications = await Notification.findAll({
            where: { user_id: userId },
            order: [['createdAt', 'DESC']],
            limit: 10
        });

        const unreadCount = await Notification.count({
            where: { user_id: userId, is_read: false }
        });

        res.json({ success: true, notifications, unreadCount });
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

exports.markRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { Notification } = req.db_models;

        if (id === 'all') {
            await Notification.update({ is_read: true }, { where: { user_id: userId } });
        } else {
            await Notification.update({ is_read: true }, { where: { id, user_id: userId } });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
};

// [NEW] Subscribe to Web Push
exports.subscribe = async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        const { PushSubscription } = req.db_models;

        if (!keys || !keys.auth || !keys.p256dh) {
             return res.status(400).json({ error: 'Invalid keys' });
        }

        // Check if exists
        const existing = await PushSubscription.findOne({ where: { endpoint } });
        if (existing) {
             await existing.update({ 
                 user_id: req.user.id, 
                 p256dh: keys.p256dh, 
                 auth: keys.auth 
             });
        } else {
             await PushSubscription.create({
                 user_id: req.user.id,
                 endpoint,
                 p256dh: keys.p256dh,
                 auth: keys.auth
             });
        }
        res.status(201).json({ success: true });
    } catch (e) {
        console.error('Push Subscribe Error:', e);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
};

// Internal helper to create notification with Push Support
exports.createNotification = async (models, data) => {
    try {
        await models.Notification.create(data);
        
        // PUSH: Send to user devices if available
        if (models.PushSubscription) {
             const subs = await models.PushSubscription.findAll({ where: { user_id: data.user_id } });
             if (subs && subs.length > 0) {
                 const payload = JSON.stringify({ 
                    title: data.title, 
                    body: data.message,
                    icon: '/assets/images/icons/android-icon-192x192.png',
                    url: data.link || '/dashboard'
                 });
                 
                 subs.forEach(sub => {
                     const pushConfig = {
                         endpoint: sub.endpoint,
                         keys: { p256dh: sub.p256dh, auth: sub.auth }
                     };
                     webpush.sendNotification(pushConfig, payload).catch(err => {
                         if (err.statusCode === 410 || err.statusCode === 404) {
                             sub.destroy();
                         }
                     });
                 });
             }
        }
    } catch (e) {
        console.error("Failed to create notification:", e);
    }
};
