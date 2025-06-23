// services/EnhancedMonitoringService.js
const dns = require('dns');
const tls = require('tls');
const url = require('url');
const Monitor = require('../models/Monitor');
const HealthCheck = require('../models/HealthCheck');

class EnhancedMonitoringService {
    constructor() {
        this.locations = [
            { name: 'US East', region: 'us-east-1' },
            { name: 'US West', region: 'us-west-1' },
            { name: 'Europe', region: 'eu-west-1' },
            { name: 'Asia Pacific', region: 'ap-southeast-1' }
        ];
    }

    async performEnhancedHealthCheck(monitor) {
        const results = [];

        try {
            // Standard HTTP check
            const httpResult = await this.performHttpCheck(monitor);
            results.push(httpResult);

            // SSL Certificate check
            if (monitor.sslCheck.enabled) {
                const sslResult = await this.performSSLCheck(monitor);
                results.push(sslResult);
            }

            // Domain expiration check
            if (monitor.domainCheck.enabled) {
                const domainResult = await this.performDomainCheck(monitor);
                results.push(domainResult);
            }

            // Content validation
            if (monitor.contentValidation.enabled && httpResult.responseBody) {
                const contentResult = await this.performContentValidation(monitor, httpResult.responseBody);
                results.push(contentResult);
            }

            // Multi-location monitoring
            if (monitor.multiLocation.enabled) {
                const multiLocationResults = await this.performMultiLocationCheck(monitor);
                results.push(...multiLocationResults);
            }

        } catch (error) {
            console.error(`Enhanced monitoring error for ${monitor.name}:`, error);
            results.push({
                type: 'error',
                status: 'failure',
                errorMessage: error.message,
                checkedAt: new Date()
            });
        }

        return results;
    }

    async performHttpCheck(monitor) {
        // This is similar to the existing health check but with enhanced error handling
        const startTime = Date.now();

        try {
            const fetch = (await import('node-fetch')).default;
            const options = {
                method: monitor.method,
                timeout: monitor.expectedResponseTime || 30000,
                headers: {}
            };

            // Add custom headers
            if (monitor.headers && monitor.headers.length > 0) {
                monitor.headers.forEach(header => {
                    if (header.key && header.value) {
                        options.headers[header.key] = header.value;
                    }
                });
            }

            const response = await fetch(monitor.url, options);
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            const responseBody = await response.text();

            return {
                type: 'http',
                monitorId: monitor._id,
                status: this.determineStatus(response.status, responseTime, monitor),
                responseTime,
                statusCode: response.status,
                responseBody: responseBody.substring(0, 10000), // Limit size
                checkedAt: new Date(),
                errorMessage: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
            };

        } catch (error) {
            const endTime = Date.now();
            return {
                type: 'http',
                monitorId: monitor._id,
                status: error.name === 'AbortError' ? 'timeout' : 'failure',
                responseTime: endTime - startTime,
                errorMessage: error.message,
                checkedAt: new Date()
            };
        }
    }

    async performSSLCheck(monitor) {
        try {
            const urlParts = url.parse(monitor.url);
            if (urlParts.protocol !== 'https:') {
                throw new Error('SSL check only available for HTTPS URLs');
            }

            const hostname = urlParts.hostname;
            const port = urlParts.port || 443;

            const cert = await this.getSSLCertificate(hostname, port);
            const expiryDate = new Date(cert.valid_to);
            const now = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

            let status = 'success';
            let errorMessage = null;

            if (daysUntilExpiry <= 0) {
                status = 'failure';
                errorMessage = 'SSL certificate has expired';
            } else if (daysUntilExpiry <= monitor.sslCheck.warnDays) {
                status = 'degraded';
                errorMessage = `SSL certificate expires in ${daysUntilExpiry} days`;
            }

            // Update monitor with SSL info
            await Monitor.findByIdAndUpdate(monitor._id, {
                'sslCheck.expiryDate': expiryDate,
                'sslCheck.issuer': cert.issuer.CN
            });

            return {
                type: 'ssl',
                monitorId: monitor._id,
                status,
                responseTime: 0,
                sslInfo: {
                    expiryDate,
                    issuer: cert.issuer.CN,
                    daysUntilExpiry
                },
                errorMessage,
                checkedAt: new Date()
            };

        } catch (error) {
            return {
                type: 'ssl',
                monitorId: monitor._id,
                status: 'failure',
                errorMessage: `SSL check failed: ${error.message}`,
                checkedAt: new Date()
            };
        }
    }

