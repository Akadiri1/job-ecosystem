 const { Op } = require('sequelize');
const { sendTeamInvitation } = require('../services/emailService');

exports.searchUsers = async (req, res) => {
    try {
        const { query } = req.query; // email or name
        const { User } = req.db_models;

        if (!query || query.length < 2) return res.json({ success: true, users: [] });

        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { email: { [Op.like]: `%${query}%` } },
                    { full_name: { [Op.like]: `%${query}%` } }
                ],
                role: 'job_seeker' // Only invite seekers or unaffiliated? Or anyone? Assuming seekers for now.
            },
            attributes: ['id', 'full_name', 'email', 'profile_picture_url'],
            limit: 10
        });

        res.json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.inviteMember = async (req, res) => {
    try {
        const { userId, email, name, role, permissions } = req.body;
        const { TeamMember, User, Company } = req.db_models;
        const ownerId = req.user.id;

        // Verify Company Ownership
        const company = await Company.findOne({ where: { owner_id: ownerId } });
        if (!company) return res.status(403).json({ success: false, message: 'Company not found' });

        // Get inviter's name
        const inviter = await User.findByPk(ownerId, { attributes: ['full_name'] });
        const inviterName = inviter ? inviter.full_name : 'Your employer';

        let targetUserId = userId;
        let generatedPassword = null;
        let targetEmail = email;

        // If no userId provided, lookup or create by Email
        if (!targetUserId && email) {
            let user = await User.findOne({ where: { email } });
            
            if (!user) {
                const tempPassword = Math.random().toString(36).slice(-8);
                generatedPassword = tempPassword;
                
                user = await User.create({
                    full_name: name || email.split('@')[0],
                    email: email,
                    password_hash: tempPassword,
                    role: 'job_seeker'
                });
            }
            targetUserId = user.id;
            targetEmail = user.email;
        }

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'User ID or Email is required' });
        }

        // Prevent inviting yourself
        if (targetUserId === ownerId) {
            return res.status(400).json({ success: false, message: 'You cannot invite yourself to your own team as an employee.' });
        }

        // Check if already member
        const existing = await TeamMember.findOne({ where: { company_id: company.id, user_id: targetUserId } });
        if (existing) return res.status(400).json({ success: false, message: 'User already in team' });

        // Add to Team
        await TeamMember.create({
            company_id: company.id,
            user_id: targetUserId,
            role: role || 'member',
            permissions: permissions || [],
            status: 'active'
        });

        // Update User Role & Company Link
        // CRITICAL FIX: Do NOT overwrite if user is already an employer or admin.
        // Also, do not overwrite if they are already an employee of ANOTHER company (unless we support switching).
        // For now, only upgrade 'job_seeker' to 'employee'.
        
        const targetUserObj = await User.findByPk(targetUserId);
        if (targetUserObj.role === 'job_seeker') {
             await User.update({ 
                role: 'employee',
                company_id: company.id
            }, { where: { id: targetUserId } });
        } else if (targetUserObj.role === 'employee' && targetUserObj.company_id !== company.id) {
             // Warn or block? 
             // Letting them be in multiple teams is fine via TeamMember, but User.company_id implies primary workplace.
             // We won't update their primary workplace if they already have one.
             console.log(`User ${targetUserId} is already an employee of another company. Added to TeamMember but primary company unchanged.`);
        } else if (targetUserObj.role === 'employer') {
            console.log(`User ${targetUserId} is an employer. Added to TeamMember but role unchanged.`);
        }

        // Generate Login URL
        const baseUrl = process.env.BASE_URL || 'https://job-ecosystem.onrender.com';
        const loginUrl = `${baseUrl}/login`;
        
        // Debug Link (for development)
        let debug_link = `${baseUrl}/login?email=${encodeURIComponent(targetEmail)}&demo_action=auto_fill`;
        if (generatedPassword) {
            debug_link += `&password=${encodeURIComponent(generatedPassword)}`;
        }

        // Send Invitation Email
        const emailSent = await sendTeamInvitation({
            to: targetEmail,
            inviteeName: name || email.split('@')[0],
            inviterName: inviterName,
            companyName: company.name,
            tempPassword: generatedPassword,
            loginUrl: loginUrl
        });

        res.json({ 
            success: true, 
            message: 'Member added successfully', 
            email_sent: emailSent,
            debug_link 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getTeamMembers = async (req, res) => {
    try {
        const { TeamMember, User, Company } = req.db_models;
        const userId = req.user.id;
        
        // Find company by owner or if user is employee
        // Ideally req.user.company_id is populated if logged in as employee/employer
        let companyId = req.user.company_id;
        if(!companyId) {
             const company = await Company.findOne({ where: { owner_id: userId } });
             if(company) companyId = company.id;
        }

        if (!companyId) return res.status(404).json({ 
            success: false, 
            message: 'No company found. Please create a company first in Company Settings.',
            needs_company: true
        });

        const members = await TeamMember.findAll({
            where: { company_id: companyId },
            include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email', 'profile_picture_url'] }]
        });

        res.json({ success: true, members });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updatePermissions = async (req, res) => {
    try {
         const { memberId } = req.params;
         const { permissions, role } = req.body;
         const { TeamMember } = req.db_models;

         const member = await TeamMember.findByPk(memberId);
         if(!member) return res.status(404).json({ success: false, message: 'Member not found' });

         // TODO: Verify requestor is owner/admin of that company
         
         await member.update({ permissions, role });
         res.json({ success: true, member });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};
exports.toggleMemberStatus = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { status } = req.body; // 'suspend' or 'active'
        const { TeamMember, User } = req.db_models;

        console.log('[Toggle Status] Request:', { memberId, status });

        const member = await TeamMember.findByPk(memberId);
        if(!member) {
            console.log('[Toggle Status] Member not found:', memberId);
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        const newStatus = status === 'suspend' ? 'suspended' : 'active';
        console.log('[Toggle Status] Updating status from', member.status, 'to', newStatus);
        
        await member.update({ status: newStatus });
        
        console.log('[Toggle Status] Updated successfully. New status:', member.status);
        
        res.json({ success: true, message: 'Status updated', newStatus: member.status });
    } catch (error) {
        console.error('[Toggle Status] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { TeamMember, User } = req.db_models;

        const member = await TeamMember.findByPk(memberId);
        if(!member) return res.status(404).json({ success: false, message: 'Member not found' });

        const userId = member.user_id;

        // Reset User role?
        await User.update({ role: 'job_seeker', company_id: null }, { where: { id: userId } });
        
        await member.destroy();

        res.json({ success: true, message: 'Member removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get current user's team membership (for permission checks in frontend)
exports.getMyMembership = async (req, res) => {
    try {
        const { TeamMember, Company } = req.db_models;
        
        // For employers, return full permissions
        if (req.user.role === 'employer') {
            const company = await Company.findOne({ where: { owner_id: req.user.id } });
            return res.json({
                success: true,
                membership: {
                    role: 'owner',
                    permissions: ['create_tasks', 'edit_tasks', 'delete_tasks', 'manage_team', 'view_reports'],
                    status: 'active',
                    company_id: company?.id
                }
            });
        }
        
        // For employees, find their TeamMember record
        const membership = await TeamMember.findOne({
            where: { user_id: req.user.id, company_id: req.user.company_id }
        });
        
        if (!membership) {
            return res.json({ success: true, membership: null });
        }
        
        res.json({
            success: true,
            membership: {
                id: membership.id,
                role: membership.role,
                permissions: membership.permissions || [],
                status: membership.status,
                company_id: membership.company_id
            }
        });
    } catch (error) {
        console.error('Get My Membership Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
