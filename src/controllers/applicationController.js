const { v4: uuidv4 } = require('uuid');

// Apply for a job
exports.applyForJob = async (req, res) => {
    try {
        const { Job, Application } = req.db_models;
        const jobId = req.params.jobId;
        const seekerId = req.user.id;
        const { cover_letter, resume_url: resume_link } = req.body; // 'resume_link' if they provided a URL text (fallback)
        
        let finalResumeUrl = resume_link;
        if (req.files && req.files['resume']) {
            // Normalize path for web access (replace backslashes with slashes and remove 'public')
            const resumePath = req.files['resume'][0].path.replace(/\\/g, '/').replace('public', '');
            finalResumeUrl = resumePath;
        }

        let finalCoverLetter = cover_letter;
        if (req.files && req.files['cover_letter_file']) {
             // If a file is uploaded, we might store the path in cover_letter column or append it
             const clPath = req.files['cover_letter_file'][0].path.replace(/\\/g, '/').replace('public', '');
             // Storing path in cover_letter field as it is TEXT. We can prefix to know it's a file? 
             // Or just store the path. Let's store "FILE:[path]" to distinguish or just the path if empty.
             // Simplest: If file exists, it overrides text or we just store the path.
             finalCoverLetter = clPath; 
        }

        // Check if job exists
        const job = await Job.findByPk(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check if already applied
        const existingApp = await Application.findOne({
            where: { job_id: jobId, seeker_id: seekerId }
        });

        if (existingApp) {
            return res.status(400).json({ error: 'You have already applied for this job' });
        }

        // Create application
        const application = await Application.create({
            job_id: jobId,
            seeker_id: seekerId,
            cover_letter: finalCoverLetter,
            resume_url: finalResumeUrl,
            status: 'pending'
        });

        res.status(201).json({ message: 'Application submitted successfully', application });

    } catch (error) {
        console.error('Error applying for job:', error);
        res.status(500).json({ error: 'Server error applying for job' });
    }
};

// Get applications for the logged-in seeker
exports.getMyApplications = async (req, res) => {
    try {
        const { Application, Job, Company } = req.db_models;
        const seekerId = req.user.id;

        const applications = await Application.findAll({
            where: { seeker_id: seekerId },
            include: [
                {
                    model: Job,
                    as: 'job',
                    include: [{ model: Company, as: 'company', attributes: ['name', 'logo_url'] }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ applications });

    } catch (error) {
        console.error('Error fetching my applications:', error);
        res.status(500).json({ error: 'Server error fetching applications' });
    }
};

// Get candidates for a specific job (Employer only)
exports.getJobCandidates = async (req, res) => {
    try {
        const { Application, Job, User } = req.db_models;
        const jobId = req.params.jobId;
        const employerId = req.user.id;

        const job = await Job.findByPk(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Verify ownership
        if (job.employer_id !== employerId) {
            return res.status(403).json({ error: 'Unauthorized to view candidates for this job' });
        }

        const candidates = await Application.findAll({
            where: { job_id: jobId },
            include: [
                {
                    model: User,
                    as: 'seeker',
                    attributes: ['id', 'full_name', 'email', 'profile_picture_url', 'resume_url', 'bio', 'phone_number'] // Don't expose password
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ candidates });

    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ error: 'Server error fetching candidates' });
    }
};

// Update application status (Employer only)
const { sendEmail } = require('../services/emailService');
const { getShortlistTemplate, getHiredTemplate, getRejectedTemplate } = require('../services/emailTemplates');

exports.updateApplicationStatus = async (req, res) => {
    try {
        const { Application, Job, User, Company } = req.db_models;
        const applicationId = req.params.applicationId;
        const employerId = req.user.id;
        const { status } = req.body;

        const application = await Application.findByPk(applicationId, {
            include: [
                { 
                    model: Job, 
                    as: 'job',
                    include: [{ model: Company, as: 'company', attributes: ['name'] }] // Fetch Company Name
                },
                { model: User, as: 'seeker' }
            ]
        });

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Verify ownership via the job
        if (application.job.employer_id !== employerId) {
            return res.status(403).json({ error: 'Unauthorized to update this application' });
        }

        if (!['pending', 'shortlisted', 'rejected', 'hired'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const oldStatus = application.status;
        application.status = status;
        await application.save();

        // --- EMAIL NOTIFICATION LOGIC ---
        if (oldStatus !== status) {
            const seekerName = application.seeker ? application.seeker.full_name : 'Candidate';
            const seekerEmail = application.seeker ? application.seeker.email : null;
            const jobTitle = application.job ? application.job.title : 'Job';
            // Fallback if company association is missing or company name is null
            const companyName = (application.job.company && application.job.company.name) ? application.job.company.name : 'Our Company';
            const companyId = (application.job && application.job.company) ? application.job.company.id : null;

            if (status === 'hired') {
                // --- CONVERT SEEKER TO EMPLOYEE ---
                if (companyId) {
                    const seekerUser = await User.findByPk(application.seeker_id);
                    if (seekerUser) {
                        seekerUser.role = 'employee';
                        seekerUser.company_id = companyId;
                        await seekerUser.save();
                        console.log(`✅ User ${seekerUser.email} converted to EMPLOYEE for Company ${companyId}`);
                    }
                }
            }

            if (seekerEmail) {
                let subject = '';
                let htmlContent = '';

                if (status === 'shortlisted') {
                    subject = `Update: You've been Shortlisted by ${companyName}`;
                    htmlContent = getShortlistTemplate(seekerName, jobTitle, companyName);
                } 
                else if (status === 'hired') {
                    subject = `Congratulations! You're Hired at ${companyName}`;
                    htmlContent = getHiredTemplate(seekerName, jobTitle, companyName);
                }
                else if (status === 'rejected') {
                    subject = `Application Status Update - ${companyName}`;
                    htmlContent = getRejectedTemplate(seekerName, jobTitle, companyName);
                }

                if (subject && htmlContent) {
                    await sendEmail(seekerEmail, subject, htmlContent);
                }
            }
        }
        // --------------------------------

        res.json({ message: 'Status updated successfully', application });

    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Server error updating status' });
    }
};

// Get ALL candidates for the logged-in employer (across all jobs)
exports.getAllEmployerCandidates = async (req, res) => {
    try {
        const { Application, Job, User } = req.db_models;
        const employerId = req.user.id;

        // Find all jobs by this employer
        const jobs = await Job.findAll({ where: { employer_id: employerId }, attributes: ['id'] });
        const jobIds = jobs.map(j => j.id);

        if (jobIds.length === 0) {
            return res.json({ candidates: [] });
        }

        const candidates = await Application.findAll({
            where: { job_id: jobIds },
            include: [
                {
                    model: User,
                    as: 'seeker',
                    attributes: ['id', 'full_name', 'email', 'profile_picture_url', 'resume_url']
                },
                {
                    model: Job,
                    as: 'job',
                    attributes: ['id', 'title']
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        res.json({ candidates });

    } catch (error) {
        console.error('Error fetching all candidates:', error);
        res.status(500).json({ error: 'Server error fetching candidates' });
    }
};

// Get application details and render view
exports.getApplicationDetails = async (req, res) => {
    try {
        const { Application, Job, User } = req.db_models;
        const applicationId = req.params.applicationId;
        
        const application = await Application.findByPk(applicationId, {
            include: [

                { 
                    model: Job, 
                    as: 'job',
                    attributes: ['title'],
                    include: [{
                        model: req.db_models.Company,
                        as: 'company',
                        attributes: ['name', 'logo_url']
                    }]
                },
                { 
                    model: User, 
                    as: 'seeker', 
                    attributes: ['full_name', 'email', 'bio', 'skills', 'experience', 'phone_number'] 
                }
            ]
        });

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Check if client accepts JSON (e.g., from fetch)
        if (req.accepts('json')) {
            return res.json({ application });
        }

        // Otherwise render view (fallback)
        res.render('candidate-details', {
            application,
            user: req.user,
            path: 'candidates',
            title: 'Candidate Details'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Withdraw/Delete Application (Seeker only)
exports.withdrawApplication = async (req, res) => {
    try {
        const { Application } = req.db_models;
        const applicationId = req.params.applicationId;
        const seekerId = req.user.id; // Logged in user

        const application = await Application.findByPk(applicationId);

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Verify ownership
        if (application.seeker_id !== seekerId) {
            return res.status(403).json({ error: 'Unauthorized to withdraw this application' });
        }

        await application.destroy();

        res.json({ message: 'Application withdrawn successfully' });

    } catch (error) {
        console.error('Error withdrawing application:', error);
        res.status(500).json({ error: 'Server error withdrawing application' });
    }
};
