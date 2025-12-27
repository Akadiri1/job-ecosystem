// src/controllers/companyController.js

// 1. Create a Company (POST /api/company)
exports.createCompany = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const { name, industry, location, website, description } = req.body;

        // Check if user already has a company
        const existingCompany = await Company.findOne({ where: { owner_id: req.user.id } });
        if (existingCompany) {
            return res.status(400).json({ error: "You already have a company profile." });
        }

        // Create new company
        const newCompany = await Company.create({
            name,
            industry,       // Ensure your Company model has this column (or add it)
            location,       // Ensure your Company model has this column (or add it)
            website,        // Ensure your Company model has this column (or add it)
            description,
            owner_id: req.user.id
        });

        res.status(201).json({ message: "Company created successfully!", company: newCompany });

    } catch (error) {
        console.error("Create Company Error:", error);
        res.status(500).json({ error: "Server error creating company." });
    }
};

// 2. Get My Company (GET /api/company/me)
exports.getMyCompany = async (req, res) => {
    try {
        const { Company } = req.db_models;
        
        // Find company belonging to the logged-in user
        const company = await Company.findOne({ where: { owner_id: req.user.id } });
        
        if (!company) {
            return res.status(404).json({ message: "No company found" });
        }

        res.json({ company });

    } catch (error) {
        console.error("Get Company Error:", error);
        res.status(500).json({ error: "Server error fetching company." });
    }
};

// 3. Update Company (PUT /api/company)
exports.updateCompany = async (req, res) => {
    try {
        const { Company } = req.db_models;
        const { name, industry, location, website, description } = req.body;

        // Find the company
        const company = await Company.findOne({ where: { owner_id: req.user.id } });

        if (!company) {
            return res.status(404).json({ error: "Company not found. Create one first." });
        }

        // Update fields only if they are provided
        if (name) company.name = name;
        if (industry) company.industry = industry;
        if (location) company.location = location;
        if (website) company.website = website;
        if (description) company.description = description;

        await company.save();

        res.json({ message: "Company updated successfully!", company });

    } catch (error) {
        console.error("Update Company Error:", error);
        res.status(500).json({ error: "Server error updating company." });
    }
};

// 4. Deactivate Company - Soft Delete (DELETE /api/company)
// Company will be permanently deleted after 30 days
exports.deleteCompany = async (req, res) => {
    try {
        const { Company } = req.db_models;

        const company = await Company.findOne({ where: { owner_id: req.user.id } });

        if (!company) {
            return res.status(404).json({ error: "Company not found." });
        }

        // Soft delete - mark as inactive
        company.is_active = false;
        company.deactivated_at = new Date();
        await company.save();

        // Calculate permanent deletion date
        const deletionDate = new Date();
        deletionDate.setDate(deletionDate.getDate() + 30);

        res.json({ 
            message: "Company profile deactivated. It will be permanently deleted after 30 days.",
            deactivated_at: company.deactivated_at,
            permanent_deletion_date: deletionDate
        });

    } catch (error) {
        console.error("Deactivate Company Error:", error);
        res.status(500).json({ error: "Server error deactivating company." });
    }
};

// 5. Reactivate Company (PUT /api/company/reactivate)
exports.reactivateCompany = async (req, res) => {
    try {
        const { Company } = req.db_models;

        const company = await Company.findOne({ where: { owner_id: req.user.id } });

        if (!company) {
            return res.status(404).json({ error: "Company not found." });
        }

        if (company.is_active) {
            return res.status(400).json({ error: "Company is already active." });
        }

        // Check if 30 days have passed
        if (company.deactivated_at) {
            const daysSinceDeactivation = Math.floor(
                (new Date() - new Date(company.deactivated_at)) / (1000 * 60 * 60 * 24)
            );
            
            if (daysSinceDeactivation >= 30) {
                // Company should have been permanently deleted
                await company.destroy();
                return res.status(410).json({ 
                    error: "This company profile has been permanently deleted and cannot be restored." 
                });
            }
        }

        // Reactivate
        company.is_active = true;
        company.deactivated_at = null;
        await company.save();

        res.json({ message: "Company profile reactivated successfully!", company });

    } catch (error) {
        console.error("Reactivate Company Error:", error);
        res.status(500).json({ error: "Server error reactivating company." });
    }
};

// 6. Permanently Delete Company (for admin or cleanup job)
exports.permanentlyDeleteCompany = async (req, res) => {
    try {
        const { Company } = req.db_models;

        const company = await Company.findOne({ where: { owner_id: req.user.id } });

        if (!company) {
            return res.status(404).json({ error: "Company not found." });
        }

        // Check if company has been deactivated for 30 days
        if (company.is_active) {
            return res.status(400).json({ 
                error: "You must deactivate your company first. It will be permanently deleted after 30 days." 
            });
        }

        if (company.deactivated_at) {
            const daysSinceDeactivation = Math.floor(
                (new Date() - new Date(company.deactivated_at)) / (1000 * 60 * 60 * 24)
            );
            
            if (daysSinceDeactivation < 30) {
                const daysRemaining = 30 - daysSinceDeactivation;
                return res.status(400).json({ 
                    error: `Company cannot be permanently deleted yet. ${daysRemaining} days remaining before automatic deletion.`
                });
            }
        }

        await company.destroy();

        res.json({ message: "Company profile permanently deleted." });

    } catch (error) {
        console.error("Permanently Delete Company Error:", error);
        res.status(500).json({ error: "Server error permanently deleting company." });
    }
};