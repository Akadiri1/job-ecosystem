// src/controllers/taskController.js
/**
 * =============================================================================
 * TASK CONTROLLER - Role-Based Task Operations
 * =============================================================================
 * 
 * This controller handles all task CRUD operations with role-based permissions.
 * 
 * WHO CAN DO WHAT:
 * ----------------
 * CREATE TASK:
 *   - Company owner (employer with Company.owner_id = user.id)
 *   - Admins (TeamMember.role = 'admin' with 'create_tasks' permission)
 * 
 * EDIT/DELETE TASK:
 *   - Company owner
 *   - Admins with 'edit_tasks' or 'delete_tasks' permission
 *   - Task creator (created_by = user.id)
 * 
 * VIEW TASKS:
 *   - Company owner/admin → See ALL company tasks
 *   - Team member → See only tasks assigned to them
 * 
 * ACCEPT TASK:
 *   - Only the assigned user (assigned_to = user.id)
 * 
 * UPDATE STATUS:
 *   - Assigned employee (for their own task)
 *   - Managers (for any task)
 * 
 * COMMENT ON TASK:
 *   - Anyone who can view the task
 * 
 * HELPER: getUserTaskRole(user, company, teamMember)
 * --------------------------------------------------
 * Returns: 'owner' | 'admin' | 'member' | 'none'
 * Use this to determine what UI elements to show or API actions to allow.
 * =============================================================================
 */

const { sendTaskAssignment } = require('../services/emailService');
const { createNotification } = require('./notificationController');

/**
 * Creates a new task
 * 
 * PERMISSIONS: Company owner or admin with 'create_tasks' permission
 * ACTIONS:
 *   1. Validates user has a company
 *   2. Creates task with created_by = current user (manager)
 *   3. Sends email notification to assignee if assigned
 */
exports.createTask = async (req, res) => {
    try {
        const { Task, User, Company, TeamMember } = req.db_models;
        const { title, description, priority, due_date, assignees, attachments } = req.body; // remove assigned_to destructuring to handle logic below

        let company;
        if (req.user.role === 'employer') {
            company = await Company.findOne({ where: { owner_id: req.user.id } });
        } else if (req.user.role === 'employee') {
            if (req.user.company_id) company = await Company.findByPk(req.user.company_id);
        }

        if (!company) return res.status(400).json({ error: 'No company found associated with your account.' });

        if (req.user.role === 'employee') {
            const member = await TeamMember.findOne({ where: { user_id: req.user.id, company_id: company.id } });
            if (!member || !member.permissions || !member.permissions.includes('create_tasks')) {
                 return res.status(403).json({ error: "You do not have permission to create tasks." });
            }
        }

        const maxPos = await Task.max('position', { where: { company_id: company.id, status: 'todo' } }) || 0;

        // Handle Assignees
        let assigneeList = [];
        if (assignees && Array.isArray(assignees)) assigneeList = assignees;
        
        // Primary assignee is the first one, or null
        const primaryAssignee = assigneeList.length > 0 ? assigneeList[0] : null;

        const task = await Task.create({
            title,
            description,
            priority: priority || 'medium',
            due_date,
            assigned_to: primaryAssignee, // Legacy support
            assignees: assigneeList,      // New support
            company_id: company.id,
            created_by: req.user.id,
            status: 'todo',
            position: maxPos + 1,
            is_accepted: false,
            attachments: attachments || []
        });

        // Send Notifications to ALL assignees
        if (assigneeList.length > 0) {
            const taskUrl = `${req.protocol}://${req.get('host')}/dashboard/employer/tasks`;
            
            // Loop through all assignees
            for(const userId of assigneeList) {
                const user = await User.findByPk(userId);
                if(user) {
                    // Email
                    await sendTaskAssignment({
                        to: user.email,
                        inviteeName: user.full_name,
                        taskTitle: title,
                        taskUrl,
                        assignerName: req.user.full_name
                    });
                     // In-App Notification
                    await createNotification(req.db_models, {
                         user_id: user.id,
                         title: 'New Task Assigned',
                         message: `You have been assigned: ${title}`,
                         type: 'info',
                         link: `/dashboard/employer/tasks/${task.id}`,
                         related_id: task.id
                     });
                }
            }
        }

        const taskWithAssignee = await Task.findByPk(task.id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { model: User, as: 'creator', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }
            ]
        });

        res.status(201).json({ message: 'Task created successfully', task: taskWithAssignee });
    } catch (error) {
        console.error('Create Task Error:', error);
        res.status(500).json({ error: 'Server error creating task' });
    }
};

