// services/CertificateManager.js
const crypto = require('crypto');
const fs = require('fs').promises;
const https = require('https');

class CertificateManager {
    constructor() {
        this.certificates = new Map();
    }

    // Store client certificate
    async storeCertificate(workspaceId, certificateData) {
        const cert = {
            id: this.generateCertId(),
            workspaceId,
            name: certificateData.name,
            cert: certificateData.cert,
            key: certificateData.key,
            passphrase: certificateData.passphrase,
            createdAt: new Date().toISOString(),
            expiresAt: certificateData.cert ? this.extractExpirationDate(certificateData.cert) : null
        };

        // Validate certificate if provided
        if (certificateData.cert) {
            const validation = await this.validateCertificate(cert);
            if (!validation.valid) {
                throw new Error(`Invalid certificate: ${validation.error}`);
            }
        }

        // Validate key format if provided
        if (certificateData.key) {
            try {
                // Basic validation to ensure it's a valid key format
                if (!certificateData.key.includes('-----BEGIN') || !certificateData.key.includes('PRIVATE KEY-----')) {
                    throw new Error('Invalid private key format');
                }
            } catch (error) {
                throw new Error(`Invalid private key: ${error.message}`);
            }
        }

        this.certificates.set(cert.id, cert);
        return cert;
    }

    // Validate SSL certificate
    async validateCertificate(cert) {
        try {
            const x509 = new crypto.X509Certificate(cert.cert);
            const now = new Date();
            const notBefore = new Date(x509.validFrom);
            const notAfter = new Date(x509.validTo);

            const validation = {
                valid: now >= notBefore && now <= notAfter,
                expiresAt: notAfter,
                issuer: x509.issuer,
                subject: x509.subject,
                serialNumber: x509.serialNumber,
                fingerprint: x509.fingerprint,
                keyUsage: x509.keyUsage
            };

            if (now < notBefore) {
                validation.error = 'Certificate is not yet valid';
                validation.valid = false;
            } else if (now > notAfter) {
                validation.error = 'Certificate has expired';
                validation.valid = false;
            }

            return validation;
        } catch (error) {
            return {
                valid: false,
                error: `Certificate parsing error: ${error.message}`
            };
        }
    }

    // Create HTTPS agent with SSL configuration
    createHttpsAgent(sslConfig) {
        const options = {
            rejectUnauthorized: sslConfig.verifyCert !== false
        };

        // Allow self-signed certificates if specified
        if (sslConfig.allowSelfSigned) {
            options.rejectUnauthorized = false;
        }

        // Add client certificate if provided
        if (sslConfig.clientCert) {
            const cert = this.certificates.get(sslConfig.clientCert);
            if (cert) {
                options.cert = cert.cert;
                options.key = cert.key;
                if (cert.passphrase) {
                    options.passphrase = cert.passphrase;
                }
            }
        }

        // Handle file-based certificates (for direct file uploads)
        if (sslConfig.clientCertFile && sslConfig.clientKeyFile) {
            try {
                options.cert = sslConfig.clientCertFile;
                options.key = sslConfig.clientKeyFile;
                if (sslConfig.passphrase) {
                    options.passphrase = sslConfig.passphrase;
                }
            } catch (error) {
                console.warn('Failed to load client certificate files:', error.message);
            }
        }

        return new https.Agent(options);
    }

    // Apply SSL configuration to request
    applySSLConfiguration(requestConfig, sslConfig) {
        if (!sslConfig || Object.keys(sslConfig).length === 0) {
            return requestConfig;
        }

        // Create HTTPS agent with SSL configuration
        const httpsAgent = this.createHttpsAgent(sslConfig);

        return {
            ...requestConfig,
            agent: httpsAgent
        };
    }

