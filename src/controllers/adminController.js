/**
 * =============================================================================
 * ADMIN CONTROLLER - Super Admin Management Functions
 * =============================================================================
 */
const { Op } = require('sequelize');

/**
 * Middleware to check if user is admin
 */
exports.requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

/**
 * GET /api/admin/stats
 * Get platform-wide statistics
 */
exports.getStats = async (req, res) => {
    try {
        const { User, Company, Job, Application, Subscription, Payment } = req.db_models;
        
        const [
            totalUsers,
            totalEmployers,
            totalSeekers,
            totalEmployees,
            totalCompanies,
            totalJobs,
            activeJobs,
            totalApplications,
            paidSubscriptions
        ] = await Promise.all([
            User.count(),
            User.count({ where: { role: 'employer' } }),
            User.count({ where: { role: 'job_seeker' } }),
            User.count({ where: { role: 'employee' } }),
            Company.count(),
            Job.count(),
            Job.count({ where: { status: 'active' } }),
            Application.count(),
            Subscription.count({ where: { plan: { [Op.ne]: 'free' }, status: 'active' } })
        ]);
        
        // Revenue (if available)
        let totalRevenue = 0;
        try {
            const revenueResult = await Payment.sum('amount', { where: { status: 'succeeded' } });
            totalRevenue = revenueResult || 0;
        } catch (e) { /* Payment table may be empty */ }
        
        // Recent signups (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentSignups = await User.count({ where: { createdAt: { [Op.gte]: weekAgo } } });
        
        res.json({
            success: true,
            stats: {
                users: { total: totalUsers, employers: totalEmployers, seekers: totalSeekers, employees: totalEmployees },
                companies: totalCompanies,
                jobs: { total: totalJobs, active: activeJobs },
                applications: totalApplications,
                subscriptions: { paid: paidSubscriptions },
                revenue: totalRevenue,
                recentSignups
            }
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/users
 * Get all users (paginated)
 */
exports.getUsers = async (req, res) => {
    try {
        const { User, Company } = req.db_models;
        const { page = 1, limit = 20, role, search, status } = req.query;
        const offset = (page - 1) * limit;
        
        const where = {};
        if (role) where.role = role;
        if (status) where.account_status = status;
        if (search) {
            where[Op.or] = [
                { full_name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        const { count, rows } = await User.findAndCountAll({
            where,
            attributes: { exclude: ['password_hash', 'reset_token'] },
            include: [{ model: Company, as: 'company', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            users: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                pages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /api/admin/users/:id
 * Update user (role, status, etc.)
 */
exports.updateUser = async (req, res) => {
    try {
        const { User } = req.db_models;
        const { id } = req.params;
        const { role, account_status, permissions } = req.body;
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (role) user.role = role;
        if (account_status) user.account_status = account_status;
        if (permissions) user.permissions = permissions;
        
        await user.save();
        
        res.json({ success: true, message: 'User updated', user });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * DELETE /api/admin/users/:id
 * Delete user
 */
exports.deleteUser = async (req, res) => {
    try {
        const { User } = req.db_models;
        const { id } = req.params;
        
        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Don't allow deleting self
        if (user.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
        }
        
        await user.destroy();
        
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/companies
 * Get all companies
 */
exports.getCompanies = async (req, res) => {
    try {
        const { Company, User, Subscription } = req.db_models;
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;
        
        const where = {};
        if (search) {
            where.name = { [Op.iLike]: `%${search}%` };
        }
        
        const { count, rows } = await Company.findAndCountAll({
            where,
            include: [
                { model: User, as: 'owner', attributes: ['id', 'full_name', 'email'] },
                { model: Subscription, as: 'subscriptions', required: false }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            companies: rows,
            pagination: { total: count, page: parseInt(page), pages: Math.ceil(count / limit) }
        });
    } catch (error) {
        console.error('Get companies error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/jobs
 * Get all jobs
 */
exports.getJobs = async (req, res) => {
    try {
        const { Job, Company } = req.db_models;
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (page - 1) * limit;
        
        const where = {};
        if (status) where.status = status;
        if (search) where.title = { [Op.iLike]: `%${search}%` };
        
        const { count, rows } = await Job.findAndCountAll({
            where,
            include: [{ model: Company, as: 'company', attributes: ['id', 'name'] }],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            jobs: rows,
            pagination: { total: count, page: parseInt(page), pages: Math.ceil(count / limit) }
        });
    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /api/admin/jobs/:id
 * Update job status
 */
exports.updateJob = async (req, res) => {
    try {
        const { Job } = req.db_models;
        const { id } = req.params;
        const { status } = req.body;
        
        const job = await Job.findByPk(id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' });
        }
        
        job.status = status;
        await job.save();
        
        res.json({ success: true, message: 'Job updated', job });
    } catch (error) {
        console.error('Update job error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/subscriptions
 * Get all subscriptions
 */
exports.getSubscriptions = async (req, res) => {
    try {
        const { Subscription, Company, User } = req.db_models;
        const { plan, status } = req.query;
        
        const where = {};
        if (plan) where.plan = plan;
        if (status) where.status = status;
        
        const subscriptions = await Subscription.findAll({
            where,
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name'] },
                { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        res.json({ success: true, subscriptions });
    } catch (error) {
        console.error('Get subscriptions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * PATCH /api/admin/subscriptions/:id
 * Update subscription (admin override)
 */
exports.updateSubscription = async (req, res) => {
    try {
        const { Subscription } = req.db_models;
        const { id } = req.params;
        const { plan, status, job_posts_limit, team_members_limit, ai_features_enabled } = req.body;
        
        const subscription = await Subscription.findByPk(id);
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        if (plan) subscription.plan = plan;
        if (status) subscription.status = status;
        if (job_posts_limit !== undefined) subscription.job_posts_limit = job_posts_limit;
        if (team_members_limit !== undefined) subscription.team_members_limit = team_members_limit;
        if (ai_features_enabled !== undefined) subscription.ai_features_enabled = ai_features_enabled;
        
        await subscription.save();
        
        res.json({ success: true, message: 'Subscription updated', subscription });
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/admin/payments
 * Get all payments
 */
exports.getPayments = async (req, res) => {
    try {
        const { Payment, Company, User } = req.db_models;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;
        
        const { count, rows } = await Payment.findAndCountAll({
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name'] },
                { model: User, as: 'user', attributes: ['id', 'full_name', 'email'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            payments: rows,
            pagination: { total: count, page: parseInt(page), pages: Math.ceil(count / limit) }
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
