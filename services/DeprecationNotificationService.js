// services/DeprecationNotificationService.js
// Service for managing deprecation notifications and alerting subscribers

const EmailService = require('./EmailService');
const IntegrationService = require('./IntegrationService');
const ApiVersionLifecycle = require('../models/ApiVersionLifecycle');
const ApiVersion = require('../models/ApiVersion');

class DeprecationNotificationService {
    // Default reminder intervals (in days before sunset)
    static DEFAULT_REMINDER_INTERVALS = [90, 60, 30, 14, 7, 3, 1];

    // Notification templates
    static TEMPLATES = {
        DEPRECATION_ANNOUNCEMENT: {
            subject: '[Action Required] API Version {version} Deprecation Notice',
            type: 'deprecation_announcement'
        },
        DEPRECATION_REMINDER: {
            subject: '[Reminder] API Version {version} Sunsetting in {days} Days',
            type: 'deprecation_reminder'
        },
        SUNSET_IMMINENT: {
            subject: '[URGENT] API Version {version} Sunset Tomorrow',
            type: 'sunset_imminent'
        },
        SUNSET_COMPLETE: {
            subject: '[Notice] API Version {version} Has Been Sunset',
            type: 'sunset_complete'
        },
        VERSION_TRANSITION: {
            subject: '[Info] API Version {version} State Changed to {state}',
            type: 'version_transition'
        },
        BREAKING_CHANGES_DETECTED: {
            subject: '[Alert] Breaking Changes Detected in API Version {version}',
            type: 'breaking_changes'
        }
    };