exports.acceptTask = async (req, res) => {
    try {
        const { Task } = req.db_models;
        const task = await Task.findByPk(req.params.id);
        
        if (!task) return res.status(404).json({ message: 'Task not found' });
        
        // Debug logging
        console.log('[Accept Task] User ID:', req.user.id);
        console.log('[Accept Task] Task assigned_to:', task.assigned_to);
        console.log('[Accept Task] Match:', task.assigned_to === req.user.id);
        
        // Check if user is the assignee (Primary or Multi)
        const isAssignee = task.assigned_to === req.user.id || 
                          (task.assignees && Array.isArray(task.assignees) && task.assignees.includes(req.user.id));
        
        if (!isAssignee) {
            return res.status(403).json({ 
                message: 'Only an assigned employee can accept this task',
                debug: { userId: req.user.id, assignedTo: task.assigned_to, assignees: task.assignees }
            });
        }
        
        if (task.is_accepted) {
            return res.status(400).json({ message: 'Task is already accepted' });
        }
        
        task.is_accepted = true;
        await task.save();
        
        res.json({ message: 'Task accepted', task });
    } catch (error) {
        console.error('Accept Task Error:', error);
        res.status(500).json({ message: 'Server error accepting task' });
    }
};

// Get all tasks for company (Kanban board)
exports.getTasks = async (req, res) => {
    try {
        const { Task, User, Company, TaskComment } = req.db_models;
        const { status, assigned_to, priority } = req.query;

        // Get user's company (or company they belong to)
        let company = await Company.findOne({ where: { owner_id: req.user.id } });
        
        // If not owner, check if they're a team member
        if (!company) {
            const { TeamMember } = req.db_models;
            const membership = await TeamMember.findOne({ where: { user_id: req.user.id } });
            if (membership) {
                company = await Company.findByPk(membership.company_id);
            }
        }

        if (!company) {
            return res.status(400).json({ 
                error: 'No company found. Please create a company first in Company Settings.',
                needs_company: true
            });
        }

        // Build filter
        const where = { company_id: company.id };
        if (status) where.status = status;
        if (assigned_to) where.assigned_to = assigned_to;
        if (priority) where.priority = priority;

        const tasks = await Task.findAll({
            where,
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { model: User, as: 'creator', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }
            ],
            order: [['status', 'ASC'], ['position', 'ASC']]
        });

        // Get comment counts
        const tasksWithCounts = await Promise.all(tasks.map(async (task) => {
            const commentCount = await TaskComment.count({ where: { task_id: task.id } });
            return { ...task.toJSON(), comment_count: commentCount };
        }));

        res.json({ tasks: tasksWithCounts });
    } catch (error) {
        console.error('Get Tasks Error:', error);
        res.status(500).json({ error: 'Server error fetching tasks' });
    }
};

// Get tasks assigned to current user
exports.getMyTasks = async (req, res) => {
    try {
        const { Task, User, TaskComment } = req.db_models;
        const { Op } = require('sequelize');

        // Find tasks where user is primary assignee OR in assignees array
        const tasks = await Task.findAll({
            where: {
                [Op.or]: [
                    { assigned_to: req.user.id },
                    { assignees: { [Op.contains]: [req.user.id] } }
                ]
            },
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { model: User, as: 'creator', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }
            ],
            order: [['due_date', 'ASC'], ['priority', 'DESC']]
        });

        const tasksWithCounts = await Promise.all(tasks.map(async (task) => {
            const commentCount = await TaskComment.count({ where: { task_id: task.id } });
            return { ...task.toJSON(), comment_count: commentCount };
        }));

        res.json({ tasks: tasksWithCounts });
    } catch (error) {
        console.error('Get My Tasks Error:', error);
        res.status(500).json({ error: 'Server error fetching tasks' });
    }
};

