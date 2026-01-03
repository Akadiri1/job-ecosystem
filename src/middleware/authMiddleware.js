const jwt = require('jsonwebtoken');

exports.protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

            req.user = await req.db_models.User.findByPk(decoded.id);

            if (req.user && req.user.account_status === 'suspended') {
                 return res.status(403).json({ error: "Your account has been deactivated. Please contact your administrator." });
            }

            // [NEW] Check Team Suspension (For Employees)
            if (req.user && req.user.role === 'employee' && req.user.company_id) {
                console.log(`[Suspension Check] Employee ${req.user.id} belongs to company ${req.user.company_id}`);
                
                const member = await req.db_models.TeamMember.findOne({
                    where: { user_id: req.user.id, company_id: req.user.company_id }
                });
                
                console.log(`[Suspension Check] TeamMember record:`, member ? { id: member.id, status: member.status } : 'NOT FOUND');
                
                if (member && member.status === 'suspended') {
                    console.log(`[Suspension Check] BLOCKED - User is suspended`);
                    return res.status(403).json({ error: "Your access to this company workspace has been suspended." });
                }
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ error: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ error: 'Not authorized, no token' });
    }
};

exports.optionalAuth = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = await req.db_models.User.findByPk(decoded.id);
        } catch (error) {
            console.log('Optional Auth: Token invalid or failed');
        }
    }
    next();
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        console.log(`🛡️ restrictTo Check: UserRole=${req.user.role}, Allowed=${roles}`);
        if (!roles.includes(req.user.role)) {
            console.log("⛔ Access Denied");
            return res.status(403).json({ error: `You do not have permission. Your role is: '${req.user.role}'. Required: ${roles.join(' or ')}` });
        }
        next();
    };
};

// --- SESSION-BASED AUTH FOR VIEW ROUTES ---

// Ensure user is authenticated (via Passport session OR JWT in Authorization header)
// Note: For view routes, this acts as a loose check. Full verification happens client-side.
exports.ensureAuth = async (req, res, next) => {
    // Check Passport session first
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    
    // Check JWT in Authorization header (for API calls or AJAX)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            req.user = await req.db_models.User.findByPk(decoded.id);
            if (req.user) return next();
        } catch (e) {
            console.log('ensureAuth: JWT failed', e.message);
        }
    }
    
    // For view routes: Redirect to login with redirect URL
    res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
};

// Ensure user has specific role (for view routes)
// Works with both Passport session and JWT-populated req.user
exports.ensureRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.redirect('/login');
        }
        if (!roles.includes(req.user.role)) {
            // Render a simple access denied page instead of JSON
            return res.status(403).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Access Denied</title>
                    <style>
                        body { background: #121212; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                        h1 { color: #e74c3c; }
                        a { color: #7b1fa2; }
                    </style>
                </head>
                <body>
                    <h1>⛔ Access Denied</h1>
                    <p>Your role is <strong>'${req.user.role}'</strong>, but this page requires: <strong>${roles.join(' or ')}</strong></p>
                    <a href="/dashboard">← Go to Dashboard</a>
                </body>
                </html>
            `);
        }
        next();
    };
};