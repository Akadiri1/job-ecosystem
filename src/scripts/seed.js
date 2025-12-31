/**
 * =============================================================================
 * DATABASE SEED SCRIPT - Initial Data for Job Ecosystem
 * =============================================================================
 * 
 * Run with: node src/scripts/seed.js
 * 
 * Creates:
 * - Super Admin user
 * - Demo employer with company
 * - Demo job seeker
 * - Demo employee
 * =============================================================================
 */
require('dotenv').config();
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

// Import models
const User = require('../models/User')(sequelize);
const Company = require('../models/Company')(sequelize);
const TeamMember = require('../models/TeamMember')(sequelize);
const Subscription = require('../models/Subscription')(sequelize);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@jobecosystem.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

async function seed() {
    try {
        console.log('🌱 Starting database seed...\n');
        
        // Connect to database
        await sequelize.authenticate();
        console.log('✅ Database connected');
        
        // Sync all models (creates tables if they don't exist)
        await sequelize.sync({ alter: true });
        console.log('✅ Database synced\n');
        
        // ======================================
        // 1. CREATE SUPER ADMIN
        // ======================================
        console.log('👑 Creating Super Admin...');
        
        let admin = await User.findOne({ where: { email: ADMIN_EMAIL } });
        
        if (!admin) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
            
            admin = await User.create({
                full_name: 'Super Admin',
                email: ADMIN_EMAIL,
                password_hash: hashedPassword,
                role: 'admin',
                permissions: [
                    'manage_users',
                    'manage_companies',
                    'manage_jobs',
                    'manage_subscriptions',
                    'view_analytics',
                    'system_settings'
                ],
                account_status: 'active'
            });
            console.log(`   ✓ Admin created: ${ADMIN_EMAIL}`);
        } else {
            console.log(`   ⚠ Admin already exists: ${ADMIN_EMAIL}`);
        }
        
        // ======================================
        // 2. CREATE DEMO EMPLOYER
        // ======================================
        console.log('\n🏢 Creating Demo Employer...');
        
        let employer = await User.findOne({ where: { email: 'employer@demo.com' } });
        
        if (!employer) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('Demo@123', salt);
            
            employer = await User.create({
                full_name: 'Demo Employer',
                email: 'employer@demo.com',
                password_hash: hashedPassword,
                role: 'employer',
                account_status: 'active'
            });
            console.log('   ✓ Employer created: employer@demo.com');
            
            // Create demo company
            const company = await Company.create({
                name: 'TechCorp Solutions',
                owner_id: employer.id,
                description: 'A leading technology company specializing in innovative software solutions.',
                industry: 'Technology',
                company_size: '51-200',
                website: 'https://techcorp-demo.com',
                location: 'San Francisco, CA'
            });
            console.log('   ✓ Company created: TechCorp Solutions');
            
            // Add employer as team owner
            await TeamMember.create({
                user_id: employer.id,
                company_id: company.id,
                role: 'owner',
                status: 'active',
                permissions: ['manage_team', 'post_jobs', 'view_applicants', 'manage_tasks']
            });
            
            // Update employer with company_id
            employer.company_id = company.id;
            await employer.save();
            
            // Create free subscription
            await Subscription.create({
                company_id: company.id,
                user_id: employer.id,
                plan: 'free',
                status: 'active',
                job_posts_limit: 3,
                team_members_limit: 5,
                ai_features_enabled: false
            });
            console.log('   ✓ Free subscription activated');
            
        } else {
            console.log('   ⚠ Demo employer already exists');
        }
        
        // ======================================
        // 3. CREATE DEMO JOB SEEKER
        // ======================================
        console.log('\n🔍 Creating Demo Job Seeker...');
        
        let seeker = await User.findOne({ where: { email: 'seeker@demo.com' } });
        
        if (!seeker) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('Demo@123', salt);
            
            seeker = await User.create({
                full_name: 'Demo Job Seeker',
                email: 'seeker@demo.com',
                password_hash: hashedPassword,
                role: 'job_seeker',
                account_status: 'active',
                bio: 'Passionate software developer looking for new opportunities.',
                skills: ['JavaScript', 'React', 'Node.js', 'Python']
            });
            console.log('   ✓ Job seeker created: seeker@demo.com');
        } else {
            console.log('   ⚠ Demo job seeker already exists');
        }
        
        // ======================================
        // 4. CREATE DEMO EMPLOYEE
        // ======================================
        console.log('\n👤 Creating Demo Employee...');
        
        let employee = await User.findOne({ where: { email: 'employee@demo.com' } });
        
        if (!employee) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('Demo@123', salt);
            
            // Get demo company
            const demoCompany = await Company.findOne({ where: { name: 'TechCorp Solutions' } });
            
            if (demoCompany) {
                employee = await User.create({
                    full_name: 'Demo Employee',
                    email: 'employee@demo.com',
                    password_hash: hashedPassword,
                    role: 'employee',
                    account_status: 'active',
                    company_id: demoCompany.id
                });
                
                // Add as team member
                await TeamMember.create({
                    user_id: employee.id,
                    company_id: demoCompany.id,
                    role: 'member',
                    status: 'active',
                    permissions: ['view_tasks']
                });
                
                console.log('   ✓ Employee created: employee@demo.com');
            }
        } else {
            console.log('   ⚠ Demo employee already exists');
        }
        
        // ======================================
        // SUMMARY
        // ======================================
        console.log('\n========================================');
        console.log('🎉 SEED COMPLETE!');
        console.log('========================================');
        console.log('\nTest Accounts:');
        console.log('----------------------------------------');
        console.log(`Super Admin:  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
        console.log('Employer:     employer@demo.com / Demo@123');
        console.log('Job Seeker:   seeker@demo.com / Demo@123');
        console.log('Employee:     employee@demo.com / Demo@123');
        console.log('----------------------------------------\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Seed Error:', error);
        process.exit(1);
    }
}

seed();