    async performDomainCheck(monitor) {
        try {
            const urlParts = url.parse(monitor.url);
            const domain = urlParts.hostname;

            // This is a simplified domain check - in production you'd use a WHOIS service
            // For now, we'll just do a DNS lookup to verify the domain resolves
            const addresses = await this.lookupDomain(domain);

            return {
                type: 'domain',
                monitorId: monitor._id,
                status: addresses.length > 0 ? 'success' : 'failure',
                responseTime: 0,
                domainInfo: {
                    resolvedAddresses: addresses
                },
                errorMessage: addresses.length === 0 ? 'Domain does not resolve' : null,
                checkedAt: new Date()
            };

        } catch (error) {
            return {
                type: 'domain',
                monitorId: monitor._id,
                status: 'failure',
                errorMessage: `Domain check failed: ${error.message}`,
                checkedAt: new Date()
            };
        }
    }

    async performContentValidation(monitor, responseBody) {
        try {
            const { expectedContent, contentType } = monitor.contentValidation;
            let isValid = false;
            let errorMessage = null;

            switch (contentType) {
                case 'text':
                    isValid = responseBody.includes(expectedContent);
                    break;
                case 'json':
                    try {
                        const jsonData = JSON.parse(responseBody);
                        isValid = JSON.stringify(jsonData).includes(expectedContent);
                    } catch (e) {
                        errorMessage = 'Response is not valid JSON';
                    }
                    break;
                case 'xml':
                    isValid = responseBody.includes(expectedContent);
                    break;
            }

            if (!isValid && !errorMessage) {
                errorMessage = `Expected content "${expectedContent}" not found in response`;
            }

            return {
                type: 'content',
                monitorId: monitor._id,
                status: isValid ? 'success' : 'failure',
                responseTime: 0,
                errorMessage,
                checkedAt: new Date()
            };

        } catch (error) {
            return {
                type: 'content',
                monitorId: monitor._id,
                status: 'failure',
                errorMessage: `Content validation failed: ${error.message}`,
                checkedAt: new Date()
            };
        }
    }

    async performMultiLocationCheck(monitor) {
        const results = [];
        const enabledLocations = monitor.multiLocation.locations.filter(loc => loc.enabled);

        for (const location of enabledLocations) {
            try {
                // In a real implementation, you'd route this through different geographic servers
                // For now, we'll simulate with different user agents and add location context
                const locationResult = await this.performLocationSpecificCheck(monitor, location);
                results.push(locationResult);
            } catch (error) {
                results.push({
                    type: 'location',
                    location: location.name,
                    monitorId: monitor._id,
                    status: 'failure',
                    errorMessage: `Location check failed: ${error.message}`,
                    checkedAt: new Date()
                });
            }
        }

        return results;
    }

    async performLocationSpecificCheck(monitor, location) {
        // Simulate location-specific check
        const startTime = Date.now();

        try {
            const fetch = (await import('node-fetch')).default;
            const options = {
                method: monitor.method,
                timeout: monitor.expectedResponseTime || 30000,
                headers: {
                    'User-Agent': `Pigeon Monitor - ${location.name} (${location.region})`
                }
            };

            // Add custom headers
            if (monitor.headers && monitor.headers.length > 0) {
                monitor.headers.forEach(header => {
                    if (header.key && header.value) {
                        options.headers[header.key] = header.value;
                    }
                });
            }

            const response = await fetch(monitor.url, options);
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            return {
                type: 'location',
                location: location.name,
                region: location.region,
                monitorId: monitor._id,
                status: this.determineStatus(response.status, responseTime, monitor),
                responseTime,
                statusCode: response.status,
                checkedAt: new Date(),
                errorMessage: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
            };

        } catch (error) {
            const endTime = Date.now();
            return {
                type: 'location',
                location: location.name,
                region: location.region,
                monitorId: monitor._id,
                status: error.name === 'AbortError' ? 'timeout' : 'failure',
                responseTime: endTime - startTime,
                errorMessage: error.message,
                checkedAt: new Date()
            };
        }
    }

    async getSSLCertificate(hostname, port) {
        return new Promise((resolve, reject) => {
            const socket = tls.connect(port, hostname, { servername: hostname }, () => {
                const cert = socket.getPeerCertificate();
                socket.destroy();
                resolve(cert);
            });

            socket.on('error', reject);
            socket.setTimeout(10000, () => {
                socket.destroy();
                reject(new Error('SSL connection timeout'));
            });
        });
    }

    async lookupDomain(domain) {
        return new Promise((resolve, reject) => {
            dns.lookup(domain, { all: true }, (err, addresses) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(addresses || []);
                }
            });
        });
    }

    determineStatus(statusCode, responseTime, monitor) {
        // Check status code
        if (statusCode !== monitor.expectedStatusCode) {
            return 'failure';
        }

        // Check response time
        if (responseTime > monitor.expectedResponseTime) {
            return 'timeout';
        }

        return 'success';
    }

    async saveEnhancedResults(results) {
        for (const result of results) {
            try {
                await HealthCheck.create(result);
            } catch (error) {
                console.error('Error saving enhanced health check result:', error);
            }
        }
    }
}

module.exports = new EnhancedMonitoringService();
