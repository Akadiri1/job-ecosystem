const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ChatGroupMember = sequelize.define('ChatGroupMember', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        group_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        is_admin: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        status: {
            type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
            defaultValue: 'accepted' // Default to accepted for now to not break existing logic
        }
    }, {
        tableName: 'chat_group_members',
        timestamps: true,
    });
    return ChatGroupMember;
};
