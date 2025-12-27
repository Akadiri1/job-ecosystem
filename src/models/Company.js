// src/models/Company.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Company = sequelize.define('Company', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        website: {
            type: DataTypes.STRING,
            allowNull: true
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true
        },
        logo_url: {
            type: DataTypes.STRING,
            allowNull: true // We will use S3 for this later
        },
        industry: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Soft Delete Fields
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        deactivated_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        // Link to the Employer (User) who owns this company profile
        owner_id: {
            type: DataTypes.UUID,
            allowNull: false
        }
    });

    return Company;
};