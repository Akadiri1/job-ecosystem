const { createNotification } = require('../controllers/notificationController');

module.exports = (io, dbModels) => {
    const { User, ChatMessage, ChatGroup, ChatGroupMember, Channel, ChannelMember } = dbModels;

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Map socket to user
        socket.on('join', async (userId) => {
            socket.userId = userId;
            socket.join(userId); // Join personal room
            console.log(`User ${userId} joined their room`);

            // Update user status to online
            await User.update({ is_online: true }, { where: { id: userId } });
            io.emit('user_status', { userId, status: 'online' });
            
            // Auto-join group rooms
            try {
                const myGroups = await ChatGroupMember.findAll({ where: { user_id: userId } });
                myGroups.forEach(group => {
                    socket.join(`group_${group.group_id}`);
                    console.log(`User ${userId} auto-joined group_${group.group_id}`);
                });
                
                // [NEW] Auto-join Channels
                if(ChannelMember) {
                    const myChannels = await ChannelMember.findAll({ where: { user_id: userId } });
                    myChannels.forEach(ch => {
                        socket.join(`channel_${ch.channel_id}`);
                        console.log(`User ${userId} auto-joined channel_${ch.channel_id}`);
                    });
                }
            } catch (e) {
                console.error("Error auto-joining groups/channels", e);
            }
        });

        // Join specific Group Room (if created after connection)
        // Join specific Group Room
        socket.on('join_group', (groupId) => {
            const userId = socket.userId;
            if (!userId) return;
            socket.join(`group_${groupId}`);
            console.log(`User ${userId} joined group_${groupId}`);
        });

        // [NEW] Join Channel Room
        socket.on('join_channel', (channelId) => {
             const userId = socket.userId;
             if (!userId) return;
             socket.join(`channel_${channelId}`);
             console.log(`User ${userId} joined channel_${channelId}`);
        });

        // Handle Private Messages
        socket.on('private_message', async ({ toUserId, message }) => {
            try {
                const fromUserId = socket.userId;
                if(!fromUserId) return;

                // Save to DB
                const chatMsg = await ChatMessage.create({
                    sender_id: fromUserId,
                    receiver_id: toUserId,
                    message: message,
                    attachment_url: message.attachment_url,
                    attachment_type: message.attachment_type
                });
                
                // Get Sender Info
                const sender = await User.findByPk(fromUserId, { attributes: ['full_name', 'profile_picture_url'] });

                const payload = {
                    id: chatMsg.id,
                    sender_id: fromUserId,
                    receiver_id: toUserId,
                    group_id: null,
                    message: message.text || message, // Handle object vs string
                    attachment_url: message.attachment_url,
                    attachment_type: message.attachment_type,
                    createdAt: chatMsg.createdAt,
                    sender_name: sender ? sender.full_name : 'Unknown',
                    sender_avatar: sender ? sender.profile_picture_url : null,
                    type: 'private'
                };

                // Emit to Receiver
                io.to(toUserId).emit('receive_message', payload);
                // Emit confirmation to sender
                socket.emit('message_sent', payload);
                
                // --- NOTIFICATION LOGIC (Private) ---
                // --- NOTIFICATION LOGIC (Private) ---
                await createNotification(dbModels, {
                    user_id: toUserId,
                    title: 'New Message',
                    message: `${sender ? sender.full_name : 'Someone'} sent you a message`,
                    type: 'message',
                    link: `/dashboard`,
                    related_id: fromUserId
                });
                
                io.to(toUserId).emit('receive_notification', {
                     title: 'New Message',
                     message: `${sender ? sender.full_name : 'Someone'} dropped a message`,
                     type: 'message',
                     link: `/dashboard`
                });
                
            } catch (err) {
                console.error('Error sending private message:', err);
            }
        });

        // Handle Group Messages
        socket.on('group_message', async ({ groupId, message }) => {
            try {
                const userId = socket.userId;
                if(!userId) return;

                // Save to DB
                const chatMsg = await ChatMessage.create({
                    sender_id: userId,
                    group_id: groupId,
                    message: message.text || message,
                    attachment_url: message.attachment_url,
                    attachment_type: message.attachment_type
                });

                // Get User Info
                const sender = await User.findByPk(userId, { attributes: ['full_name', 'profile_picture_url'] });

                const payload = {
                    id: chatMsg.id,
                    sender_id: userId,
                    group_id: groupId,
                    message: message.text || message,
                    attachment_url: message.attachment_url,
                    attachment_type: message.attachment_type,
                    createdAt: chatMsg.createdAt,
                    sender_name: sender ? sender.full_name : 'Unknown',
                    sender_avatar: sender ? sender.profile_picture_url : null,
                    type: 'group'
                };

                // Broadcast to Group
                io.to(`group_${groupId}`).emit('receive_message', payload);

                // --- NOTIFICATION LOGIC (Group) ---
                const members = await ChatGroupMember.findAll({ where: { group_id: groupId } });
                const groupInfo = await ChatGroup.findByPk(groupId);
                
                members.forEach(async (member) => {
                    if (member.user_id !== userId) {
                         if(dbModels.Notification) {
                         if(dbModels.Notification) {
                             await createNotification(dbModels, {
                                user_id: member.user_id,
                                title: 'New Group Message',
                                message: `${sender ? sender.full_name : 'Someone'} posted in ${groupInfo ? groupInfo.name : 'group'}`,
                                type: 'message',
                                link: `/dashboard`,
                                related_id: groupId
                            });
                        }
                        }
                        io.to(member.user_id).emit('receive_notification', {
                            title: 'New Message',
                            message: `${sender ? sender.full_name : 'Someone'} dropped a message in ${groupInfo ? groupInfo.name : 'group'}`,
                            type: 'message',
                            link: `/dashboard`
                        });
                    }
                });

            } catch (err) {
                console.error('Error sending group message:', err);
            }
        });

        // [NEW] Handle Channel Messages
        socket.on('channel_message', async ({ channelId, message }) => {
            try {
                const userId = socket.userId;
                if(!userId) return;

                // Save to DB
                const chatMsg = await ChatMessage.create({
                    sender_id: userId,
                    channel_id: channelId,
                    message: message.text || message,
                    attachment_url: message.attachment_url,
                    attachment_type: message.attachment_type
                });

                const sender = await User.findByPk(userId, { attributes: ['full_name', 'profile_picture_url'] });

                const payload = {
                    id: chatMsg.id,
                    sender_id: userId,
                    channel_id: channelId,
                    message: message.text || message,
                    attachment_url: message.attachment_url,
                    attachment_type: message.attachment_type,
                    createdAt: chatMsg.createdAt,
                    sender_name: sender ? sender.full_name : 'Unknown',
                    sender_avatar: sender ? sender.profile_picture_url : null,
                    type: 'channel'
                };

                io.to(`channel_${channelId}`).emit('receive_message', payload);

                // --- NOTIFICATION LOGIC (Channel) ---
                if(ChannelMember && Channel) {
                    const channelMembers = await ChannelMember.findAll({ where: { channel_id: channelId } });
                    const channelInfo = await Channel.findByPk(channelId);

                    channelMembers.forEach(async (member) => {
                        if (member.user_id !== userId) {
                            if(dbModels.Notification) {
                                await createNotification(dbModels, {
                                    user_id: member.user_id,
                                    title: 'New Channel Message',
                                    message: `${sender ? sender.full_name : 'Someone'} posted in #${channelInfo ? channelInfo.name : 'channel'}`,
                                    type: 'message',
                                    link: `/dashboard`,
                                    related_id: channelId
                                });
                            }
                            io.to(member.user_id).emit('receive_notification', {
                                title: 'New Channel Message',
                                message: `${sender ? sender.full_name : 'Someone'} posted in #${channelInfo ? channelInfo.name : 'channel'}`,
                                type: 'message',
                                link: `/dashboard`
                            });
                        }
                    });
                }

            } catch (err) {
                console.error('Error sending channel message:', err);
            }
        });
        
        // Typing Indicators
        socket.on('typing', ({ toUserId, groupId }) => {
            const userId = socket.userId;
            if(groupId) {
                 socket.to(`group_${groupId}`).emit('user_typing', { userId, groupId });
            } else if (toUserId) {
                 io.to(toUserId).emit('user_typing', { userId });
            }
        });

        socket.on('stop_typing', ({ toUserId, groupId }) => {
             const userId = socket.userId;
             if(groupId) {
                 socket.to(`group_${groupId}`).emit('user_stop_typing', { userId, groupId });
            } else if (toUserId) {
                 io.to(toUserId).emit('user_stop_typing', { userId });
            }
        });

        // ================== CALL SIGNALING ==================
        socket.on('call_user', (data) => {
            // data: { userToCall, from, signal/peerId, type }
            io.to(data.userToCall).emit("call_incoming", data);
        });

        socket.on("answer_call", (data) => {
            io.to(data.to).emit("call_accepted", data);
        });
        
        socket.on("reject_call", (data) => {
            io.to(data.to).emit("call_rejected");
        });
        
        socket.on("end_call", (data) => {
             io.to(data.to).emit("call_ended");
        });

        // ================== SAVE CALL RECORD ==================
        socket.on('save_call_record', async (data) => {
            try {
                const fromUserId = socket.userId;
                if(!fromUserId) return;
                
                // data: { toUserId, callType, duration, status }
                // status: 'completed', 'missed', 'declined'
                
                const durationText = data.duration > 0 
                    ? `${Math.floor(data.duration / 60)}:${String(data.duration % 60).padStart(2, '0')}`
                    : '';
                    
                let messageText = '';
                if(data.status === 'completed') {
                    messageText = `📞 ${data.callType === 'video' ? 'Video' : 'Voice'} call • ${durationText}`;
                } else if(data.status === 'missed') {
                    messageText = `📵 Missed ${data.callType === 'video' ? 'video' : 'voice'} call`;
                } else if(data.status === 'declined') {
                    messageText = `❌ ${data.callType === 'video' ? 'Video' : 'Voice'} call declined`;
                } else {
                    messageText = `📞 ${data.callType === 'video' ? 'Video' : 'Voice'} call`;
                }

                // Save to DB as a special message
                const chatMsg = await ChatMessage.create({
                    sender_id: fromUserId,
                    receiver_id: data.toUserId,
                    message: messageText,
                    attachment_type: 'call' // Mark as call record
                });
                
                const sender = await User.findByPk(fromUserId, { attributes: ['full_name', 'profile_picture_url'] });
                
                const payload = {
                    id: chatMsg.id,
                    sender_id: fromUserId,
                    receiver_id: data.toUserId,
                    message: messageText,
                    attachment_type: 'call',
                    createdAt: chatMsg.createdAt,
                    sender_name: sender ? sender.full_name : 'Unknown',
                    sender_avatar: sender ? sender.profile_picture_url : null,
                    type: 'private',
                    isCall: true
                };

                // Emit to both users
                io.to(data.toUserId).emit('receive_message', payload);
                socket.emit('message_sent', payload);
                
                console.log(`Call record saved: ${messageText}`);
            } catch(err) {
                console.error('Error saving call record:', err);
            }
        });

        socket.on('disconnect', async () => {
             if(socket.userId) {
                console.log('Client disconnected:', socket.userId);
                await User.update({ is_online: false }, { where: { id: socket.userId } });
                io.emit('user_status', { userId: socket.userId, status: 'offline' });
             }
        });
    });
};
