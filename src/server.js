// src/server.js
const path = require('path');
const http = require('http'); // [NEW] Import http
const { Server } = require("socket.io"); // [NEW] Import Socket.io
// Load env vars before anything else
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const { protect, restrictTo, ensureAuth, ensureRole } = require('./middleware/authMiddleware');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
const rateLimit = require('express-rate-limit');

// Database & Models
const sequelize = require('./config/database');
// Initialize Models
const User = require('./models/User')(sequelize);
const Company = require('./models/Company')(sequelize);
const Job = require('./models/Job')(sequelize);
const Application = require('./models/Application')(sequelize);
const SavedJob = require('./models/SavedJob')(sequelize);
// [NEW] Team & Channels (Must be before ChatMessage for FKs)
const TeamMember = require('./models/TeamMember')(sequelize);
const Channel = require('./models/Channel')(sequelize);
const ChannelMember = require('./models/ChannelMember')(sequelize);

const ChatMessage = require('./models/ChatMessage')(sequelize); // [NEW] Import ChatMessage
const ChatGroup = require('./models/ChatGroup')(sequelize);
const ChatGroupMember = require('./models/ChatGroupMember')(sequelize);
const Notification = require('./models/Notification')(sequelize); // [NEW]
const NotificationPreference = require('./models/NotificationPreference')(sequelize); // [NEW]
const PushSubscription = require('./models/PushSubscription')(sequelize); // [PUSH]
const Task = require('./models/Task')(sequelize);
const TaskComment = require('./models/TaskComment')(sequelize);
const TaskCommentLike = require('./models/TaskCommentLike')(sequelize);
// [AI] AI Assistant Models
const Attendance = require('./models/Attendance')(sequelize);
const AIInsight = require('./models/AIInsight')(sequelize);
// [BILLING] Payment Models
const Subscription = require('./models/Subscription')(sequelize);
const Payment = require('./models/Payment')(sequelize);
// [ADMIN] User Activity Tracking
const UserActivity = require('./models/UserActivity')(sequelize);

// Routes Imports
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const jobRoutes = require('./routes/jobRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const chatRoutes = require('./routes/chatRoutes'); // [NEW]
const chatGroupRoutes = require('./routes/chatGroupRoutes'); // [NEW]
const notificationRoutes = require('./routes/notificationRoutes'); // [NEW]
const taskRoutes = require('./routes/taskRoutes');

// Registered below
User.hasOne(Company, { foreignKey: 'owner_id', as: 'company' });
Company.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

Company.hasMany(Job, { foreignKey: 'company_id', as: 'jobs' });
Job.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

User.hasMany(Job, { foreignKey: 'employer_id', as: 'posted_jobs' });
Job.belongsTo(User, { foreignKey: 'employer_id', as: 'employer' });

// Application Relationships
User.hasMany(Application, { foreignKey: 'seeker_id', as: 'applications' });
Application.belongsTo(User, { foreignKey: 'seeker_id', as: 'seeker' });

Job.hasMany(Application, { foreignKey: 'job_id', as: 'applications' });
Application.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

// Saved Jobs (Many-to-Many)
User.belongsToMany(Job, { through: SavedJob, as: 'saved_jobs', foreignKey: 'seeker_id' });
Job.belongsToMany(User, { through: SavedJob, as: 'savers', foreignKey: 'job_id' });

// --- GROUP CHAT RELATIONSHIPS ---
// User <-> Group (Through Members)
User.belongsToMany(ChatGroup, { through: ChatGroupMember, as: 'groups', foreignKey: 'user_id' });
ChatGroup.belongsToMany(User, { through: ChatGroupMember, as: 'members', foreignKey: 'group_id' });

// Group Created By User
ChatGroup.belongsTo(User, { as: 'creator', foreignKey: 'created_by' });

// Group <-> Messages
ChatGroup.hasMany(ChatMessage, { foreignKey: 'group_id', as: 'messages' });
ChatMessage.belongsTo(ChatGroup, { foreignKey: 'group_id', as: 'group' });

// Message <-> User (Sender/Receiver)
ChatMessage.belongsTo(User, { as: 'sender', foreignKey: 'sender_id' });
ChatMessage.belongsTo(User, { as: 'receiver', foreignKey: 'receiver_id' }); // Optional for Group, required for Private

// Notification Relationships
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Push Subscriptions
User.hasMany(PushSubscription, { foreignKey: 'user_id', as: 'push_subscriptions' });
PushSubscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Notification Preferences
User.hasOne(NotificationPreference, { foreignKey: 'user_id', as: 'preferences' });
NotificationPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// --- EMPLOYEE RELATIONSHIPS ---
// A Company has many Employees
Company.hasMany(User, { foreignKey: 'company_id', as: 'employees' });
// A User (Employee) belongs to a Company
User.belongsTo(Company, { foreignKey: 'company_id', as: 'workplace' });

// --- TEAM & CHANNEL RELATIONSHIPS ---
// Company <-> Team Members
Company.hasMany(TeamMember, { foreignKey: 'company_id', as: 'team_members' });
TeamMember.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
TeamMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Company <-> Channels
Company.hasMany(Channel, { foreignKey: 'company_id', as: 'channels' });
Channel.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

// Channel <-> Members
Channel.belongsToMany(User, { through: ChannelMember, as: 'members', foreignKey: 'channel_id' });
User.belongsToMany(Channel, { through: ChannelMember, as: 'channels', foreignKey: 'user_id' });

// Channel <-> Messages
Channel.hasMany(ChatMessage, { foreignKey: 'channel_id', as: 'messages' });
ChatMessage.belongsTo(Channel, { foreignKey: 'channel_id', as: 'channel' });

// --- TASK RELATIONSHIPS ---
Company.hasMany(Task, { foreignKey: 'company_id', as: 'tasks' });
Task.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
Task.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });
Task.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
User.hasMany(Task, { foreignKey: 'assigned_to', as: 'assigned_tasks' });

