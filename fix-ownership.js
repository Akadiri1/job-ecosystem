// fix-ownership.js - Temporary script to fix job/company ownership
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        logging: console.log,
    }
);

const OLD_USER_ID = 'ed9624db-897d-4aa8-8897-be0439b9447f';
const NEW_USER_ID = 'd73ee967-984e-4f58-bb98-526b86e15dab';

async function fixOwnership() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Connected!\n');

        // Update jobs
        console.log('Updating Jobs table...');
        const [jobResults] = await sequelize.query(
            `UPDATE "Jobs" SET employer_id = '${NEW_USER_ID}' WHERE employer_id = '${OLD_USER_ID}'`
        );
        console.log('Jobs updated!\n');

        // Update companies
        console.log('Updating Companies table...');
        const [companyResults] = await sequelize.query(
            `UPDATE "Companies" SET owner_id = '${NEW_USER_ID}' WHERE owner_id = '${OLD_USER_ID}'`
        );
        console.log('Companies updated!\n');

        console.log('✅ Ownership transferred successfully!');
        console.log(`All jobs and companies from user ${OLD_USER_ID}`);
        console.log(`are now owned by user ${NEW_USER_ID}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

fixOwnership();
