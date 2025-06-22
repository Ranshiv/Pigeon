# API Monitoring & Status Pages - Integration Guide

## Overview

Your Pigeon project now includes a comprehensive API monitoring system with the following features:

- **Automated Health Checks**: Scheduled monitoring of API endpoints
- **Email Alerts**: Notifications for failures, slow responses, and recovery
- **Public Status Page**: Real-time status display for your APIs
- **Real-time Updates**: Live monitoring dashboard with WebSocket updates
- **Incident Tracking**: Track and communicate service incidents

## Project Structure

### Backend Components

```
models/
├── Monitor.js          # Monitor configuration model
├── HealthCheck.js      # Health check results model
└── Incident.js         # Incident tracking model (NEW)

services/
├── EmailService.js     # Email notification service
└── monitoring/
    └── MonitoringService.js  # Core monitoring logic with cron scheduler

routes/
└── monitoring.js       # API endpoints for monitoring
```

### Frontend Components

```
client/src/components/
├── MonitoringDashboard.js     # Internal monitoring dashboard
├── MonitoringDashboard.css    # Dashboard styles
├── PublicStatusPage.js        # Public status page
└── PublicStatusPage.css       # Public status page styles
```

## Features Breakdown

### 1. Backend Health Check Scheduler

**File**: `services/monitoring/MonitoringService.js`

- Uses `node-cron` for scheduling checks every minute
- Supports HTTP methods: GET, POST, PUT, DELETE, PATCH, HEAD
- Configurable intervals (1-60 minutes)
- Response time monitoring
- Status code validation
- Real-time Socket.IO updates

**Key Features**:

- Automatic failure detection
- Consecutive failure tracking
- Response time averaging
- Uptime percentage calculation

### 2. Mongoose Models

**Monitor Model** (`models/Monitor.js`):

```javascript
{
  name: String,              // Monitor display name
  url: String,               // Endpoint URL to monitor
  method: String,            // HTTP method
  headers: Array,            // Custom headers
  expectedStatusCode: Number, // Expected HTTP status
  expectedResponseTime: Number, // Response time threshold (ms)
  interval: Number,          // Check interval (minutes)
  isActive: Boolean,         // Enable/disable monitoring
  isPublic: Boolean,         // Show on public status page
  alertSettings: {
    emailEnabled: Boolean,
    webhookUrl: String,
    slackWebhook: String,
    alertOnFailure: Boolean,
    alertOnSlowResponse: Boolean,
    alertOnRecovery: Boolean
  },
  currentStatus: String,     // 'up', 'down', 'degraded', 'unknown'
  // ... statistics fields
}
```

**HealthCheck Model** (`models/HealthCheck.js`):

```javascript
{
  monitorId: ObjectId,       // Reference to Monitor
  status: String,            // 'success', 'failure', 'timeout'
  responseTime: Number,      // Response time in milliseconds
  statusCode: Number,        // HTTP status code
  errorMessage: String,      // Error details if failed
  checkedAt: Date,          // Timestamp of check
  alertSent: Boolean        // Whether alert was sent
}
```

### 3. Express Routes

**File**: `routes/monitoring.js`

Available endpoints:

- `GET /api/monitoring` - Get user's monitors
- `GET /api/monitoring/:id` - Get specific monitor
- `POST /api/monitoring` - Create new monitor
- `PUT /api/monitoring/:id` - Update monitor
- `DELETE /api/monitoring/:id` - Delete monitor
- `GET /api/monitoring/:id/history` - Get health check history
- `GET /api/monitoring/:id/stats` - Get monitor statistics
- `POST /api/monitoring/:id/check` - Run manual health check
- `GET /api/monitoring/public` - Get public monitors for status page
- `GET /api/monitoring/incidents/recent` - Get recent incidents
- `POST /api/monitoring/test-email` - Test email configuration

### 4. React Monitoring Dashboard

**File**: `client/src/components/MonitoringDashboard.js`

Features:

- Monitor creation and management
- Real-time status updates
- Filter by status and tags
- Manual health check triggers
- Statistics overview
- Responsive design

### 5. React Public Status Page

**File**: `client/src/components/PublicStatusPage.js`

Features:

- Overall system status
- Individual service status
- Uptime percentages
- Response time metrics
- Recent incidents
- Auto-refresh capability
- Clean, professional design

### 6. Email Alert System

**File**: `services/EmailService.js`

Features:

- HTML and text email templates
- Configurable alert types:
  - Failure alerts
  - Slow response alerts
  - Recovery notifications
