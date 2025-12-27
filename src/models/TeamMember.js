/**
 * =============================================================================
 * TEAM MEMBER MODEL - Company Role & Permission System
 * =============================================================================
 * 
 * Links users to companies with specific roles and granular permissions.
 * This is the source of truth for what a user can do within a company.
 * 
 * ROLE HIERARCHY:
 * ---------------
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  ROLE     │  DESCRIPTION                │  DEFAULT PERMISSIONS  │
 * ├───────────┼─────────────────────────────┼───────────────────────┤
 * │  owner    │  Company founder/CEO        │  All permissions      │
 * │  admin    │  Project Manager/HR/Lead    │  Most permissions     │
 * │  member   │  Regular team employee       │  Basic permissions    │
 * └─────────────────────────────────────────────────────────────────┘
 * 
 * TASK-RELATED PERMISSIONS (stored in `permissions` JSONB array):
 * ---------------------------------------------------------------
 * - 'create_tasks'      → Can create new tasks
 * - 'assign_tasks'      → Can assign tasks to team members  
 * - 'edit_tasks'        → Can edit any task's details
 * - 'delete_tasks'      → Can delete tasks
 * - 'view_all_tasks'    → Can see all company tasks (not just assigned)
 * - 'manage_team'       → Can invite/remove team members
 * - 'post_jobs'         → Can post job listings
 * - 'view_applicants'   → Can view job applicants
 * 
 * DEFAULT PERMISSIONS BY ROLE:
 * ----------------------------
 * OWNER:  All permissions automatically granted (bypass check)
 * ADMIN:  ['create_tasks', 'assign_tasks', 'edit_tasks', 'view_all_tasks', 
 *          'post_jobs', 'view_applicants']
 * MEMBER: ['view_assigned_tasks', 'comment_on_tasks', 'update_own_task_status']
 * 
 * CHECKING PERMISSIONS (example):
 * -------------------------------
 * const canEdit = teamMember.role === 'owner' || 
 *                 teamMember.role === 'admin' ||
 *                 teamMember.permissions.includes('edit_tasks');
 * =============================================================================
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TeamMember = sequelize.define('TeamMember', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('owner', 'admin', 'member'),
            defaultValue: 'member'
        },
        permissions: {
            type: DataTypes.JSONB, // Stores array like ['post_jobs', 'view_applicants', 'manage_team']
            defaultValue: []
        },
        status: {
            type: DataTypes.ENUM('active', 'invited', 'suspended'),
            defaultValue: 'active'
        }
    });

    return TeamMember;
};
