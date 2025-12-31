/**
 * =============================================================================
 * ATTENDANCE MODEL - Employee Clock-In/Clock-Out Tracking
 * =============================================================================
 * 
 * Tracks daily attendance records for team members including:
 * - Clock in/out times
 * - Total hours worked
 * - Break times
 * - Status (present, late, absent, half-day)
 * - AI-generated notes
 * =============================================================================
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Attendance = sequelize.define('Attendance', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        clock_in: {
            type: DataTypes.DATE,
            allowNull: true
        },
        clock_out: {
            type: DataTypes.DATE,
            allowNull: true
        },
        break_minutes: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        total_hours: {
            type: DataTypes.DECIMAL(5, 2), // e.g., 8.50 hours
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('present', 'late', 'absent', 'half_day', 'on_leave', 'holiday'),
            defaultValue: 'present'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        // AI-generated flag for anomalies
        ai_flagged: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        ai_flag_reason: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'attendances',
        timestamps: true,
        underscored: true,
        indexes: [
            { fields: ['user_id', 'date'], unique: true }, // One record per user per day
            { fields: ['company_id', 'date'] }
        ]
    });

    return Attendance;
};
