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

        // Find existing admin user
        let admin = await User.findOne({ where: { email: ADMIN_EMAIL } });

        if (admin) {
            // Update existing user - hash password manually since we're updating directly
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
            
            // Use raw update to bypass hooks (avoid double hashing)
            await User.update(
                { password_hash: hashedPassword, role: 'admin', account_status: 'active' },
                { where: { email: ADMIN_EMAIL }, individualHooks: false }
            );
            console.log(`✅ Admin password reset to: ${NEW_PASSWORD}`);
        } else {
            // Create new admin - model hook will hash password_hash field
            // So we pass plain password and let hook handle it
            await User.create({
                full_name: 'Super Admin',
                email: ADMIN_EMAIL,
                password_hash: NEW_PASSWORD,  // Hook will hash this
                role: 'admin',
                account_status: 'active'
            });
            console.log(`✅ Admin account created with password: ${NEW_PASSWORD}`);
        }
        
        console.log('📧 Email:', ADMIN_EMAIL);
        console.log('🔑 Password:', NEW_PASSWORD);
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

resetAdmin();

