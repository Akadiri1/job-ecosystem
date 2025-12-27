const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const TaskCommentLike = sequelize.define('TaskCommentLike', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        task_comment_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('like', 'dislike'),
            allowNull: false
        }
    }, {
        tableName: 'task_comment_likes',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['user_id', 'task_comment_id']
            }
        ]
    });

    return TaskCommentLike;
};
