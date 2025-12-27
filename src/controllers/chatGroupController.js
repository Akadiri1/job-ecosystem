const asyncHandler = require('express-async-handler');
const { Op } = require('sequelize');

// @desc    Create a new chat group
// @route   POST /api/chat/groups
exports.createGroup = asyncHandler(async (req, res) => {
    const { name, members = [] } = req.body; // members is array of userIds
    const userId = req.user.id;
    const { ChatGroup, ChatGroupMember } = req.db_models;

    // 1. Create Group
    const group = await ChatGroup.create({
        name,
        created_by: userId
    });

    // 2. Add Creator as Admin
    await ChatGroupMember.create({
        group_id: group.id,
        user_id: userId,
        is_admin: true,
        status: 'accepted'
    });

    // 3. Add Other Members (as invites)
    if (members.length > 0) {
        // We'll create them one by one to trigger notifications or use loop
        for(const mId of members) {
             const memberRecord = await ChatGroupMember.create({
                group_id: group.id,
                user_id: mId,
                status: 'pending' // Default to pending
            });

            // CREATE NOTIFICATION
             if(req.db_models.Notification) {
                await req.db_models.Notification.create({
                    user_id: mId,
                    title: 'Group Invitation',
                    message: `You have been invited to join group "${name}"`,
                    type: 'invite',
                    link: null, // Actions handled in UI
                    related_id: memberRecord.id, // ID of the Invite/Member record
                    is_read: false
                });
             }
        }
    }

    res.status(201).json({ success: true, group });
});

// @desc    Get my groups
// @route   GET /api/chat/groups
exports.getMyGroups = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { ChatGroup, ChatGroupMember, User } = req.db_models;

    // First get group IDs where user is a member AND accepted
    const memberships = await ChatGroupMember.findAll({
        where: { 
            user_id: userId,
            status: 'accepted' // Only showing active groups
        },
        attributes: ['group_id']
    });
    
    const groupIds = memberships.map(m => m.group_id);
    
    if (groupIds.length === 0) {
        return res.json({ success: true, groups: [] });
    }

    // Then fetch groups with all their members
    const groups = await ChatGroup.findAll({
        where: { id: groupIds },
        include: [
            {
                model: User,
                as: 'members',
                attributes: ['id', 'full_name', 'profile_picture_url'],
                through: { attributes: ['status'] } // Show all members (pending & accepted)
            }
        ],
        order: [['updatedAt', 'DESC']]
    });

    res.json({ success: true, groups, currentUserId: userId });
});

// @desc    Get group messages
// @route   GET /api/chat/groups/:groupId/messages
exports.getGroupMessages = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    const { ChatMessage, ChatGroupMember, User } = req.db_models;

    // Check membership
    const isMember = await ChatGroupMember.findOne({ where: { group_id: groupId, user_id: userId, status: 'accepted' } });
    if (!isMember) {
        res.status(403);
        throw new Error('Not a member of this group');
    }

    const messages = await ChatMessage.findAll({
        where: { group_id: groupId },
        include: [
            {
                model: User,
                as: 'sender',
                attributes: ['id', 'full_name', 'profile_picture_url']
            }
        ],
        order: [['createdAt', 'ASC']],
        limit: 100 // Pagination later
    });
    
    // Flatten for frontend
    const result = messages.map(msg => ({
        id: msg.id,
        message: msg.content || msg.message,
        sender_id: msg.sender_id,
        createdAt: msg.createdAt,
        sender_name: msg.sender ? msg.sender.full_name : 'Unknown',
        sender_avatar: msg.sender ? msg.sender.profile_picture_url : null,
        group_id: groupId
    }));

    res.json({ success: true, messages: result });
});

