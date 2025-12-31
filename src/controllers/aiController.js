/**
 * =============================================================================
 * AI CONTROLLER - API Endpoints for AI Assistant
 * =============================================================================
 */
const aiService = require('../services/aiService');

/**
 * GET /api/ai/dashboard
 * Get AI dashboard stats overview
 */
exports.getDashboard = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const userId = req.user.id;
        
        // Get user's company
        let companyId = req.user.company_id;
        if (!companyId) {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) companyId = company.id;
        }
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'No company found' });
        }
        
        const stats = await aiService.getDashboardStats(req.db_models, companyId);
        const insights = await aiService.getActiveInsights(req.db_models, companyId, 10);
        const performance = await aiService.getTeamPerformance(req.db_models, companyId);
        
        // Sort by completion rate for leaderboard
        const leaderboard = [...performance].sort((a, b) => b.completionRate - a.completionRate);
        
        res.json({
            success: true,
            stats,
            insights,
            leaderboard: leaderboard.slice(0, 5),
            underperformers: performance.filter(p => p.completionRate < 50 && p.totalTasks >= 3)
        });
    } catch (error) {
        console.error('AI Dashboard Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/ai/insights
 * Get AI-generated insights
 */
exports.getInsights = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const userId = req.user.id;
        
        let companyId = req.user.company_id;
        if (!companyId) {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) companyId = company.id;
        }
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'No company found' });
        }
        
        const insights = await aiService.getActiveInsights(req.db_models, companyId);
        
        res.json({ success: true, insights });
    } catch (error) {
        console.error('Get Insights Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/ai/insights/generate
 * Manually trigger insight generation
 */
exports.generateInsights = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const userId = req.user.id;
        
        let companyId = req.user.company_id;
        if (!companyId) {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) companyId = company.id;
        }
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'No company found' });
        }
        
        const newInsights = await aiService.generateInsights(req.db_models, companyId);
        
        res.json({ 
            success: true, 
            message: `Generated ${newInsights.length} new insights`,
            insights: newInsights 
        });
    } catch (error) {
        console.error('Generate Insights Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/ai/insights/:id/dismiss
 * Dismiss an insight
 */
exports.dismissInsight = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await aiService.dismissInsight(req.db_models, id);
        res.json(result);
    } catch (error) {
        console.error('Dismiss Insight Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/ai/attendance
 * Get today's attendance overview
 */
exports.getAttendance = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const userId = req.user.id;
        
        let companyId = req.user.company_id;
        if (!companyId) {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) companyId = company.id;
        }
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'No company found' });
        }
        
        const attendance = await aiService.getTodayAttendance(req.db_models, companyId);
        
        res.json({ success: true, attendance });
    } catch (error) {
        console.error('Get Attendance Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/ai/attendance/me
 * Get current user's attendance status
 */
exports.getMyAttendance = async (req, res) => {
    try {
        const { Attendance } = req.db_models;
        const userId = req.user.id;
        const companyId = req.user.company_id;
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'Not part of a company' });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const attendance = await Attendance.findOne({
            where: { user_id: userId, company_id: companyId, date: today }
        });
        
        res.json({
            success: true,
            attendance,
            isClockedIn: attendance?.clock_in && !attendance?.clock_out
        });
    } catch (error) {
        console.error('Get My Attendance Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/ai/attendance/clock-in
 * Clock in
 */
exports.clockIn = async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'Not part of a company' });
        }
        
        const result = await aiService.clockIn(req.db_models, userId, companyId);
        res.json(result);
    } catch (error) {
        console.error('Clock In Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/ai/attendance/clock-out
 * Clock out
 */
exports.clockOut = async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id;
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'Not part of a company' });
        }
        
        const result = await aiService.clockOut(req.db_models, userId, companyId);
        res.json(result);
    } catch (error) {
        console.error('Clock Out Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/ai/tasks/at-risk
 * Get tasks at risk of missing deadline
 */
exports.getTasksAtRisk = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const userId = req.user.id;
        
        let companyId = req.user.company_id;
        if (!companyId) {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) companyId = company.id;
        }
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'No company found' });
        }
        
        const overdue = await aiService.getOverdueTasks(req.db_models, companyId);
        const dueToday = await aiService.getTasksDueToday(req.db_models, companyId);
        const unaccepted = await aiService.getUnacceptedTasks(req.db_models, companyId);
        
        res.json({
            success: true,
            overdue,
            dueToday,
            unaccepted
        });
    } catch (error) {
        console.error('Tasks At Risk Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/ai/performance
 * Get team performance metrics
 */
exports.getPerformance = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const userId = req.user.id;
        
        let companyId = req.user.company_id;
        if (!companyId) {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) companyId = company.id;
        }
        
        if (!companyId) {
            return res.status(404).json({ success: false, message: 'No company found' });
        }
        
        const performance = await aiService.getTeamPerformance(req.db_models, companyId);
        
        res.json({ success: true, performance });
    } catch (error) {
        console.error('Get Performance Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
