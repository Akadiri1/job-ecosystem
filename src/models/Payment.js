/**
 * =============================================================================
 * PAYMENT MODEL - Payment History & Transactions
 * =============================================================================
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Payment = sequelize.define('Payment', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        company_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        subscription_id: {
            type: DataTypes.UUID,
            allowNull: true
        },
        // Payment details
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        currency: {
            type: DataTypes.STRING(3),
            defaultValue: 'USD'
        },
        status: {
            type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded'),
            defaultValue: 'pending'
        },
        // Stripe fields
        stripe_payment_intent_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        stripe_invoice_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        stripe_charge_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Invoice details
        description: {
            type: DataTypes.STRING,
            allowNull: true
        },
        invoice_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        receipt_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // Metadata
        metadata: {
            type: DataTypes.JSONB,
            defaultValue: {}
        }
    }, {
        tableName: 'payments',
        timestamps: true,
        underscored: true
    });

    return Payment;
};
