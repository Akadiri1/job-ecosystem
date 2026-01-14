require('dotenv').config();
const sequelize = require('../config/database');
const User = require('../models/User')(sequelize);

const ADMIN_EMAIL = 'admin@jobecosystem.com';
const NEW_PASSWORD = 'Admin@123';

async function resetAdmin() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        // Delete existing admin if exists
        const deleted = await User.destroy({ where: { email: ADMIN_EMAIL } });
        if (deleted) {
            console.log('🗑️ Deleted existing admin account');
        }

        // Create fresh admin - beforeCreate hook will hash password
        const admin = await User.create({
            full_name: 'Super Admin',
            email: ADMIN_EMAIL,
            password_hash: NEW_PASSWORD,  // Hook will hash this once
            role: 'admin',
            account_status: 'active'
        });

        console.log('✅ Admin account created successfully!');
        console.log('📧 Email:', ADMIN_EMAIL);
        console.log('🔑 Password:', NEW_PASSWORD);
        console.log('🆔 User ID:', admin.id);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

resetAdmin();


