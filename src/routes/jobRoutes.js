// src/routes/jobRoutes.js
const express = require('express');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { hasPermission } = require('../middleware/permissionMiddleware');
const jobController = require('../controllers/jobController');
const { createJobValidator, jobIdValidator, paginationValidator } = require('../middleware/validators');

const router = express.Router();

// Public Route: Get all jobs (for job feed) - with pagination
router.get('/', paginationValidator, jobController.getAllJobs); 

// Protected Route: Get my jobs (Employer Dashboard)
router.get('/my', protect, paginationValidator, jobController.getMyJobs);

// Protected Route: Get Dashboard Stats
router.get('/dashboard/stats', protect, jobController.getDashboardStats);

// Protected Route: Get Saved Jobs (API)
router.get('/seeker/saved', protect, paginationValidator, jobController.getSavedJobs);

// Public Route with Optional Auth: Get single job by ID (checks if applied)
router.get('/:id', optionalAuth, jobIdValidator, jobController.getJobById);

// Protected Route: Post a job (requires 'post_jobs' permission) - with validation
router.post('/', protect, hasPermission('post_jobs'), createJobValidator, jobController.createJob);

// Protected Route: Update a job (requires 'post_jobs' permission)
router.put('/:id', protect, hasPermission('post_jobs'), jobIdValidator, jobController.updateJob);

// Protected Route: Delete a job (requires 'post_jobs' permission)
router.delete('/:id', protect, hasPermission('post_jobs'), jobIdValidator, jobController.deleteJob);

// Protected Route: Toggle Save Job
router.post('/:id/save', protect, jobIdValidator, jobController.toggleSaveJob);

module.exports = router;