require('dotenv').config();
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');
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
        
        // VERIFICATION: Test password comparison
        const verifyUser = await User.findOne({ where: { email: ADMIN_EMAIL } });
        const passwordValid = await bcrypt.compare(NEW_PASSWORD, verifyUser.password_hash);
        console.log('');
        console.log('🔐 Password Verification:', passwordValid ? '✅ PASS' : '❌ FAIL');
        console.log('🔒 Hash stored:', verifyUser.password_hash.substring(0, 20) + '...');
        
        if (!passwordValid) {
            console.log('');
            console.log('⚠️ Password verification failed! This indicates a hashing issue.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

resetAdmin();


