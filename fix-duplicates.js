const sequelize = require('./src/config/database');
const CompanyModel = require('./src/models/Company');

const Company = CompanyModel(sequelize);

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB.');
        
        const idToDelete = '2b5d647a-1e91-4fc5-8d10-a6d1ee75507c'; // Fresh Start Corp
        
        const result = await Company.destroy({
            where: { id: idToDelete }
        });
        
        if (result) {
            console.log(`✅ Successfully deleted Company ID: ${idToDelete}`);
        } else {
            console.log(`⚠️ Company ID ${idToDelete} not found.`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sequelize.close();
    }
};

run();
