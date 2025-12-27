const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sequelize = require('./src/config/database');
const NotificationModel = require('./src/models/Notification')(sequelize);
const User = require('./src/models/User')(sequelize);

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // User.hasMany(NotificationModel, { foreignKey: 'user_id', as: 'notifications' });
        // NotificationModel.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

        await sequelize.sync({ alter: true }); // Ensure table exists

        const users = await User.findAll({ limit: 5 }); // Notify first 5 users
        
        if (users.length === 0) {
            console.log('No users found to notify.');
            process.exit(0);
        }

        const notificationsArr = [];
        
        users.forEach(user => {
            notificationsArr.push(
                {
                    user_id: user.id,
                    title: 'Welcome to Job Ecosystem',
                    message: 'Thanks for joining! Complete your profile to get started.',
                    type: 'success',
                    is_read: false
                },
                {
                    user_id: user.id,
                    title: 'New Feature Alert',
                    message: 'Check out the new global chat feature.',
                    type: 'info',
                    is_read: false
                },
                {
                    user_id: user.id,
                    title: 'System Maintenance',
                    message: 'Scheduled maintenance will occur on Sunday at 2 AM.',
                    type: 'warning',
                    is_read: true 
                },
                {
                    user_id: user.id,
                    title: 'Group Invitation',
                    message: 'You have been invited to join group "Design Team"',
                    type: 'invite',
                    related_id: 'mock-invite-id', // This will fail action but show UI
                    is_read: false
                }
            );
        });

        await NotificationModel.bulkCreate(notificationsArr);
        console.log(`✅ Created ${notificationsArr.length} notifications for ${users.length} users.`);

    } catch (error) {
        console.error('Error creating notifications:', error);
    } finally {
        await sequelize.close();
        process.exit();
    }
})();