// Task Comments
Task.hasMany(TaskComment, { foreignKey: 'task_id', as: 'comments' });
TaskComment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
TaskComment.belongsTo(User, { foreignKey: 'user_id', as: 'author' });
TaskComment.hasMany(TaskComment, { foreignKey: 'parent_id', as: 'replies' });
TaskComment.belongsTo(TaskComment, { foreignKey: 'parent_id', as: 'parent' });

// Comment Likes
TaskComment.hasMany(TaskCommentLike, { foreignKey: 'task_comment_id', as: 'likes' });
TaskCommentLike.belongsTo(TaskComment, { foreignKey: 'task_comment_id', as: 'comment' });
TaskCommentLike.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// --- AI ASSISTANT RELATIONSHIPS ---
// Attendance
Company.hasMany(Attendance, { foreignKey: 'company_id', as: 'attendances' });
Attendance.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
User.hasMany(Attendance, { foreignKey: 'user_id', as: 'attendances' });
Attendance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// AI Insights
Company.hasMany(AIInsight, { foreignKey: 'company_id', as: 'ai_insights' });
AIInsight.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });
User.hasMany(AIInsight, { foreignKey: 'user_id', as: 'ai_insights' });
AIInsight.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// --- USER ACTIVITY TRACKING ---
User.hasMany(UserActivity, { foreignKey: 'user_id', as: 'activities' });
UserActivity.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

const app = express();

// Trust proxy for Render deployment (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// --- MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(morgan('dev'));
app.use(helmet({ contentSecurityPolicy: false }));

