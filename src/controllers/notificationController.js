const { Op } = require('sequelize');

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

// Internal helper to create notification
exports.createNotification = async (models, data) => {
    try {
        await models.Notification.create(data);
    } catch (e) {
        console.error("Failed to create notification:", e);
    }
};
