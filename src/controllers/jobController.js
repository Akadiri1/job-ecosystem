// src/controllers/jobController.js
const { Sequelize } = require('sequelize');

// 1. Post a Job
const createJob = async (req, res) => {
    try {
        const { Job, Company } = req.db_models;
        
        // Extract all fields from request body
        const { 
            title, description, type, salary, location, location_type, salary_range, currency,
            skills, category, experience, vacancies, qualification, language, deadline, gender
        } = req.body;

        // Check if Company exists for this user
        const company = await Company.findOne({ where: { owner_id: req.user.id } });
        if (!company) {
            return res.status(400).json({ error: "You must create a Company Profile first." });
        }

        console.log("📝 Creating Job:", { title, type, skills, category });

        // Create the Job with all fields
        const newJob = await Job.create({
            title,
            description,
            type, 
            salary_range: salary_range || salary,
            currency: currency || 'NGN', 
            location_type: location_type || location,
            location_type: location_type || location,
            location,
            company_id: company.id,
            employer_id: req.user.id,
            status: 'active',
            // New fields
            skills,
            category,
            experience,
            vacancies: vacancies || 1,
            qualification,
            language,
            deadline,
            gender
        });

        res.status(201).json({ message: "Job Posted Successfully!", job: newJob });

    } catch (error) {
        console.error("❌ Create Job Error:", error);
        res.status(500).json({ error: "Server error posting job." });
    }
};

// 2. Get All Jobs (for Job Feed) - WITH PAGINATION
const getAllJobs = async (req, res) => {
    try {
        const { Job, Company } = req.db_models;
        
        // Pagination params (default: page 1, 10 per page)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { count, rows: jobs } = await Job.findAndCountAll({
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name', 'logo_url', 'location', 'website'] } 
            ],
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.json({ 
            jobs,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
                hasMore: page * limit < count
            }
        });

    } catch (error) {
        console.error("❌ Get All Jobs Error:", error);
        res.status(500).json({ error: "Server error fetching jobs." });
    }
};

// 2b. Get My Jobs (Employer Dashboard)
const getMyJobs = async (req, res) => {
    try {
        const { Job, Company, Application } = req.db_models;
        
        console.log(`🔍 Fetching jobs for User ID: ${req.user.id}`);
        
        // Find jobs where employer_id matches logged in user
        let jobs = await Job.findAll({
            where: { employer_id: req.user.id },
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name', 'logo_url'] }
            ],
            order: [['createdAt', 'DESC']]
        });

        // Add application count to each job
        // We convert to plain object first to verify we can add properties freely
        jobs = await Promise.all(jobs.map(async (job) => {
            const jobPlain = job.get({ plain: true });
            const count = await Application.count({ where: { job_id: job.id } });
            jobPlain.applicationCount = count;
            return jobPlain;
        }));

        console.log(`✅ Found ${jobs.length} jobs for user ${req.user.id}`);
        res.json({ jobs });
    } catch (error) {
        console.error("❌ Get My Jobs Error (Details):", error);
        res.status(500).json({ error: "Server error fetching your jobs: " + error.message });
    }
};

