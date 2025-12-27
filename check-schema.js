// check-schema.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sequelize = require('./src/config/database');

async function checkSchema() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected!');

        const [results] = await sequelize.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'Jobs'
        `);

        console.log('\n📊 Current Columns in "Jobs" table:');
        results.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type}`);
        });

        const essentialColumns = ['skills', 'category', 'experience', 'qualification', 'vacancies'];
        const missingColumns = [];

        essentialColumns.forEach(ec => {
            if (!results.find(r => r.column_name === ec)) {
                missingColumns.push(ec);
            }
        });

        if (missingColumns.length > 0) {
            console.log('\n❌ ERROR: Missing columns:', missingColumns.join(', '));
            console.log('Try restarting the server to trigger alter:true');
        } else {
            console.log('\n✅ All essential columns are present!');
        }

    } catch (error) {
        console.error('❌ Error checking schema:', error);
    } finally {
        await sequelize.close();
    }
}

checkSchema();
