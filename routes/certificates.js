// routes/certificates.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { ensureAuthenticated } = require('../middleware/auth');
const CertificateManager = require('../services/CertificateManager');

// Initialize certificate manager
const certificateManager = new CertificateManager();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept certificate and key files
        const allowedExtensions = ['.crt', '.pem', '.key', '.cer', '.p12', '.pfx'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

        if (allowedExtensions.includes(fileExtension)) {
            cb(null, true);
        } else {
            cb(new Error('Only certificate and key files are allowed'), false);
        }
    }
});

// Upload and store certificate
router.post('/upload', ensureAuthenticated, upload.fields([
    { name: 'certificate', maxCount: 1 },
    { name: 'privateKey', maxCount: 1 }
]), async (req, res) => {
    try {
        const { workspaceId, name, passphrase } = req.body;
        const certificateFile = req.files?.certificate?.[0];
        const privateKeyFile = req.files?.privateKey?.[0];

        console.log('Upload request received:', {
            workspaceId,
            name,
            hasCertFile: !!certificateFile,
            hasKeyFile: !!privateKeyFile,
            files: req.files
        });

        // Check if at least one file is provided
        if (!certificateFile && !privateKeyFile) {
            console.log('No files provided');
            return res.status(400).json({
                error: 'At least one file (certificate or private key) is required'
            });
        }

        if (!workspaceId || !name) {
            console.log('Missing required fields:', { workspaceId, name });
            return res.status(400).json({
                error: 'Workspace ID and certificate name are required'
            });
        }

        // Process certificate file if provided
        let certContent = null;
        if (certificateFile) {
            certContent = await certificateManager.processCertificateFile({
                buffer: certificateFile.buffer,
                originalname: certificateFile.originalname
            });
        }

        // Process private key file if provided
        let keyContent = null;
        if (privateKeyFile) {
            keyContent = await certificateManager.processCertificateFile({
                buffer: privateKeyFile.buffer,
                originalname: privateKeyFile.originalname
            });
        }

        // Validate certificate and key pair if both provided
        if (certContent && keyContent) {
            const validation = certificateManager.validateCertificateKeyPair(certContent, keyContent);
            if (!validation.valid) {
                return res.status(400).json({
                    error: 'Certificate and private key do not match',
                    message: validation.error
                });
            }
        }

        // Store certificate (allow partial uploads)
        const certificate = await certificateManager.storeCertificate(workspaceId, {
            name,
            cert: certContent,
            key: keyContent,
            passphrase: passphrase || ''
        });

        res.json({
            success: true,
            certificate: {
                id: certificate.id,
                name: certificate.name,
                workspaceId: certificate.workspaceId,
                createdAt: certificate.createdAt,
                expiresAt: certificate.expiresAt
            }
        });
    } catch (error) {
        console.error('Certificate upload error:', error);
        res.status(400).json({
            error: 'Certificate upload error',
            message: error.message || error.toString()
        });
    }
});

// List certificates for a workspace
router.get('/workspace/:workspaceId', ensureAuthenticated, async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const certificates = certificateManager.listCertificates(workspaceId);

        res.json({
            certificates
        });
    } catch (error) {
        console.error('List certificates error:', error);
        res.status(500).json({
            error: 'Failed to list certificates',
            message: error.message
        });
    }
});

// Get certificate details
router.get('/:certificateId', ensureAuthenticated, async (req, res) => {
    try {
        const { certificateId } = req.params;
        const certificate = certificateManager.getCertificateInfo(certificateId);

        if (!certificate) {
            return res.status(404).json({
                error: 'Certificate not found'
            });
        }

        res.json({
            certificate
        });
    } catch (error) {
        console.error('Get certificate error:', error);
        res.status(500).json({
            error: 'Failed to get certificate details',
            message: error.message
        });
    }
});

// Delete certificate
router.delete('/:certificateId', ensureAuthenticated, async (req, res) => {
    try {
        const { certificateId } = req.params;
        const deleted = certificateManager.deleteCertificate(certificateId);

        if (!deleted) {
            return res.status(404).json({
                error: 'Certificate not found'
            });
        }

        res.json({
            success: true,
            message: 'Certificate deleted successfully'
        });
    } catch (error) {
        console.error('Delete certificate error:', error);
        res.status(500).json({
            error: 'Failed to delete certificate',
            message: error.message
        });
    }
});

// Validate certificate
router.post('/:certificateId/validate', ensureAuthenticated, async (req, res) => {
    try {
        const { certificateId } = req.params;
        const certificate = certificateManager.getCertificateInfo(certificateId);

        if (!certificate) {
            return res.status(404).json({
                error: 'Certificate not found'
            });
        }

        // Get detailed validation info
        const validation = await certificateManager.validateCertificate(certificate);

        res.json({
            validation
        });
    } catch (error) {
        console.error('Certificate validation error:', error);
        res.status(500).json({
            error: 'Failed to validate certificate',
            message: error.message
        });
    }
});

// Check server certificate
router.post('/check-server', ensureAuthenticated, async (req, res) => {
    try {
        const { hostname, port = 443 } = req.body;

        if (!hostname) {
            return res.status(400).json({
                error: 'Hostname is required'
            });
        }

        const certificateInfo = await certificateManager.checkServerCertificate(hostname, port);

        res.json({
            hostname,
            port,
            certificate: certificateInfo
        });
    } catch (error) {
        console.error('Server certificate check error:', error);
        res.status(400).json({
            error: 'Failed to check server certificate',
            message: error.message
        });
    }
});

// Test SSL configuration
router.post('/test-ssl', ensureAuthenticated, async (req, res) => {
    try {
        const { sslConfig, testUrl } = req.body;

        if (!testUrl) {
            return res.status(400).json({
                error: 'Test URL is required'
            });
        }

        // Create test request with SSL configuration
        const testRequest = {
            url: testUrl,
            method: 'GET',
            headers: {}
        };

        const configuredRequest = certificateManager.applySSLConfiguration(testRequest, sslConfig);

        // Make a test request
        const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
        const response = await fetch(configuredRequest.url, {
            method: configuredRequest.method,
            headers: configuredRequest.headers,
            agent: configuredRequest.agent,
            timeout: 10000
        });

        res.json({
            success: true,
            message: 'SSL configuration test successful',
            testResult: {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            }
        });
    } catch (error) {
        console.error('SSL test error:', error);
        res.status(400).json({
            success: false,
            error: 'SSL configuration test failed',
            message: error.message
        });
    }
});

module.exports = router;
