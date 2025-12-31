/**
 * =============================================================================
 * AI SERVICE - Core AI Assistant Logic
 * =============================================================================
 * 
 * The brain of the AI assistant. Analyzes team performance, tracks tasks,
 * monitors attendance, and generates insights.
 * =============================================================================
 */
const { Op } = require('sequelize');

/**
 * Get overdue tasks for a company
 */
const getOverdueTasks = async (models, companyId) => {
    const { Task, User } = models;
    const now = new Date();
    
    const overdueTasks = await Task.findAll({
        where: {
            company_id: companyId,
            due_date: { [Op.lt]: now },
            status: { [Op.notIn]: ['completed'] }
        },
        include: [
            { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] },
            { model: User, as: 'creator', attributes: ['id', 'full_name'] }
        ],
        order: [['due_date', 'ASC']]
    });
    
    return overdueTasks;
};

/**
 * Get tasks due today
 */
const getTasksDueToday = async (models, companyId) => {
    const { Task, User } = models;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tasks = await Task.findAll({
        where: {
            company_id: companyId,
            due_date: { [Op.between]: [today, tomorrow] },
            status: { [Op.notIn]: ['completed'] }
        },
        include: [
            { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] }
        ]
    });
    
    return tasks;
};

/**
 * Get unaccepted tasks (assigned but not accepted)
 */
const getUnacceptedTasks = async (models, companyId) => {
    const { Task, User } = models;
    
    const tasks = await Task.findAll({
        where: {
            company_id: companyId,
            assigned_to: { [Op.ne]: null },
            is_accepted: false,
            status: { [Op.notIn]: ['completed'] }
        },
        include: [
            { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email'] }
        ]
    });
    
    return tasks;
};

/**
 * Calculate team performance metrics
 */
const getTeamPerformance = async (models, companyId) => {
    const { Task, TeamMember, User, Attendance } = models;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get team members
    const members = await TeamMember.findAll({
        where: { company_id: companyId, status: 'active' },
        include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'profile_picture_url', 'performance_score'] }]
    });
    
    // Calculate stats for each member
    const memberStats = await Promise.all(members.map(async (member) => {
        const userId = member.user_id;
        
        // Tasks assigned to this user in this company
        const totalTasks = await Task.count({
            where: { assigned_to: userId, company_id: companyId }
        });
        
        const completedTasks = await Task.count({
            where: { assigned_to: userId, company_id: companyId, status: 'completed' }
        });
        
        const overdueTasks = await Task.count({
            where: {
                assigned_to: userId,
                company_id: companyId,
                due_date: { [Op.lt]: now },
                status: { [Op.notIn]: ['completed'] }
            }
        });
        
        // Recent attendance (last 7 days)
        const attendanceRecords = await Attendance.findAll({
            where: {
                user_id: userId,
                company_id: companyId,
                date: { [Op.gte]: sevenDaysAgo }
            }
        });
        
        const totalHoursThisWeek = attendanceRecords.reduce((sum, a) => sum + (parseFloat(a.total_hours) || 0), 0);
        const daysPresent = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
        
        return {
            user: member.user,
            role: member.role,
            totalTasks,
            completedTasks,
            overdueTasks,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            totalHoursThisWeek: Math.round(totalHoursThisWeek * 10) / 10,
            daysPresent
        };
    }));
    
    return memberStats;
};

/**
 * Get today's attendance status for all team members
 */
const getTodayAttendance = async (models, companyId) => {
    const { Attendance, TeamMember, User } = models;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all active team members
    const members = await TeamMember.findAll({
        where: { company_id: companyId, status: 'active' },
        include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }]
    });
    
    // Get today's attendance records
    const attendanceRecords = await Attendance.findAll({
        where: {
            company_id: companyId,
            date: today
        }
    });
    
    const attendanceMap = {};
    attendanceRecords.forEach(a => { attendanceMap[a.user_id] = a; });
    
    const result = members.map(member => ({
        user: member.user,
        role: member.role,
        attendance: attendanceMap[member.user_id] || null,
        isClockedIn: attendanceMap[member.user_id]?.clock_in && !attendanceMap[member.user_id]?.clock_out,
        status: attendanceMap[member.user_id]?.status || 'not_clocked_in'
    }));
    
    return result;
};

/**
 * Clock in a user
 */
