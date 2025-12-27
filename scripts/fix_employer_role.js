const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const sequelize = require('../src/config/database');
const User = require('../src/models/User')(sequelize);
const Company = require('../src/models/Company')(sequelize);

const fixRoles = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected.');

        // 1. Find all Companies
        const companies = await Company.findAll();
        
        for (const company of companies) {
            // 2. Find the Owner
            const owner = await User.findByPk(company.owner_id);
            
            if (owner) {
                console.log(`Checking Owner: ${owner.full_name} (${owner.email}) - Role: ${owner.role}, CompanyID: ${owner.company_id}`);
                
                let needsSave = false;

                // 3. Fix Role if demoted
                if (owner.role !== 'employer') {
                    console.log(`⚠️ FIXING ROLE for ${owner.email}...`);
                    owner.role = 'employer';
                    needsSave = true;
                }

                // 4. Fix Self-Employment (Owner shouldn't be an employee of their own company in this context)
                if (owner.company_id === company.id) {
                    console.log(`⚠️ REMOVING SELF-LINK (company_id) for ${owner.email}...`);
                    owner.company_id = null; // Remove the "Employee" link
                    needsSave = true;
                }

                if (needsSave) {
                    await owner.save();
                    console.log(`✅ ACCOUNT RESTORED: ${owner.email} is an Employer again.`);
                } else {
                    console.log(`👍 Account is healthy.`);
                }
            }
        }

    } catch (error) {
        console.error('Error fixing roles:', error);
    } finally {
        await sequelize.close();
    }
};

fixRoles();
