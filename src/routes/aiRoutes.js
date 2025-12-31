/**
 * =============================================================================
 * AI ROUTES - API Routes for AI Assistant
 * =============================================================================
 */
const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../controllers/authController');

// All AI routes require authentication
router.use(protect);

// Dashboard & Overview
router.get('/dashboard', aiController.getDashboard);
router.get('/performance', aiController.getPerformance);

// Insights
router.get('/insights', aiController.getInsights);
router.post('/insights/generate', aiController.generateInsights);
router.post('/insights/:id/dismiss', aiController.dismissInsight);

// Attendance
router.get('/attendance', aiController.getAttendance);
router.get('/attendance/me', aiController.getMyAttendance);
router.post('/attendance/clock-in', aiController.clockIn);
router.post('/attendance/clock-out', aiController.clockOut);

// Task Analysis
router.get('/tasks/at-risk', aiController.getTasksAtRisk);

module.exports = router;
