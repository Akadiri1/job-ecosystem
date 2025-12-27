// src/models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: { isEmail: true }
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: true // Changed to TRUE for social login users
        },
        
        // --- SOCIAL LOGIN IDS ---
        google_id: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
        },
        facebook_id: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true
        },
        
        // --- 1. ROLES & SECURITY ---
        role: {
            type: DataTypes.ENUM('job_seeker', 'employer', 'employee', 'admin'),
            defaultValue: 'job_seeker'
        },
        // The "Keys on the Keyring" (e.g., ['can_post_job', 'can_view_billing'])
        permissions: {
            type: DataTypes.JSON, 
            defaultValue: [] 
        },
        
        // --- 2. ACCOUNT LIFECYCLE (HR & HOLIDAY) ---
        account_status: {
            type: DataTypes.ENUM('active', 'suspended', 'terminated', 'hibernating'),
            defaultValue: 'active'
        },
        is_on_holiday: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        
        // --- 3. PROFILE DATA (Ready for S3) ---
        phone_number: { type: DataTypes.STRING },
        profile_picture_url: { type: DataTypes.STRING }, // Will store S3 Link or Local Path
        resume_url: { type: DataTypes.STRING },          // Will store S3 Link or Local Path
        bio: { type: DataTypes.TEXT },
        skills: { type: DataTypes.JSON },      // Array of strings or objects
        experience: { type: DataTypes.TEXT },  // Could be JSON or TEXT describing experience
        
        // --- 4. COMPANY LINK (For Employees) ---
        // If they are an employee, which company do they belong to?
        company_id: {
            type: DataTypes.UUID,
            allowNull: true
        },

        // --- 5. AI OVERSEER DATA ---
        last_active_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        is_online: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // AI uses this to gauge "Reliability" (0-100)
        performance_score: {
            type: DataTypes.INTEGER,
            defaultValue: 100 
        },
        
        // --- 6. AUTH TOKENS ---
        reset_token: { type: DataTypes.STRING },
        reset_token_expiry: { type: DataTypes.DATE }
    }, {
        timestamps: true, // Adds createdAt and updatedAt automatically
        hooks: {
            // Hash password before creating user
            beforeCreate: async (user) => {
                if (user.password_hash) {
                    const salt = await bcrypt.genSalt(10);
                    user.password_hash = await bcrypt.hash(user.password_hash, salt);
                }
            },
            // Hash password before updating (if changed)
            beforeUpdate: async (user) => {
                if (user.changed('password_hash')) {
                    const salt = await bcrypt.genSalt(10);
                    user.password_hash = await bcrypt.hash(user.password_hash, salt);
                }
            }
        }
    });

    return User;
};