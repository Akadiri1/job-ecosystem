const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Application = sequelize.define('Application', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        job_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        seeker_id: { // The user who is applying
            type: DataTypes.UUID,
            allowNull: false
        },
        cover_letter: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        resume_url: {
            type: DataTypes.STRING,
            allowNull: true // Optional for now, or could be required
        },
        status: {
            type: DataTypes.ENUM('pending', 'reviewed', 'shortlisted', 'rejected', 'hired'),
            defaultValue: 'pending'
        }
    }, {
        timestamps: true,
        tableName: 'applications' // Explicit table name
    });

    return Application;
};
