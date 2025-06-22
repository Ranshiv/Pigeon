// services/EmailService.js
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = this.createTransporter();
    }

    createTransporter() {
        // Configure based on environment variables
        const emailConfig = {
            service: process.env.EMAIL_SERVICE || 'gmail',
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        };

        // If no email configuration, return null (alerts will be skipped)
        if (!emailConfig.auth.user || !emailConfig.auth.pass) {
            console.warn('Email configuration missing. Email alerts will be disabled.');
            return null;
        }

        return nodemailer.createTransporter(emailConfig);
    }

    async sendMonitorAlert(alertData) {
        if (!this.transporter) {
            console.log('Email service not configured, skipping email alert');
            return;
        }

        try {
            const { monitor, healthCheck, alertType } = alertData;

            const subject = this.getAlertSubject(monitor, alertType);
            const htmlContent = this.generateAlertHTML(monitor, healthCheck, alertType);
            const textContent = this.generateAlertText(monitor, healthCheck, alertType);

            // Get user email (you'll need to fetch this based on monitor.userId)
            const User = require('../models/User');
            const user = await User.findById(monitor.userId);

            if (!user || !user.email) {
                console.log('User email not found for monitor alert');
                return;
            }

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: user.email,
                subject,
                text: textContent,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Monitor alert email sent:', result.messageId);

            return result;
        } catch (error) {
            console.error('Error sending monitor alert email:', error);
            throw error;
        }
    }

    getAlertSubject(monitor, alertType) {
        const statusEmoji = {
            failure: '🔴',
            slow_response: '🟡',
            recovery: '🟢'
        };

        const emoji = statusEmoji[alertType] || '⚠️';

        switch (alertType) {
            case 'recovery':
                return `${emoji} [RESOLVED] ${monitor.name} is back online`;
            case 'slow_response':
                return `${emoji} [SLOW] ${monitor.name} response time exceeded threshold`;
            case 'failure':
                return `${emoji} [DOWN] ${monitor.name} is experiencing issues`;
            default:
                return `${emoji} [ALERT] ${monitor.name} status update`;
        }
    }

    generateAlertHTML(monitor, healthCheck, alertType) {
        const statusColor = {
            failure: '#dc3545',
            slow_response: '#ffc107',
            recovery: '#28a745'
        };

        const color = statusColor[alertType] || '#6c757d';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Monitor Alert</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
                .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                .status-${alertType} { background: ${color}; color: white; }
                .info-grid { display: grid; grid-template-columns: auto 1fr; gap: 10px; margin: 20px 0; }
                .info-label { font-weight: bold; color: #666; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #666; }
                a { color: ${color}; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">Monitor Alert</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">${monitor.name}</p>
                </div>
                
                <div class="content">
                    <div style="margin-bottom: 20px;">
                        <span class="status-badge status-${alertType}">${alertType.replace('_', ' ')}</span>
                    </div>
                    
                    <div class="info-grid">
                        <span class="info-label">Monitor:</span>
                        <span>${monitor.name}</span>
                        
                        <span class="info-label">URL:</span>
                        <span><a href="${monitor.url}" target="_blank">${monitor.url}</a></span>
                        
                        <span class="info-label">Method:</span>
                        <span>${monitor.method}</span>
                        
                        <span class="info-label">Status:</span>
                        <span>${healthCheck.status.toUpperCase()}</span>
                        
                        <span class="info-label">Response Time:</span>
                        <span>${healthCheck.responseTime}ms</span>
                        
                        ${healthCheck.statusCode ? `
                        <span class="info-label">Status Code:</span>
                        <span>${healthCheck.statusCode}</span>
                        ` : ''}
                        
                        <span class="info-label">Checked At:</span>
                        <span>${new Date(healthCheck.checkedAt).toLocaleString()}</span>
                        
                        ${monitor.consecutiveFailures > 0 ? `
                        <span class="info-label">Consecutive Failures:</span>
                        <span>${monitor.consecutiveFailures}</span>
                        ` : ''}
                    </div>
                    
                    ${healthCheck.errorMessage ? `
                    <div style="margin-top: 20px; padding: 15px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; color: #721c24;">
                        <strong>Error:</strong> ${healthCheck.errorMessage}
                    </div>
                    ` : ''}
                    
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitoring/status" 
                           style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 6px; font-weight: bold;">
                            View Status Dashboard
                        </a>
                    </div>
                </div>
                
                <div class="footer">
                    <p>This alert was sent by Pigeon API Monitor. You're receiving this because you have monitoring alerts enabled for this endpoint.</p>
                    <p>If you want to modify your alert settings, please visit your <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitoring">monitoring dashboard</a>.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateAlertText(monitor, healthCheck, alertType) {
        let message = `MONITOR ALERT: ${monitor.name}\n\n`;

        message += `Status: ${alertType.replace('_', ' ').toUpperCase()}\n`;
        message += `URL: ${monitor.url}\n`;
        message += `Method: ${monitor.method}\n`;
        message += `Response Time: ${healthCheck.responseTime}ms\n`;

        if (healthCheck.statusCode) {
            message += `Status Code: ${healthCheck.statusCode}\n`;
        }

        message += `Checked At: ${new Date(healthCheck.checkedAt).toLocaleString()}\n`;

        if (monitor.consecutiveFailures > 0) {
            message += `Consecutive Failures: ${monitor.consecutiveFailures}\n`;
        }

        if (healthCheck.errorMessage) {
            message += `\nError: ${healthCheck.errorMessage}\n`;
        }

        message += `\nView your status dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/monitoring/status\n`;
        message += `\nThis alert was sent by Pigeon API Monitor.`;

        return message;
    }

    async sendTestEmail(toEmail) {
        if (!this.transporter) {
            throw new Error('Email service not configured');
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: toEmail,
            subject: 'Pigeon Monitor - Test Email',
            text: 'This is a test email from Pigeon API Monitor. Your email configuration is working correctly!',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #28a745;">✅ Email Test Successful</h2>
                    <p>This is a test email from Pigeon API Monitor.</p>
                    <p>Your email configuration is working correctly!</p>
                    <hr style="margin: 20px 0;">
                    <p style="color: #666; font-size: 12px;">Sent from Pigeon API Monitor</p>
                </div>
            `
        };

        return await this.transporter.sendMail(mailOptions);
    }
}

module.exports = EmailService;
