const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ChannelMember = sequelize.define('ChannelMember', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        channel_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('admin', 'member'),
            defaultValue: 'member'
        }
    });

    return ChannelMember;
};
