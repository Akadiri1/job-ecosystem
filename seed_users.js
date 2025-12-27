
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const sequelize = require('./src/config/database');
const User = require('./src/models/User')(sequelize);
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const count = await User.count();
        console.log(`Current user count: ${count}`);

        if (count < 5) {
            console.log('Seeding dummy users...');
            const password = await bcrypt.hash('password123', 10);
            
            const users = [
                {
                    id: uuidv4(),
                    full_name: 'Alice Johnson',
                    email: 'alice@example.com',
                    password: password,
                    role: 'job_seeker',
                    profile_picture_url: 'https://laravelui.spruko.com/zeno/build/assets/images/faces/2.jpg'
                },
                {
                    id: uuidv4(),
                    full_name: 'Bob Smith',
                    email: 'bob@example.com',
                    password: password,
                    role: 'employer',
                    profile_picture_url: 'https://laravelui.spruko.com/zeno/build/assets/images/faces/3.jpg'
                },
                {
                    id: uuidv4(),
                    full_name: 'Charlie Brown',
                    email: 'charlie@example.com',
                    password: password,
                    role: 'job_seeker',
                    profile_picture_url: 'https://laravelui.spruko.com/zeno/build/assets/images/faces/4.jpg'
                },
                {
                    id: uuidv4(),
                    full_name: 'David Wilson',
                    email: 'david@example.com',
                    password: password,
                    role: 'employer',
                    profile_picture_url: 'https://laravelui.spruko.com/zeno/build/assets/images/faces/5.jpg'
                },
                 {
                    id: uuidv4(),
                    full_name: 'Eva Green',
                    email: 'eva@example.com',
                    password: password,
                    role: 'job_seeker',
                    profile_picture_url: 'https://laravelui.spruko.com/zeno/build/assets/images/faces/10.jpg'
                }
            ];

            for (const u of users) {
                // Check if exists by email to be safe
                const exists = await User.findOne({ where: { email: u.email } });
                if (!exists) {
                    await User.create(u);
                    console.log(`Created user: ${u.full_name}`);
                }
            }
            console.log('Seeding completed.');
        } else {
            console.log('Enough users exist. No seeding needed.');
        }

    } catch (error) {
        console.error('Seeding error:', error);
    } finally {
        // await sequelize.close(); // Keep connection open or close? Script ends anyway.
        process.exit();
    }
}

seed();
