
require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false
});

// Define Minimal Models
const User = require('./src/models/User')(sequelize);
const Company = require('./src/models/Company')(sequelize);
const TeamMember = require('./src/models/TeamMember')(sequelize);

// Initialize Associations (Simplified)
Company.hasMany(TeamMember, { foreignKey: 'company_id', as: 'team_members' });
TeamMember.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
TeamMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

async function check() {
    try {
        await sequelize.authenticate();
        console.log('Connection OK.');

        const usersCount = await User.count();
        const teamCount = await TeamMember.count();
        
        console.log(`Total Users in DB: ${usersCount}`);
        console.log(`Total Team Memberships: ${teamCount}`);
        
        if(teamCount > 0) {
            const members = await TeamMember.findAll({
                include: [{ model: User, as: 'user' }]
            });
            console.log('Members found:', members.map(m => m.user ? m.user.email : 'Unknown'));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

check();
