// services/IntegrationService.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Integration = require('../models/Integration');
const { Spectral, Document } = require('@stoplight/spectral-core');
const { Json, Yaml } = require('@stoplight/spectral-parsers');
const { oas } = require('@stoplight/spectral-rulesets');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const {
    resolveRuleset,
    loadRuleset,
    validateRuleset,
    calculateLintScore,
    normalizeFindings
} = require('../utils/spectral');

class IntegrationService {
    constructor() {
        this.retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
    }

    // Test mode configuration
    isTestMode() {
        return process.env.NODE_ENV === 'test' || process.env.INTEGRATION_TEST_MODE === 'true';
    }

    // Enhanced error handling
    async logIntegrationError(integrationId, error, context = {}) {
        try {
            await Integration.findByIdAndUpdate(integrationId, {
                $inc: { errorCount: 1 },
                lastError: {
                    message: error.message,
                    timestamp: new Date(),
                    context: context
                }
            });

            console.error(`Integration ${integrationId} error:`, {
                message: error.message,
                stack: error.stack,
                context
            });
        } catch (logError) {
            console.error('Failed to log integration error:', logError);
        }
    }

    // Retry mechanism with exponential backoff
    async sendAlertWithRetry(integration, alertData, maxRetries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.sendAlert(integration, alertData);

                // Success - reset error count if this was a retry
                if (attempt > 1) {
                    await Integration.findByIdAndUpdate(integration._id, {
                        $unset: { lastError: 1 },
                        errorCount: 0
                    });
                }

                return;
            } catch (error) {
                lastError = error;

                if (attempt === maxRetries) {
                    await this.logIntegrationError(integration._id, error, {
                        attempt,
                        maxRetries,
                        alertType: alertData.alertType
                    });
                    throw error;
                }

                // Wait before retry (exponential backoff)
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Integration ${integration.type} failed (attempt ${attempt}), retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async sendAlert(integration, alertData) {
        try {
            switch (integration.type) {
                case 'email':
                    await this.sendEmailAlert(integration, alertData);
                    break;
                case 'pagerduty':
                    await this.sendPagerDutyAlert(integration, alertData);
                    break;
                case 'slack':
                    await this.sendSlackAlert(integration, alertData);
                    break;
                case 'teams':
                    await this.sendTeamsAlert(integration, alertData);
                    break;
                case 'discord':
                    await this.sendDiscordAlert(integration, alertData);
                    break;
                case 'jira':
                    await this.createJiraTicket(integration, alertData);
                    break;
                case 'webhook':
                    await this.sendWebhookAlert(integration, alertData);
                    break;
                default:
                    throw new Error(`Unsupported integration type: ${integration.type}`);
            }

            // Update last used timestamp
            await Integration.findByIdAndUpdate(integration._id, {
                lastUsed: new Date(),
                $inc: { errorCount: 0 }
            });

        } catch (error) {
            console.error(`Error sending alert via ${integration.type}:`, error);

            // Track error
            await Integration.findByIdAndUpdate(integration._id, {
                $inc: { errorCount: 1 },
                lastError: {
                    message: error.message,
                    timestamp: new Date()
                }
            });

            throw error;
        }
    }

    async sendEmailAlert(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;
        const config = integration.configuration;

        // Import nodemailer dynamically
        const nodemailer = require('nodemailer');

        // Create transporter with integration-specific SMTP settings
        const transporter = nodemailer.createTransport({
            host: config.smtpHost,
            port: config.smtpPort || 587,
            secure: config.smtpPort === 465, // true for 465, false for other ports
            auth: {
                user: config.smtpUser,
                pass: config.smtpPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // Get recipient email (monitor owner)
        const User = require('../models/User');
        let user = null;
        let recipientEmail = null;

        if (monitor.userId) {
            user = await User.findById(monitor.userId);
            if (user && user.email) {
                recipientEmail = user.email;
            }
        }

        // Fallback: if no user email found, use the integration's fromEmail for testing
        if (!recipientEmail) {
            if (monitor._id === 'test' || monitor.name === 'Test Monitor') {
                // For test alerts, send to the integration's fromEmail
                recipientEmail = config.fromEmail;
                console.log('📧 Test mode: Sending email alert to integration fromEmail:', recipientEmail);
            } else {
                throw new Error('User email not found for alert');
            }
        }

        const subject = this.getEmailSubject(monitor, alertType);
        const htmlContent = this.generateEmailHTML(monitor, healthCheck, alertType);
        const textContent = this.generateEmailText(monitor, healthCheck, alertType);

        const mailOptions = {
            from: config.fromEmail,
            to: recipientEmail,
            subject,
            text: textContent,
            html: htmlContent
        };

        if (this.isTestMode()) {
            console.log('🧪 TEST MODE: Would send email:', {
                to: recipientEmail,
                from: config.fromEmail,
                subject,
                smtp: `${config.smtpHost}:${config.smtpPort}`
            });
            return Promise.resolve({ messageId: 'test-mode' });
        }

        const result = await transporter.sendMail(mailOptions);
        console.log('Email alert sent successfully:', result.messageId);
        return result;
    }

    getEmailSubject(monitor, alertType) {
        switch (alertType) {
            case 'recovery':
                return `✅ RECOVERED: ${monitor.name}`;
            case 'slow_response':
                return `⚠️ SLOW RESPONSE: ${monitor.name}`;
            case 'failure':
            default:
                return `🚨 DOWN: ${monitor.name}`;
        }
    }

    generateEmailHTML(monitor, healthCheck, alertType) {
        const statusColor = alertType === 'recovery' ? '#28a745' :
            alertType === 'slow_response' ? '#ffc107' : '#dc3545';

        return `
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: ${statusColor}; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <h2 style="margin: 0;">Monitor Alert: ${monitor.name}</h2>
                    <p style="margin: 5px 0 0 0;">${this.getAlertMessage(alertType)}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3>Details:</h3>
                    <p><strong>URL:</strong> ${monitor.url}</p>
                    <p><strong>Status:</strong> ${healthCheck.status.toUpperCase()}</p>
                    <p><strong>Response Time:</strong> ${healthCheck.responseTime}ms</p>
                    <p><strong>Checked At:</strong> ${new Date(healthCheck.checkedAt).toLocaleString()}</p>
                    ${healthCheck.errorMessage ? `<p><strong>Error:</strong> ${healthCheck.errorMessage}</p>` : ''}
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
                    <p>This alert was sent by Pigeon API Monitor.</p>
                    <p>Visit your <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitoring">monitoring dashboard</a> for more details.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateEmailText(monitor, healthCheck, alertType) {
        let message = `MONITOR ALERT: ${monitor.name}\n\n`;
        message += `Status: ${this.getAlertMessage(alertType)}\n`;
        message += `URL: ${monitor.url}\n`;
        message += `Response Time: ${healthCheck.responseTime}ms\n`;
        message += `Checked At: ${new Date(healthCheck.checkedAt).toLocaleString()}\n`;

        if (healthCheck.errorMessage) {
            message += `\nError: ${healthCheck.errorMessage}\n`;
        }

        message += `\nView dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitoring\n`;
        message += `\nThis alert was sent by Pigeon API Monitor.`;

        return message;
    }

    async sendPagerDutyAlert(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;
        const severity = this.mapToPagerDutySeverity(alertType);

        const payload = {
            routing_key: integration.configuration.routingKey,
            event_action: alertType === 'recovery' ? 'resolve' : 'trigger',
            dedup_key: `monitor_${monitor._id}`,
            payload: {
                summary: `${monitor.name} - ${this.getAlertMessage(alertType)}`,
                source: monitor.url,
                severity: severity,
                component: monitor.name,
                group: 'API Monitoring',
                class: 'Monitor Alert',
                custom_details: {
                    monitor_id: monitor._id,
                    monitor_name: monitor.name,
                    monitor_url: monitor.url,
                    status: healthCheck.status,
                    response_time: healthCheck.responseTime,
                    error_message: healthCheck.errorMessage,
                    timestamp: healthCheck.checkedAt
                }
            }
        };

        const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
        }
    }

    async sendSlackAlert(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;
        const color = this.getSlackColor(alertType);

        const payload = {
            channel: integration.configuration.channel,
            attachments: [{
                color: color,
                title: `Monitor Alert: ${monitor.name}`,
                title_link: `${process.env.FRONTEND_URL}/workspace/monitoring/${monitor._id}`,
                fields: [
                    {
                        title: 'Status',
                        value: this.getAlertMessage(alertType),
                        short: true
                    },
                    {
                        title: 'URL',
                        value: monitor.url,
                        short: true
                    },
                    {
                        title: 'Response Time',
                        value: `${healthCheck.responseTime}ms`,
                        short: true
                    },
                    {
                        title: 'Time',
                        value: new Date(healthCheck.checkedAt).toLocaleString(),
                        short: true
                    }
                ],
                footer: 'Pigeon Monitoring',
                ts: Math.floor(healthCheck.checkedAt.getTime() / 1000)
            }]
        };

        if (healthCheck.errorMessage) {
            payload.attachments[0].fields.push({
                title: 'Error',
                value: healthCheck.errorMessage,
                short: false
            });
        }

        await this.sendWebhookPayload(integration.configuration.webhookUrl, payload);
    }

    async sendTeamsAlert(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;
        const themeColor = this.getTeamsColor(alertType);

        const payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            themeColor: themeColor,
            summary: `Monitor Alert: ${monitor.name}`,
            sections: [{
                activityTitle: `Monitor Alert: ${monitor.name}`,
                activitySubtitle: this.getAlertMessage(alertType),
                facts: [
                    {
                        name: "URL",
                        value: monitor.url
                    },
                    {
                        name: "Status",
                        value: healthCheck.status.toUpperCase()
                    },
                    {
                        name: "Response Time",
                        value: `${healthCheck.responseTime}ms`
                    },
                    {
                        name: "Time",
                        value: new Date(healthCheck.checkedAt).toISOString()
                    }
                ],
                markdown: true
            }],
            potentialAction: [{
                "@type": "OpenUri",
                name: "View Monitor",
                targets: [{
                    os: "default",
                    uri: `${process.env.FRONTEND_URL}/workspace/monitoring/${monitor._id}`
                }]
            }]
        };

        if (healthCheck.errorMessage) {
            payload.sections[0].facts.push({
                name: "Error",
                value: healthCheck.errorMessage
            });
        }

        await this.sendWebhookPayload(integration.configuration.webhookUrl, payload);
    }

    async sendDiscordAlert(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;
        const color = this.getDiscordColor(alertType);

        const payload = {
            embeds: [{
                title: `Monitor Alert: ${monitor.name}`,
                description: this.getAlertMessage(alertType),
                color: color,
                fields: [
                    {
                        name: "URL",
                        value: monitor.url,
                        inline: true
                    },
                    {
                        name: "Status",
                        value: healthCheck.status.toUpperCase(),
                        inline: true
                    },
                    {
                        name: "Response Time",
                        value: `${healthCheck.responseTime}ms`,
                        inline: true
                    }
                ],
                timestamp: healthCheck.checkedAt.toISOString(),
                footer: {
                    text: "Pigeon Monitoring"
                }
            }]
        };

        if (healthCheck.errorMessage) {
            payload.embeds[0].fields.push({
                name: "Error",
                value: healthCheck.errorMessage,
                inline: false
            });
        }

        await this.sendWebhookPayload(integration.configuration.webhookUrl, payload);
    }

    async createJiraTicket(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;

        // Only create tickets for failures, not recoveries
        if (alertType === 'recovery') return;

        const config = integration.configuration;

        // Normalize the server URL (remove trailing slash)
        let serverUrl = config.serverUrl;
        if (serverUrl.endsWith('/')) {
            serverUrl = serverUrl.slice(0, -1);
        }

        // Log the API call for debugging
        console.log(`Making Jira API call to: ${serverUrl}/rest/api/2/issue`);
        console.log(`Project: ${config.projectKey}, Issue Type: ${config.issueType || 'Bug'}`);

        const auth = Buffer.from(`${config.username}:${config.apiToken}`).toString('base64');

        const payload = {
            fields: {
                project: {
                    key: config.projectKey
                },
                summary: `Monitor Alert: ${monitor.name} is ${healthCheck.status}`,
                description: `Monitor: ${monitor.name}\nURL: ${monitor.url}\nStatus: ${healthCheck.status}\nResponse Time: ${healthCheck.responseTime}ms\nError: ${healthCheck.errorMessage || 'N/A'}\nTime: ${healthCheck.checkedAt}`,
                issuetype: {
                    name: config.issueType || 'Bug'
                },
                priority: {
                    name: this.mapToJiraPriority(alertType)
                },
                labels: ['monitoring', 'automated', `monitor-${monitor._id}`]
            }
        };

        const response = await fetch(`${serverUrl}/rest/api/2/issue`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.text();

            // Better error handling for common issues
            if (response.status === 404 && error.includes('dead link')) {
                throw new Error(`Jira API endpoint not found. Check your Jira URL: ${serverUrl}. Make sure it's a valid Jira Cloud/Server instance and you're using the correct URL format.`);
            } else if (response.status === 401) {
                throw new Error(`Jira authentication failed. Check your username (email) and API token.`);
            } else if (response.status === 403) {
                throw new Error(`Jira access denied. You may not have permission to create issues in project ${config.projectKey}.`);
            } else {
                throw new Error(`Jira API error: ${response.status} ${error}`);
            }
        }

        const result = await response.json();
        console.log(`Jira ticket created successfully: ${result.key}`);
        return result;
    }

    async sendWebhookAlert(integration, alertData) {
        const { monitor, healthCheck, alertType } = alertData;
        const config = integration.configuration;

        let payload;
        if (config.payloadTemplate) {
            // Use custom payload template
            payload = this.renderTemplate(config.payloadTemplate, {
                monitor,
                healthCheck,
                alertType,
                timestamp: new Date().toISOString()
            });
        } else {
            // Default payload
            payload = {
                event: 'monitor_alert',
                alert_type: alertType,
                monitor: {
                    id: monitor._id,
                    name: monitor.name,
                    url: monitor.url
                },
                health_check: {
                    status: healthCheck.status,
                    response_time: healthCheck.responseTime,
                    error_message: healthCheck.errorMessage,
                    checked_at: healthCheck.checkedAt
                },
                timestamp: new Date().toISOString()
            };
        }

        const headers = {
            'Content-Type': 'application/json'
        };

        // Add custom headers
        if (config.headers) {
            config.headers.forEach(header => {
                if (header.key && header.value) {
                    headers[header.key] = header.value;
                }
            });
        }

        await this.sendWebhookPayload(integration.configuration.webhookUrl, payload, headers);
    }

    async sendWebhookPayload(url, payload, customHeaders = {}) {
        // Test mode - don't make actual HTTP requests
        if (this.isTestMode()) {
            console.log('🧪 TEST MODE: Would send webhook to:', url);
            console.log('📦 Payload:', JSON.stringify(payload, null, 2));
            console.log('🔧 Headers:', JSON.stringify(customHeaders, null, 2));
            return Promise.resolve({ ok: true, status: 200 });
        }

        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                timeout: 10000 // 10 second timeout
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');

                // Enhanced error handling for Teams webhooks
                if (response.status === 405 && url.includes('webhook.office.com')) {
                    throw new Error(`Teams webhook error (405): The webhook URL appears to be invalid or the webhook has been deleted. Please verify the URL format and recreate the webhook if necessary. URL: ${url.substring(0, 50)}...`);
                } else if (response.status === 404 && url.includes('webhook.office.com')) {
                    throw new Error(`Teams webhook error (404): Webhook not found. The webhook may have been deleted in Teams or the URL is incorrect. Please recreate the webhook.`);
                } else if (response.status === 400 && url.includes('webhook.office.com')) {
                    throw new Error(`Teams webhook error (400): Invalid message format. The message payload may be malformed.`);
                }

                throw new Error(`Webhook error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return response;
        } catch (error) {
            // Better error handling for network issues
            if (error.code === 'ENOTFOUND') {
                throw new Error(`Webhook URL not found: ${url}`);
            } else if (error.code === 'ECONNREFUSED') {
                throw new Error(`Connection refused to webhook URL: ${url}`);
            } else if (error.name === 'AbortError') {
                throw new Error(`Webhook request timeout after 10 seconds: ${url}`);
            }
            throw error;
        }
    }

    renderTemplate(template, data) {
        return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
            return path.split('.').reduce((obj, key) => obj && obj[key], data) || match;
        });
    }

    mapToPagerDutySeverity(alertType) {
        switch (alertType) {
            case 'failure': return 'critical';
            case 'slow_response': return 'warning';
            case 'recovery': return 'info';
            default: return 'error';
        }
    }

    mapToJiraPriority(alertType) {
        switch (alertType) {
            case 'failure': return 'High';
            case 'slow_response': return 'Medium';
            default: return 'Low';
        }
    }

    getSlackColor(alertType) {
        switch (alertType) {
            case 'recovery': return 'good';
            case 'slow_response': return 'warning';
            case 'failure': return 'danger';
            default: return '#439FE0';
        }
    }

    getTeamsColor(alertType) {
        switch (alertType) {
            case 'recovery': return '28A745';
            case 'slow_response': return 'FFC107';
            case 'failure': return 'DC3545';
            default: return '17A2B8';
        }
    }

    getDiscordColor(alertType) {
        switch (alertType) {
            case 'recovery': return 0x28A745;
            case 'slow_response': return 0xFFC107;
            case 'failure': return 0xDC3545;
            default: return 0x17A2B8;
        }
    }

    getAlertMessage(alertType) {
        switch (alertType) {
            case 'failure': return '🔴 Monitor is DOWN';
            case 'slow_response': return '🟡 Monitor is responding slowly';
            case 'recovery': return '🟢 Monitor has RECOVERED';
            default: return '⚪ Monitor status unknown';
        }
    }

    // OpenAPI Linting with Spectral
    async lintOpenApi(specInput, options = {}) {
        const {
            rulesetPath = null,
            timeoutMs = 10000,
            maxSizeMB = 20,
            workspaceId = null,
            apiVersionId = null
        } = options;

        const isEnabled = process.env.PIGEON_LINT_ENABLED !== 'false';
        if (!isEnabled) {
            console.log('📋 OpenAPI linting is disabled via PIGEON_LINT_ENABLED=false');
            return {
                findings: [],
                counts: { errors: 0, warnings: 0, infos: 0, hints: 0 },
                score: 100,
                rulesetInfo: { name: 'Disabled', sourcePath: 'N/A' },
                lintedAt: new Date().toISOString()
            };
        }

        try {
            console.log('📋 Starting OpenAPI lint operation...');

            // Parse and validate spec input
            const { spec, specDoc } = await this.parseSpecInput(specInput, maxSizeMB);

            // Resolve and load ruleset
            const rulesetConfig = await resolveRuleset(rulesetPath, process.cwd());
            const { ruleset, info: rulesetInfo } = await loadRuleset(rulesetConfig);

            // Validate ruleset security
            if (rulesetConfig.type === 'file') {
                validateRuleset(ruleset, rulesetPath);
            }

            // Execute linting with timeout.
            // Important: always clear the timeout so it doesn't keep the event loop alive.
            const timeout = this.createTimeout(timeoutMs);
            let lintResults;
            try {
                lintResults = await Promise.race([
                    this.executeLinting(specDoc, ruleset, rulesetConfig),
                    timeout.promise
                ]);
            } finally {
                timeout.cancel();
            }

            // Process and normalize results
            const findings = normalizeFindings(lintResults);
            const scoreData = calculateLintScore(findings);

            const result = {
                findings,
                counts: {
                    errors: scoreData.counts.error,
                    warnings: scoreData.counts.warn,
                    infos: scoreData.counts.info,
                    hints: scoreData.counts.hint
                },
                score: scoreData.score,
                rulesetInfo,
                lintedAt: new Date().toISOString()
            };

            console.log(`📋 Lint completed: Score ${result.score}/100, ${result.findings.length} findings`);
            return result;

        } catch (error) {
            console.error('❌ OpenAPI linting failed:', error.message);

            // Return structured error for invalid specs or rulesets
            if (error.name === 'YAMLException' || error.message.includes('parse')) {
                return {
                    findings: [{
                        id: 'parse-error',
                        message: `Parse error: ${error.message}`,
                        severity: 'error',
                        path: [],
                        source: 'parser'
                    }],
                    counts: { errors: 1, warnings: 0, infos: 0, hints: 0 },
                    score: 0,
                    rulesetInfo: { name: 'N/A', sourcePath: 'N/A' },
                    lintedAt: new Date().toISOString(),
                    parseError: true
                };
            }

            throw error;
        }
    }

    async parseSpecInput(specInput, maxSizeMB) {
        let spec;
        let specContent;
        let format = 'json';

        // Handle different input types
        if (typeof specInput === 'string') {
            // File path
            if (specInput.startsWith('http://') || specInput.startsWith('https://')) {
                throw new Error('URL loading not supported for security reasons');
            }

            const filePath = path.resolve(specInput);

            // Prefer treating input as a file path if it exists; otherwise treat it as inline content.
            try {
                const stats = await fs.stat(filePath);
                const sizeInMB = stats.size / (1024 * 1024);

                if (sizeInMB > maxSizeMB) {
                    throw new Error(`Spec file too large: ${sizeInMB.toFixed(2)}MB (max: ${maxSizeMB}MB)`);
                }

                specContent = await fs.readFile(filePath, 'utf8');
                const ext = path.extname(filePath).toLowerCase();

                if (ext === '.json') {
                    format = 'json';
                    spec = JSON.parse(specContent);
                } else if (ext === '.yaml' || ext === '.yml') {
                    format = 'yaml';
                    spec = yaml.load(specContent);
                } else {
                    throw new Error(`Unsupported file format: ${ext}. Use .json, .yaml, or .yml`);
                }
            } catch (err) {
                // If it doesn't exist as a file path, interpret the string as spec content.
                if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
                    specContent = specInput;
                    const trimmed = specInput.trim();

                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        format = 'json';
                        spec = JSON.parse(trimmed);
                    } else {
                        format = 'yaml';
                        spec = yaml.load(specInput);
                    }
                } else {
                    throw err;
                }
            }
        } else if (typeof specInput === 'object') {
            // Already parsed object
            spec = specInput;
            specContent = JSON.stringify(spec, null, 2);
            format = 'json';
        } else {
            throw new Error('Invalid spec input: must be file path or parsed object');
        }

