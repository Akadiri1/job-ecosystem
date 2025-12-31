/**
 * =============================================================================
 * CRON JOBS - Scheduled Background Tasks for AI Assistant
 * =============================================================================
 * 
 * Schedule:
 * - Every hour: Check overdue tasks => generate insights
 * - 9 AM daily: Generate morning task reminders
 * - 6 PM daily: Generate end-of-day summary
 * - Monday 9 AM: Weekly team report
 * =============================================================================
 */
const cron = require('node-cron');
const aiService = require('./aiService');

let models = null;

/**
 * Initialize cron jobs with database models
 */
const initCronJobs = (dbModels) => {
    models = dbModels;
    console.log('[AI CRON] Initializing scheduled jobs...');
    
    // Every hour - Check for overdue tasks and generate insights
    cron.schedule('0 * * * *', async () => {
        console.log('[AI CRON] Running hourly insight generation...');
        await runInsightGeneration();
    });
    
    // 9 AM daily - Morning reminders (tasks due today)
    cron.schedule('0 9 * * *', async () => {
        console.log('[AI CRON] Running morning task reminders...');
        await runMorningReminders();
    });
    
    // 6 PM daily - End of day summary
    cron.schedule('0 18 * * *', async () => {
        console.log('[AI CRON] Running end-of-day summary...');
        await runEndOfDaySummary();
    });
    
    // Monday 9 AM - Weekly report
    cron.schedule('0 9 * * 1', async () => {
        console.log('[AI CRON] Running weekly team report...');
        await runWeeklyReport();
    });
    
    console.log('[AI CRON] ✓ Scheduled jobs initialized');
};

/**
 * Generate insights for all companies
 */
const runInsightGeneration = async () => {
    if (!models) return;
    
    try {
        const { Company } = models;
        const companies = await Company.findAll();
        
        for (const company of companies) {
            const insights = await aiService.generateInsights(models, company.id);
            if (insights.length > 0) {
                console.log(`[AI CRON] Generated ${insights.length} insights for company ${company.id}`);
            }
        }
    } catch (error) {
        console.error('[AI CRON] Insight generation error:', error);
    }
};

/**
 * Send morning task reminders
 */
const runMorningReminders = async () => {
    if (!models) return;
    
    try {
        const { Company, Notification } = models;
        const companies = await Company.findAll();
        
        for (const company of companies) {
            const tasksDueToday = await aiService.getTasksDueToday(models, company.id);
            
            // Create notifications for each assignee
            for (const task of tasksDueToday) {
                if (task.assigned_to) {
                    await Notification.create({
                        user_id: task.assigned_to,
                        title: '📋 Task Due Today',
                        message: `Your task "${task.title}" is due today!`,
                        type: 'warning',
                        link: `/dashboard/employer/tasks/${task.id}`,
                        related_id: task.id
                    });
                }
            }
            
            console.log(`[AI CRON] Sent ${tasksDueToday.length} morning reminders for company ${company.id}`);
        }
    } catch (error) {
        console.error('[AI CRON] Morning reminders error:', error);
    }
};

/**
 * Generate end-of-day summary
 */
const runEndOfDaySummary = async () => {
    if (!models) return;
    
    try {
        const { Company, TeamMember, Notification } = models;
        const companies = await Company.findAll();
        
        for (const company of companies) {
            const stats = await aiService.getDashboardStats(models, company.id);
            
            // Notify company owner/admins
            const admins = await TeamMember.findAll({
                where: { 
                    company_id: company.id, 
                    role: ['owner', 'admin'],
                    status: 'active'
                }
            });
            
            for (const admin of admins) {
                await Notification.create({
                    user_id: admin.user_id,
                    title: '📊 Daily Summary',
                    message: `Today: ${stats.team.clockedIn}/${stats.team.total} team members active, ${stats.tasks.completed} tasks completed, ${stats.tasks.overdue} overdue.`,
                    type: 'info',
                    link: '/dashboard/employer/ai-insights'
                });
            }
        }
    } catch (error) {
        console.error('[AI CRON] End-of-day summary error:', error);
    }
};

/**
 * Generate weekly team report
 */
const runWeeklyReport = async () => {
    if (!models) return;
    
    try {
        const { Company, AIInsight } = models;
        const companies = await Company.findAll();
        
        for (const company of companies) {
            const performance = await aiService.getTeamPerformance(models, company.id);
            
            // Calculate averages
            const avgCompletion = performance.length > 0
                ? Math.round(performance.reduce((sum, p) => sum + p.completionRate, 0) / performance.length)
                : 0;
            
            const totalHours = performance.reduce((sum, p) => sum + p.totalHoursThisWeek, 0);
            
            // Create weekly summary insight
            await AIInsight.create({
                company_id: company.id,
                type: 'team_summary',
                severity: 'info',
                title: '📈 Weekly Team Report',
                message: `Team average: ${avgCompletion}% task completion rate. Total hours logged: ${totalHours}. ${performance.filter(p => p.completionRate >= 90).length} top performers this week.`,
                metadata: { avgCompletion, totalHours, memberCount: performance.length }
            });
            
            console.log(`[AI CRON] Generated weekly report for company ${company.id}`);
        }
    } catch (error) {
        console.error('[AI CRON] Weekly report error:', error);
    }
};

/**
 * Manually trigger insight generation for a specific company
 */
const triggerInsights = async (companyId) => {
    if (!models) throw new Error('Models not initialized');
    return await aiService.generateInsights(models, companyId);
};

module.exports = {
    initCronJobs,
    triggerInsights,
    runInsightGeneration,
    runMorningReminders,
    runEndOfDaySummary,
    runWeeklyReport
};
