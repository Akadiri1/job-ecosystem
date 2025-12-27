const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Notification = sequelize.define('Notification', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('info', 'success', 'warning', 'error', 'message', 'invite'),
            defaultValue: 'info'
        },
        is_read: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        link: {
            type: DataTypes.STRING, // URL to redirect to (e.g., /dashboard/chats)
            allowNull: true
        },
        related_id: {
            type: DataTypes.UUID, // ID of related entity (e.g., chat ID, job ID)
            allowNull: true
        }
    }, {
        timestamps: true
    });

    return Notification;
};
