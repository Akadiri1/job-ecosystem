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
        const { Task, User, Company } = req.db_models;
        const { title, description, priority, due_date, assigned_to } = req.body;

        const company = await Company.findOne({ where: { owner_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: 'No company found. Create a company first.' });
        }

        const maxPos = await Task.max('position', { where: { company_id: company.id, status: 'todo' } }) || 0;

        const task = await Task.create({
            title,
            description,
            priority: priority || 'medium',
            due_date,
            assigned_to,
            company_id: company.id,
            created_by: req.user.id,
            status: 'todo',
            position: maxPos + 1,
            is_accepted: false // Default
        });

        // Send Email if assigned
        if (assigned_to) {
            const assignee = await User.findByPk(assigned_to);
            if (assignee) {
                const taskUrl = `${req.protocol}://${req.get('host')}/dashboard/employer/tasks`;
                await sendTaskAssignment({
                    to: assignee.email,
                    inviteeName: assignee.full_name,
                    taskTitle: title,
                    taskUrl,
                    assignerName: req.user.full_name
                });
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
        
        // Check if user is the assignee
        if (task.assigned_to !== req.user.id) {
            return res.status(403).json({ 
                message: 'Only the assigned employee can accept this task',
                debug: { userId: req.user.id, assignedTo: task.assigned_to }
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
            return res.status(400).json({ error: 'No company found' });
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

        const tasks = await Task.findAll({
            where: { assigned_to: req.user.id },
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
        const { Task, User } = req.db_models;
        const { id } = req.params;
        const { title, description, priority, due_date, assigned_to } = req.body;

        const task = await Task.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Update fields
        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (priority) task.priority = priority;
        if (due_date !== undefined) task.due_date = due_date;
        if (assigned_to !== undefined) task.assigned_to = assigned_to;

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
        const { Task, TaskComment } = req.db_models;
        const { id } = req.params;

        const task = await Task.findByPk(id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
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
