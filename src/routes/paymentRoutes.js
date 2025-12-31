/**
 * =============================================================================
 * PAYMENT ROUTES - Billing & Subscription API
 * =============================================================================
 */
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../controllers/authController');

// Public endpoint for Stripe webhook (must be before protect middleware)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.webhook);

// Protected routes
router.use(protect);

router.get('/plans', paymentController.getPlans);
router.get('/subscription', paymentController.getSubscription);
router.get('/payments', paymentController.getPayments);
router.post('/create-checkout', paymentController.createCheckout);
router.post('/create-portal', paymentController.createPortal);
router.post('/downgrade', paymentController.downgrade);

module.exports = router;
