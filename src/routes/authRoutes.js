// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Helper to handle social login success
const handleSocialLogin = (req, res) => {
    const user = req.user;
    const token = jwt.sign(
        { id: user.id, role: user.role }, 
        process.env.JWT_SECRET || 'job_ecosystem_secret_key', 
        { expiresIn: '1h' }
    );
    
    // Pass token and user info via query params so frontend can grab them
    const userData = JSON.stringify({
        id: user.id, 
        name: user.full_name, 
        role: user.role
    });
    
    
    let redirectPath = '/dashboard';
    if (user.role === 'employer') redirectPath = '/dashboard/employer';
    else if (user.role === 'employee') redirectPath = '/dashboard/employee';
    else redirectPath = '/dashboard/seeker';

    res.redirect(`${redirectPath}?token=${token}&user=${encodeURIComponent(userData)}`);
};

// Import ALL controller functions in one go
const { 
    signup, 
    login, 
    forgotPassword, 
    resetPassword, 
    getMe, 
    protect, 
    updateDetails,
    changePassword
} = require('../controllers/authController');

// Import validators
const { 
    signupValidator, 
    loginValidator, 
    forgotPasswordValidator, 
    resetPasswordValidator 
} = require('../middleware/validators');

// --- Auth Routes (with validation) ---
router.post('/signup', signupValidator, signup);
router.post('/login', loginValidator, login);
router.post('/forgot-password', forgotPasswordValidator, forgotPassword);
router.post('/reset-password', resetPasswordValidator, resetPassword);

// --- Social Auth Routes ---
// --- Social Auth Routes ---

// GOOGLE
router.get('/google', (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(503).send("⚠️ Service Unavailable: Google Login is not configured. Please add GOOGLE_CLIENT_ID to .env");
    }
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback', 
    (req, res, next) => {
         if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.redirect('/login');
        }
        passport.authenticate('google', { failureRedirect: '/login' })(req, res, next);
    },
    handleSocialLogin
);

// FACEBOOK
router.get('/facebook', (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
         return res.status(503).send("⚠️ Service Unavailable: Facebook Login is not configured. Please add FACEBOOK_APP_ID to .env");
    }
    passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get('/facebook/callback',
    (req, res, next) => {
        if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
            return res.redirect('/login');
        }
        passport.authenticate('facebook', { failureRedirect: '/login' })(req, res, next);
    },
    handleSocialLogin
);
// Import upload middleware
const upload = require('../middleware/upload');

// --- Protected User Routes ---
router.get('/me', protect, (req, res, next) => {
    // Prevent caching to ensure suspension check runs every time
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
}, getMe);
router.put('/updatedetails', protect, upload.single('profile_picture'), updateDetails); // <--- Added upload middleware
router.put('/change-password', protect, changePassword); // <--- Password change

// DEV ONLY: Quick role switch endpoint
router.post('/switch-role', protect, async (req, res) => {
    const { role } = req.body; // 'employer' or 'job_seeker'
    const { User } = req.db_models;
    
    if (!['employer', 'job_seeker', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Use: employer, job_seeker, or admin' });
    }
    
    const user = await User.findByPk(req.user.id);
    user.role = role;
    await user.save();
    
    // Generate new token with updated role
    const newToken = jwt.sign(
        { id: user.id, role: user.role }, 
        process.env.JWT_SECRET || 'job_ecosystem_secret_key', 
        { expiresIn: '1h' }
    );
    
    res.json({ 
        success: true, 
        message: `Role updated to ${role}. Please use the new token.`,
        token: newToken,
        user: { id: user.id, name: user.full_name, role: user.role }
    });
});

module.exports = router;