const clockIn = async (models, userId, companyId) => {
    const { Attendance } = models;
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if already clocked in today
    let attendance = await Attendance.findOne({
        where: { user_id: userId, company_id: companyId, date: today }
    });
    
    if (attendance && attendance.clock_in) {
        return { success: false, message: 'Already clocked in today', attendance };
    }
    
    // Determine if late (assuming 9 AM is start time - could be configurable)
    const nineAM = new Date(today);
    nineAM.setHours(9, 0, 0, 0);
    const isLate = now > nineAM;
    
    if (attendance) {
        // Update existing record
        attendance.clock_in = now;
        attendance.status = isLate ? 'late' : 'present';
        await attendance.save();
    } else {
        // Create new record
        attendance = await Attendance.create({
            user_id: userId,
            company_id: companyId,
            date: today,
            clock_in: now,
            status: isLate ? 'late' : 'present'
        });
    }
    
    return { success: true, message: isLate ? 'Clocked in (late)' : 'Clocked in', attendance };
};

/**
 * Clock out a user
 */
const clockOut = async (models, userId, companyId) => {
    const { Attendance } = models;
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const attendance = await Attendance.findOne({
        where: { user_id: userId, company_id: companyId, date: today }
    });
    
    if (!attendance || !attendance.clock_in) {
        return { success: false, message: 'Not clocked in today' };
    }
    
    if (attendance.clock_out) {
        return { success: false, message: 'Already clocked out today', attendance };
    }
    
    // Calculate total hours
    const clockInTime = new Date(attendance.clock_in);
    const diffMs = now - clockInTime;
    const totalHours = (diffMs / (1000 * 60 * 60)) - (attendance.break_minutes / 60);
    
    attendance.clock_out = now;
    attendance.total_hours = Math.round(totalHours * 100) / 100;
    
    // Check for half day (less than 4 hours)
    if (totalHours < 4) {
        attendance.status = 'half_day';
    }
    
    await attendance.save();
    
    return { success: true, message: `Clocked out. Total hours: ${attendance.total_hours}`, attendance };
};

/**
 * Generate AI insights for a company
 */