// Get single task with comments
exports.getTask = async (req, res) => {
    try {
        const { Task, User, TaskComment } = req.db_models;
        const { id } = req.params;

        const task = await Task.findByPk(id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { model: User, as: 'creator', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }
            ]
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Get comments with nested replies
        const comments = await TaskComment.findAll({
            where: { task_id: id, parent_id: null },
            include: [
                { model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { 
                    model: TaskComment, 
                    as: 'replies',
                    include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }]
                }
            ],
            order: [['created_at', 'ASC']]
        });

        res.json({ task, comments });
    } catch (error) {
        console.error('Get Task Error:', error);
        res.status(500).json({ error: 'Server error fetching task' });
    }
};

// Update task details
exports.updateTask = async (req, res) => {
    try {
        const { Task, User, Company, TeamMember } = req.db_models;
        const { id } = req.params;
        const { title, description, priority, due_date, assignees } = req.body;

        const task = await Task.findByPk(id);
        if (!task) return res.status(404).json({ error: 'Task not found' });

        // Permission Check
        const company = await Company.findByPk(task.company_id);
        const isOwner = company && company.owner_id === req.user.id;
        const isCreator = task.created_by === req.user.id;
        
        let hasPermission = isOwner || isCreator;
        
        if (!hasPermission && req.user.role === 'employee') {
            const member = await TeamMember.findOne({ where: { user_id: req.user.id, company_id: task.company_id } });
            hasPermission = member && member.permissions && member.permissions.includes('edit_tasks');
        }
        
        if (!hasPermission) return res.status(403).json({ error: 'You do not have permission to edit this task.' });

        // Update fields
        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (priority) task.priority = priority;
        if (due_date !== undefined) task.due_date = due_date;
        
        // Update Assignees
        if (assignees !== undefined) {
             task.assignees = assignees;
             // Sync primary
             task.assigned_to = (assignees && assignees.length > 0) ? assignees[0] : null;
        }

        await task.save();

        const updatedTask = await Task.findByPk(id, {
            include: [
                { model: User, as: 'assignee', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { model: User, as: 'creator', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }
            ]
        });

        res.json({ message: 'Task updated', task: updatedTask });
    } catch (error) {
        console.error('Update Task Error:', error);
        res.status(500).json({ error: 'Server error updating task' });
    }
};

// Update task status (for drag-and-drop)
exports.updateTaskStatus = async (req, res) => {
    try {
        const { Task } = req.db_models;
        const { id } = req.params;
        const { status, position } = req.body;

        const task = await Task.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const validStatuses = ['todo', 'in_progress', 'review', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        task.status = status;
        if (position !== undefined) task.position = position;
        await task.save();

        res.json({ message: 'Status updated', task });
    } catch (error) {
        console.error('Update Status Error:', error);
        res.status(500).json({ error: 'Server error updating status' });
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    try {
        const { Task, TaskComment, Company, TeamMember } = req.db_models;
        const { id } = req.params;

        const task = await Task.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Permission Check
        const company = await Company.findByPk(task.company_id);
        const isOwner = company && company.owner_id === req.user.id;
        const isCreator = task.created_by === req.user.id;
        
        let hasPermission = isOwner || isCreator;
        
        if (!hasPermission && req.user.role === 'employee') {
            const member = await TeamMember.findOne({ 
                where: { user_id: req.user.id, company_id: task.company_id } 
            });
            hasPermission = member && member.permissions && member.permissions.includes('delete_tasks');
        }
        
        if (!hasPermission) {
            return res.status(403).json({ error: 'You do not have permission to delete this task.' });
        }

        // Delete all comments first
        await TaskComment.destroy({ where: { task_id: id } });
        await task.destroy();

        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error('Delete Task Error:', error);
        res.status(500).json({ error: 'Server error deleting task' });
    }
};
