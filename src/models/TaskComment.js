// src/models/TaskComment.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TaskComment = sequelize.define('TaskComment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        task_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        // For threaded replies - null means top-level comment
        parent_id: {
            type: DataTypes.UUID,
            allowNull: true
        },
        // Content type: 'text', 'image', 'file', 'code', 'gif'
        content_type: {
            type: DataTypes.ENUM('text', 'image', 'file', 'code', 'gif'),
            defaultValue: 'text'
        },
        // Main content (text, code, or URL for media)
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        // For code snippets - programming language
        code_language: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        // For file attachments - original filename
        file_name: {
            type: DataTypes.STRING(255),
            allowNull: true
        },
        // For file attachments - file size in bytes
        file_size: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'task_comments',
        timestamps: true,
        underscored: true
    });

    return TaskComment;
};
