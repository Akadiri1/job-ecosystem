
const getBaseTemplate = (content, companyName) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background-color: #4a90e2; padding: 30px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 40px 30px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #999; border-top: 1px solid #eee; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #4a90e2; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
    .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 20px; }
    .status-shortlisted { background-color: #e3f2fd; color: #1976d2; }
    .status-hired { background-color: #e8f5e9; color: #2e7d32; }
    .status-rejected { background-color: #ffebee; color: #c62828; }
</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${companyName}</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.
        </div>
    </div>
</body>
</html>
`;

exports.getShortlistTemplate = (candidateName, jobTitle, companyName) => {
    const content = `
        <div style="text-align: center;">
            <span class="status-badge status-shortlisted">Application Update: Shortlisted</span>
        </div>
        <h2>Great news, ${candidateName}!</h2>
        <p>We are pleased to inform you that your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong> has been shortlisted.</p>
        <p>Our team was impressed with your profile and we would like to move forward. You can expect to hear from us shortly regarding the next steps, which may include an interview invitation or a technical assessment.</p>
        <p>Please keep an eye on your inbox!</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/my-applications" class="btn">View Application Status</a>
        </div>
    `;
    return getBaseTemplate(content, companyName);
};

exports.getHiredTemplate = (candidateName, jobTitle, companyName) => {
    const content = `
        <div style="text-align: center;">
            <span class="status-badge status-hired">Application Update: Hired</span>
        </div>
        <h2>Congratulations, ${candidateName}!</h2>
        <p>We are thrilled to offer you the position of <strong>${jobTitle}</strong> at <strong>${companyName}</strong>!</p>
        <p>Your skills and experience are a perfect match for our team. We are excited about the possibility of you joining us and making an impact.</p>
        <p><strong>Next Steps:</strong> Your account has been upgraded. You now have access to our private company workspace.</p>
        <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/dashboard" class="btn" style="background-color: #2e7d32;">Go to Workspace</a>
        </div>
    `;
    return getBaseTemplate(content, companyName);
};

exports.getRejectedTemplate = (candidateName, jobTitle, companyName) => {
    const content = `
        <div style="text-align: center;">
            <span class="status-badge status-rejected">Application Update</span>
        </div>
        <p>Dear ${candidateName},</p>
        <p>Thank you for giving us the opportunity to consider your application for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
        <p>We have received a large number of applications, and after careful review, we have decided to move forward with other candidates whose qualifications more closely align with our current needs.</p>
        <p>We appreciate the time you took to apply and wish you the very best in your job search.</p>
    `;
    return getBaseTemplate(content, companyName);
};
