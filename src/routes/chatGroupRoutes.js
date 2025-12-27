const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createGroup, getMyGroups, getGroupMessages, addMember, leaveGroup } = require('../controllers/chatGroupController');

router.use(protect);

router.route('/')
    .post(createGroup)
    .get(getMyGroups);

router.get('/:groupId/messages', getGroupMessages);

// Management
// Management
router.post('/:groupId/members', addMember);
router.delete('/:groupId/members', leaveGroup);
router.put('/invite/:inviteId/:action', require('../controllers/chatGroupController').handleInvitation); // New Route
router.put('/:groupId', require('../controllers/chatGroupController').editGroup);
router.delete('/:groupId', require('../controllers/chatGroupController').deleteGroup);

module.exports = router;
