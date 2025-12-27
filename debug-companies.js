const sequelize = require('./src/config/database');
const CompanyModel = require('./src/models/Company');

const Company = CompanyModel(sequelize);

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection has been established successfully.');
        
        const companies = await Company.findAll({ raw: true });
        
        console.log(`\nFound ${companies.length} companies. Writing to company_dump.json...`);
        const fs = require('fs');
        fs.writeFileSync('company_dump.json', JSON.stringify(companies, null, 2));
        console.log('Done.');

    } catch (error) {
        console.error('❌ Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
};

run();
