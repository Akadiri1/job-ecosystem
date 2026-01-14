/**
 * =============================================================================
 * ADMIN ROUTES - Super Admin API Endpoints
 * =============================================================================
 */
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect } = require('../controllers/authController');

// All admin routes require authentication + admin role
router.use(protect);
router.use(adminController.requireAdmin);

// Dashboard / Stats
router.get('/stats', adminController.getStats);

// User Management
router.get('/users', adminController.getUsers);
router.patch('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Company Management
router.get('/companies', adminController.getCompanies);

// Job Management
router.get('/jobs', adminController.getJobs);
router.patch('/jobs/:id', adminController.updateJob);

// Subscription Management
router.get('/subscriptions', adminController.getSubscriptions);
router.patch('/subscriptions/:id', adminController.updateSubscription);

// Payment History
router.get('/payments', adminController.getPayments);

// User Activity Tracking
router.get('/activities', adminController.getUserActivities);
router.get('/activities/stats', adminController.getActivityStats);
router.get('/activities/user/:userId', adminController.getUserActivityHistory);

module.exports = router;
