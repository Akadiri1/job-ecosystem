// src/models/Job.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Job = sequelize.define('Job', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('full_time', 'part_time', 'contract', 'freelance', 'internship'),
            allowNull: false
        },
        location_type: {
            type: DataTypes.ENUM('remote', 'on_site', 'hybrid'),
            allowNull: false
        },
        salary_range: {
            type: DataTypes.STRING,
            allowNull: true
        },
        currency: {
            type: DataTypes.STRING,
            defaultValue: 'NGN',
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('active', 'closed', 'draft'),
            defaultValue: 'active'
        },
        // Additional fields
        skills: {
            type: DataTypes.JSON, // Stores array of skills
            allowNull: true
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true
        },
        experience: {
            type: DataTypes.STRING,
            allowNull: true
        },
        vacancies: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 1
        },
        qualification: {
            type: DataTypes.STRING,
            allowNull: true
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true
        },
        language: {
            type: DataTypes.JSON, // Stores array of languages
            allowNull: true
        },
        deadline: {
            type: DataTypes.DATE,
            allowNull: true
        },
        gender: {
            type: DataTypes.STRING,
            allowNull: true
        }
    });

    return Job;
};