    /**
     * Send deprecation announcement to all subscribers
     */
    static async sendDeprecationAnnouncement(apiVersionId, options = {}) {
        try {
            const lifecycle = await ApiVersionLifecycle.findOne({ apiVersionId })
                .populate('apiVersionId', 'version name collectionId');

            if (!lifecycle) {
                throw new Error('Version lifecycle not found');
            }

            const apiVersion = await ApiVersion.findById(apiVersionId)
                .populate('collectionId', 'name');

            const subscribers = lifecycle.subscribers.filter(s => 
                s.isActive && s.notifyOn?.deprecation !== false
            );

            const results = [];

            for (const subscriber of subscribers) {
                try {
                    const emailContent = this._generateDeprecationEmail(
                        apiVersion,
                        lifecycle.deprecationSchedule,
                        subscriber,
                        'announcement'
                    );

                    await EmailService.sendEmail({
                        to: subscriber.email,
                        subject: emailContent.subject,
                        html: emailContent.html,
                        text: emailContent.text
                    });

                    results.push({
                        email: subscriber.email,
                        status: 'sent',
                        type: 'deprecation_announcement'
                    });
                } catch (error) {
                    results.push({
                        email: subscriber.email,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            // Send to integration channels
            await this._sendToIntegrations(lifecycle, {
                type: 'deprecation_announcement',
                version: apiVersion.version,
                versionName: apiVersion.name,
                collectionName: apiVersion.collectionId?.name || 'Unknown',
                deprecationDate: lifecycle.deprecationSchedule.deprecationDate,
                sunsetDate: lifecycle.deprecationSchedule.sunsetDate,
                reason: lifecycle.deprecationSchedule.reason,
                migrationGuideUrl: lifecycle.deprecationSchedule.migrationGuideUrl
            });

            // Record notification sent
            await this._recordNotificationSent(lifecycle._id, 'deprecation_announcement');

            return {
                success: true,
                sent: results.filter(r => r.status === 'sent').length,
                failed: results.filter(r => r.status === 'failed').length,
                details: results
            };
        } catch (error) {
            console.error('Error sending deprecation announcement:', error);
            throw error;
        }
    }

    /**
     * Send scheduled deprecation reminders
     */
    static async sendDeprecationReminders() {
        try {
            const now = new Date();
            const results = [];

            // Find all deprecated versions with upcoming sunsets
            const lifecycles = await ApiVersionLifecycle.find({
                currentState: 'deprecated',
                'deprecationSchedule.sunsetDate': { $gte: now }
            }).populate('apiVersionId', 'version name collectionId');

            for (const lifecycle of lifecycles) {
                const daysUntilSunset = Math.ceil(
                    (lifecycle.deprecationSchedule.sunsetDate - now) / (1000 * 60 * 60 * 24)
                );

                const intervals = lifecycle.deprecationSchedule.reminderIntervals || 
                    this.DEFAULT_REMINDER_INTERVALS;

                // Check if we should send a reminder for this interval
                if (intervals.includes(daysUntilSunset)) {
                    // Check if we already sent this reminder
                    const alreadySent = lifecycle.deprecationSchedule.notificationsSent?.some(
                        n => n.type === `reminder_${daysUntilSunset}_days`
                    );

                    if (!alreadySent) {
                        const result = await this._sendReminderNotifications(
                            lifecycle,
                            daysUntilSunset
                        );
                        results.push({
                            apiVersionId: lifecycle.apiVersionId._id,
                            version: lifecycle.apiVersionId.version,
                            daysUntilSunset,
                            ...result
                        });
                    }
                }
            }

            return {
                processed: lifecycles.length,
                remindersSent: results.length,
                details: results
            };
        } catch (error) {
            console.error('Error sending deprecation reminders:', error);
            throw error;
        }
    }

    /**
     * Send reminder notifications for a specific version
     */
    static async _sendReminderNotifications(lifecycle, daysUntilSunset) {
        const apiVersion = await ApiVersion.findById(lifecycle.apiVersionId)
            .populate('collectionId', 'name');

        const subscribers = lifecycle.subscribers.filter(s =>
            s.isActive && s.notifyOn?.reminder !== false
        );

        const results = [];
        let urgencyLevel = 'normal';

        if (daysUntilSunset <= 3) {
            urgencyLevel = 'critical';
        } else if (daysUntilSunset <= 7) {
            urgencyLevel = 'high';
        } else if (daysUntilSunset <= 14) {
            urgencyLevel = 'medium';
        }

        for (const subscriber of subscribers) {
            try {
                const emailContent = this._generateDeprecationEmail(
                    apiVersion,
                    lifecycle.deprecationSchedule,
                    subscriber,
                    'reminder',
                    { daysUntilSunset, urgencyLevel }
                );

                await EmailService.sendEmail({
                    to: subscriber.email,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text
                });

                results.push({ email: subscriber.email, status: 'sent' });
            } catch (error) {
                results.push({ email: subscriber.email, status: 'failed', error: error.message });
            }
        }

        // Send to integrations with appropriate urgency
        await this._sendToIntegrations(lifecycle, {
            type: 'deprecation_reminder',
            version: apiVersion.version,
            versionName: apiVersion.name,
            collectionName: apiVersion.collectionId?.name || 'Unknown',
            daysUntilSunset,
            urgencyLevel,
            sunsetDate: lifecycle.deprecationSchedule.sunsetDate,
            migrationGuideUrl: lifecycle.deprecationSchedule.migrationGuideUrl
        });

        // Record notification
        await this._recordNotificationSent(lifecycle._id, `reminder_${daysUntilSunset}_days`);

        return {
            sent: results.filter(r => r.status === 'sent').length,
            failed: results.filter(r => r.status === 'failed').length
        };
    }

    /**
     * Send sunset completion notification
     */
    static async sendSunsetNotification(apiVersionId) {
        try {
            const lifecycle = await ApiVersionLifecycle.findOne({ apiVersionId })
                .populate('apiVersionId', 'version name collectionId');

            if (!lifecycle) {
                throw new Error('Version lifecycle not found');
            }

            const apiVersion = await ApiVersion.findById(apiVersionId)
                .populate('collectionId', 'name');

            const subscribers = lifecycle.subscribers.filter(s => s.isActive);
            const results = [];

            for (const subscriber of subscribers) {
                try {
                    const emailContent = this._generateDeprecationEmail(
                        apiVersion,
                        lifecycle.deprecationSchedule,
                        subscriber,
                        'sunset'
                    );

                    await EmailService.sendEmail({
                        to: subscriber.email,
                        subject: emailContent.subject,
                        html: emailContent.html,
                        text: emailContent.text
                    });

                    results.push({ email: subscriber.email, status: 'sent' });
                } catch (error) {
                    results.push({ email: subscriber.email, status: 'failed', error: error.message });
                }
            }

            // Send to integrations
            await this._sendToIntegrations(lifecycle, {
                type: 'sunset_complete',
                version: apiVersion.version,
                versionName: apiVersion.name,
                collectionName: apiVersion.collectionId?.name || 'Unknown',
                replacementVersionId: lifecycle.deprecationSchedule.replacementVersionId
            });

            await this._recordNotificationSent(lifecycle._id, 'sunset_complete');

            return {
                success: true,
                sent: results.filter(r => r.status === 'sent').length,
                failed: results.filter(r => r.status === 'failed').length,
                details: results
            };
        } catch (error) {
            console.error('Error sending sunset notification:', error);
            throw error;
        }
    }

    /**
     * Send breaking changes alert
     */
    static async sendBreakingChangesAlert(apiVersionId, breakingChanges) {
        try {
            const lifecycle = await ApiVersionLifecycle.findOne({ apiVersionId })
                .populate('apiVersionId', 'version name collectionId');

            if (!lifecycle) {
                // No subscribers to notify
                return { success: true, sent: 0, failed: 0 };
            }

            const apiVersion = await ApiVersion.findById(apiVersionId)
                .populate('collectionId', 'name');

            const subscribers = lifecycle.subscribers.filter(s =>
                s.isActive && s.notifyOn?.breakingChanges !== false
            );

            const results = [];

            for (const subscriber of subscribers) {
                try {
                    const emailContent = this._generateBreakingChangesEmail(
                        apiVersion,
                        breakingChanges,
                        subscriber
                    );

                    await EmailService.sendEmail({
                        to: subscriber.email,
                        subject: emailContent.subject,
                        html: emailContent.html,
                        text: emailContent.text
                    });

                    results.push({ email: subscriber.email, status: 'sent' });
                } catch (error) {
                    results.push({ email: subscriber.email, status: 'failed', error: error.message });
                }
            }

            // Send to integrations
            await this._sendToIntegrations(lifecycle, {
                type: 'breaking_changes',
                version: apiVersion.version,
                versionName: apiVersion.name,
                collectionName: apiVersion.collectionId?.name || 'Unknown',
                breakingChangesCount: breakingChanges.length,
                breakingChangesSummary: breakingChanges.slice(0, 5).map(c => c.message || c.description)
            });

            return {
                success: true,
                sent: results.filter(r => r.status === 'sent').length,
                failed: results.filter(r => r.status === 'failed').length,
                details: results
            };
        } catch (error) {
            console.error('Error sending breaking changes alert:', error);
            throw error;
        }
    }

    /**
     * Send version state transition notification
     */
    static async sendStateTransitionNotification(apiVersionId, fromState, toState, triggeredBy) {
        try {
            const lifecycle = await ApiVersionLifecycle.findOne({ apiVersionId })
                .populate('apiVersionId', 'version name collectionId');

            if (!lifecycle) {
                return { success: true, sent: 0, failed: 0 };
            }

            const apiVersion = await ApiVersion.findById(apiVersionId)
                .populate('collectionId', 'name');

            const subscribers = lifecycle.subscribers.filter(s =>
                s.isActive && s.notifyOn?.stateChanges !== false
            );

            const results = [];

            for (const subscriber of subscribers) {
                try {
                    const subject = this.TEMPLATES.VERSION_TRANSITION.subject
                        .replace('{version}', apiVersion.version)
                        .replace('{state}', toState);

                    const emailContent = {
                        subject,
                        html: this._generateStateTransitionHtml(apiVersion, fromState, toState, subscriber),
                        text: this._generateStateTransitionText(apiVersion, fromState, toState)
                    };

                    await EmailService.sendEmail({
                        to: subscriber.email,
                        subject: emailContent.subject,
                        html: emailContent.html,
                        text: emailContent.text
                    });

                    results.push({ email: subscriber.email, status: 'sent' });
                } catch (error) {
                    results.push({ email: subscriber.email, status: 'failed', error: error.message });
                }
            }

            // Send to integrations
            await this._sendToIntegrations(lifecycle, {
                type: 'state_transition',
                version: apiVersion.version,
                versionName: apiVersion.name,
                collectionName: apiVersion.collectionId?.name || 'Unknown',
                fromState,
                toState,
                triggeredBy
            });

            return {
                success: true,
                sent: results.filter(r => r.status === 'sent').length,
                failed: results.filter(r => r.status === 'failed').length
            };
        } catch (error) {
            console.error('Error sending state transition notification:', error);
            throw error;
        }
    }

    /**
     * Check for versions that need sunset processing
     */
    static async processSunsetVersions() {
        try {
            const now = new Date();
            const results = [];

            // Find deprecated versions past their sunset date
            const lifecycles = await ApiVersionLifecycle.find({
                currentState: 'deprecated',
                'deprecationSchedule.sunsetDate': { $lte: now }
            });

            for (const lifecycle of lifecycles) {
                try {
                    // Transition to sunset state
                    await lifecycle.transitionState('sunset', null, 'Automatic sunset processing');

                    // Send sunset notification
                    await this.sendSunsetNotification(lifecycle.apiVersionId);

                    results.push({
                        apiVersionId: lifecycle.apiVersionId,
                        status: 'processed',
                        newState: 'sunset'
                    });
                } catch (error) {
                    results.push({
                        apiVersionId: lifecycle.apiVersionId,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            return {
                processed: results.length,
                successful: results.filter(r => r.status === 'processed').length,
                failed: results.filter(r => r.status === 'error').length,
                details: results
            };
        } catch (error) {
            console.error('Error processing sunset versions:', error);
            throw error;
        }
    }

    /**
     * Get notification history for a version
     */
    static async getNotificationHistory(apiVersionId) {
        try {
            const lifecycle = await ApiVersionLifecycle.findOne({ apiVersionId });

            if (!lifecycle) {
                return { notifications: [], total: 0 };
            }

            const notifications = lifecycle.deprecationSchedule?.notificationsSent || [];

            return {
                notifications: notifications.sort((a, b) => 
                    new Date(b.sentAt) - new Date(a.sentAt)
                ),
                total: notifications.length
            };
        } catch (error) {
            console.error('Error getting notification history:', error);
            throw error;
        }
    }

    /**
     * Preview notification before sending
     */
    static async previewNotification(apiVersionId, notificationType) {
        try {
            const lifecycle = await ApiVersionLifecycle.findOne({ apiVersionId });
            const apiVersion = await ApiVersion.findById(apiVersionId)
                .populate('collectionId', 'name');

            if (!apiVersion) {
                throw new Error('API version not found');
            }

            const mockSubscriber = {
                email: 'preview@example.com',
                name: 'Preview User',
                organization: 'Your Organization',
                unsubscribeToken: 'preview-token'
            };

            let emailContent;

            switch (notificationType) {
                case 'deprecation_announcement':
                    emailContent = this._generateDeprecationEmail(
                        apiVersion,
                        lifecycle?.deprecationSchedule || {
                            deprecationDate: new Date(),
                            sunsetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                            reason: 'This version is being replaced with a newer version'
                        },
                        mockSubscriber,
                        'announcement'
                    );
                    break;

                case 'deprecation_reminder':
                    emailContent = this._generateDeprecationEmail(
                        apiVersion,
                        lifecycle?.deprecationSchedule || {
                            deprecationDate: new Date(),
                            sunsetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        },
                        mockSubscriber,
                        'reminder',
                        { daysUntilSunset: 30, urgencyLevel: 'medium' }
                    );
                    break;

                case 'sunset_complete':
                    emailContent = this._generateDeprecationEmail(
                        apiVersion,
                        lifecycle?.deprecationSchedule || {},
                        mockSubscriber,
                        'sunset'
                    );
                    break;

                default:
                    throw new Error('Invalid notification type');
            }

            return {
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text,
                recipientCount: lifecycle?.subscribers?.filter(s => s.isActive).length || 0
            };
        } catch (error) {
            console.error('Error previewing notification:', error);
            throw error;
        }
    }

    // ============================================
    // Private Helper Methods
    // ============================================

    /**
     * Generate deprecation email content
     */
    static _generateDeprecationEmail(apiVersion, schedule, subscriber, type, options = {}) {
        const versionName = apiVersion.name || apiVersion.version;
        const collectionName = apiVersion.collectionId?.name || 'Unknown Collection';

        let subject;
        let htmlContent;
        let textContent;

        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        const unsubscribeUrl = `${baseUrl}/api/contract-testing/unsubscribe/${subscriber.unsubscribeToken}`;

        switch (type) {
            case 'announcement':
                subject = `[Action Required] API Version ${versionName} Deprecation Notice`;
                htmlContent = this._generateAnnouncementHtml(apiVersion, schedule, subscriber, unsubscribeUrl);
                textContent = this._generateAnnouncementText(apiVersion, schedule);
                break;

            case 'reminder':
                const { daysUntilSunset, urgencyLevel } = options;
                const urgencyPrefix = urgencyLevel === 'critical' ? '[URGENT] ' : 
                    urgencyLevel === 'high' ? '[Important] ' : '';
                subject = `${urgencyPrefix}API Version ${versionName} Sunsetting in ${daysUntilSunset} Days`;
                htmlContent = this._generateReminderHtml(apiVersion, schedule, subscriber, daysUntilSunset, urgencyLevel, unsubscribeUrl);
                textContent = this._generateReminderText(apiVersion, schedule, daysUntilSunset);
                break;

            case 'sunset':
                subject = `[Notice] API Version ${versionName} Has Been Sunset`;
                htmlContent = this._generateSunsetHtml(apiVersion, schedule, subscriber, unsubscribeUrl);
                textContent = this._generateSunsetText(apiVersion, schedule);
                break;

            default:
                throw new Error(`Unknown email type: ${type}`);
        }

        return { subject, html: htmlContent, text: textContent };
    }

    /**
     * Generate announcement HTML email
     */
    static _generateAnnouncementHtml(apiVersion, schedule, subscriber, unsubscribeUrl) {
        const deprecationDate = new Date(schedule.deprecationDate).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const sunsetDate = new Date(schedule.sunsetDate).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff6b6b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .alert-box { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .timeline { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .timeline-item { display: flex; margin: 10px 0; }
        .timeline-date { font-weight: bold; min-width: 150px; color: #666; }
        .btn { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin: 5px; }
        .btn-secondary { background: #6c757d; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ API Deprecation Notice</h1>
        </div>
        <div class="content">
            <p>Hello${subscriber.name ? ' ' + subscriber.name : ''},</p>
            
            <div class="alert-box">
                <strong>API Version ${apiVersion.name || apiVersion.version}</strong> from 
                <strong>${apiVersion.collectionId?.name || 'Unknown Collection'}</strong> 
                has been scheduled for deprecation.
            </div>

            ${schedule.reason ? `<p><strong>Reason:</strong> ${schedule.reason}</p>` : ''}

            <div class="timeline">
                <h3>📅 Important Dates</h3>
                <div class="timeline-item">
                    <span class="timeline-date">Deprecation Date:</span>
                    <span>${deprecationDate}</span>
                </div>
                <div class="timeline-item">
                    <span class="timeline-date">Sunset Date:</span>
                    <span>${sunsetDate}</span>
                </div>
            </div>

            <h3>🔄 What You Need To Do</h3>
            <ol>
                <li>Review the migration guide for upgrade instructions</li>
                <li>Update your integrations before the sunset date</li>
                <li>Test your applications with the new version</li>
            </ol>

            ${schedule.migrationGuideUrl ? `
            <p>
                <a href="${schedule.migrationGuideUrl}" class="btn">📘 View Migration Guide</a>
            </p>
            ` : ''}

            <p>We will send you reminder notifications as the sunset date approaches.</p>
        </div>
        <div class="footer">
            <p>You received this because you're subscribed to updates for this API version.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe from these notifications</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate announcement plain text email
     */
    static _generateAnnouncementText(apiVersion, schedule) {
        const deprecationDate = new Date(schedule.deprecationDate).toLocaleDateString();
        const sunsetDate = new Date(schedule.sunsetDate).toLocaleDateString();

        return `
API DEPRECATION NOTICE

API Version ${apiVersion.name || apiVersion.version} from ${apiVersion.collectionId?.name || 'Unknown Collection'} has been scheduled for deprecation.

${schedule.reason ? `Reason: ${schedule.reason}\n` : ''}

IMPORTANT DATES:
- Deprecation Date: ${deprecationDate}
- Sunset Date: ${sunsetDate}

WHAT YOU NEED TO DO:
1. Review the migration guide for upgrade instructions
2. Update your integrations before the sunset date
3. Test your applications with the new version

${schedule.migrationGuideUrl ? `Migration Guide: ${schedule.migrationGuideUrl}\n` : ''}

We will send you reminder notifications as the sunset date approaches.
`;
    }

    /**
     * Generate reminder HTML email
     */
    static _generateReminderHtml(apiVersion, schedule, subscriber, daysUntilSunset, urgencyLevel, unsubscribeUrl) {
        const urgencyColors = {
            critical: '#dc3545',
            high: '#fd7e14',
            medium: '#ffc107',
            normal: '#17a2b8'
        };

        const urgencyColor = urgencyColors[urgencyLevel] || urgencyColors.normal;
        const sunsetDate = new Date(schedule.sunsetDate).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${urgencyColor}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .countdown { font-size: 48px; font-weight: bold; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .btn { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Sunset Reminder</h1>
            <div class="countdown">${daysUntilSunset}</div>
            <p>days until API sunset</p>
        </div>
        <div class="content">
            <p>Hello${subscriber.name ? ' ' + subscriber.name : ''},</p>
            
            <p>This is a reminder that <strong>API Version ${apiVersion.name || apiVersion.version}</strong> 
            will be sunset on <strong>${sunsetDate}</strong>.</p>

            ${daysUntilSunset <= 7 ? `
            <p style="color: ${urgencyColor}; font-weight: bold;">
                ⚠️ This is a final reminder. Please ensure you have migrated before the sunset date.
            </p>
            ` : ''}

            ${schedule.migrationGuideUrl ? `
            <p>
                <a href="${schedule.migrationGuideUrl}" class="btn">📘 View Migration Guide</a>
            </p>
            ` : ''}
        </div>
        <div class="footer">
            <p><a href="${unsubscribeUrl}">Unsubscribe from these notifications</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate reminder plain text email
     */
    static _generateReminderText(apiVersion, schedule, daysUntilSunset) {
        const sunsetDate = new Date(schedule.sunsetDate).toLocaleDateString();

        return `
SUNSET REMINDER - ${daysUntilSunset} DAYS REMAINING

API Version ${apiVersion.name || apiVersion.version} will be sunset on ${sunsetDate}.

${daysUntilSunset <= 7 ? 'WARNING: This is a final reminder. Please ensure you have migrated before the sunset date.\n' : ''}

${schedule.migrationGuideUrl ? `Migration Guide: ${schedule.migrationGuideUrl}` : ''}
`;
    }

    /**
     * Generate sunset notification HTML
     */
    static _generateSunsetHtml(apiVersion, schedule, subscriber, unsubscribeUrl) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌅 API Version Sunset Complete</h1>
        </div>
        <div class="content">
            <p>Hello${subscriber.name ? ' ' + subscriber.name : ''},</p>
            
            <p><strong>API Version ${apiVersion.name || apiVersion.version}</strong> has been officially sunset 
            and is no longer available.</p>

            ${schedule.replacementVersionId ? `
            <p>Please use the replacement version for continued access to this API.</p>
            ` : ''}

            <p>If you haven't already migrated, please do so immediately to avoid service disruption.</p>
        </div>
        <div class="footer">
            <p><a href="${unsubscribeUrl}">Unsubscribe from these notifications</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate sunset notification plain text
     */
    static _generateSunsetText(apiVersion, schedule) {
        return `
API VERSION SUNSET COMPLETE

API Version ${apiVersion.name || apiVersion.version} has been officially sunset and is no longer available.

${schedule.replacementVersionId ? 'Please use the replacement version for continued access to this API.\n' : ''}

If you haven't already migrated, please do so immediately to avoid service disruption.
`;
    }

    /**
     * Generate breaking changes email content
     */
    static _generateBreakingChangesEmail(apiVersion, breakingChanges, subscriber) {
        const subject = `[Alert] Breaking Changes Detected in API Version ${apiVersion.name || apiVersion.version}`;

        const changesList = breakingChanges.slice(0, 10).map(change => {
            return `<li><strong>${change.type || 'Change'}:</strong> ${change.message || change.description || 'No description'}</li>`;
        }).join('\n');

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .changes-list { background: white; padding: 15px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Breaking Changes Detected</h1>
        </div>
        <div class="content">
            <p>Hello${subscriber.name ? ' ' + subscriber.name : ''},</p>
            
            <p><strong>${breakingChanges.length} breaking change(s)</strong> have been detected in 
            <strong>API Version ${apiVersion.name || apiVersion.version}</strong>.</p>

            <div class="changes-list">
                <h3>Changes Detected:</h3>
                <ul>
                    ${changesList}
                </ul>
                ${breakingChanges.length > 10 ? `<p>...and ${breakingChanges.length - 10} more</p>` : ''}
            </div>

            <p>Please review these changes and update your integrations accordingly.</p>
        </div>
    </div>
</body>
</html>`;

        const text = `
BREAKING CHANGES DETECTED

${breakingChanges.length} breaking change(s) have been detected in API Version ${apiVersion.name || apiVersion.version}.

Changes:
${breakingChanges.slice(0, 10).map(c => `- ${c.type || 'Change'}: ${c.message || c.description || 'No description'}`).join('\n')}
${breakingChanges.length > 10 ? `...and ${breakingChanges.length - 10} more` : ''}

Please review these changes and update your integrations accordingly.
`;

        return { subject, html, text };
    }

    /**
     * Generate state transition HTML email
     */
    static _generateStateTransitionHtml(apiVersion, fromState, toState, subscriber) {
        const stateColors = {
            draft: '#6c757d',
            beta: '#17a2b8',
            stable: '#28a745',
            deprecated: '#ffc107',
            sunset: '#dc3545'
        };

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px; }
        .content { padding: 20px; }
        .state-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>API Version State Changed</h1>
        </div>
        <div class="content">
            <p>Hello${subscriber.name ? ' ' + subscriber.name : ''},</p>
            
            <p><strong>API Version ${apiVersion.name || apiVersion.version}</strong> has transitioned from 
            <span class="state-badge" style="background: ${stateColors[fromState] || '#6c757d'}">${fromState}</span>
            to 
            <span class="state-badge" style="background: ${stateColors[toState] || '#6c757d'}">${toState}</span>
            </p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate state transition plain text email
     */
    static _generateStateTransitionText(apiVersion, fromState, toState) {
        return `
API VERSION STATE CHANGED

API Version ${apiVersion.name || apiVersion.version} has transitioned from ${fromState.toUpperCase()} to ${toState.toUpperCase()}.
`;
    }

    /**
     * Send notifications to integration channels
     */
    static async _sendToIntegrations(lifecycle, payload) {
        try {
            // Get integrations for the collection
            const Integration = require('../models/Integration');
            const integrations = await Integration.find({
                collectionId: lifecycle.collectionId,
                isActive: true,
                'triggers.apiVersionChanges': true
            });

            for (const integration of integrations) {
                try {
                    await IntegrationService.sendNotification(integration._id, {
                        event: payload.type,
                        data: payload
                    });
                } catch (error) {
                    console.error(`Failed to send to integration ${integration._id}:`, error.message);
                }
            }
        } catch (error) {
            console.error('Error sending to integrations:', error);
            // Don't throw - integrations are secondary to email notifications
        }
    }

    /**
     * Record that a notification was sent
     */
    static async _recordNotificationSent(lifecycleId, notificationType) {
        try {
            await ApiVersionLifecycle.findByIdAndUpdate(lifecycleId, {
                $push: {
                    'deprecationSchedule.notificationsSent': {
                        type: notificationType,
                        sentAt: new Date()
                    }
                }
            });
        } catch (error) {
            console.error('Error recording notification:', error);
        }
    }
}

module.exports = DeprecationNotificationService;
