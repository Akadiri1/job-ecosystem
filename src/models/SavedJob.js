const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SavedJob = sequelize.define('SavedJob', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        seeker_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        job_id: {
            type: DataTypes.UUID,
            allowNull: false
        }
    }, {
        timestamps: true
    });

    return SavedJob;
};
