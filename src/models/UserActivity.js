// src/models/UserActivity.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserActivity = sequelize.define('UserActivity', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id'
            }
        },
        event_type: {
            type: DataTypes.ENUM('signup', 'login', 'logout', 'password_reset', 'password_change'),
            allowNull: false
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        device_type: {
            type: DataTypes.STRING,
            allowNull: true
        },
        browser: {
            type: DataTypes.STRING,
            allowNull: true
        },
        os: {
            type: DataTypes.STRING,
            allowNull: true
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSON,
            defaultValue: {}
        }
    }, {
        timestamps: true,
        updatedAt: false, // Only need createdAt for activity logs
        indexes: [
            { fields: ['user_id'] },
            { fields: ['event_type'] },
            { fields: ['createdAt'] }
        ]
    });

    return UserActivity;
};
