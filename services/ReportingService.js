// services/ReportingService.js
const cron = require('node-cron');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Report = require('../models/Report');
const Monitor = require('../models/Monitor');
const HealthCheck = require('../models/HealthCheck');
const Incident = require('../models/Incident');
const EmailService = require('./EmailService');

class ReportingService {
    constructor() {
        this.isRunning = false;
        this.emailService = new EmailService();
        this.scheduledJobs = new Map();
    }

    start() {
        if (this.isRunning) return;

        console.log('Starting Reporting Service...');
        this.isRunning = true;

        // Check for scheduled reports every hour
        this.schedulerJob = cron.schedule('0 * * * *', async () => {
            await this.processScheduledReports();
        });

        this.loadActiveReports();
    }

    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.schedulerJob) {
            this.schedulerJob.destroy();
        }

        // Cancel all scheduled jobs
        this.scheduledJobs.forEach(job => job.destroy());
        this.scheduledJobs.clear();
    }

    async loadActiveReports() {
        try {
            const reports = await Report.find({ isActive: true });

            for (const report of reports) {
                this.scheduleReport(report);
            }
        } catch (error) {
            console.error('Error loading active reports:', error);
        }
    }

    scheduleReport(report) {
        const { frequency, dayOfWeek, dayOfMonth, time } = report.schedule;
        let cronPattern = '';

        const [hour, minute] = time.split(':').map(Number);

        switch (frequency) {
            case 'daily':
                cronPattern = `${minute} ${hour} * * *`;
                break;
            case 'weekly':
                cronPattern = `${minute} ${hour} * * ${dayOfWeek}`;
                break;
            case 'monthly':
                cronPattern = `${minute} ${hour} ${dayOfMonth} * *`;
                break;
        }

        if (cronPattern) {
            const job = cron.schedule(cronPattern, async () => {
                await this.generateReport(report);
            });

            this.scheduledJobs.set(report._id.toString(), job);
        }
    }

    async processScheduledReports() {
        try {
            const now = new Date();
            const reports = await Report.find({
                isActive: true,
                nextScheduled: { $lte: now }
            });

            for (const report of reports) {
                await this.generateReport(report);
            }
        } catch (error) {
            console.error('Error processing scheduled reports:', error);
        }
    }

    async generateReport(report) {
        try {
            console.log(`Generating report: ${report.name}`);

            const data = await this.collectReportData(report);

            for (const recipient of report.recipients) {
                let reportBuffer;

                switch (recipient.format) {
                    case 'pdf':
                        reportBuffer = await this.generatePDFReport(data, report);
                        break;
                    case 'csv':
                        reportBuffer = await this.generateCSVReport(data, report);
                        break;
                    case 'html':
                        reportBuffer = Buffer.from(await this.generateHTMLReport(data, report));
                        break;
                }

                await this.sendReport(recipient, reportBuffer, report, recipient.format);
            }

            // Update next scheduled time
            await this.updateNextScheduledTime(report);

        } catch (error) {
            console.error(`Error generating report ${report.name}:`, error);
        }
    }

    async collectReportData(report) {
        const { dateRange, monitorIds, tags } = report.filters;
        const endDate = new Date();
        const startDate = this.getStartDate(dateRange, endDate);

        // Build monitor query
        let monitorQuery = { workspaceId: report.workspaceId };
        if (monitorIds && monitorIds.length > 0) {
            monitorQuery._id = { $in: monitorIds };
        }
        if (tags && tags.length > 0) {
            monitorQuery.tags = { $in: tags };
        }

        const monitors = await Monitor.find(monitorQuery);
        const monitorData = [];

        for (const monitor of monitors) {
            const healthChecks = await HealthCheck.find({
                monitorId: monitor._id,
                checkedAt: { $gte: startDate, $lte: endDate }
            }).sort({ checkedAt: 1 });

            const stats = this.calculateMonitorStats(healthChecks);

            monitorData.push({
                monitor,
                stats,
                healthChecks: healthChecks.slice(-100) // Last 100 checks for charts
            });
        }

        // Get incidents for the period
        const incidents = await Incident.find({
            createdAt: { $gte: startDate, $lte: endDate }
        }).populate('affectedServices.monitorId');

        return {
            period: { startDate, endDate },
            monitors: monitorData,
            incidents,
            summary: this.calculateSummaryStats(monitorData)
        };
    }

    calculateMonitorStats(healthChecks) {
        if (healthChecks.length === 0) {
            return {
                totalChecks: 0,
                successfulChecks: 0,
                failedChecks: 0,
                uptimePercentage: 100,
                avgResponseTime: 0,
                maxResponseTime: 0,
                minResponseTime: 0
            };
        }

        const successfulChecks = healthChecks.filter(hc => hc.status === 'success').length;
        const responseTimes = healthChecks
            .filter(hc => hc.responseTime > 0)
            .map(hc => hc.responseTime);

        return {
            totalChecks: healthChecks.length,
            successfulChecks,
            failedChecks: healthChecks.length - successfulChecks,
            uptimePercentage: ((successfulChecks / healthChecks.length) * 100).toFixed(2),
            avgResponseTime: responseTimes.length > 0
                ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                : 0,
            maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
            minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0
        };
    }

    calculateSummaryStats(monitorData) {
        const totalMonitors = monitorData.length;
        const avgUptime = monitorData.length > 0
            ? (monitorData.reduce((sum, m) => sum + parseFloat(m.stats.uptimePercentage), 0) / totalMonitors).toFixed(2)
            : 100;

        return {
            totalMonitors,
            avgUptime,
            totalIncidents: 0 // Will be calculated separately
        };
    }

    async generatePDFReport(data, report) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument();
                const buffers = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                // Header
                doc.fontSize(20).text(report.name, { align: 'center' });
                doc.fontSize(12).text(`Report Period: ${data.period.startDate.toDateString()} - ${data.period.endDate.toDateString()}`, { align: 'center' });
                doc.moveDown();

                // Executive Summary
                if (report.template.includeExecutiveSummary) {
                    doc.fontSize(16).text('Executive Summary');
                    doc.fontSize(12).text(`Total Monitors: ${data.summary.totalMonitors}`);
                    doc.text(`Average Uptime: ${data.summary.avgUptime}%`);
                    doc.moveDown();
                }

                // Monitor Details
                data.monitors.forEach(monitorData => {
                    doc.fontSize(14).text(monitorData.monitor.name);
                    doc.fontSize(10);
                    doc.text(`URL: ${monitorData.monitor.url}`);
                    doc.text(`Uptime: ${monitorData.stats.uptimePercentage}%`);
                    doc.text(`Avg Response Time: ${monitorData.stats.avgResponseTime}ms`);
                    doc.text(`Total Checks: ${monitorData.stats.totalChecks}`);
                    doc.moveDown();
                });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    async generateCSVReport(data, report) {
        const rows = ['Monitor Name,URL,Uptime %,Avg Response Time (ms),Total Checks,Failed Checks'];

        data.monitors.forEach(monitorData => {
            const row = [
                monitorData.monitor.name,
                monitorData.monitor.url,
                monitorData.stats.uptimePercentage,
                monitorData.stats.avgResponseTime,
                monitorData.stats.totalChecks,
                monitorData.stats.failedChecks
            ].join(',');
            rows.push(row);
        });

        return Buffer.from(rows.join('\n'));
    }

    async generateHTMLReport(data, report) {
        // HTML template for email reports
        return `
        <html>
        <head>
            <title>${report.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                .monitor { border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
                .uptime-good { color: #28a745; }
                .uptime-warning { color: #ffc107; }
                .uptime-critical { color: #dc3545; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${report.name}</h1>
                <p>Report Period: ${data.period.startDate.toDateString()} - ${data.period.endDate.toDateString()}</p>
            </div>
            
            <div class="summary">
                <h3>Summary</h3>
                <p>Total Monitors: ${data.summary.totalMonitors}</p>
                <p>Average Uptime: ${data.summary.avgUptime}%</p>
            </div>
            
            ${data.monitors.map(monitorData => `
                <div class="monitor">
                    <h4>${monitorData.monitor.name}</h4>
                    <p>URL: ${monitorData.monitor.url}</p>
                    <p class="${this.getUptimeClass(monitorData.stats.uptimePercentage)}">
                        Uptime: ${monitorData.stats.uptimePercentage}%
                    </p>
                    <p>Average Response Time: ${monitorData.stats.avgResponseTime}ms</p>
                    <p>Total Checks: ${monitorData.stats.totalChecks}</p>
                </div>
            `).join('')}
        </body>
        </html>`;
    }

    getUptimeClass(uptime) {
        const uptimeNum = parseFloat(uptime);
        if (uptimeNum >= 99.5) return 'uptime-good';
        if (uptimeNum >= 95) return 'uptime-warning';
        return 'uptime-critical';
    }

    async sendReport(recipient, reportBuffer, report, format) {
        const filename = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${format}`;

        await this.emailService.sendReportEmail({
            to: recipient.email,
            subject: `${report.name} - ${new Date().toLocaleDateString()}`,
            reportName: report.name,
            attachment: {
                filename,
                content: reportBuffer
            }
        });
    }

    getStartDate(dateRange, endDate) {
        const days = parseInt(dateRange.replace('d', ''));
        return new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));
    }

    async updateNextScheduledTime(report) {
        const { frequency, dayOfWeek, dayOfMonth, time } = report.schedule;
        const [hour, minute] = time.split(':').map(Number);
        const now = new Date();
        let nextScheduled = new Date();

        switch (frequency) {
            case 'daily':
                nextScheduled.setDate(now.getDate() + 1);
                break;
            case 'weekly':
                const daysUntilNext = (dayOfWeek + 7 - now.getDay()) % 7 || 7;
                nextScheduled.setDate(now.getDate() + daysUntilNext);
                break;
            case 'monthly':
                nextScheduled.setMonth(now.getMonth() + 1);
                nextScheduled.setDate(dayOfMonth);
                break;
        }

        nextScheduled.setHours(hour, minute, 0, 0);

        await Report.findByIdAndUpdate(report._id, {
            lastGenerated: now,
            nextScheduled
        });
    }
}

module.exports = new ReportingService();
