const express = require('express');
const router = express.Router();
// Case sensitivity check: file was TeamController.js or teamController.js?
// I created TeamController.js with Capital T. Require should match or be case insensitive on Windows.
// Safer to use proper case.
const teamController = require('../controllers/teamController'); 
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Search Users to Invite
router.get('/search', restrictTo('employer', 'admin'), teamController.searchUsers);

// Invite/Add Member
router.post('/invite', restrictTo('employer', 'admin'), teamController.inviteMember);

// List Members
// Allowing employees to view team too? For chat, yes.
router.get('/members', restrictTo('employer', 'admin', 'employee'), teamController.getTeamMembers);

// Get current user's membership (for permission checks)
router.get('/my-membership', restrictTo('employer', 'admin', 'employee'), teamController.getMyMembership);

// Update Permissions
router.put('/members/:memberId', restrictTo('employer', 'admin'), teamController.updatePermissions);

// Toggle Status (Suspend/Activate)
router.patch('/members/:memberId/status', restrictTo('employer', 'admin'), teamController.toggleMemberStatus);

// Remove Member
router.delete('/members/:memberId', restrictTo('employer', 'admin'), teamController.removeMember);

module.exports = router;
