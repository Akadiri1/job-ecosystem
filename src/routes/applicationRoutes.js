const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');
const { hasPermission, hasAnyPermission } = require('../middleware/permissionMiddleware');

const upload = require('../middleware/uploadMiddleware');

// Seeker Routes
router.post('/apply/:jobId', protect, upload.fields([
    { name: 'resume', maxCount: 1 }, 
    { name: 'cover_letter_file', maxCount: 1 }
]), applicationController.applyForJob);
router.get('/my-applications', protect, applicationController.getMyApplications);
router.delete('/:applicationId', protect, applicationController.withdrawApplication);

// Employer Routes (require permissions)
router.get('/candidates', protect, hasAnyPermission('view_applicants', 'manage_applicants'), applicationController.getAllEmployerCandidates);
router.get('/job/:jobId/candidates', protect, hasAnyPermission('view_applicants', 'manage_applicants'), applicationController.getJobCandidates);
router.get('/:applicationId', protect, hasAnyPermission('view_applicants', 'manage_applicants'), applicationController.getApplicationDetails);
router.put('/:applicationId/status', protect, hasPermission('manage_applicants'), applicationController.updateApplicationStatus);

module.exports = router;

