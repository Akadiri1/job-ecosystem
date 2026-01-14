// src/models/NotificationPreference.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const NotificationPreference = sequelize.define('NotificationPreference', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true // One preference record per user
        },
        
        // --- CHANNELS ---
        email_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        push_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        in_app_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        sms_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // SMS usually off by default due to cost
        },
        
        // --- SECURITY ---
        security_email: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        security_sms: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        // --- CATEGORIES (Optional, matching profile.ejs UI) ---
        job_alerts: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        application_updates: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        marketing_emails: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }

    }, {
        timestamps: true
    });

    return NotificationPreference;
};
