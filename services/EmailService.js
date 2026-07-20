// services/EmailService.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const https = require('https');

class EmailService {
    constructor() {
        this.transporter = this.createTransporter();
        this.brevoApiKey = process.env.BREVO_API_KEY;
        this.brevoSender = this.getBrevoSender();
        this.emailConfigured = !!this.transporter || !!this.brevoApiKey;
        this.authErrorLogged = false;
        this.oauth2Client = null;
    }

    getBrevoSender() {
        const senderEmail =
            process.env.BREVO_SENDER_EMAIL ||
            this.extractEmailAddress(process.env.EMAIL_FROM) ||
            process.env.EMAIL_USER ||
            null;

        const senderName =
            process.env.BREVO_SENDER_NAME ||
            this.extractDisplayName(process.env.EMAIL_FROM) ||
            'Pigeon';

        return senderEmail ? { email: senderEmail, name: senderName } : null;
    }

    extractEmailAddress(value) {
        if (!value || typeof value !== 'string') return null;
        // Match "Name <email@domain>" first
        const match = value.match(/<\s*([^>\s]+@[^>\s]+)\s*>/);
        if (match && match[1]) return match[1].trim();
        // Else, if it's just an email, accept it
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return value.trim();
        return null;
    }

    extractDisplayName(value) {
        if (!value || typeof value !== 'string') return null;
        const match = value.match(/^\s*([^<]+?)\s*<\s*[^>]+\s*>\s*$/);
        if (match && match[1]) return match[1].trim().replace(/^"|"$/g, '');
        return null;
    }

    isBrevoConfigured() {
        return !!this.brevoApiKey;
    }

    async sendViaBrevo({ toEmail, toName, subject, textContent, htmlContent }) {
        if (!this.isBrevoConfigured()) {
            return { skipped: true, reason: 'Brevo not configured' };
        }
        if (!this.brevoSender?.email) {
            return { skipped: true, reason: 'Brevo sender not configured (BREVO_SENDER_EMAIL or EMAIL_FROM)' };
        }

        const payload = {
            sender: {
                name: this.brevoSender.name,
                email: this.brevoSender.email
            },
            to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
            subject,
            ...(htmlContent ? { htmlContent } : {}),
            ...(textContent ? { textContent } : {})
        };

        const body = JSON.stringify(payload);

        return new Promise((resolve) => {
            const req = https.request(
                {
                    method: 'POST',
                    hostname: 'api.brevo.com',
                    path: '/v3/smtp/email',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'api-key': this.brevoApiKey,
                        'content-length': Buffer.byteLength(body)
                    }
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
                        if (!ok) {
                            // Try to surface Brevo error response without throwing hard
                            return resolve({
                                success: false,
                                error: `Brevo API error (${res.statusCode}): ${data || 'no response body'}`,
                                code: 'BREVO_API_ERROR'
                            });
                        }

                        let parsed;
                        try {
                            parsed = data ? JSON.parse(data) : null;
                        } catch {
                            parsed = null;
                        }

                        return resolve({ success: true, messageId: parsed?.messageId || parsed?.messageId?.toString?.() || undefined });
                    });
                }
            );

            req.on('error', (error) => {
                resolve({ success: false, error: error.message, code: 'BREVO_REQUEST_ERROR' });
            });

