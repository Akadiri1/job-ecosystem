const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sendEmail } = require('../src/services/emailService');

async function testEmail() {
    console.log('🔍 Starting Email Diagnostic...');
    
    // Check Env
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com'; // Default per service
    
    console.log(`- EMAIL_HOST: ${host}`);
    console.log(`- EMAIL_USER: ${user ? user : '❌ NOT SET'}`);
    console.log(`- EMAIL_PASS: ${pass ? (pass.length > 0 ? '✅ SET (Hidden)' : '❌ EMPTY') : '❌ NOT SET'}`);

    if (!user || !pass) {
        console.error('❌ Critical: EMAIL_USER or EMAIL_PASS is missing in .env file.');
        console.log('   Please set these values. If using Gmail, you MUST use an App Password, not your login password.');
        return;
    }

    // Try Sending
    console.log('🚀 Attempting to send test email...');
    const result = await sendEmail(user, 'Test Email from Debug Script', '<p>This is a test email to verify configuration.</p>');
    
    if (result) {
        console.log('✅ Email sent successfully!');
    } else {
        console.error('❌ Email failed to send. Check the logs above for specific error details.');
    }
}

testEmail();