// 3. Get Single Job by ID (for Job Details page)
const getJobById = async (req, res) => {
    try {
        const { Job, Company, User } = req.db_models;
        const { id } = req.params;

        console.log(`🔍 Requesting Job Details for ID: ${id}`);
        console.log(`Checking DB for Job ID: ${id}`);

        const job = await Job.findByPk(id, {
            include: [
                { model: Company, as: 'company', attributes: ['id', 'name', 'logo_url', 'location', 'website', 'description', 'industry'] },
                { model: User, as: 'employer', attributes: ['id', 'full_name', 'email'] }
            ]
        });

        if (!job) {
            return res.status(404).json({ error: "Job not found." });
        }

        // Check if user has applied (if logged in)
        let hasApplied = false;
        // req.user might be populated if the route uses 'protect' OR 'optionalAuth' middleware.
        // Assuming this route might be public but checking header if present?
        // Actually, for now, let's assume if they are checking details they might verify status via a separate call or we rely on 'protect' middleware being used or we check token in frontend.
        // Wait, 'getJobById' is likely public. We need to check if req.user is populated.
        // If not populated by middleware, we can't check. 
        // BUT, we can make the frontend do a separate check `GET /api/applications/check/:jobId` OR just trust the frontend to send the token even to this public endpoint if stored.
        
        // Let's rely on a separate lightweight check or just modify this if we can.
        // Since we can't easily force auth on a public job view, let's add `hasApplied` ONLY if req.user is present.
        // Ensure your route uses `protect` or a "tryExtractUser" middleware.
        
        // For simplicity: The user asked to "fix it". 
        // Best approach: Add `checkApplicationStatus` endpoint or include it here if we assume the user sends the token.
        // Let's modify the ROUTE to use `optionalProtect`? Or just add `checkStatus` endpoint.
        
        // Actually simplest is: Frontend calls `GET /api/applications/status/:jobId` if token exists.
        // But since I'm editing this file, I'll pass it if req.user exists.
        
        // NOTE: Standard `protect` throws if no token. We need `optional`.
        // Let's assume for now we will add a separate endpoint or frontend logic.
        // Actually, let's just stick to the plan: Modify Controller. But note: valid only if req.user is set.
        
        if (req.user) {
             const { Application, SavedJob } = req.db_models;
             
             // Check Application Status
             const app = await Application.findOne({ where: { job_id: id, seeker_id: req.user.id } });
             hasApplied = !!app;

             // Check Saved Status
             const saved = await SavedJob.findOne({ where: { job_id: id, seeker_id: req.user.id } });
             var isSaved = !!saved;
             console.log(`Backend Check - User: ${req.user.id}, Job: ${id}, isSaved: ${isSaved}`);
        }

        res.json({ job, hasApplied,isSaved: isSaved || false });

    } catch (error) {
        console.error("Get Job Error:", error);
        res.status(500).json({ error: "Server error fetching job." });
    }
};

// 4. Update Job
const updateJob = async (req, res) => {
    try {
        const { Job, Company } = req.db_models;
        const { id } = req.params;

        const job = await Job.findByPk(id);
        if (!job) {
            return res.status(404).json({ error: "Job not found." });
        }

        // Check ownership - only the employer who created the job can update it
        // TEMPORARILY DISABLED FOR DEBUGGING - will log and allow through
        console.log('DEBUG updateJob - job.employer_id:', job.employer_id, 'type:', typeof job.employer_id);
        console.log('DEBUG updateJob - req.user.id:', req.user.id, 'type:', typeof req.user.id);
        console.log('DEBUG updateJob - String comparison:', String(job.employer_id), '===', String(req.user.id));
        
        // Allow if employer_id matches OR if user owns the company
        const company = await Company.findByPk(job.company_id);
        const isCompanyOwner = company && String(company.owner_id) === String(req.user.id);
        const isJobCreator = String(job.employer_id) === String(req.user.id);
        
        console.log('DEBUG - isCompanyOwner:', isCompanyOwner, 'isJobCreator:', isJobCreator);
        
        if (!isCompanyOwner && !isJobCreator) {
            console.log('Permission denied - not employer_id match and not company owner');
            return res.status(403).json({ error: "You don't have permission to update this job." });
        }

        // Update allowed fields
        const allowedFields = ['title', 'description', 'type', 'salary_range', 'currency', 'location_type', 'status', 'category', 'experience', 'vacancies', 'skills', 'language', 'deadline', 'location', 'qualification', 'gender'];
        const updates = {};
        
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });
        
        console.log('Updating job with:', updates);

        await job.update(updates);

        res.json({ message: "Job updated successfully!", job });

    } catch (error) {
        console.error("❌ Update Job Error:", error);
        res.status(500).json({ error: "Server error updating job." });
    }
};

