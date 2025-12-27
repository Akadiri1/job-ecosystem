const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Channel = sequelize.define('Channel', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('public', 'private'), // Public to company vs Private (invite only)
            defaultValue: 'public'
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: true
        }
    });

    return Channel;
};
