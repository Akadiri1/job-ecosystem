/**
 * Test Push Notification Script
 * Run: node scripts/test_push.js
 * 
 * This directly tests if web-push can send notifications to registered devices.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../src/config/database');
const PushSubscription = require('../src/models/PushSubscription')(sequelize);
const { webpush } = require('../src/config/push');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected');

        // Find all subscriptions
        const subscriptions = await PushSubscription.findAll();
        console.log(`📦 Found ${subscriptions.length} push subscription(s) in database`);

        if (subscriptions.length === 0) {
            console.log('❌ No subscriptions found! The browser subscription is not being saved.');
            console.log('   Check if /api/notifications/subscribe is being called and succeeding.');
            process.exit(1);
        }

        // Send test notification to each
        for (const sub of subscriptions) {
            console.log(`\n🔔 Sending test push to user ${sub.user_id}...`);
            console.log(`   Endpoint: ${sub.endpoint.substring(0, 50)}...`);

            const payload = JSON.stringify({
                title: 'Test Notification',
                body: 'If you see this, push notifications are WORKING!',
                icon: '/assets/images/icons/android-icon-192x192.png',
                url: '/dashboard'
            });

            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                const result = await webpush.sendNotification(pushConfig, payload);
                console.log('   ✅ Push sent successfully! Status:', result.statusCode);
            } catch (err) {
                console.error('   ❌ Push FAILED:', err.message);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log('   📛 Subscription expired/invalid - deleting it');
                    await sub.destroy();
                }
            }
        }

        console.log('\n🏁 Test Complete!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
})();
