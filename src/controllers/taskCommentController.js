// src/controllers/taskCommentController.js
/**
 * =============================================================================
 * TASK COMMENT CONTROLLER - Discussion & Collaboration System
 * =============================================================================
 * 
 * Handles all comment-related operations on tasks including:
 * - Adding comments (text, code snippets, attachments)
 * - Reply threading (nested comments via parent_id)
 * - Voting (like/dislike system)
 * - File attachments
 * 
 * WHO CAN COMMENT:
 * ----------------
 * Anyone who can VIEW the task can comment on it:
 *   - Company owner/admin → Can comment on any task
 *   - Team member → Can comment on tasks assigned to them
 * 
 * COMMENT TYPES (content_type field):
 * ------------------------------------
 * - 'text'  → Plain text comment (supports line breaks)
 * - 'code'  → Code snippet with syntax highlighting (use code_language field)
 * - 'image' → Image attachment (URL stored in content or attachment_url)
 * - 'file'  → File attachment (URL stored in content or attachment_url)
 * 
 * VOTING SYSTEM:
 * --------------
 * Each user can vote once per comment (like OR dislike, not both)
 * - Clicking same vote type again → removes vote (toggle off)
 * - Clicking different vote type → switches vote
 * 
 * EMOJI REACTIONS (future enhancement):
 * -------------------------------------
 * Could extend TaskCommentLike model to support emoji types:
 * type: ENUM('like', 'dislike', '👍', '❤️', '😂', '😮', '😢', '😡')
 * 
 * THREADING:
 * ----------
 * Comments can have replies via parent_id:
 * - parent_id = null → Top-level comment
 * - parent_id = <comment_id> → Reply to that comment
 * - Replies are fetched and nested in the response
 * =============================================================================
 */
const path = require('path');
const fs = require('fs');

/**
 * Add a comment to a task
 * 
 * PERMISSIONS: Any user who can view the task
 * BODY: { content, content_type, parent_id, code_language }
 */
exports.addComment = async (req, res) => {
    try {
        const { TaskComment, User, Notification } = req.db_models;
        const { task_id } = req.params;
        const { content, content_type, parent_id, code_language } = req.body;

        const comment = await TaskComment.create({
            task_id,
            user_id: req.user.id,
            content,
            content_type: content_type || 'text',
            parent_id: parent_id || null,
            code_language: code_language || null
        });

        // Get with author info
        const commentWithAuthor = await TaskComment.findByPk(comment.id, {
            include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }]
        });

        res.status(201).json({ message: 'Comment added', comment: commentWithAuthor });
    } catch (error) {
        console.error('Add Comment Error:', error);
        res.status(500).json({ error: 'Server error adding comment' });
    }
};

// Toggle like/dislike on a comment
exports.toggleVote = async (req, res) => {
    try {
        const { TaskCommentLike, TaskComment } = req.db_models;
        const { comment_id } = req.params;
        const { type } = req.body; // 'like' or 'dislike'

        if (!['like', 'dislike'].includes(type)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }

        const comment = await TaskComment.findByPk(comment_id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const existingVote = await TaskCommentLike.findOne({
            where: {
                task_comment_id: comment_id,
                user_id: req.user.id
            }
        });

        if (existingVote) {
            if (existingVote.type === type) {
                // Same vote type -> remove (toggle off)
                await existingVote.destroy();
                res.json({ message: 'Vote removed', action: 'removed' });
            } else {
                // Different vote type -> update (switch)
                existingVote.type = type;
                await existingVote.save();
                res.json({ message: `Vote switched to ${type}`, action: 'switched' });
            }
        } else {
            // New vote - wrap in try/catch to handle race condition with unique constraint
            try {
                await TaskCommentLike.create({
                    task_comment_id: comment_id,
                    user_id: req.user.id,
                    type
                });
                res.json({ message: `${type} added`, action: 'added' });
            } catch (createError) {
                if (createError.name === 'SequelizeUniqueConstraintError') {
                    // This means a vote was just created by another request
                    // We can try to find it again and update it if needed, or just return success
                    // For simplicity, let's treat it as if the user clicked too fast/twice
                    const verifyVote = await TaskCommentLike.findOne({
                        where: { task_comment_id: comment_id, user_id: req.user.id }
                    });
                    
                    if (verifyVote && verifyVote.type !== type) {
                        verifyVote.type = type;
                        await verifyVote.save();
                        return res.json({ message: `Vote switched to ${type}`, action: 'switched' });
                    }
                    // If same type, maybe they meant to toggle off? 
                    // But since we are here inside "else" (didn't exist initially), 
                    // it's an edge case. Let's just return current state to be safe.
                    return res.json({ message: 'Vote processed', action: 'processed' });
                }
                throw createError;
            }
        }
    } catch (error) {
        console.error('Toggle Vote Error:', error);
        res.status(500).json({ error: 'Server error toggling vote' });
    }
};

// Get all comments for a task (with nested replies and votes)
exports.getComments = async (req, res) => {
    try {
        const { TaskComment, User, TaskCommentLike } = req.db_models;
        const { task_id } = req.params;
        const currentUserId = req.user.id;

        const comments = await TaskComment.findAll({
            where: { task_id, parent_id: null },
            include: [
                { model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                { 
                    model: TaskCommentLike, 
                    as: 'likes',
                    attributes: ['user_id', 'type']
                },
                { 
                    model: TaskComment, 
                    as: 'replies',
                    include: [
                        { model: User, as: 'author', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] },
                        { 
                            model: TaskCommentLike, 
                            as: 'likes',
                            attributes: ['user_id', 'type']
                        }
                    ],
                    order: [['created_at', 'ASC']]
                }
            ],
            order: [['created_at', 'ASC']]
        });

        // Helper to process comments (count votes and check user vote)
        // Helper to enrich comment with vote counts
        const enrichComment = (plain) => {
            if (!plain.likes) plain.likes = [];
            
            plain.likes_count = plain.likes.filter(l => l.type === 'like').length;
            plain.dislikes_count = plain.likes.filter(l => l.type === 'dislike').length;
            
            const myVote = plain.likes.find(l => l.user_id === currentUserId);
            plain.current_user_vote = myVote ? myVote.type : null;
            
            delete plain.likes; // Clean up raw likes array
            return plain;
        };

        const processedComments = comments.map(c => {
            const plain = c.get({ plain: true });
            const enriched = enrichComment(plain);
            
            if (enriched.replies) {
                enriched.replies = enriched.replies.map(r => enrichComment(r));
            }
            return enriched;
        });

        res.json({ comments: processedComments });
    } catch (error) {
        console.error('Get Comments Error:', error);
        res.status(500).json({ error: 'Server error fetching comments' });
    }
};

// Delete a comment/image attachment for comment
exports.uploadAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileUrl = `/uploads/task-attachments/${req.file.filename}`;
        
        res.json({ 
            message: 'File uploaded',
            url: fileUrl,
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Server error uploading file' });
    }
};

// Delete a comment
exports.deleteComment = async (req, res) => {
    try {
        const { TaskComment } = req.db_models;
        const { comment_id } = req.params;

        const comment = await TaskComment.findByPk(comment_id);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Only author can delete
        if (comment.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        // Delete replies first
        await TaskComment.destroy({ where: { parent_id: comment_id } });
        await comment.destroy();

        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Delete Comment Error:', error);
        res.status(500).json({ error: 'Server error deleting comment' });
    }
};
