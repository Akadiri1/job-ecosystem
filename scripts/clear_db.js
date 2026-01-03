const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const sequelize = require('../src/config/database');

// Import all models to ensure associations are known
require('../src/models/User')(sequelize);
require('../src/models/Company')(sequelize);
require('../src/models/Job')(sequelize);
require('../src/models/Application')(sequelize);
require('../src/models/SavedJob')(sequelize);
require('../src/models/TeamMember')(sequelize);
require('../src/models/Channel')(sequelize);
require('../src/models/ChannelMember')(sequelize);
require('../src/models/ChatMessage')(sequelize);
require('../src/models/ChatGroup')(sequelize);
require('../src/models/ChatGroupMember')(sequelize);
require('../src/models/Notification')(sequelize);
require('../src/models/Task')(sequelize);
require('../src/models/TaskComment')(sequelize);
require('../src/models/TaskCommentLike')(sequelize);
require('../src/models/Attendance')(sequelize);
require('../src/models/AIInsight')(sequelize);
require('../src/models/Subscription')(sequelize);
require('../src/models/Payment')(sequelize);

async function clearDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        console.log('⚠️  Dropping and Recreating all tables (clearing data)...');
        // force: true drops tables and re-creates them
        await sequelize.sync({ force: true });
        
        console.log('✅ Database cleared successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing database:', error);
        process.exit(1);
    }
}

clearDatabase();