// @desc    Add member to group
// @route   POST /api/chat/groups/:groupId/members
exports.addMember = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { userId } = req.body;
    const adminId = req.user.id;
    const { ChatGroupMember, ChatGroup, Notification } = req.db_models;

    // Check if already member
    const exists = await ChatGroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
    if(exists) {
        if(exists.status === 'pending') return res.status(400).json({ success: false, message: "User already invited" });
        return res.status(400).json({ success: false, message: "User already in group" });
    }
    
    const group = await ChatGroup.findByPk(groupId);

    const memberRecord = await ChatGroupMember.create({
        group_id: groupId,
        user_id: userId,
        is_admin: false,
        status: 'pending' // Invite flow
    });

    // Notify
    if(Notification) {
         await Notification.create({
            user_id: userId,
            title: 'Group Invitation',
            message: `You have been invited to join group "${group ? group.name : 'Unknown'}"`,
            type: 'invite', // This triggers buttons in UI
            link: null, 
            related_id: memberRecord.id, // Invite ID
            is_read: false
        });
    }

    res.json({ success: true, message: "Invitation sent" });
});

// @desc    Handle Invitation (Accept/Reject)
// @route   PUT /api/chat/groups/invite/:inviteId/:action
exports.handleInvitation = asyncHandler(async (req, res) => {
    const { inviteId, action } = req.params; // action = 'accept' or 'reject'
    const userId = req.user.id;
    const { ChatGroupMember, Notification } = req.db_models;
    
    const membership = await ChatGroupMember.findByPk(inviteId);
    
    if(!membership) {
        res.status(404);
        throw new Error('Invitation not found');
    }
    
    // Security check: ensure the invite belongs to the user
    if(membership.user_id !== userId) {
        res.status(403);
        throw new Error('Not authorized to handle this invitation');
    }

    if(action === 'accept') {
        membership.status = 'accepted';
        await membership.save();
        
        // Notify success? (Optional)
        // Mark connected Notification as read
        if(Notification) {
            await Notification.update({ is_read: true }, { where: { related_id: inviteId } });
        }
        res.json({ success: true, message: 'Group joined successfully' });
    } else if (action === 'reject') {
        // Destroy membership record
        await membership.destroy();
         // Mark notification as read
        if(Notification) {
            await Notification.update({ is_read: true }, { where: { related_id: inviteId } });
        }
        res.json({ success: true, message: 'Invitation rejected' });
    } else {
        res.status(400);
        throw new Error('Invalid action');
    }
});

// @desc    Leave group (or remove member)
// @route   DELETE /api/chat/groups/:groupId/members
exports.leaveGroup = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.id; // Self-leave for now
    const { ChatGroupMember } = req.db_models;

    await ChatGroupMember.destroy({
        where: { group_id: groupId, user_id: userId }
    });

    res.json({ success: true, message: "Left group" });
});

// @desc    Get members of a group
// @route   GET /api/chat/groups/:groupId/members
exports.getGroupMembers = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { ChatGroup, User } = req.db_models;

    const group = await ChatGroup.findByPk(groupId, {
        include: [
             {
                model: User,
                as: 'members',
                attributes: ['id', 'full_name', 'profile_picture_url'],
                 through: { attributes: ['status'], where: { status: 'accepted' } } 
            }
        ]
    });

    if(!group) {
        res.status(404);
         throw new Error('Group not found');
    }

    res.json({ success: true, members: group.members });
});

// @desc    Edit group (Name)
// @route   PUT /api/chat/groups/:groupId
exports.editGroup = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { name } = req.body;
    const { ChatGroup } = req.db_models;

    const group = await ChatGroup.findByPk(groupId);
    if (!group) {
        res.status(404);
        throw new Error('Group not found');
    }

    if (group.created_by !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized to edit this group');
    }

    group.name = name || group.name;
    await group.save();

    res.json({ success: true, group });
});

// @desc    Delete group
// @route   DELETE /api/chat/groups/:groupId
exports.deleteGroup = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const { ChatGroup } = req.db_models;

    const group = await ChatGroup.findByPk(groupId);
    if (!group) {
        res.status(404);
        throw new Error('Group not found');
    }

    if (group.created_by !== req.user.id) {
        res.status(403);
        throw new Error('Not authorized to delete this group');
    }

    await group.destroy();

    res.json({ success: true, message: 'Group deleted' });
});
