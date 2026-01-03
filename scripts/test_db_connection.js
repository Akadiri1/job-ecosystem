require('dotenv').config();
const { Client } = require('pg');
const dns = require('dns');
const { promisify } = require('util');

const lookup = promisify(dns.lookup);

async function testConnection() {
    console.log('🔍 Starting Connectivity Test...');

    // 1. Load Config
    // Use the URL from env or construct it if you have separate vars
    // Assuming DATABASE_URL is in .env based on typical Neon setups
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error('❌ DATABASE_URL not found in .env');
        console.log('   Please make sure .env is loaded correctly.');
        return;
    }

    // Extract hostname for DNS test
    let hostname;
    try {
        // Handle postgres:// connection strings
        const urlPart = dbUrl.split('@')[1]; // after credentials
        if (urlPart) {
            hostname = urlPart.split(':')[0].split('/')[0];
        } else {
             // Fallback if generic string
             console.log('⚠️ Could not parse hostname strictly from URL, attempting basic parse...');
             const match = dbUrl.match(/host=([^;]+)/);
             if (match) hostname = match[1];
        }
    } catch (e) {
        console.error('⚠️ Could not parse hostname from connection string.');
    }

    if (hostname) {
        console.log(`\n📡 Testing DNS Resolution for: ${hostname}`);
        try {
            const result = await lookup(hostname);
            console.log(`   ✅ DNS Resolved: ${result.address}`);
        } catch (e) {
            console.error(`   ❌ DNS Lookup Failed: ${e.code}`);
            console.error(`   Error details: ${e.message}`);
            console.log('\n💡 TIP: This indicates a network or DNS issue on your machine.');
            console.log('   - Check your internet connection');
            console.log('   - Try flushing DNS (ipconfig /flushdns)');
            console.log('   - If using a VPN, try toggling it');
            return; // Stop if DNS fails
        }
    }

    console.log('\n🔌 Testing TCP/Database Connection...');
    const client = new Client({
        connectionString: dbUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('   ✅ Successfully connected to the Database!');
        const res = await client.query('SELECT NOW()');
        console.log(`   ✅ Query execution successful. Server time: ${res.rows[0].now}`);
        await client.end();
        console.log('\n✨ Database connection is HEALTHY.');
    } catch (err) {
        console.error('   ❌ Connection Failed:', err.message);
        console.error('   Code:', err.code);
        if (err.message.includes('EAI_AGAIN')) {
            console.log('\n💡 DIAGNOSIS: DNS Lookup Timeout (EAI_AGAIN)');
            console.log('   This means your computer cannot find the IP address of the database server.');
            console.log('   This is usually temporary or related to your local network connection.');
        }
    }
}

testConnection();
