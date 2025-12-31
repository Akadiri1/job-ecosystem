/**
 * =============================================================================
 * SUBSCRIPTION MODEL - Company Subscription Plans
 * =============================================================================
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Subscription = sequelize.define('Subscription', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        plan: {
            type: DataTypes.ENUM('free', 'starter', 'pro', 'enterprise'),
            defaultValue: 'free'
        },
        status: {
            type: DataTypes.ENUM('active', 'cancelled', 'past_due', 'trialing', 'inactive'),
            defaultValue: 'active'
        },
        // Stripe fields
        stripe_customer_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        stripe_subscription_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        stripe_price_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Billing cycle
        current_period_start: {
            type: DataTypes.DATE,
            allowNull: true
        },
        current_period_end: {
            type: DataTypes.DATE,
            allowNull: true
        },
        cancel_at_period_end: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        // Plan limits
        job_posts_limit: {
            type: DataTypes.INTEGER,
            defaultValue: 3 // Free tier
        },
        team_members_limit: {
            type: DataTypes.INTEGER,
            defaultValue: 5 // Free tier
        },
        ai_features_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'subscriptions',
        timestamps: true,
        underscored: true
    });

    return Subscription;
};
