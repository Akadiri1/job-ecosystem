// src/middleware/permissionMiddleware.js
// Middleware to enforce permission-based access control for team members

/**
 * Check if the user has a specific permission
 * @param {string} permission - The permission to check (e.g., 'post_jobs', 'view_applicants')
 */
exports.hasPermission = (permission) => async (req, res, next) => {
    try {
        const { TeamMember, Company } = req.db_models;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Employers (company owners) have all permissions by default
        if (userRole === 'employer') {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) {
                return next(); // Owner has all permissions
            }
        }

        // Admins have all permissions
        if (userRole === 'admin') {
            return next();
        }

        // For employees, check TeamMember permissions
        if (userRole === 'employee') {
            const member = await TeamMember.findOne({ where: { user_id: userId } });
            
            if (!member) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied: Not a team member' 
                });
            }

            // Team admins have all permissions
            if (member.role === 'admin' || member.role === 'owner') {
                return next();
            }

            // Check specific permission
            const permissions = member.permissions || [];
            if (permissions.includes(permission)) {
                return next();
            }

            return res.status(403).json({ 
                success: false, 
                message: `Access denied: Missing '${permission}' permission` 
            });
        }

        // Job seekers don't have team permissions
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied: Not authorized for this action' 
        });

    } catch (error) {
        console.error('Permission check error:', error);
        return res.status(500).json({ success: false, message: 'Error checking permissions' });
    }
};

/**
 * Check if the user has ANY of the specified permissions
 * @param {...string} permissions - List of permissions to check
 */
exports.hasAnyPermission = (...permissions) => async (req, res, next) => {
    try {
        const { TeamMember, Company } = req.db_models;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Employers (company owners) have all permissions
        if (userRole === 'employer') {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) return next();
        }

        // Admins have all permissions
        if (userRole === 'admin') return next();

        // For employees, check TeamMember permissions
        if (userRole === 'employee') {
            const member = await TeamMember.findOne({ where: { user_id: userId } });
            
            if (!member) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Access denied: Not a team member' 
                });
            }

            // Team admins have all permissions
            if (member.role === 'admin' || member.role === 'owner') {
                return next();
            }

            // Check if user has ANY of the required permissions
            const userPermissions = member.permissions || [];
            const hasAny = permissions.some(p => userPermissions.includes(p));
            
            if (hasAny) return next();

            return res.status(403).json({ 
                success: false, 
                message: `Access denied: Requires one of: ${permissions.join(', ')}` 
            });
        }

        return res.status(403).json({ 
            success: false, 
            message: 'Access denied: Not authorized for this action' 
        });

    } catch (error) {
        console.error('Permission check error:', error);
        return res.status(500).json({ success: false, message: 'Error checking permissions' });
    }
};

/**
 * Check if user has ALL of the specified permissions
 * @param {...string} permissions - List of permissions to check
 */
exports.hasAllPermissions = (...permissions) => async (req, res, next) => {
    try {
        const { TeamMember, Company } = req.db_models;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Employers and admins have all permissions
        if (userRole === 'employer') {
            const company = await Company.findOne({ where: { owner_id: userId } });
            if (company) return next();
        }
        if (userRole === 'admin') return next();

        // For employees
        if (userRole === 'employee') {
            const member = await TeamMember.findOne({ where: { user_id: userId } });
            
            if (!member) {
                return res.status(403).json({ success: false, message: 'Not a team member' });
            }

            if (member.role === 'admin' || member.role === 'owner') return next();

            const userPermissions = member.permissions || [];
            const hasAll = permissions.every(p => userPermissions.includes(p));
            
            if (hasAll) return next();

            const missing = permissions.filter(p => !userPermissions.includes(p));
            return res.status(403).json({ 
                success: false, 
                message: `Missing permissions: ${missing.join(', ')}` 
            });
        }

        return res.status(403).json({ success: false, message: 'Not authorized' });

    } catch (error) {
        console.error('Permission check error:', error);
        return res.status(500).json({ success: false, message: 'Error checking permissions' });
    }
};
