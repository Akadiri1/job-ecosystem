// src/routes/companyRoutes.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { protect } = require('../controllers/authController'); // We reuse the auth middleware
const { createCompany, getMyCompany, updateCompany, deleteCompany } = require('../controllers/companyController');
const router = express.Router();

// --- MULTER CONFIGURATION FOR LOGO UPLOAD ---
const uploadDir = path.join(__dirname, '../public/uploads/logos');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename: userId_timestamp.ext
        const ext = path.extname(file.originalname);
        const filename = `${req.user.id}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// 1. Create Company Profile (POST /api/company)
router.post('/', protect, createCompany);



// 2. Update Company Profile (PUT /api/company)
router.put('/', protect, updateCompany);

// 3. Delete/Deactivate Company Profile (DELETE /api/company)
router.delete('/', protect, deleteCompany);

// 4. Reactivate Company Profile (PUT /api/company/reactivate)
const { reactivateCompany } = require('../controllers/companyController');
router.put('/reactivate', protect, reactivateCompany);

// 5. Get My Company Profile (GET /api/company/me)
// 5. Get My Company Profile (GET /api/company/me)
router.get('/me', protect, getMyCompany);

// 5. Upload Company Logo (POST /api/company/logo)
router.post('/logo', protect, upload.single('logo'), async (req, res) => {
    try {
        const { Company } = req.db_models;
        
        // Find the company
        const company = await Company.findOne({ where: { owner_id: req.user.id } });
        
        if (!company) {
            return res.status(404).json({ error: "No company profile found. Create one first." });
        }

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded." });
        }

        // Delete old logo if exists
        if (company.logo_url) {
            const oldLogoPath = path.join(__dirname, '../public', company.logo_url);
            if (fs.existsSync(oldLogoPath)) {
                fs.unlinkSync(oldLogoPath);
            }
        }

        // Update company with new logo URL
        const logoUrl = `/uploads/logos/${req.file.filename}`;
        company.logo_url = logoUrl;
        await company.save();

        res.json({ 
            message: "Logo uploaded successfully!", 
            logo_url: logoUrl 
        });

    } catch (error) {
        console.error("Upload Logo Error:", error);
        res.status(500).json({ error: error.message || "Server error uploading logo." });
    }
});

// 6. Remove Company Logo (DELETE /api/company/logo)
router.delete('/logo', protect, async (req, res) => {
    try {
        const { Company } = req.db_models;
        
        const company = await Company.findOne({ where: { owner_id: req.user.id } });
        
        if (!company) {
            return res.status(404).json({ error: "No company profile found." });
        }

        if (!company.logo_url) {
            return res.status(400).json({ error: "No logo to remove." });
        }

        // Delete the file
        const logoPath = path.join(__dirname, '../public', company.logo_url);
        if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
        }

        // Clear the logo_url
        company.logo_url = null;
        await company.save();

        res.json({ message: "Logo removed successfully." });

    } catch (error) {
        console.error("Remove Logo Error:", error);
        res.status(500).json({ error: "Server error removing logo." });
    }
});

module.exports = router;