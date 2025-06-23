// services/IntegrationService.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const Integration = require('../models/Integration');

class IntegrationService {
    constructor() {
        this.retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s
    }

    async sendAlert(integration, alertData) {
        try {
            switch (integration.type) {
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

        const response = await fetch(`${config.serverUrl}/rest/api/2/issue`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Jira API error: ${response.status} ${error}`);
        }
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
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
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
}

module.exports = new IntegrationService();
