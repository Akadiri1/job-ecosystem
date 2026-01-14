// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); 

// ==========================================
// HELPER FUNCTIONS - User Agent Parsing
// ==========================================
function parseDeviceType(userAgent) {
    if (!userAgent) return 'Unknown';
    if (/mobile/i.test(userAgent)) return 'Mobile';
    if (/tablet|ipad/i.test(userAgent)) return 'Tablet';
    return 'Desktop';
}

function parseBrowser(userAgent) {
    if (!userAgent) return 'Unknown';
    if (/edg/i.test(userAgent)) return 'Edge';
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/opera|opr/i.test(userAgent)) return 'Opera';
    if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';
    return 'Unknown';
}

function parseOS(userAgent) {
    if (!userAgent) return 'Unknown';
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    return 'Unknown';
}

// ==========================================
// 1. SIGNUP CONTROLLER
// ==========================================
exports.signup = async (req, res) => {
    console.log("🚀 Signup Request Body:", req.body);
    const { User, UserActivity } = req.db_models;

    if (!User) return res.status(500).json({ error: "Server Error: User model failed to load." });

    try {
        const { name, email, password, role, phone } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Send plain password (hashed by User.js hook)
        const newUser = await User.create({
            full_name: name,
            email: email,
            password_hash: password, 
            role: role || 'job_seeker',
            phone_number: phone
        });

        // Log signup activity
        try {
            const userAgent = req.headers['user-agent'] || '';
            await UserActivity.create({
                user_id: newUser.id,
                event_type: 'signup',
                ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
                user_agent: userAgent,
                device_type: parseDeviceType(userAgent),
                browser: parseBrowser(userAgent),
                os: parseOS(userAgent),
                metadata: { registration_role: role || 'job_seeker' }
            });
        } catch (activityErr) {
            console.error('Activity logging error:', activityErr);
        }

        console.log("✅ User created successfully:", newUser.id);
        res.status(201).json({ message: 'User registered successfully!', userId: newUser.id });

    } catch (error) {
        console.error("❌ Signup Error:", error);
        res.status(500).json({ error: error.message || 'Signup failed' });
    }
};