            req.write(body);
            req.end();
        });
    }

    // Create OAuth2 client for token refresh
    getOAuth2Client() {
        if (!this.oauth2Client) {
            this.oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                `${process.env.API_URL || 'http://localhost:5001'}/auth/google/callback`
            );
        }
        return this.oauth2Client;
    }

    // Create OAuth2 transporter using user's tokens
    async createOAuth2Transporter(user) {
        try {
            // Check if user has OAuth tokens
            if (!user.accessToken || !user.refreshToken) {
                console.log('📧 User does not have OAuth tokens, falling back to SMTP');
                return null;
            }

            // Check if token is expired
            let accessToken = user.accessToken;
            if (user.tokenExpiry && user.tokenExpiry < new Date()) {
                console.log('🔄 Access token expired, refreshing...');
                accessToken = await this.refreshAccessToken(user);
            }

            // Create OAuth2 transporter
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    type: 'OAuth2',
                    user: user.email,
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    refreshToken: user.refreshToken,
                    accessToken: accessToken
                }
            });

            console.log('✅ OAuth2 email transporter created for:', user.email);
            return transporter;
        } catch (error) {
            console.error('❌ Failed to create OAuth2 transporter:', error.message);
            return null;
        }
    }

    // Refresh OAuth2 access token
    async refreshAccessToken(user) {
        try {
            const oauth2Client = this.getOAuth2Client();
            oauth2Client.setCredentials({
                refresh_token: user.refreshToken
            });

            const { credentials } = await oauth2Client.refreshAccessToken();

            // Update user's tokens in database
            const User = require('../models/User');
            await User.findByIdAndUpdate(user._id, {
                accessToken: credentials.access_token,
                tokenExpiry: new Date(credentials.expiry_date)
            });

            console.log('✅ Access token refreshed for:', user.email);
            return credentials.access_token;
        } catch (error) {
            console.error('❌ Failed to refresh access token:', error.message);
            throw error;
        }
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
            },
            // Additional options for better reliability
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 5
        };

        // If no email configuration, return null (alerts will be skipped)
        if (!emailConfig.auth.user || !emailConfig.auth.pass) {
            console.warn('⚠️  SMTP email configuration missing. SMTP email alerts will be disabled.');
            console.warn('   You can enable automatic email sending in production using ONE of:');
            console.warn('   - Brevo (recommended): set BREVO_API_KEY (+ optional BREVO_SENDER_EMAIL/BREVO_SENDER_NAME)');
            console.warn('   - SMTP: set EMAIL_USER + EMAIL_PASSWORD (+ EMAIL_SERVICE)');
            console.warn('   - OAuth2: users send from their own Gmail account (requires tokens)');
            return null;
        }

        try {
            const transporter = nodemailer.createTransport(emailConfig);
            console.log('✅ Email service initialized:', emailConfig.auth.user);
            return transporter;
        } catch (error) {
            console.error('❌ Failed to create email transporter:', error.message);
            return null;
        }
    }

    async sendMonitorAlert(alertData) {
        try {
            const { monitor, healthCheck, alertType } = alertData;

            const subject = this.getAlertSubject(monitor, alertType);
            const htmlContent = this.generateAlertHTML(monitor, healthCheck, alertType);
            const textContent = this.generateAlertText(monitor, healthCheck, alertType);

            // Get user with OAuth tokens (select: false fields need to be explicitly included)
            const User = require('../models/User');
            const user = await User.findById(monitor.userId).select('+accessToken +refreshToken +tokenExpiry');

            if (!user || !user.email) {
                console.log('📧 User email not found for monitor alert');
                return { skipped: true, reason: 'User email not found' };
            }

            // Try to use OAuth2 transporter first (user's own email account)
            let transporter = await this.createOAuth2Transporter(user);

            // If OAuth2 not available, try SMTP, then Brevo.
            if (transporter) {
                const mailOptions = {
                    from: process.env.EMAIL_FROM || user.email,
                    to: user.email,
                    subject,
                    text: textContent,
                    html: htmlContent
                };

                const result = await transporter.sendMail(mailOptions);
                console.log('✅ Monitor alert email sent (OAuth2) to:', user.email, 'MessageId:', result.messageId);
                return { success: true, messageId: result.messageId };
            }

            if (this.transporter) {
                console.log('📧 Using SMTP transporter as fallback');
                const mailOptions = {
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    to: user.email,
                    subject,
                    text: textContent,
                    html: htmlContent
                };

                const result = await this.transporter.sendMail(mailOptions);
                console.log('✅ Monitor alert email sent (SMTP) to:', user.email, 'MessageId:', result.messageId);
                return { success: true, messageId: result.messageId };
            }

            if (this.isBrevoConfigured()) {
                const result = await this.sendViaBrevo({
                    toEmail: user.email,
                    toName: user.username,
                    subject,
                    textContent,
                    htmlContent
                });
                if (result?.success) {
                    console.log('✅ Monitor alert email sent (Brevo) to:', user.email, 'MessageId:', result.messageId);
                }
                return result;
            }

            console.log('📧 No email configuration available (OAuth2, SMTP, or Brevo)');
            return { skipped: true, reason: 'No email configuration available' };
        } catch (error) {
            return this.handleEmailError(error, 'monitor alert');
        }
    }

    handleEmailError(error, context = 'email') {
        // Handle authentication errors specifically
        if (error.code === 'EAUTH') {
            if (!this.authErrorLogged) {
                console.error('\n❌ EMAIL AUTHENTICATION FAILED\n');
                console.error('   Error:', error.message);
                console.error('\n   📖 TROUBLESHOOTING GUIDE:');
                console.error('   ═══════════════════════════════════════════════════════════');

                if (error.response?.includes('Application-specific password')) {
                    console.error('   🔐 Gmail requires an App-Specific Password when 2FA is enabled');
                    console.error('');
                    console.error('   Steps to fix:');
                    console.error('   1. Go to: https://myaccount.google.com/apppasswords');
                    console.error('   2. Sign in to your Google Account');
                    console.error('   3. Click "Generate" under "App passwords"');
                    console.error('   4. Select "Mail" and "Other" (name it "Pigeon API")');
                    console.error('   5. Copy the 16-character password');
                    console.error('   6. Update your .env file or environment variables:');
                    console.error('      EMAIL_PASSWORD=<your-16-character-app-password>');
                    console.error('');
                    console.error('   Alternative: Use Less Secure App Access (not recommended)');
                    console.error('   - Go to: https://myaccount.google.com/lesssecureapps');
                    console.error('   - Enable "Less secure app access"');
                } else {
                    console.error('   ✓ Verify EMAIL_USER and EMAIL_PASSWORD are correct');
                    console.error('   ✓ Check if 2-factor authentication is enabled');
                    console.error('   ✓ For Gmail, use app-specific password instead of account password');
                    console.error('   ✓ Ensure EMAIL_SERVICE matches your provider (gmail, outlook, etc.)');
                }

                console.error('   ═══════════════════════════════════════════════════════════\n');
                this.authErrorLogged = true;
            }
            return {
                success: false,
                error: 'Authentication failed - check email configuration',
                code: 'EAUTH',
                requiresAction: true
            };
        }

        // Handle other email errors
        console.error(`❌ Error sending ${context}:`, error.message);
        return {
            success: false,
            error: error.message,
            code: error.code
        };
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
        const subject = '✅ Pigeon Monitor - Test Email';
        const text = 'This is a test email from Pigeon API Monitor. Your email configuration is working correctly!';
        const html = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #28a745;">✅ Email Test Successful</h2>
                        <p>This is a test email from Pigeon API Monitor.</p>
                        <p>Your email configuration is working correctly!</p>
                        <hr style="margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">Sent from Pigeon API Monitor</p>
                    </div>
                `;

        try {
            if (this.transporter) {
                const mailOptions = {
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    to: toEmail,
                    subject,
                    text,
                    html
                };

                const result = await this.transporter.sendMail(mailOptions);
                console.log('✅ Test email sent successfully (SMTP):', result.messageId);
                return { success: true, messageId: result.messageId };
            }

            if (this.isBrevoConfigured()) {
                const result = await this.sendViaBrevo({
                    toEmail,
                    subject,
                    textContent: text,
                    htmlContent: html
                });
                if (result?.success) {
                    console.log('✅ Test email sent successfully (Brevo):', result.messageId);
                }
                return result;
            }

            return {
                success: false,
                error: 'Email service not configured. Set BREVO_API_KEY (recommended) or EMAIL_USER/EMAIL_PASSWORD.',
                requiresAction: true
            };
        } catch (error) {
            return this.handleEmailError(error, 'test email');
        }
    }

    async sendReportEmail(reportData) {
        if (!this.transporter) {
            console.log('📧 Email service not configured, skipping report email');
            return { skipped: true, reason: 'Email service not configured' };
        }

        try {
            const { to, subject, reportName, attachment } = reportData;

            const htmlContent = this.generateReportHTML(reportName);
            const textContent = `Please find attached the ${reportName} report.`;

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to,
                subject,
                text: textContent,
                html: htmlContent,
                attachments: [
                    {
                        filename: attachment.filename,
                        content: attachment.content
                    }
                ]
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Report email sent:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            return this.handleEmailError(error, 'report email');
        }
    }

    async sendMaintenanceNotification(maintenanceData) {
        if (!this.transporter) {
            console.log('📧 Email service not configured, skipping maintenance notification');
            return { skipped: true, reason: 'Email service not configured' };
        }

        try {
            const { subscribers, maintenance, type } = maintenanceData; // type: 'scheduled', 'reminder', 'started', 'completed'

            const subject = this.getMaintenanceSubject(maintenance, type);
            const htmlContent = this.generateMaintenanceHTML(maintenance, type);
            const textContent = this.generateMaintenanceText(maintenance, type);

            const promises = subscribers.map(async (subscriber) => {
                const mailOptions = {
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    to: subscriber.email,
                    subject,
                    text: textContent,
                    html: htmlContent,
                    headers: {
                        'List-Unsubscribe': `<${process.env.FRONTEND_URL}/unsubscribe?token=${subscriber.unsubscribeToken}>`
                    }
                };

                return await this.transporter.sendMail(mailOptions);
            });

            const results = await Promise.allSettled(promises);
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(`✅ Maintenance notification: ${successful} sent, ${failed} failed (${subscribers.length} total)`);
            return { success: true, sent: successful, failed: failed, total: subscribers.length };
        } catch (error) {
            return this.handleEmailError(error, 'maintenance notification');
        }
    }

    async sendStatusPageSubscriptionConfirmation(subscriptionData) {
        if (!this.transporter) {
            console.log('📧 Email service not configured, skipping subscription confirmation');
            return { skipped: true, reason: 'Email service not configured' };
        }

        try {
            const { email, verificationToken, companyName } = subscriptionData;

            const subject = `Confirm your subscription to ${companyName} status updates`;
            const verificationUrl = `${process.env.FRONTEND_URL}/status/verify?token=${verificationToken}`;

            const htmlContent = `
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #014C75;">Confirm Your Status Page Subscription</h2>
                        <p>You've subscribed to receive status updates for ${companyName}.</p>
                        <p>Please click the button below to confirm your subscription:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" 
                               style="background-color: #014C75; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                Confirm Subscription
                            </a>
                        </div>
                        <p>If you didn't subscribe to these updates, you can safely ignore this email.</p>
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666;">
                            ${companyName} Status Page<br>
                            Powered by Pigeon Monitoring
                        </p>
                    </div>
                </body>
                </html>
            `;

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                subject,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Subscription confirmation email sent:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            return this.handleEmailError(error, 'subscription confirmation');
        }
    }

    async sendTeamInvitation(invitationData) {
        if (!this.transporter) {
            console.log('📧 Email service not configured, skipping team invitation email');
            return { skipped: true, reason: 'Email service not configured' };
        }

        try {
            const { email, inviterName, teamName, inviteToken, role } = invitationData;

            const subject = `You've been invited to join ${teamName} on Pigeon Monitoring`;
            const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/teams/invite/accept?token=${inviteToken}`;

            const htmlContent = `
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h2 style="color: #014C75;">Team Invitation</h2>
                        </div>
                        
                        <p>Hi there!</p>
                        <p><strong>${inviterName}</strong> has invited you to join the <strong>${teamName}</strong> team on Pigeon Monitoring.</p>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Team:</strong> ${teamName}</p>
                            <p><strong>Role:</strong> ${role}</p>
                            <p><strong>Invited by:</strong> ${inviterName}</p>
                        </div>
                        
                        <p>By joining this team, you'll be able to collaborate on monitoring configurations, view shared dashboards, and receive team alerts.</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${inviteUrl}" 
                               style="background-color: #014C75; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                Accept Invitation
                            </a>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">
                            This invitation will expire in 7 days. If you don't want to join this team, you can safely ignore this email.
                        </p>
                        
                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666;">
                            Pigeon Monitoring - Team Collaboration<br>
                            If you have any questions, please contact our support team.
                        </p>
                    </div>
                </body>
                </html>
            `;

            const textContent = `
Team Invitation

Hi there!

${inviterName} has invited you to join the ${teamName} team on Pigeon Monitoring.

Team: ${teamName}
Role: ${role}
Invited by: ${inviterName}

By joining this team, you'll be able to collaborate on monitoring configurations, view shared dashboards, and receive team alerts.

To accept this invitation, please visit: ${inviteUrl}

This invitation will expire in 7 days. If you don't want to join this team, you can safely ignore this email.

--
Pigeon Monitoring - Team Collaboration
If you have any questions, please contact our support team.
            `;

            const mailOptions = {
                from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                to: email,
                subject,
                text: textContent,
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Team invitation email sent:', result.messageId);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            return this.handleEmailError(error, 'team invitation');
        }
    }

    async sendReviewRequestNotification(reviewData) {
        if (!this.transporter && !this.isBrevoConfigured()) {
            console.log('📧 Email service not configured, skipping review request email');
            return { skipped: true, reason: 'Email service not configured' };
        }

        try {
            const { toEmail, toName, requesterName, title, reviewId } = reviewData;

            const subject = `${requesterName} requested your review: ${title}`;
            const reviewUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reviews/${reviewId}`;

            const htmlContent = `
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h2 style="color: #014C75;">Review Requested</h2>
                        </div>

                        <p>Hi ${toName || 'there'},</p>
                        <p><strong>${requesterName}</strong> has requested your review on <strong>${title}</strong>.</p>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${reviewUrl}"
                               style="background-color: #014C75; color: white; padding: 12px 30px;
                                      text-decoration: none; border-radius: 5px; display: inline-block;">
                                View Review
                            </a>
                        </div>

                        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #666;">
                            Pigeon Monitoring - Review Requests
                        </p>
                    </div>
                </body>
                </html>
            `;

            const textContent = `${requesterName} has requested your review on ${title}.\n\nView it here: ${reviewUrl}\n\n--\nPigeon Monitoring`;

            if (this.transporter) {
                const mailOptions = {
                    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
                    to: toEmail,
                    subject,
                    text: textContent,
                    html: htmlContent
                };

                const result = await this.transporter.sendMail(mailOptions);
                console.log('✅ Review request email sent (SMTP):', result.messageId);
                return { success: true, messageId: result.messageId };
            }

            const result = await this.sendViaBrevo({
                toEmail,
                toName,
                subject,
                textContent,
                htmlContent
            });
            if (result?.success) {
                console.log('✅ Review request email sent (Brevo):', result.messageId);
            }
            return result;
        } catch (error) {
            return this.handleEmailError(error, 'review request notification');
        }
    }

    generateReportHTML(reportName) {
        return `
            <html>
            <head>
                <title>${reportName}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .logo { max-width: 200px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${reportName}</h1>
                        <p>Your monitoring report is attached to this email.</p>
                    </div>
                    <p>This report contains detailed monitoring statistics and insights for your configured services.</p>
                    <p>If you have any questions about this report, please contact our support team.</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">
                        Powered by Pigeon Monitoring<br>
                        Generated on ${new Date().toLocaleDateString()}
                    </p>
                </div>
            </body>
            </html>
        `;
    }

    getMaintenanceSubject(maintenance, type) {
        const emoji = {
            scheduled: '📅',
            reminder: '⏰',
            started: '🔧',
            completed: '✅'
        };

        const prefixes = {
            scheduled: '[SCHEDULED]',
            reminder: '[REMINDER]',
            started: '[IN PROGRESS]',
            completed: '[COMPLETED]'
        };

        return `${emoji[type]} ${prefixes[type]} ${maintenance.title}`;
    }

    generateMaintenanceHTML(maintenance, type) {
        const statusColor = {
            scheduled: '#014C75',
            reminder: '#ffc107',
            started: '#fd7e14',
            completed: '#28a745'
        };

        const messages = {
            scheduled: 'We have scheduled maintenance for the following services:',
            reminder: 'Maintenance is starting soon for the following services:',
            started: 'Maintenance is currently in progress for the following services:',
            completed: 'Maintenance has been completed for the following services:'
        };

        return `
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h2 style="color: ${statusColor[type]};">${maintenance.title}</h2>
                    </div>
                    
                    <p>${messages[type]}</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h4>Maintenance Details:</h4>
                        <p><strong>Description:</strong> ${maintenance.description}</p>
                        <p><strong>Scheduled Start:</strong> ${new Date(maintenance.scheduledStartTime).toLocaleString()}</p>
                        <p><strong>Scheduled End:</strong> ${new Date(maintenance.scheduledEndTime).toLocaleString()}</p>
                        
                        <h4>Affected Services:</h4>
                        <ul>
                            ${maintenance.affectedServices.map(service =>
            `<li>${service.serviceName || 'Unknown Service'}</li>`
        ).join('')}
                        </ul>
                    </div>
                    
                    ${type === 'completed' ? `
                        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="color: #155724; margin: 0;">
                                <strong>✅ Maintenance completed successfully!</strong><br>
                                All services should now be operating normally.
                            </p>
                        </div>
                    ` : ''}
                    
                    <p>We apologize for any inconvenience this may cause. For real-time updates, please visit our status page.</p>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #666;">
                        Status Page Updates<br>
                        Powered by Pigeon Monitoring
                    </p>
                </div>
            </body>
            </html>
        `;
    }

    generateMaintenanceText(maintenance, type) {
        const messages = {
            scheduled: 'We have scheduled maintenance for the following services:',
            reminder: 'Maintenance is starting soon for the following services:',
            started: 'Maintenance is currently in progress for the following services:',
            completed: 'Maintenance has been completed for the following services:'
        };

        return `
${maintenance.title}

${messages[type]}

Description: ${maintenance.description}
Scheduled Start: ${new Date(maintenance.scheduledStartTime).toLocaleString()}
Scheduled End: ${new Date(maintenance.scheduledEndTime).toLocaleString()}

Affected Services:
${maintenance.affectedServices.map(service => `- ${service.serviceName || 'Unknown Service'}`).join('\n')}

${type === 'completed' ? 'Maintenance completed successfully! All services should now be operating normally.' : ''}

We apologize for any inconvenience this may cause.

--
Status Page Updates
Powered by Pigeon Monitoring
        `;
    }
}

module.exports = EmailService;
