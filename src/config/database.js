// src/config/database.js
const Sequelize = require('sequelize');
const path = require('path');

// Force load .env from the root folder
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let sequelize;

// Check if DATABASE_URL exists (for cloud deployment like Neon, Render, Railway)
if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Required for Neon.tech
            }
        },
        pool: {
            max: 10,
            min: 0,
            acquire: 60000, // Increased to 60s
            idle: 10000
        }
    });
    console.log('📡 Using DATABASE_URL for connection');
} else {
    // Fallback to individual env vars (local development)
    sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
            host: process.env.DB_HOST,
            dialect: 'postgres',
            logging: false,
            pool: {
                max: 10,
                min: 0,
                acquire: 60000, // Increased to 60s
                idle: 10000
            }
        }
    );
    console.log('🏠 Using local DB config');
}

module.exports = sequelize;