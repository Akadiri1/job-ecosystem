// src/models/Task.js
/**
 * =============================================================================
 * TASK MODEL - Role-Based Task Management System
 * =============================================================================
 * 
 * This model represents a work task within a company's project management system.
 * 
 * ROLE HIERARCHY:
 * ---------------
 * 1. MANAGERS (CEO, Admin, Project Manager):
 *    - Identified by: `created_by` field (the user who created the task)
 *    - TeamMember.role: 'owner' or 'admin'
 *    - Capabilities: Create, assign, edit, delete tasks, view all tasks
 * 
 * 2. EMPLOYEES (Team Members):
 *    - Identified by: `assigned_to` field (the user assigned to work on the task)
 *    - TeamMember.role: 'member'
 *    - Capabilities: View assigned tasks, accept tasks, update status, comment
 * 
 * KEY RELATIONSHIPS:
 * ------------------
 * - `created_by` → User (Manager) - The person who created/manages this task
 * - `assigned_to` → User (Employee) - The person responsible for completing it
 * - `company_id` → Company - The organization this task belongs to
 * 
 * TASK LIFECYCLE:
 * ---------------
 * 1. Manager creates task (created_by = manager.id)
 * 2. Manager assigns to employee (assigned_to = employee.id)
 * 3. Employee receives notification & can view task
 * 4. Employee accepts task (is_accepted = true)
 * 5. Employee moves through statuses: todo → in_progress → review → completed
 * 6. Both can comment/discuss throughout
 * 
 * PERMISSION MATRIX:
 * ------------------
 * | Action          | Owner/Admin | Member (assigned) | Member (not assigned) |
 * |-----------------|-------------|-------------------|----------------------|
 * | Create Task     | ✅           | ❌                 | ❌                    |
 * | Edit Task       | ✅           | ❌                 | ❌                    |
 * | Delete Task     | ✅           | ❌                 | ❌                    |
 * | Assign Task     | ✅           | ❌                 | ❌                    |
 * | View Task       | ✅           | ✅                 | ❌ (configurable)     |
 * | Accept Task     | ❌           | ✅                 | ❌                    |
 * | Update Status   | ✅           | ✅                 | ❌                    |
 * | Comment         | ✅           | ✅                 | ❌                    |
 * =============================================================================
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Task = sequelize.define('Task', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('todo', 'in_progress', 'review', 'completed'),
            defaultValue: 'todo'
        },
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            defaultValue: 'medium'
        },
        is_accepted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        due_date: {
            type: DataTypes.DATE,
            allowNull: true
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        assigned_to: {
            type: DataTypes.UUID,
            allowNull: true // Can be unassigned
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: false
        },
        // For ordering within columns
        position: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        // [NEW] File attachments array: [{url, filename, size}]
        attachments: {
            type: DataTypes.JSONB,
            defaultValue: []
        },
        // [NEW] Multiple assignees (for multi-person assignment)
        assignees: {
            type: DataTypes.JSONB,
            defaultValue: []
        }
    }, {
        tableName: 'tasks',
        timestamps: true,
        underscored: true
    });

    return Task;
};