// 5. Delete Job
const deleteJob = async (req, res) => {
    try {
        const { Job, Company } = req.db_models;
        const { id } = req.params;

        const job = await Job.findByPk(id);
        if (!job) {
            return res.status(404).json({ error: "Job not found." });
        }

        // Check ownership - employer_id OR company owner
        const company = await Company.findByPk(job.company_id);
        const isCompanyOwner = company && String(company.owner_id) === String(req.user.id);
        const isJobCreator = String(job.employer_id) === String(req.user.id);
        
        if (!isCompanyOwner && !isJobCreator) {
            return res.status(403).json({ error: "You don't have permission to delete this job." });
        }

        await job.destroy();

        res.json({ message: "Job deleted successfully!" });

    } catch (error) {
        console.error("❌ Delete Job Error:", error);
        res.status(500).json({ error: "Server error deleting job." });
    }
};

// 6. Toggle Save Job
const toggleSaveJob = async (req, res) => {
    try {
        const { SavedJob } = req.db_models;
        const jobId = req.params.id;
        const seekerId = req.user.id; // User must be logged in

        const existingSave = await SavedJob.findOne({
            where: {
                job_id: jobId,
                seeker_id: seekerId
            }
        });

        if (existingSave) {
            await existingSave.destroy();
            return res.json({ message: "Job removed from saved items.", isSaved: false });
        } else {
            await SavedJob.create({
                job_id: jobId,
                seeker_id: seekerId
            });
            return res.json({ message: "Job saved successfully!", isSaved: true });
        }
    } catch (error) {
        console.error("❌ Toggle Save Error:", error);
        res.status(500).json({ error: "Server error toggling save." });
    }
};

// 7. Get Saved Jobs
const getSavedJobs = async (req, res) => {
    try {
        console.log("🔍 GetSavedJobs - User ID:", req.user.id);
        const { User, Job, Company } = req.db_models;
        const seekerId = req.user.id;

        // Debug: Check if User exists first
        const userCheck = await User.findByPk(seekerId);
        if (!userCheck) {
            console.error("❌ User not found in DB:", seekerId);
            return res.status(404).json({ error: "User not found" });
        }

        // Fetch user with saved items
        const user = await User.findByPk(seekerId, {
            include: [{
                model: Job,
                as: 'saved_jobs',
                include: [{ model: Company, as: 'company' }]
            }]
        });

        if (!user) {
             console.error("❌ User retrieval failed (should not happen)");
             return res.status(404).json({ error: "User not found" });
        }

        console.log(`✅ Found ${user.saved_jobs ? user.saved_jobs.length : 0} saved jobs.`);
        res.json({ jobs: user.saved_jobs || [] });

    } catch (error) {
        console.error("❌ Get Saved Jobs Error:", error);
        res.status(500).json({ error: "Server error fetching saved jobs." });
    }
};