// ==========================================
// 2. LOGIN CONTROLLER
// ==========================================
exports.login = async (req, res) => {
    console.log("🚀 [DEBUG] Login Request Received for:", req.body.email);
    
    if (!req.db_models) {
        console.error("❌ [DEBUG] req.db_models IS UNDEFINED!");
        return res.status(500).json({ error: "Server Error: Database models not injected." });
    }

    const { User, UserActivity } = req.db_models;
    if (!User) {
        console.error("❌ [DEBUG] User model is missing from req.db_models");
        return res.status(500).json({ error: "Server Error: User model missing." });
    }

    try {
        const { email, password } = req.body;

        const user = await User.findOne({ where: { email } });
        if (!user) {
            console.warn(`⚠️ [DEBUG] User not found: ${email}`);
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        if (!user.password_hash) {
             console.warn("⚠️ [DEBUG] User has no password hash");
             return res.status(400).json({ error: 'Invalid email or password (Try social login)' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.warn("⚠️ [DEBUG] Password mismatch");
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        if (user.account_status === 'suspended') {
            return res.status(403).json({ error: "Your account is deactivated. Please contact your administrator." });
        }

        // Log login activity
        try {
            const userAgent = req.headers['user-agent'] || '';
            await UserActivity.create({
                user_id: user.id,
                event_type: 'login',
                ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
                user_agent: userAgent,
                device_type: parseDeviceType(userAgent),
                browser: parseBrowser(userAgent),
                os: parseOS(userAgent),
                metadata: { login_method: 'email' }
            });

            // Update last_active_at
            user.last_active_at = new Date();
            user.is_online = true;
            await user.save();
        } catch (activityErr) {
            console.error('Activity logging error:', activityErr);
        }

        const secretKey = process.env.JWT_SECRET || 'temporary_dev_secret_key';
        const token = jwt.sign({ id: user.id, role: user.role }, secretKey, { expiresIn: '30d' });

        console.log("✅ [DEBUG] Login Successful");
        res.json({
            message: 'Login successful!',
            token: token,
            user: { id: user.id, name: user.full_name, role: user.role }
        });

    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
};

// ==========================================
// 3. FORGOT PASSWORD CONTROLLER (SEND OTP)
// ==========================================
exports.forgotPassword = async (req, res) => {
    console.log("❓ Forgot Password Request:", req.body);
    const { User } = req.db_models;
    
    if (!User) return res.status(500).json({ error: "Server Error: User model missing." });

    try {
        const { email } = req.body;

        // 1. Find User
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "User with this email does not exist." });
        }

        // 2. Generate OTP (Random 6 digits)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryTime = new Date(Date.now() + 3600000); // Expires in 1 Hour

        // 3. Save OTP to Database
        user.reset_token = otp;
        user.reset_token_expiry = expiryTime;
        await user.save();

        console.log(`💾 OTP Saved for ${email}: ${otp}`);

        // 4. Send Email (Mock vs Real)
        
        // CHECK: Do we have email credentials in .env?
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.warn("⚠️ NO EMAIL CREDENTIALS IN .ENV - MOCKING EMAIL SENDING");
            console.log("========================================");
            console.log(`📧 TO: ${email}`);
            console.log(`🔑 YOUR OTP CODE IS: ${otp}`);
            console.log("========================================");
            
            return res.json({ 
                message: "Test Mode: OTP sent to server console!", 
                debug_otp: otp 
            });
        }

        // REAL EMAIL SENDING
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: '"Job Ecosystem" <no-reply@jobecosystem.com>',
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Password Reset Request</h2>
                    <p>You requested a password reset. Your OTP code is:</p>
                    <h1 style="color: #7b1fa2; letter-spacing: 5px;">${otp}</h1>
                    <p>This code expires in 1 hour.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully");

        res.json({ message: "OTP sent to your email!" });

    } catch (error) {
        console.error("❌ Forgot Password Error:", error);
        res.status(500).json({ error: "Failed to process request: " + error.message });
    }
};

// ==========================================
// 4. RESET PASSWORD CONTROLLER (VERIFY OTP & UPDATE)
// ==========================================
exports.resetPassword = async (req, res) => {
    console.log("🔄 Reset Password Request:", req.body);
    const { User } = req.db_models;

    if (!User) return res.status(500).json({ error: "Server Error: User model missing." });

    try {
        const { email, otp, newPassword } = req.body;

        // 1. Find User
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // 2. Validate OTP
        if (user.reset_token !== otp) {
            return res.status(400).json({ error: "Invalid OTP Code." });
        }
        
        // Check Expiry
        if (new Date() > new Date(user.reset_token_expiry)) {
            return res.status(400).json({ error: "OTP has expired. Please request a new one." });
        }

        // 3. Update Password
        // Note: The 'beforeCreate' hook handles hashing for new users.
        // For updates, we usually need a 'beforeUpdate' hook or manual hashing.
        // To be safe, let's manually hash it here if your hook only runs on 'create'.
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        user.password_hash = hashedPassword;
        user.reset_token = null;          // Clear the OTP
        user.reset_token_expiry = null;   // Clear expiry
        
        await user.save();

        console.log(`✅ Password updated successfully for ${email}`);
        res.json({ message: "Password updated successfully!" });

    } catch (error) {
        console.error("❌ Reset Password Error:", error);
        res.status(500).json({ error: "Failed to reset password." });
    }
};

// ==========================================
// 5. GET CURRENT USER (The "Who Am I?" Function)
// ==========================================
exports.getMe = async (req, res) => {
    // The Middleware (authMiddleware.js) has already found the user 
    // and attached it to 'req.user'. We just need to send it back.
    
    try {
        const user = req.user;
        let stats = {};

        // [NEW] Fetch Employee Stats
        if (user.role === 'employee' && user.company_id) {
             const { Task, TeamMember } = req.db_models;
             const { Op } = require('sequelize');
             
             // Get Team Count
             const teamCount = await TeamMember.count({ where: { company_id: user.company_id } });
             
             // Get Tasks - using simple equality for assigned_to (UUID)
             const assignedTasks = await Task.count({ 
                 where: { 
                     assigned_to: user.id,
                     status: { [Op.in]: ['todo', 'in_progress'] } 
                 } 
             });
             const completedTasks = await Task.count({ 
                 where: { 
                     assigned_to: user.id,
                     status: 'completed' 
                 } 
             });
             const pendingReviews = await Task.count({ 
                 where: { 
                     assigned_to: user.id,
                     status: 'review' 
                 } 
             });

             stats = {
                teamCount,
                assignedTasks,
                completedTasks,
                pendingReviews
             };
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                phone_number: user.phone_number,
                bio: user.bio,
                profile_picture_url: user.profile_picture_url,
                website_url: user.website_url,
                // We will add Company details here later
            },
            stats // [NEW] Return stats
        });
    } catch (error) {
        console.error("❌ GetMe Error:", error);
        res.status(500).json({ error: "Server Error" });
    }
};