        // Validate basic OpenAPI structure
        if (!spec.openapi && !spec.swagger) {
            throw new Error('Not a valid OpenAPI/Swagger specification');
        }

        // Create Spectral document with appropriate parser
        const parser = format === 'yaml' ? Yaml : Json;
        const specDoc = new Document(specContent, parser);

        return { spec, specDoc };
    }

    async executeLinting(specDoc, ruleset, rulesetConfig) {
        const spectral = new Spectral();

        if (rulesetConfig.type === 'builtin') {
            // Use built-in OpenAPI ruleset
            spectral.setRuleset(oas);
        } else {
            // Use custom ruleset
            await spectral.setRuleset(ruleset);
        }

        return await spectral.run(specDoc);
    }

    createTimeout(timeoutMs) {
        let timer;
        const promise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`Linting timeout exceeded: ${timeoutMs}ms`));
            }, timeoutMs);
        });

        return {
            promise,
            cancel: () => {
                if (timer) clearTimeout(timer);
            }
        };
    }

    // Health monitoring and validation methods

    async trackIntegrationHealth(integrationId, success, responseTime = null, errorMessage = null) {
        try {
            // For now, just log - IntegrationHealth model would be needed for full implementation
            console.log(`📊 Health tracking - Integration ${integrationId}: ${success ? 'SUCCESS' : 'FAILURE'}`);
            if (responseTime) console.log(`   Response time: ${responseTime}ms`);
            if (errorMessage) console.log(`   Error: ${errorMessage}`);

            return { success, responseTime, errorMessage };
        } catch (error) {
            console.error('Error tracking integration health:', error);
        }
    }

    async canSendToIntegration(integrationId) {
        try {
            // For now, always return true - would use IntegrationHealth model in full implementation
            return true;
        } catch (error) {
            console.error('Error checking integration health:', error);
            return true; // Default to allowing if we can't check
        }
    }

    async validateIntegrationConfiguration(integration) {
        const errors = [];

        switch (integration.type) {
            case 'email':
                if (!integration.configuration.smtpHost) {
                    errors.push('SMTP host is required');
                }
                // Set default SMTP port if not provided
                if (!integration.configuration.smtpPort) {
                    integration.configuration.smtpPort = 587;
                }
                if (isNaN(integration.configuration.smtpPort) || integration.configuration.smtpPort < 1 || integration.configuration.smtpPort > 65535) {
                    errors.push('SMTP port must be a valid number between 1 and 65535');
                }
                if (!integration.configuration.smtpUser) {
                    errors.push('SMTP username is required');
                }
                if (!integration.configuration.smtpPass) {
                    errors.push('SMTP password is required');
                }
                if (!integration.configuration.fromEmail) {
                    errors.push('From email is required');
                } else {
                    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailPattern.test(integration.configuration.fromEmail)) {
                        errors.push('Invalid from email address format');
                    }
                }
                break;

            case 'slack':
                if (!integration.configuration.webhookUrl) {
                    errors.push('Slack webhook URL is required');
                } else {
                    // Test webhook URL format
                    const urlPattern = /^https:\/\/hooks\.slack\.com\/services\/.+/;
                    if (!urlPattern.test(integration.configuration.webhookUrl)) {
                        errors.push('Invalid Slack webhook URL format');
                    }
                }
                break;

            case 'teams':
                if (!integration.configuration.webhookUrl) {
                    errors.push('Teams webhook URL is required');
                } else {
                    const url = integration.configuration.webhookUrl;
                    // More specific Teams webhook URL validation
                    const urlPattern = /^https:\/\/[^.]+\.webhook\.office\.com\/webhookb2\/.+\/IncomingWebhook\/.+/;

                    if (!urlPattern.test(url)) {
                        if (!url.includes('webhook.office.com')) {
                            errors.push('Invalid Teams webhook URL: Must be from webhook.office.com domain');
                        } else if (!url.includes('webhookb2')) {
                            errors.push('Invalid Teams webhook URL: Missing webhookb2 path component');
                        } else if (!url.includes('IncomingWebhook')) {
                            errors.push('Invalid Teams webhook URL: Missing IncomingWebhook path component');
                        } else {
                            errors.push('Invalid Teams webhook URL format. Expected: https://tenant.webhook.office.com/webhookb2/.../IncomingWebhook/...');
                        }
                    }

                    // Additional validation for common mistakes
                    if (url.includes('teams.microsoft.com')) {
                        errors.push('Invalid Teams webhook URL: This appears to be a Teams channel URL, not a webhook URL. Please create an Incoming Webhook connector.');
                    }
                }
                break;

            case 'discord':
                if (!integration.configuration.webhookUrl) {
                    errors.push('Discord webhook URL is required');
                } else {
                    const urlPattern = /^https:\/\/discord\.com\/api\/webhooks\/.+/;
                    if (!urlPattern.test(integration.configuration.webhookUrl)) {
                        errors.push('Invalid Discord webhook URL format');
                    }
                }
                break;

            case 'pagerduty':
                if (!integration.configuration.routingKey) {
                    errors.push('PagerDuty routing key is required');
                } else if (integration.configuration.routingKey.length < 20) {
                    errors.push('PagerDuty routing key appears to be invalid (too short)');
                }
                break;

            case 'jira':
                if (!integration.configuration.serverUrl ||
                    !integration.configuration.username ||
                    !integration.configuration.apiToken ||
                    !integration.configuration.projectKey) {
                    errors.push('Jira requires serverUrl, username, apiToken, and projectKey');
                }

                // Validate Jira URL format
                if (integration.configuration.serverUrl &&
                    !integration.configuration.serverUrl.match(/^https?:\/\/.+\.atlassian\.(net|com)/)) {
                    errors.push('Invalid Jira server URL format');
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    async testIntegrationConnectivity(integration) {
        console.log(`🧪 Testing connectivity for ${integration.type} integration...`);

        try {
            const testAlertData = {
                monitor: {
                    _id: 'test-monitor',
                    name: 'Connectivity Test',
                    url: 'https://example.com'
                },
                healthCheck: {
                    status: 'failure',
                    responseTime: 1000,
                    errorMessage: 'This is a connectivity test',
                    checkedAt: new Date()
                },
                alertType: 'failure'
            };

            const startTime = Date.now();
            await this.sendAlert(integration, testAlertData);
            const responseTime = Date.now() - startTime;

            await this.trackIntegrationHealth(integration._id, true, responseTime);

            return {
                success: true,
                responseTime: responseTime,
                message: 'Connectivity test passed'
            };

        } catch (error) {
            await this.trackIntegrationHealth(integration._id, false, null, error.message);

            return {
                success: false,
                error: error.message,
                message: 'Connectivity test failed'
            };
        }
    }

    // Enhanced sendAlert method with health tracking
    async sendAlertWithHealthTracking(integration, alertData) {
        const canSend = await this.canSendToIntegration(integration._id);

        if (!canSend) {
            console.log(`⚠️ Integration ${integration.type} is not healthy enough to send alerts`);
            return;
        }

        try {
            const startTime = Date.now();
            await this.sendAlert(integration, alertData);
            const responseTime = Date.now() - startTime;

            // Track success
            await this.trackIntegrationHealth(integration._id, true, responseTime);

            console.log(`✅ Alert sent successfully via ${integration.type} (response time: ${responseTime}ms)`);

        } catch (error) {
            // Track failure
            await this.trackIntegrationHealth(integration._id, false, null, error.message);

            console.error(`❌ Failed to send alert via ${integration.type}:`, error.message);
            throw error;
        }
    }
}

module.exports = IntegrationService;
