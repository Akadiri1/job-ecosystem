// src/middleware/validators.js
const { body, param, query, validationResult } = require('express-validator');

// Helper to check validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Validation failed', 
            details: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};

// ==========================================
// AUTH VALIDATORS
// ==========================================

const signupValidator = [
    body('name')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role')
        .optional()
        .isIn(['job_seeker', 'employer']).withMessage('Invalid role'),
    validate
];

const loginValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format'),
    body('password')
        .notEmpty().withMessage('Password is required'),
    validate
];

const forgotPasswordValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format'),
    validate
];

const resetPasswordValidator = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format'),
    body('otp')
        .trim()
        .notEmpty().withMessage('OTP is required')
        .isLength({ min: 4, max: 6 }).withMessage('Invalid OTP'),
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
];

// ==========================================
// JOB VALIDATORS
// ==========================================

const createJobValidator = [
    body('title')
        .trim()
        .notEmpty().withMessage('Job title is required')
        .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description')
        .trim()
        .notEmpty().withMessage('Job description is required')
        .isLength({ min: 20 }).withMessage('Description must be at least 20 characters'),
    body('location')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Location too long'),
    body('salary_min')
        .optional()
        .isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
    body('salary_max')
        .optional()
        .isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
    body('job_type')
        .optional()
        .isIn(['full-time', 'part-time', 'contract', 'internship', 'remote']).withMessage('Invalid job type'),
    validate
];

const jobIdValidator = [
    param('id')
        .notEmpty().withMessage('Job ID is required')
        .isUUID().withMessage('Invalid job ID format'),
    validate
];

// ==========================================
// APPLICATION VALIDATORS  
// ==========================================

const applyJobValidator = [
    body('job_id')
        .notEmpty().withMessage('Job ID is required')
        .isUUID().withMessage('Invalid job ID'),
    body('cover_letter')
        .optional()
        .trim()
        .isLength({ max: 5000 }).withMessage('Cover letter too long'),
    validate
];

// ==========================================
// TASK VALIDATORS
// ==========================================

const createTaskValidator = [
    body('title')
        .trim()
        .notEmpty().withMessage('Task title is required')
        .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
    body('description')
        .optional()
        .trim(),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
    body('assigned_to')
        .optional()
        .isUUID().withMessage('Invalid user ID'),
    body('due_date')
        .optional()
        .isISO8601().withMessage('Invalid date format'),
    validate
];

// ==========================================
// PAGINATION VALIDATOR
// ==========================================

const paginationValidator = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    validate
];

module.exports = {
    validate,
    signupValidator,
    loginValidator,
    forgotPasswordValidator,
    resetPasswordValidator,
    createJobValidator,
    jobIdValidator,
    applyJobValidator,
    createTaskValidator,
    paginationValidator
};
