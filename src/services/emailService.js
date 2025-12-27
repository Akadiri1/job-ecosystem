const nodemailer = require('nodemailer');

// 1. Create Helper Function
const sendEmail = async (to, subject, html) => {
    try {
        // Robust Transporter Configuration
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT || '465'),
            secure: true, // Use SSL/TLS
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false, // Helps in dev environments with self-signed certs or antivirus issues
                ciphers: 'SSLv3'
            },
            connectionTimeout: 10000, // 10 seconds
            greetingTimeout: 10000,
            socketTimeout: 20000
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: to,
            subject: subject,
            html: html
        };

        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}: ${result.messageId}`);
        return true;
    } catch (error) {
        console.error("❌ Email Send Error:", error);
        return false;
    }
};

// 2. Team Invitation Email
const sendTeamInvitation = async ({ to, inviteeName, inviterName, companyName, tempPassword, loginUrl }) => {
    const subject = `🎉 You've been invited to join ${companyName} on Job Ecosystem`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; border-collapse: collapse; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 40px 40px 20px 40px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Welcome to the Team! 🚀</h1>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 0 40px;">
                                <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                                    <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                        Hi <strong>${inviteeName || 'there'}</strong>,
                                    </p>
                                    <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                                        <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Job Ecosystem as a team member.
                                    </p>
                                    
                                    <!-- Credentials Box -->
                                    <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); border-radius: 10px; padding: 24px; margin: 24px 0; border-left: 4px solid #667eea;">
                                        <p style="margin: 0 0 12px 0; color: #333; font-weight: 600;">Your Login Credentials:</p>
                                        <table style="width: 100%;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #666;">📧 Email:</td>
                                                <td style="padding: 8px 0; color: #333; font-weight: 500;">${to}</td>
                                            </tr>
                                            ${tempPassword ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #666;">🔑 Temporary Password:</td>
                                                <td style="padding: 8px 0; color: #333; font-weight: 500; font-family: monospace; background: #fff3cd; padding: 4px 8px; border-radius: 4px;">${tempPassword}</td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    </div>
                                    
                                    <!-- CTA Button -->
                                    <div style="text-align: center; margin: 32px 0;">
                                        <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                                            Login to Your Account →
                                        </a>
                                    </div>
                                    
                                    ${tempPassword ? `
                                    <p style="color: #888; font-size: 13px; line-height: 1.5; margin: 0; text-align: center; padding-top: 16px; border-top: 1px solid #eee;">
                                        ⚠️ Please change your password after your first login for security.
                                    </p>
                                    ` : ''}
                                </div>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 30px 40px; text-align: center;">
                                <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0;">
                                    © ${new Date().getFullYear()} Job Ecosystem. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
    
    return await sendEmail(to, subject, html);
};

// 3. Task Assignment Email
const sendTaskAssignment = async ({ to, inviteeName, taskTitle, taskUrl, assignerName }) => {
    const subject = `New Task Assigned: ${taskTitle}`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; max-width: 600px; margin: 20px auto; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <tr>
                <td style="background-color: #0d6efd; padding: 20px; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0;">New Task Assigned</h1>
                </td>
            </tr>
            <tr>
                <td style="padding: 30px; color: #333333;">
                    <p>Hello <strong>${inviteeName}</strong>,</p>
                    <p><strong>${assignerName}</strong> has assigned you a new task: <strong>${taskTitle}</strong>.</p>
                    <p>Please log in to review and accept the task.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${taskUrl}" style="background-color: #0d6efd; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">View Task</a>
                    </div>
                    <p style="font-size: 12px; color: #777;">If the button doesn't work, copy this link: ${taskUrl}</p>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
    
    return sendEmail(to, subject, html);
};

module.exports = {
    sendEmail,
    sendTeamInvitation,
    sendTaskAssignment
};
