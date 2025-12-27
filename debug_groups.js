const path = require('path');
require('dotenv').config();
const sequelize = require('./src/config/database');
const User = require('./src/models/User')(sequelize);
const ChatGroup = require('./src/models/ChatGroup')(sequelize);
const ChatGroupMember = require('./src/models/ChatGroupMember')(sequelize);

async function checkGroups() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        const groups = await ChatGroup.findAll();
        console.log(`\n📋 Found ${groups.length} Groups:`);
        groups.forEach(g => console.log(` - [${g.id}] ${g.name} (Created by ${g.created_by})`));

        const members = await ChatGroupMember.findAll();
        console.log(`\n👥 Found ${members.length} Memberships:`);
        members.forEach(m => console.log(` - Group ${m.group_id} | User ${m.user_id} | Admin: ${m.is_admin}`));

        if(groups.length > 0 && members.length === 0) {
            console.warn("\n⚠️ WARNING: Groups exist but have NO members. This is why nothing shows up!");
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkGroups();