    // Get certificate information for UI display
    getCertificateInfo(certificateId) {
        const cert = this.certificates.get(certificateId);
        if (!cert) return null;

        try {
            const x509 = new crypto.X509Certificate(cert.cert);
            return {
                id: cert.id,
                name: cert.name,
                subject: x509.subject,
                issuer: x509.issuer,
                validFrom: x509.validFrom,
                validTo: x509.validTo,
                serialNumber: x509.serialNumber,
                fingerprint: x509.fingerprint,
                isExpired: new Date() > new Date(x509.validTo),
                daysUntilExpiry: Math.ceil((new Date(x509.validTo) - new Date()) / (1000 * 60 * 60 * 24))
            };
        } catch (error) {
            return {
                id: cert.id,
                name: cert.name,
                error: error.message
            };
        }
    }

    // List certificates for a workspace
    listCertificates(workspaceId) {
        const workspaceCerts = [];
        for (const [id, cert] of this.certificates) {
            if (cert.workspaceId === workspaceId) {
                workspaceCerts.push(this.getCertificateInfo(id));
            }
        }
        return workspaceCerts;
    }

    // Delete certificate
    deleteCertificate(certificateId) {
        return this.certificates.delete(certificateId);
    }

    // Process uploaded certificate files
    async processCertificateFile(file) {
        try {
            let content;
            if (typeof file === 'string') {
                // File content as string
                content = file;
            } else if (file.buffer) {
                // File buffer from multer
                content = file.buffer.toString('utf8');
            } else if (file.path) {
                // File path
                content = await fs.readFile(file.path, 'utf8');
            } else {
                throw new Error('Invalid file format');
            }

            // Validate that it looks like a certificate or key
            if (content.includes('-----BEGIN CERTIFICATE-----') ||
                content.includes('-----BEGIN PRIVATE KEY-----') ||
                content.includes('-----BEGIN RSA PRIVATE KEY-----') ||
                content.includes('-----BEGIN EC PRIVATE KEY-----')) {
                return content;
            } else {
                throw new Error('File does not appear to be a valid certificate or key');
            }
        } catch (error) {
            throw new Error(`Failed to process certificate file: ${error.message}`);
        }
    }

    // Check SSL certificate of a remote server
    async checkServerCertificate(hostname, port = 443) {
        return new Promise((resolve, reject) => {
            const options = {
                host: hostname,
                port: port,
                method: 'GET',
                rejectUnauthorized: false, // Allow checking any certificate
                agent: false
            };

            const req = https.request(options, (res) => {
                const cert = res.socket.getPeerCertificate();
                if (cert && Object.keys(cert).length > 0) {
                    const now = new Date();
                    const validFrom = new Date(cert.valid_from);
                    const validTo = new Date(cert.valid_to);

                    resolve({
                        subject: cert.subject,
                        issuer: cert.issuer,
                        validFrom: cert.valid_from,
                        validTo: cert.valid_to,
                        fingerprint: cert.fingerprint,
                        serialNumber: cert.serialNumber,
                        isValid: now >= validFrom && now <= validTo,
                        daysUntilExpiry: Math.ceil((validTo - now) / (1000 * 60 * 60 * 24)),
                        protocol: res.socket.getProtocol(),
                        cipher: res.socket.getCipher()
                    });
                } else {
                    reject(new Error('No certificate found'));
                }
            });

            req.on('error', (error) => {
                reject(new Error(`Failed to check certificate: ${error.message}`));
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Certificate check timeout'));
            });

            req.end();
        });
    }

    // Helper methods
    generateCertId() {
        return `cert_${crypto.randomBytes(16).toString('hex')}`;
    }

    extractExpirationDate(certPem) {
        try {
            const x509 = new crypto.X509Certificate(certPem);
            return new Date(x509.validTo);
        } catch {
            return null;
        }
    }

    // Convert DER to PEM format if needed
    derToPem(derBuffer, type = 'CERTIFICATE') {
        const base64 = derBuffer.toString('base64');
        const lines = base64.match(/.{1,64}/g);
        return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----\n`;
    }

    // Validate certificate and key pair match
    validateCertificateKeyPair(certPem, keyPem) {
        try {
            // Create a test HTTPS agent to validate the pair
            const testAgent = new https.Agent({
                cert: certPem,
                key: keyPem
            });
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: `Certificate and key pair validation failed: ${error.message}`
            };
        }
    }
}

module.exports = CertificateManager;