- Professional email styling
- Links back to monitoring dashboard

## Setup Instructions

### 1. Install Dependencies (Already Installed)

The following packages are already included in your `package.json`:

- `node-cron` - For scheduling health checks
- `nodemailer` - For sending email alerts
- `node-fetch` - For making HTTP requests

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Email configuration for alerts
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
FRONTEND_URL=http://localhost:3000
```

### 3. Start the Services

The monitoring service automatically starts when your server starts (see `server.js`):

```javascript
// Monitoring service starts automatically
setTimeout(() => {
  console.log("Starting monitoring service...");
  MonitoringService.start();
}, 2000);
```

### 4. Access the Features

- **Monitoring Dashboard**: http://localhost:3000/monitoring (requires login)
- **Public Status Page**: http://localhost:3000/status (public access)
- **API Endpoints**: http://localhost:5001/api/monitoring/\*

## Usage Examples

### Creating a Monitor

```javascript
// POST /api/monitoring
{
  "name": "Main API Health Check",
  "url": "https://api.example.com/health",
  "method": "GET",
  "expectedStatusCode": 200,
  "expectedResponseTime": 2000,
  "interval": 5,
  "isActive": true,
  "isPublic": true,
  "alertSettings": {
    "emailEnabled": true,
    "alertOnFailure": true,
    "alertOnSlowResponse": true,
    "alertOnRecovery": true
  },
  "tags": ["production", "critical"]
}
```

### Email Alert Configuration

For Gmail, you'll need to:

1. Enable 2-factor authentication
2. Generate an "App Password"
3. Use the app password in `EMAIL_PASSWORD`

### Webhook Integration

You can configure webhook URLs in monitor settings to receive alerts in external systems:

```javascript
{
  "alertSettings": {
    "webhookUrl": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
    "slackWebhook": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
  }
}
```

## Best Practices

### 1. Monitor Selection

- **Public Monitors**: Only mark critical, customer-facing services as public
- **Check Intervals**: Use longer intervals (5-15 minutes) for production to avoid overwhelming APIs
- **Response Time Thresholds**: Set realistic thresholds based on actual API performance

### 2. Alert Configuration

- **Email Limits**: Be mindful of email quotas when using free email services
- **Recovery Alerts**: Enable recovery notifications to know when issues are resolved
- **Webhook Redundancy**: Use multiple notification channels for critical services

### 3. Status Page Setup

- **Service Grouping**: Use meaningful names and descriptions for public monitors
- **Incident Communication**: Create incidents for planned maintenance or known issues
- **Uptime Transparency**: Be transparent about service availability

### 4. Monitoring Strategy

- **Health Check Endpoints**: Create dedicated `/health` endpoints that check database connectivity, external dependencies, etc.
- **Synthetic Monitoring**: Monitor critical user journeys, not just simple ping endpoints
- **Geographic Distribution**: Consider monitoring from multiple locations (future enhancement)

## Customization Options

### 1. Alert Templates

You can customize email templates in `services/EmailService.js`:

- Modify HTML styling
- Add company branding
- Include additional metrics

### 2. Status Page Branding

Update `PublicStatusPage.css` to match your brand:

- Color scheme
- Logo placement
- Typography

### 3. Additional Notification Channels

Extend the monitoring service to support:

- Discord webhooks
- Telegram bots
- SMS alerts (via Twilio)
- PagerDuty integration

### 4. Advanced Monitoring

Consider adding:

- SSL certificate monitoring
- Domain expiration checks
- Database connection monitoring
- Third-party API dependency monitoring

## Troubleshooting

### Common Issues

1. **Email not sending**: Check EMAIL\_\* environment variables and Gmail app password
2. **Monitors not running**: Verify MonitoringService.start() is called in server.js
3. **Database errors**: Ensure MongoDB is running and MONGODB_URI is correct
4. **Socket updates not working**: Check WebSocket connection in browser dev tools

### Debug Commands

```javascript
// Check monitoring service status
GET /api/monitoring/service/status

// Test email configuration
POST /api/monitoring/test-email
{
  "email": "test@example.com"
}

// Manual health check
POST /api/monitoring/:monitorId/check
```

## Future Enhancements

Potential improvements you could add:

- Multi-location monitoring
- Custom alerting rules
- Advanced analytics and reporting
- API performance trends
- SLA tracking
- Maintenance mode scheduling
- Team collaboration features

Your monitoring system is now fully integrated and ready to use! The combination of automated health checks, email alerts, and public status pages provides a professional monitoring solution for your API infrastructure.
