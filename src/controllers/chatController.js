const { Op } = require('sequelize');
const asyncHandler = require('express-async-handler');

exports.getContacts = async (req, res) => {
    try {
        const models = req.db_models;
        const currentUser = await models.User.findByPk(req.user.id);
        const role = currentUser.role;
        
        let whereClause = { id: { [Op.ne]: req.user.id } };
        
        // Role-based filtering
        if (role === 'job_seeker') {
            // Seekers can only see employers/admins they've had conversations with
            const conversationPartners = await models.ChatMessage.findAll({
                where: {
                    [Op.or]: [
                        { sender_id: req.user.id },
                        { receiver_id: req.user.id }
                    ],
                    group_id: null
                },
                attributes: ['sender_id', 'receiver_id'],
                raw: true
            });
            
            // Get unique partner IDs
            const partnerIds = new Set();
            conversationPartners.forEach(msg => {
                if (msg.sender_id !== req.user.id) partnerIds.add(msg.sender_id);
                if (msg.receiver_id !== req.user.id) partnerIds.add(msg.receiver_id);
            });
            
            if (partnerIds.size > 0) {
                whereClause = {
                    id: { [Op.in]: Array.from(partnerIds) }
                };
            } else {
                // No conversations yet - return empty contacts
                return res.json({ success: true, contacts: [], userRole: role });
            }
        } else if (role === 'employer' || role === 'employee') {
            // Employers/employees see team members from same company
            if (currentUser.company_id) {
                whereClause = {
                    id: { [Op.ne]: req.user.id },
                    company_id: currentUser.company_id
                };
            }
        }
        // Admin sees everyone (no additional filter)
        
        const users = await models.User.findAll({
            where: whereClause,
            attributes: ['id', 'full_name', 'email', 'profile_picture_url', 'role']
        });
        
        res.json({ success: true, contacts: users, userRole: role });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getChatHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        const models = req.db_models;

        const messages = await models.ChatMessage.findAll({
            where: {
                [Op.or]: [
                    { sender_id: currentUserId, receiver_id: userId },
                    { sender_id: userId, receiver_id: currentUserId }
                ]
            },
            include: [
                {
                    model: models.User,
                    as: 'sender',
                    attributes: ['id', 'full_name', 'profile_picture_url']
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        // Flatten for frontend
        const result = messages.map(msg => ({
            id: msg.id,
            message: msg.message,
            sender_id: msg.sender_id,
            sender_name: msg.sender ? msg.sender.full_name : 'Unknown',
            sender_avatar: msg.sender ? msg.sender.profile_picture_url : null,
            createdAt: msg.createdAt
        }));

        res.json({ success: true, messages: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// [NEW] Get Recent Conversations (Private & Group)
exports.getRecentChats = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { User, ChatMessage, ChatGroup, ChatGroupMember } = req.db_models;

        // 1. Get Private Conversations (Latest message per partner)
        // Note: Faster approach is using raw SQL or distinct. For MVP, we fetch generally and process.
        const privateMessages = await ChatMessage.findAll({
            where: {
                [Op.or]: [{ sender_id: currentUserId }, { receiver_id: currentUserId }],
                group_id: null
            },
            order: [['createdAt', 'DESC']],
            include: [
                { model: User, as: 'sender', attributes: ['id', 'full_name'] },
                { model: User, as: 'receiver', attributes: ['id', 'full_name'] }
            ],
            limit: 200 // Fetch decent amount to find unique partners
        });

        const conversations = {};
        
        for (const msg of privateMessages) {
            const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
            const partner = msg.sender_id === currentUserId ? msg.receiver : msg.sender;
            
            if (!partnerId || !partner) continue;

            if (!conversations[`private_${partnerId}`]) {
                const isMe = msg.sender_id === currentUserId;
                const prefix = isMe ? 'You: ' : '';
                
                conversations[`private_${partnerId}`] = {
                    type: 'private',
                    partnerId: partnerId,
                    name: partner.full_name,
                    lastMessage: prefix + msg.message,
                    time: msg.createdAt,
                    unread: 0
                };
            }
            
            // Count unread: messages sent TO current user that are unread
            if (msg.receiver_id === currentUserId && !msg.is_read) {
                conversations[`private_${partnerId}`].unread++;
            }
        }

        // 2. Get Group Conversations (Latest message per group)
        // First get my groups
        const memberships = await ChatGroupMember.findAll({ where: { user_id: currentUserId }, attributes: ['group_id'] });
        const groupIds = memberships.map(m => m.group_id);

        if(groupIds.length > 0) {
            const groups = await ChatGroup.findAll({
                where: { id: groupIds },
                include: [
                    { 
                        model: ChatMessage, 
                        as: 'messages',
                        limit: 1,
                        order: [['createdAt', 'DESC']],
                        include: [{ model: User, as: 'sender', attributes: ['full_name'] }] // Who sent the last one
                    }
                ]
            });

            for(const g of groups) {
                const lastMsg = g.messages[0];
                if(lastMsg) {
                    const isMe = lastMsg.sender_id === currentUserId;
                    const senderName = isMe ? 'You' : (lastMsg.sender ? lastMsg.sender.full_name : 'User');
                    
                    conversations[`group_${g.id}`] = {
                        type: 'group',
                        partnerId: g.id, // Group ID as distinct ID
                        name: g.name,
                        avatar: '/assets/images/faces/12.jpg', // Default Group Avatar
                        lastMessage: `${senderName}: ${lastMsg.message}`,
                        time: lastMsg.createdAt,
                        unread: 0
                    };
                }
            }
        }

        // 3. Hydrate Private Chat Avatars
        const privateIds = Object.values(conversations).filter(c => c.type === 'private').map(c => c.partnerId);
        if(privateIds.length > 0) {
            const partners = await User.findAll({
                where: { id: privateIds },
                attributes: ['id', 'full_name', 'profile_picture_url', 'is_online']
            });
            partners.forEach(p => {
                if(conversations[`private_${p.id}`]) {
                    conversations[`private_${p.id}`].name = p.full_name;
                    conversations[`private_${p.id}`].avatar = p.profile_picture_url;
                    conversations[`private_${p.id}`].avatar = p.profile_picture_url;
                    conversations[`private_${p.id}`].is_online = p.is_online; // Return boolean directly
                }
            });
        }

        // 4. Merge and Sort
        const result = Object.values(conversations).sort((a, b) => new Date(b.time) - new Date(a.time));

        res.json({ success: true, recent: result });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Mark messages as read for a conversation
exports.markAsRead = async (req, res) => {
    try {
        const { partnerId, type } = req.body; // type: 'private' or 'group'
        const currentUserId = req.user.id;
        const { ChatMessage } = req.db_models;

        if (type === 'private') {
            // Mark all messages FROM partner TO current user as read
            await ChatMessage.update(
                { is_read: true },
                { 
                    where: { 
                        sender_id: partnerId, 
                        receiver_id: currentUserId,
                        is_read: false 
                    } 
                }
            );
        } else if (type === 'group') {
            // Mark all group messages not from current user as read
            await ChatMessage.update(
                { is_read: true },
                { 
                    where: { 
                        group_id: partnerId, 
                        sender_id: { [Op.ne]: currentUserId },
                        is_read: false 
                    } 
                }
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Add/Toggle reaction on a message
exports.addReaction = async (req, res) => {
    try {
        const { messageId, emoji } = req.body;
        const userId = req.user.id;
        const { ChatMessage } = req.db_models;
        const io = req.app.get('io');

        const message = await ChatMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        let reactions = message.reactions || {};
        
        // Toggle reaction
        if (!reactions[emoji]) {
            reactions[emoji] = [];
        }
        
        const userIndex = reactions[emoji].indexOf(userId);
        if (userIndex > -1) {
            // Remove reaction
            reactions[emoji].splice(userIndex, 1);
            if (reactions[emoji].length === 0) {
                delete reactions[emoji];
            }
        } else {
            // Add reaction
            reactions[emoji].push(userId);
        }

        await message.update({ reactions });

        // Emit Socket Event
        const payload = {
            messageId: message.id,
            reactions: reactions,
            group_id: message.group_id,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id
        };

        if (message.group_id) {
            io.to(`group_${message.group_id}`).emit('reaction_updated', payload);
        } else {
            io.to(message.sender_id).emit('reaction_updated', payload);
            io.to(message.receiver_id).emit('reaction_updated', payload);
        }

        res.json({ success: true, reactions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a message (soft delete)
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        const { ChatMessage } = req.db_models;
        const io = req.app.get('io');

        const message = await ChatMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        // Only sender can delete their own messages
        if (message.sender_id !== userId) {
            return res.status(403).json({ success: false, message: 'Cannot delete others messages' });
        }

        await message.update({ is_deleted: true, message: 'This message was deleted' });

        // Emit Socket Event
        const payload = {
            id: message.id,
            message: 'This message was deleted',
            is_deleted: true,
            group_id: message.group_id,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id
        };

        if (message.group_id) {
            io.to(`group_${message.group_id}`).emit('message_deleted', payload);
        } else {
            io.to(message.sender_id).emit('message_deleted', payload);
            io.to(message.receiver_id).emit('message_deleted', payload);
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Edit a message
exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { newMessage } = req.body;
        const userId = req.user.id;
        const { ChatMessage } = req.db_models;
        const io = req.app.get('io');

        const message = await ChatMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (message.sender_id !== userId) {
            return res.status(403).json({ success: false, message: 'Cannot edit others messages' });
        }

        await message.update({ message: newMessage, is_edited: true });

        // Emit Socket Event
        const payload = {
            id: message.id,
            message: newMessage,
            is_edited: true,
            group_id: message.group_id,
            sender_id: message.sender_id,
            receiver_id: message.receiver_id
        };

        if (message.group_id) {
            io.to(`group_${message.group_id}`).emit('message_updated', payload);
        } else {
            io.to(message.sender_id).emit('message_updated', payload);
            io.to(message.receiver_id).emit('message_updated', payload);
        }

        res.json({ success: true, message: newMessage });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Toggle pin on a message
exports.togglePin = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { ChatMessage } = req.db_models;

        const message = await ChatMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        await message.update({ is_pinned: !message.is_pinned });
        res.json({ success: true, is_pinned: message.is_pinned });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Toggle star on a message
exports.toggleStar = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { ChatMessage } = req.db_models;

        const message = await ChatMessage.findByPk(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        await message.update({ is_starred: !message.is_starred });
        res.json({ success: true, is_starred: message.is_starred });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get total unread count for header notification
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { ChatMessage } = req.db_models;

        const count = await ChatMessage.count({
            where: {
                receiver_id: userId,
                is_read: false
            }
        });

        res.json({ success: true, count });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ==========================================
// CHANNEL CONTROLLER LOGIC (Team Collaboration)
// ==========================================

exports.createChannel = async (req, res) => {
    try {
        const { name, type, description } = req.body;
        const ownerId = req.user.id;
        const { Channel, ChannelMember, TeamMember, Company, User } = req.db_models;

        // Verify user belongs to a company
        // Check if user is employer (owner) OR employee of a company
        let companyId;
        const user = await User.findByPk(ownerId);
        
        if (user.role === 'employer') {
            const company = await Company.findOne({ where: { owner_id: ownerId } });
            if(company) companyId = company.id;
        } else if (user.role === 'employee') {
            companyId = user.company_id;
        }

        if (!companyId) return res.status(403).json({ success: false, message: 'You must belong to a company to create channels' });

        // Create Channel
        const channel = await Channel.create({
            company_id: companyId,
            name,
            type: type || 'public',
            description,
            created_by: ownerId
        });

        // Add Creator as Admin
        await ChannelMember.create({
            channel_id: channel.id,
            user_id: ownerId,
            role: 'admin'
        });

        res.json({ success: true, channel });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.addAllTeamToChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.id;
        const { Channel, TeamMember, ChannelMember } = req.db_models;

        const channel = await Channel.findByPk(channelId);
        if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

        // TODO: Verify userId has permissions (omitted for brevity)

        // Get all active team members
        const teamMembers = await TeamMember.findAll({ 
            where: { company_id: channel.company_id, status: 'active' },
            attributes: ['user_id']
        });

        const membersToAdd = teamMembers.map(tm => ({
            channel_id: channel.id,
            user_id: tm.user_id,
            role: 'member'
        }));

        // Bulk Create (ignore duplicates ideally, but Sequelize bulkCreate might fail on distinct constraint if not careful)
        await ChannelMember.bulkCreate(membersToAdd, { ignoreDuplicates: true });

        res.json({ success: true, message: `Added ${membersToAdd.length} members to channel` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getChannelMessages = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { ChatMessage, User } = req.db_models;

        const messages = await ChatMessage.findAll({
            where: { channel_id: channelId },
            include: [{ model: User, as: 'sender', attributes: ['id', 'full_name', 'profile_picture_url'] }],
            order: [['createdAt', 'ASC']]
        });

        res.json({ success: true, messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getChannels = async (req, res) => {
    try {
        const userId = req.user.id;
        const { Channel, ChannelMember, User, Company } = req.db_models;

        // Get User's Company ID
        const user = await User.findByPk(userId);
        let companyId = user.company_id;
        if (!companyId && user.role === 'employer') {
             const company = await Company.findOne({ where: { owner_id: userId } });
             if(company) companyId = company.id;
        }

        if(!companyId) return res.json({ success: true, channels: [] });

        // Get all attributes
        const channels = await Channel.findAll({
            where: {
                company_id: companyId
            }
        });

        // Filter: If private, check membership
        const myMemberships = await ChannelMember.findAll({ where: { user_id: userId, channel_id: channels.map(c => c.id) } });
        const memberChannelIds = new Set(myMemberships.map(m => m.channel_id));

        const visibleChannels = channels.filter(c => c.type === 'public' || memberChannelIds.has(c.id));

        res.json({ success: true, channels: visibleChannels });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.addChannelMember = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { userId } = req.body;
        const { Channel, ChannelMember, User } = req.db_models;

        const channel = await Channel.findByPk(channelId);
        if(!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

        const existing = await ChannelMember.findOne({ where: { channel_id: channelId, user_id: userId } });
        if(existing) return res.status(400).json({ success: false, message: 'User already in channel' });

        await ChannelMember.create({
            channel_id: channelId,
            user_id: userId,
            role: 'member'
        });

        res.json({ success: true, message: 'Member added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getChannelMembers = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { Channel, User, ChannelMember } = req.db_models;

        const channel = await Channel.findByPk(channelId, {
            include: [{
                model: User,
                as: 'members',
                through: { attributes: ['role'] },
                attributes: ['id', 'full_name', 'email', 'profile_picture_url']
            }]
        });

        if(!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

        const members = channel.members.map(u => ({
            id: u.id,
            full_name: u.full_name,
            email: u.email,
            profile_picture_url: u.profile_picture_url,
            role: u.ChannelMember.role
        }));

        res.json({ success: true, members });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { Channel } = req.db_models;
        
        // TODO: Check ownership
        
        const channel = await Channel.findByPk(channelId);
        if(!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
        
        await channel.destroy();
        
        res.json({ success: true, message: 'Channel deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.editChannel = async (req, res) => {
    try {
        const { channelId } = req.params;
        const { name, description, type } = req.body;
        const { Channel } = req.db_models;
        
        const channel = await Channel.findByPk(channelId);
        if(!channel) return res.status(404).json({ success: false, message: 'Channel not found' });
        
        await channel.update({ name, description, type });
        
        res.json({ success: true, message: 'Channel updated' });
    } catch (error) {
         console.error(error);
         res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Upload attachment
// @route   POST /api/chat/upload-attachment
exports.uploadAttachment = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }

    // Determine type
    const mime = req.file.mimetype;
    let type = 'file';
    if(mime.startsWith('image/')) type = 'image';
    else if(mime.startsWith('audio/')) type = 'audio';
    else if(mime.startsWith('video/')) type = 'video';

    // Return URL and type
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    res.json({ success: true, url: fileUrl, type: type, filename: req.file.originalname });
});
