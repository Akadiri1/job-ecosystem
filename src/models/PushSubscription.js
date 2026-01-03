const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PushSubscription = sequelize.define('PushSubscription', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        endpoint: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        p256dh: {
            type: DataTypes.STRING,
            allowNull: false
        },
        auth: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        tableName: 'push_subscriptions',
        timestamps: true,
        underscored: true
    });

    return PushSubscription;
};