// Add no-cache middleware for auth routes to prevent 304 caching
exports.noCache = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
};

// ==========================================
// 6. PROTECT MIDDLEWARE (Verify Token)
// ==========================================
exports.protect = async (req, res, next) => {
    let token;

    // 1. Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (Format: "Bearer <token>")
            token = req.headers.authorization.split(' ')[1];

            // 2. Verify Token
            const secretKey = process.env.JWT_SECRET || 'temporary_dev_secret_key';
            const decoded = jwt.verify(token, secretKey);

            // 3. Get User from DB
            // We use req.db_models because you injected it in server.js
            const { User } = req.db_models; 
            
            const user = await User.findByPk(decoded.id);

            if (!user) {
                return res.status(401).json({ error: "User belonging to this token no longer exists." });
            }

            // 4. Attach user to request object
            req.user = user; 
            next();

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                 console.warn("⚠️ Token expired.");
                 return res.status(401).json({ error: "Your session has expired. Please log in again." });
            }
            console.error("❌ Auth Middleware Error (Token Verification):", error);
            return res.status(401).json({ error: "Not authorized, token failed" });
        }
    }

    if (!token) {
        return res.status(401).json({ error: "Not authorized, no token provided" });
    }
};

// ==========================================
// 6. UPDATE USER DETAILS
// ==========================================
exports.updateDetails = async (req, res) => {
    try {
        const { User } = req.db_models;
        const { name, email, phone } = req.body;

        // 1. Find the user (req.user.id comes from the 'protect' middleware)
        const user = await User.findByPk(req.user.id);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // 2. Update fields
        user.full_name = name || user.full_name;
        user.phone_number = phone || user.phone_number;
        user.bio = req.body.bio || user.bio; // Add Bio support
        user.website_url = req.body.website || user.website_url; // Add Website support if model has it (checking model in next step, but adding robustly)

        // Handle File Upload
        if (req.file) {
            // Construct public URL
            // server.js serves '../public/uploads' as '/uploads'
            const publicUrl = `/uploads/profiles/${req.file.filename}`;
            user.profile_picture_url = publicUrl;
        }

        // Restriction: Employees cannot change their email
        if (req.user.role !== 'employee') {
            user.email = email || user.email;
        } else if (email && email !== user.email) {
            console.log("⚠️ Employee attempted to change email - Blocked.");
            // Optional: return error or just ignore. Ignoring is safer/simpler here as we'll disable UI too.
            // If we wanted to be strict: return res.status(403).json({ error: "Employees cannot change workspace email." });
            // Let's just ignore it to avoid breaking if frontend sends existing email.
        }

        // 3. Save
        await user.save();

        res.json({ 
            success: true, 
            message: "Profile updated successfully!", 
            user: {
                id: user.id,
                name: user.full_name,
                email: user.email,
                phone: user.phone_number,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({ error: "Server Error updating profile" });
    }
};

// ==========================================
// 7. CHANGE PASSWORD
// ==========================================
exports.changePassword = async (req, res) => {
    try {
        const { User } = req.db_models;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Current password and new password are required." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters." });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: "Current password is incorrect." });
        }

        // Hash new password - FIXED: Do NOT hash here, let User model hook handle it to avoid double hashing
        // const salt = await bcrypt.genSalt(10);
        // user.password_hash = await bcrypt.hash(newPassword, salt);
        
        user.password_hash = newPassword; // Model hook will hash this
        await user.save();

        res.json({ success: true, message: "Password changed successfully!" });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ error: "Server Error changing password" });
    }
};