// 8.// Get Dashboard Stats (Employer & Seeker)
const getDashboardStats = async (req, res) => {
    try {
        const { Job, Application, User, SavedJob, sequelize, Company } = req.db_models;
        const userId = req.user.id;
        const user = await User.findByPk(userId);
        const role = user.role;

        let stats = {};

        if (role === 'employer') {
            const activeJobs = await Job.count({ where: { employer_id: userId, status: 'active' } });
            
            // For total applicants, we need to count applications for jobs owned by this employer
            // This is a bit complex in Sequelize without raw queries or deep includes.
            // Simplified: Find all jobs by employer, then count applications for those jobs.
            const jobs = await Job.findAll({ where: { employer_id: userId }, attributes: ['id'] });
            const jobIds = jobs.map(j => j.id);
            if (jobIds.length === 0) {
                stats = {
                    activeJobs: 0,
                    totalApplicants: 0,
                    teamOnline: 5,
                    pipeline: { pending: 0, reviewed: 0, shortlisted: 0, rejected: 0, hired: 0 },
                    recentApplications: []
                };
            } else {
                const totalApplicants = await Application.count({ where: { job_id: jobIds } });

                stats = {
                    activeJobs,
                    totalApplicants,
                    teamOnline: 5 // Mock for now
                };

                // 1. Pipeline Stats (Candidates by Status)
                const pipeline = await Application.findAll({
                    where: { job_id: jobIds },
                    attributes: ['status', [Sequelize.fn('COUNT', Sequelize.col('status')), 'count']],
                    group: ['status']
                });

                // Convert to simple object { pending: 5, shortlisted: 2, etc. }
                const pipelineStats = { pending: 0, reviewed: 0, shortlisted: 0, rejected: 0, hired: 0 };
                pipeline.forEach(p => {
                    const s = p.getDataValue('status');
                    const c = parseInt(p.getDataValue('count'));
                    if (pipelineStats[s] !== undefined) pipelineStats[s] = c;
                });
                stats.pipeline = pipelineStats;

                // 2. Recent Applications (Last 5)
                const recentApps = await Application.findAll({
                    where: { job_id: jobIds },
                    limit: 5,
                    order: [['createdAt', 'DESC']],
                    include: [
                        { model: User, as: 'seeker', attributes: ['id', 'full_name', 'email'] },
                        { model: Job, as: 'job', attributes: ['id', 'title'] }
                    ]
                });
                stats.recentApplications = recentApps;
            }
        } else if (role === 'employee') {
            // --- EMPLOYEE DASHBOARD STATS ---
            const company = await Company.findByPk(user.company_id);
            const companyName = company ? company.name : 'Your Company';
            
            // 1. My Tasks (Mock for Phase 3)
            const myTasks = [
                { id: 1, title: 'Review candidates for Design role', status: 'pending', due: 'Today' },
                { id: 2, title: 'Update company profile', status: 'in_progress', due: 'Tomorrow' },
                { id: 3, title: 'Team meeting', status: 'completed', due: 'Yesterday' }
            ];

            // 2. Recent Company Activity (Mock)
            const recentActivity = [
                { id: 1, text: 'New job posted: Senior Developer', time: '2 hours ago' },
                { id: 2, text: 'New candidate applied: John Doe', time: '5 hours ago' },
                { id: 3, text: 'Weekly sync scheduled', time: '1 day ago' }
            ];

            stats = {
                role: 'employee',
                companyName: companyName,
                tasks: myTasks,
                activity: recentActivity,
                teamOnline: 4 // Mock
            };

        } else {
            // Seeker
            const applicationsSent = await Application.count({ where: { seeker_id: userId } });
            const savedJobsCount = await SavedJob.count({ where: { seeker_id: userId } });
            const interviewsScheduled = await Application.count({ where: { seeker_id: userId, status: 'shortlisted' } }); // Proxy for interviews

            // 1. Recent Applications
            const recentApps = await Application.findAll({
                where: { seeker_id: userId },
                limit: 5,
                order: [['createdAt', 'DESC']],
                include: [
                    { 
                        model: Job, 
                        as: 'job', 
                        attributes: ['id', 'title'],
                        include: [{ model: Company, as: 'company', attributes: ['name', 'logo_url'] }]
                    }
                ]
            });

            // 2. Recommended Jobs (Simple logic: Latest Active Jobs not applied to)
            // For now, just latest 4 active jobs to keep it simple and fast.
            const recommendedJobs = await Job.findAll({
                where: { status: 'active' },
                limit: 4,
                order: [['createdAt', 'DESC']],
                include: [{ model: Company, as: 'company', attributes: ['name', 'logo_url', 'location'] }]
            });

            stats = {
                applicationsSent,
                savedJobs: savedJobsCount,
                interviewsScheduled,
                recentApplications: recentApps,
                recommendedJobs: recommendedJobs
            };
        }

        res.json(stats);

    } catch (error) {
        console.error("❌ Get Dashboard Stats Error:", error);
        res.status(500).json({ error: "Server error fetching stats." });
    }
};

// 👇 CRITICAL: Export all functions
module.exports = {
    createJob,
    getAllJobs,
    getMyJobs,
    getJobById,
    updateJob,
    deleteJob,
    toggleSaveJob,
    getSavedJobs,
    getDashboardStats
};