const sequelize = require('./src/config/database');
const User = require('./src/models/User')(sequelize);

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection has been established successfully.');
        
        await sequelize.sync();
        console.log('✅ Models synced successfully.');
        
        const userCount = await User.count();
        console.log(`✅ Users in DB: ${userCount}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
        process.exit(1);
    }
}

testConnection();
