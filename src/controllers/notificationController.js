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
// [NEW] Get Notification Preferences
exports.getPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const { NotificationPreference } = req.db_models;

        // Find or Create default preferences
        const [prefs, created] = await NotificationPreference.findOrCreate({
            where: { user_id: userId },
            defaults: {
                 email_alerts: true,
                 push_alerts: true,
                 in_app_alerts: true,
                 sms_alerts: false
            }
        });

        res.json({ success: true, preferences: prefs });
    } catch (e) {
        console.error('Get Preferences Error:', e);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
};

// [NEW] Update Notification Preferences
exports.updatePreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        const { NotificationPreference } = req.db_models;
        const updates = req.body; // e.g., { email_alerts: false }

        const prefs = await NotificationPreference.findOne({ where: { user_id: userId } });
        
        if (!prefs) {
            // Should exist from getPreferences call, but handle edge case
            await NotificationPreference.create({
                user_id: userId,
                ...updates
            });
        } else {
            // Update only allowed fields to prevent abuse
            const allowedFields = [
                'email_alerts', 'push_alerts', 'in_app_alerts', 'sms_alerts',
                'job_alerts', 'application_updates', 'marketing_emails',
                'security_email', 'security_sms'
            ];
            
            allowedFields.forEach(field => {
                if (updates[field] !== undefined) {
                    prefs[field] = updates[field];
                }
            });
            
            await prefs.save();
        }

        res.json({ success: true, message: "Preferences saved" });
    } catch (e) {
        console.error('Update Preferences Error:', e);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
};