const generateInsights = async (models, companyId) => {
    const { AIInsight, Notification, User } = models;
    const insights = [];
    
    // 1. Check for overdue tasks
    const overdueTasks = await getOverdueTasks(models, companyId);
    for (const task of overdueTasks) {
        const existingInsight = await AIInsight.findOne({
            where: {
                company_id: companyId,
                related_entity_id: task.id,
                type: 'task_overdue',
                is_dismissed: false
            }
        });
        
        if (!existingInsight) {
            const daysOverdue = Math.floor((new Date() - new Date(task.due_date)) / (1000 * 60 * 60 * 24));
            const insight = await AIInsight.create({
                company_id: companyId,
                user_id: task.assigned_to,
                type: 'task_overdue',
                severity: daysOverdue > 3 ? 'critical' : 'warning',
                title: `Task Overdue: ${task.title}`,
                message: `This task is ${daysOverdue} day(s) overdue. Assigned to ${task.assignee?.full_name || 'Unassigned'}.`,
                related_entity_type: 'task',
                related_entity_id: task.id,
                action_url: `/dashboard/employer/tasks/${task.id}`
            });
            insights.push(insight);
        }
    }
    
    // 2. Check for unaccepted tasks
    const unacceptedTasks = await getUnacceptedTasks(models, companyId);
    for (const task of unacceptedTasks) {
        const existingInsight = await AIInsight.findOne({
            where: {
                company_id: companyId,
                related_entity_id: task.id,
                type: 'task_unaccepted',
                is_dismissed: false
            }
        });
        
        if (!existingInsight) {
            const insight = await AIInsight.create({
                company_id: companyId,
                user_id: task.assigned_to,
                type: 'task_unaccepted',
                severity: 'info',
                title: `Task Not Accepted: ${task.title}`,
                message: `${task.assignee?.full_name || 'Team member'} hasn't accepted this task yet.`,
                related_entity_type: 'task',
                related_entity_id: task.id,
                action_url: `/dashboard/employer/tasks/${task.id}`
            });
            insights.push(insight);
        }
    }
    
    // 3. Check team performance
    const performance = await getTeamPerformance(models, companyId);
    for (const member of performance) {
        // Flag underperformers (completion rate < 50% with at least 3 tasks)
        if (member.totalTasks >= 3 && member.completionRate < 50) {
            const existingInsight = await AIInsight.findOne({
                where: {
                    company_id: companyId,
                    user_id: member.user.id,
                    type: 'performance_low',
                    is_dismissed: false,
                    created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            });
            
            if (!existingInsight) {
                const insight = await AIInsight.create({
                    company_id: companyId,
                    user_id: member.user.id,
                    type: 'performance_low',
                    severity: 'warning',
                    title: `Low Completion Rate: ${member.user.full_name}`,
                    message: `Task completion rate is ${member.completionRate}%. ${member.overdueTasks} tasks are overdue.`,
                    metadata: { completionRate: member.completionRate, overdueTasks: member.overdueTasks }
                });
                insights.push(insight);
            }
        }
        
        // Celebrate high performers
        if (member.totalTasks >= 5 && member.completionRate >= 90) {
            const existingInsight = await AIInsight.findOne({
                where: {
                    company_id: companyId,
                    user_id: member.user.id,
                    type: 'performance_high',
                    is_dismissed: false,
                    created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            });
            
            if (!existingInsight) {
                const insight = await AIInsight.create({
                    company_id: companyId,
                    user_id: member.user.id,
                    type: 'performance_high',
                    severity: 'positive',
                    title: `Top Performer: ${member.user.full_name}`,
                    message: `Excellent work! ${member.completionRate}% task completion rate.`,
                    metadata: { completionRate: member.completionRate }
                });
                insights.push(insight);
            }
        }
    }
    
    return insights;
};

/**
 * Get active insights for a company
 */
const getActiveInsights = async (models, companyId, limit = 20) => {
    const { AIInsight, User } = models;
    
    const insights = await AIInsight.findAll({
        where: {
            company_id: companyId,
            is_dismissed: false
        },
        include: [
            { model: User, as: 'user', attributes: ['id', 'full_name', 'profile_picture_url'] }
        ],
        order: [
            ['severity', 'DESC'], // critical first
            ['created_at', 'DESC']
        ],
        limit
    });
    
    return insights;
};

/**
 * Dismiss an insight
 */
const dismissInsight = async (models, insightId) => {
    const { AIInsight } = models;
    
    const insight = await AIInsight.findByPk(insightId);
    if (!insight) {
        return { success: false, message: 'Insight not found' };
    }
    
    insight.is_dismissed = true;
    await insight.save();
    
    return { success: true, message: 'Insight dismissed' };
};

/**
 * Get dashboard stats for AI overview
 */
const getDashboardStats = async (models, companyId) => {
    const { Task, TeamMember, Attendance, AIInsight } = models;
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Team stats
    const totalMembers = await TeamMember.count({ where: { company_id: companyId, status: 'active' } });
    const clockedInToday = await Attendance.count({ 
        where: { company_id: companyId, date: today, clock_in: { [Op.ne]: null } } 
    });
    
    // Task stats
    const totalTasks = await Task.count({ where: { company_id: companyId } });
    const completedTasks = await Task.count({ where: { company_id: companyId, status: 'completed' } });
    const overdueTasks = await Task.count({
        where: {
            company_id: companyId,
            due_date: { [Op.lt]: now },
            status: { [Op.notIn]: ['completed'] }
        }
    });
    const tasksDueToday = await Task.count({
        where: {
            company_id: companyId,
            due_date: { [Op.between]: [today, new Date(today.getTime() + 24 * 60 * 60 * 1000)] },
            status: { [Op.notIn]: ['completed'] }
        }
    });
    
    // Insight stats
    const activeInsights = await AIInsight.count({ 
        where: { company_id: companyId, is_dismissed: false } 
    });
    const criticalInsights = await AIInsight.count({ 
        where: { company_id: companyId, is_dismissed: false, severity: 'critical' } 
    });
    
    return {
        team: {
            total: totalMembers,
            clockedIn: clockedInToday,
            attendanceRate: totalMembers > 0 ? Math.round((clockedInToday / totalMembers) * 100) : 0
        },
        tasks: {
            total: totalTasks,
            completed: completedTasks,
            overdue: overdueTasks,
            dueToday: tasksDueToday,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        },
        insights: {
            active: activeInsights,
            critical: criticalInsights
        }
    };
};

module.exports = {
    getOverdueTasks,
    getTasksDueToday,
    getUnacceptedTasks,
    getTeamPerformance,
    getTodayAttendance,
    clockIn,
    clockOut,
    generateInsights,
    getActiveInsights,
    dismissInsight,
    getDashboardStats
};
