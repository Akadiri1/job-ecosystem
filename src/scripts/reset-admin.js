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

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);

        const [updated] = await User.update(
            { password_hash: hashedPassword, role: 'admin' },
            { where: { email: ADMIN_EMAIL } }
        );

        if (updated) {
            console.log(`✅ Admin password reset successfully to: ${NEW_PASSWORD}`);
        } else {
            // If user doesn't exist, create it
            await User.create({
                full_name: 'Super Admin',
                email: ADMIN_EMAIL,
                password_hash: hashedPassword,
                role: 'admin',
                account_status: 'active'
            });
            console.log(`✅ Admin account created with password: ${NEW_PASSWORD}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit();
    }
}

resetAdmin();