// --- RATE LIMITING ---
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { error: 'Too many attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Model Injection Middleware
app.use((req, res, next) => {
    req.db_models = { 
        User, Company, Job, Application, SavedJob,
        ChatGroup, ChatGroupMember, ChatMessage, Notification,
        TeamMember, Channel, ChannelMember,
        Task, TaskComment, TaskCommentLike,
        Attendance, AIInsight,
        Subscription, Payment, PushSubscription, NotificationPreference,
        UserActivity
    };
    next();
});

// --- SESSION & PASSPORT ---
app.use(session({
    secret: process.env.SESSION_SECRET || 'job_ecosystem_secret_key',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Global User Middleware
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// Use Routes - Moved to bottom
 


// Initialize Passport Config
require('./config/passport')(passport, User);

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public'))); // Serve assets from src/public
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))); // Serve uploads from src/public/uploads

// --- ROUTES ---

// API Routes
// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company', companyRoutes); // Also mount at /api/company for frontend compatibility
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat/groups', chatGroupRoutes);
app.use('/api/notifications', notificationRoutes); // [NEW]
app.use('/api/team', require('./routes/teamRoutes'));
app.use('/api/tasks', taskRoutes);
app.use('/api/ai', require('./routes/aiRoutes')); // [AI] AI Assistant Routes
app.use('/api/billing', require('./routes/paymentRoutes')); // [BILLING] Payment Routes
app.use('/api/admin', require('./routes/adminRoutes')); // [ADMIN] Super Admin Routes

// ============================================================
// DASHBOARD & FEATURE ROUTES (Role-Based Namespacing)
// ============================================================

// 1. DASHBOARD ROOTS
// 1. DASHBOARD ROOTS
app.get('/dashboard', (req, res) => {
    // SAFE FALLBACK: Render a minimal loader that checks localStorage and redirects to specific role dashboard
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Redirecting...</title>
            <style>
                body { background: #121212; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; }
                .loader { border: 3px solid #333; border-top: 3px solid #7b1fa2; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="loader"></div>
            <script>
                const user = localStorage.getItem('user');
                if (user) {
                    try {
                        const parsed = JSON.parse(user);
                        const role = parsed.role;
                        let target = '/dashboard/seeker';
                        if (role === 'employer') target = '/dashboard/employer';
                        else if (role === 'employee') target = '/dashboard/employee';
                        else if (role === 'admin') target = '/dashboard/admin';
                        window.location.replace(target);
                    } catch(e) {
                         window.location.replace('/login');
                    }
                } else {
                    window.location.replace('/login');
                }
            </script>
        </body>
        </html>
    `);
});

// NOTE: View routes below are NOT server-side protected because auth uses client-side JWT (localStorage).
// The client JS checks auth and redirects to login if needed. API routes ARE protected with 'protect' middleware.
// For full server-side protection, migrate to HTTP-only cookie JWT or Passport sessions.

app.get('/dashboard/employer', (req, res) => res.render('dashboard', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employee', (req, res) => res.render('dashboard', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/seeker', (req, res) => res.render('dashboard', { sidebar: 'includes/sidebar-seeker' }));
app.get('/dashboard/admin', (req, res) => res.render('admin-dashboard', { sidebar: 'includes/sidebar-admin' }));

// 2. EMPLOYER ROUTES (/dashboard/employer/...)
app.get('/dashboard/employer/jobs/create', (req, res) => res.render('post-job', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/jobs/manage', (req, res) => res.render('manage-jobs', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/candidates', (req, res) => res.render('candidates', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/chat', (req, res) => res.render('chat', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/tasks', (req, res) => res.render('tasks', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/tasks/:id', (req, res) => res.render('task-detail', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/team/manage', (req, res) => res.render('manage-team', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/channels', (req, res) => res.render('manage-channels', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/groups', (req, res) => res.render('manage-groups', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/company/settings', (req, res) => res.render('create-company', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/company', (req, res) => res.redirect('/dashboard/employer/company/settings')); // Redirect shortcut
app.get('/dashboard/employer/profile', (req, res) => res.render('profile', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/billing', (req, res) => res.render('billing', { sidebar: 'includes/sidebar-employer' }));
app.get('/dashboard/employer/ai-insights', (req, res) => res.render('ai-insights', { sidebar: 'includes/sidebar-employer' }));

// 3. EMPLOYEE ROUTES (/dashboard/employee/...)
app.get('/dashboard/employee/chat', (req, res) => res.render('chat', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/tasks', (req, res) => res.render('tasks', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/tasks/:id', (req, res) => res.render('task-detail', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/docs', (req, res) => res.render('company-docs', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/profile', (req, res) => res.render('profile', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/ai-assistant', (req, res) => res.render('ai-employee', { sidebar: 'includes/sidebar-employee' }));

// [NEW] Privileged Employee Routes (Access controlled by Client JS & API Permissions)
app.get('/dashboard/employee/team', (req, res) => res.render('manage-team', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/jobs/create', (req, res) => res.render('post-job', { sidebar: 'includes/sidebar-employee' }));
app.get('/dashboard/employee/candidates', (req, res) => res.render('candidates', { sidebar: 'includes/sidebar-employee' }));

// 4. SEEKER ROUTES (/dashboard/seeker/...)
app.get('/dashboard/seeker/jobs/feed', (req, res) => res.render('job-feed', { sidebar: 'includes/sidebar-seeker' }));
app.get('/dashboard/seeker/applications', (req, res) => res.render('my-applications', { sidebar: 'includes/sidebar-seeker' }));
app.get('/dashboard/seeker/saved-jobs', (req, res) => res.render('saved-jobs', { sidebar: 'includes/sidebar-seeker' }));
app.get('/dashboard/seeker/chat', (req, res) => res.render('chat', { sidebar: 'includes/sidebar-seeker' }));
app.get('/dashboard/seeker/profile', (req, res) => res.render('profile', { sidebar: 'includes/sidebar-seeker' }));
app.get('/dashboard/seeker/ai-coach', (req, res) => res.render('ai-seeker', { sidebar: 'includes/sidebar-seeker' }));

// 5. ADMIN ROUTES (/dashboard/admin/...)
app.get('/dashboard/admin/users', (req, res) => res.render('admin-users', { sidebar: 'includes/sidebar-admin' }));
app.get('/dashboard/admin/companies', (req, res) => res.render('admin-dashboard', { sidebar: 'includes/sidebar-admin' }));
app.get('/dashboard/admin/jobs', (req, res) => res.render('admin-dashboard', { sidebar: 'includes/sidebar-admin' }));
app.get('/dashboard/admin/subscriptions', (req, res) => res.render('admin-dashboard', { sidebar: 'includes/sidebar-admin' }));
app.get('/dashboard/admin/payments', (req, res) => res.render('admin-dashboard', { sidebar: 'includes/sidebar-admin' }));
app.get('/dashboard/admin/ai-insights', (req, res) => res.render('ai-insights', { sidebar: 'includes/sidebar-admin' })); // Reuse AI dashboard
app.get('/dashboard/admin/settings', (req, res) => res.render('admin-dashboard', { sidebar: 'includes/sidebar-admin' }));
app.get('/dashboard/admin/user-activity', (req, res) => res.render('admin-user-activity', { sidebar: 'includes/sidebar-admin' }));


// ============================================================
// LEGACY / DIRECT ACCESS FALLBACKS (Redirect or Render Safe)
// ============================================================
// Redirect core features to dashboard to force role checks or default to seeker
app.get('/chat', (req, res) => res.redirect('/dashboard'));
app.get('/tasks', (req, res) => res.redirect('/dashboard'));
app.get('/company/docs', (req, res) => res.redirect('/dashboard'));

// Keep some direct links working for now (e.g. from email links) but ensure they have A sidebar
app.get('/jobs/feed', (req, res) => res.render('job-feed', { sidebar: 'includes/sidebar-seeker' }));
app.get('/jobs/manage', (req, res) => res.render('manage-jobs', { sidebar: 'includes/sidebar-employer' }));
app.get('/my-applications', (req, res) => res.render('my-applications', { sidebar: 'includes/sidebar-seeker' }));
app.get('/saved-jobs', (req, res) => res.render('saved-jobs', { sidebar: 'includes/sidebar-seeker' }));
app.get('/candidates', (req, res) => res.render('candidates', { sidebar: 'includes/sidebar-employer' }));
app.get('/profile/edit', (req, res) => res.render('profile', { sidebar: 'includes/sidebar-seeker' })); // Default

// UI Routes (Public/Auth)
app.get('/', (req, res) => res.render('welcome'));
app.get('/welcome', (req, res) => res.render('welcome'));
app.get('/login', (req, res) => res.render('login'));
app.get('/admin-login', (req, res) => res.render('admin-login'));
app.get('/signup', (req, res) => res.render('signup'));
app.get('/forgot-password', (req, res) => res.render('forgot-password'));
app.get('/reset-password', (req, res) => res.render('reset-password'));

// Sub-Feature Routes (Less critical to namespace but good practice later)
app.get('/jobs/create', (req, res) => res.render('post-job', { sidebar: 'includes/sidebar-employer' }));
app.get('/jobs/:id/edit', (req, res) => res.render('edit-job', { sidebar: 'includes/sidebar-employer' }));
app.get('/jobs/:id', (req, res) => res.render('job-details', { sidebar: 'includes/sidebar-seeker' }));
app.get('/jobs/:id/candidates', (req, res) => res.render('candidates', { sidebar: 'includes/sidebar-employer' }));
app.get('/company/create', (req, res) => res.render('create-company', { sidebar: 'includes/sidebar-employer' }));
app.get('/team/manage', (req, res) => res.render('manage-team', { sidebar: 'includes/sidebar-employer' }));
app.get('/accept-invite', (req, res) => res.render('accept-invite'));

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Default error
    res.status(err.status || 500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : err.message 
    });
});

// 404 Handler
app.use((req, res) => res.status(404).json({ error: "Endpoint not found" }));


// --- SERVER START ---
const PORT = process.env.PORT || 5000;
const startTime = Date.now();
sequelize.authenticate()
    .then(() => {
        console.log('✅ Database connected!');
        
        // Use ALTER_SYNC=true env var to enable slow alter mode
        // Default: false for fast startup (no table modifications)
        const shouldAlter = process.env.ALTER_SYNC === 'true';
        console.log(shouldAlter ? '🔧 Syncing with ALTER (slow mode)...' : '⚡ Fast sync mode (no schema changes)');
        
        return sequelize.sync({ alter: shouldAlter });
    })
    .then(() => {
        const syncTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Database Synced & Tables Ready (${syncTime}s)`);
        
        // [NEW] Setup Socket.io
        const server = http.createServer(app);
        const io = new Server(server);
        app.set('io', io);

        // [NEW] Initialize Socket Manager
        require('./sockets/socketManager')(io, { 
            User, Company, Job, Application, SavedJob, 
            ChatGroup, ChatGroupMember, ChatMessage, Notification, PushSubscription
        });

        // [AI] Initialize Cron Jobs for AI Assistant
        const cronJobs = require('./services/cronJobs');
        cronJobs.initCronJobs({ 
            User, Company, Task, TeamMember, Attendance, AIInsight, Notification 
        });

        // Change app.listen to server.listen
        server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    })
    .catch((err) => console.log('❌ Database Error:', err));