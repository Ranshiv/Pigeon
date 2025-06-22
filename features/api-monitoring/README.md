# API Monitoring & Status Pages

This document describes the API monitoring, alerting, and status page features added to Pigeon.

## Features Overview

### 1. API Monitoring

- **Automated Health Checks**: Schedule periodic health checks for your APIs
- **Configurable Intervals**: Set check intervals from 1 minute to any custom duration
- **Multiple HTTP Methods**: Support for GET, POST, PUT, DELETE, PATCH, HEAD
- **Custom Headers & Body**: Include authentication headers and request bodies
- **Response Validation**: Check status codes and response times
- **Historical Data**: Store and analyze health check history

### 2. Alerting System

- **Email Notifications**: Get notified when APIs go down or recover
- **Webhook Integration**: Send alerts to custom webhooks
- **Slack Integration**: Direct alerts to Slack channels
- **Configurable Triggers**: Alert on failures, slow responses, or recovery
- **Alert Rate Limiting**: Prevent spam during prolonged outages

### 3. Status Pages

- **Public Status Dashboard**: Share real-time API status with your users
- **Private Monitoring Dashboard**: Manage all your monitors in one place
- **Real-time Updates**: Live status updates via WebSocket
- **Uptime Statistics**: Display uptime percentages and response times
- **Historical Charts**: Visualize performance trends over time

## Quick Start

### 1. Install Dependencies

```bash
npm install node-cron nodemailer
```

### 2. Configure Environment Variables

Copy the example environment file and configure your email settings:

```bash
cp .env.monitoring.example .env
```

Edit `.env` and add your email configuration:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
FRONTEND_URL=http://localhost:3000
```

### 3. Start the Server

The monitoring service will automatically start when you run the server:

```bash
npm start
```

### 4. Create Your First Monitor

1. Navigate to `/monitoring` in your frontend
2. Click "Add Monitor"
3. Configure your API endpoint
4. Set check interval and alert preferences
5. Save and start monitoring

## API Endpoints

### Monitors Management

- `GET /api/monitoring` - Get all monitors for authenticated user
- `POST /api/monitoring` - Create a new monitor
- `GET /api/monitoring/:id` - Get specific monitor details
- `PUT /api/monitoring/:id` - Update monitor configuration
- `DELETE /api/monitoring/:id` - Delete monitor

### Health Checks

- `GET /api/monitoring/:id/history` - Get health check history
- `GET /api/monitoring/:id/stats` - Get monitor statistics
- `POST /api/monitoring/:id/check` - Run manual health check

### Public Status

- `GET /api/monitoring/public/status` - Get public status page data

### Utilities

- `POST /api/monitoring/test-email` - Test email configuration
- `GET /api/monitoring/service/status` - Get monitoring service status

## Monitor Configuration

### Basic Settings

```javascript
{
  "name": "My API",
  "url": "https://api.example.com/health",
  "method": "GET",
  "interval": 5, // minutes
  "expectedStatusCode": 200,
  "expectedResponseTime": 5000, // milliseconds
  "isActive": true,
  "isPublic": false // Show on public status page
}
```

### Advanced Settings

```javascript
{
  "headers": [
    {
      "key": "Authorization",
      "value": "Bearer {{token}}"
    },
    {
      "key": "Content-Type",
      "value": "application/json"
    }
  ],
  "body": "{\"healthcheck\": true}",
  "tags": ["production", "critical"],
  "alertSettings": {
    "emailEnabled": true,
    "webhookUrl": "https://hooks.slack.com/...",
    "alertOnFailure": true,
    "alertOnSlowResponse": true,
    "alertOnRecovery": true
  }
}
```

## Email Configuration

### Gmail Setup

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password for Pigeon
3. Configure environment variables:

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-digit-app-password
```

### Other Email Providers

#### Outlook/Hotmail

```env
EMAIL_SERVICE=hotmail
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
```

#### Yahoo

```env
EMAIL_SERVICE=yahoo
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
```

#### Custom SMTP

```env
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_SECURE=true
EMAIL_USER=your-username
EMAIL_PASSWORD=your-password
```

## Webhook Integration

### Slack Webhooks

1. Create a Slack app and enable Incoming Webhooks
2. Copy the webhook URL
3. Add it to your monitor's `alertSettings.slackWebhook`

### Custom Webhooks

Pigeon sends POST requests to webhook URLs with this payload:

```javascript
{
  "type": "monitor_alert",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "monitor": {
    "id": "monitor_id",
    "name": "Monitor Name",
    "url": "https://api.example.com",
    "status": "down"
  },
  "healthCheck": {
    "status": "failure",
    "responseTime": 30000,
    "statusCode": 500,
    "errorMessage": "Internal Server Error"
  },
  "alertType": "failure"
}
```

## Frontend Integration

### Adding Routes

Add these routes to your React app:

```javascript
// In your main App.js or router configuration
import MonitoringDashboard from './components/monitoring/MonitoringDashboard';
import StatusPage from './components/monitoring/StatusPage';

// Add routes
<Route path="/monitoring" element={<MonitoringDashboard />} />
<Route path="/monitoring/status" element={<StatusPage />} />
```

### Navigation

Add monitoring links to your navigation:

```javascript
<nav>
  <Link to="/monitoring">Monitoring</Link>
  <Link to="/monitoring/status">Status</Link>
</nav>
```

## Best Practices

### Monitor Configuration

1. **Choose Appropriate Intervals**: Don't check too frequently (min 1 minute)
2. **Set Realistic Timeouts**: Allow enough time for normal response variations
3. **Use Health Check Endpoints**: Monitor dedicated health endpoints when available
4. **Tag Your Monitors**: Use tags to organize monitors by environment, criticality, etc.

### Alert Management

1. **Configure Alert Channels**: Set up multiple notification channels
2. **Use Recovery Alerts**: Know when services come back online
3. **Avoid Alert Fatigue**: Don't alert on every minor issue
4. **Test Alert Configurations**: Use the test email feature regularly

### Status Pages

1. **Keep It Simple**: Only show essential services on public pages
2. **Use Clear Names**: Make service names user-friendly
3. **Provide Context**: Add descriptions for what each service does
4. **Update Regularly**: Keep service information current

### Security

1. **Protect Sensitive Data**: Be careful with API keys in headers
2. **Use Environment Variables**: Don't hardcode credentials
3. **Limit Public Exposure**: Only make necessary monitors public
4. **Monitor the Monitors**: Set up alerts for the monitoring system itself

## Troubleshooting

### Common Issues

#### Email Not Sending

- Check email credentials and app passwords
- Verify EMAIL_SERVICE setting matches your provider
- Test with the `/api/monitoring/test-email` endpoint

#### Health Checks Failing

- Verify URL accessibility from server
- Check for CORS or firewall issues
- Validate SSL certificates
- Test manually with curl or Postman

#### Status Page Not Loading

- Check if monitors are marked as `isPublic: true`
- Verify the public status endpoint is accessible
- Check browser console for errors

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=pigeon:monitoring
```

### Service Status

Check monitoring service status:

```bash
curl http://localhost:5001/api/monitoring/service/status
```

## Architecture

### Backend Components

- **Models**: `Monitor.js` and `HealthCheck.js` for data storage
- **Services**: `MonitoringService.js` for health check execution
- **Services**: `EmailService.js` for alert notifications
- **Routes**: `monitoring.js` for API endpoints
- **Scheduler**: Node-cron for automated checks

### Frontend Components

- **MonitoringDashboard**: Private dashboard for managing monitors
- **StatusPage**: Public status page for users
- **Real-time Updates**: Socket.io for live status updates

### Data Flow

1. **Monitor Creation**: User creates monitor via frontend
2. **Scheduling**: MonitoringService schedules health checks
3. **Execution**: Automated checks run at specified intervals
4. **Storage**: Results stored in HealthCheck collection
5. **Alerting**: Notifications sent based on configured rules
6. **Display**: Status shown on dashboard and public page

## Extending the System

### Adding New Alert Channels

1. Create a new method in `EmailService.js`
2. Add configuration to monitor `alertSettings`
3. Call the new method in `MonitoringService.js`

### Custom Health Check Logic

1. Extend the `performHealthCheck` method in `MonitoringService.js`
2. Add custom validation rules
3. Update the `determineStatus` method

### Advanced Reporting

1. Create new aggregation queries in the routes
2. Add statistical analysis endpoints
3. Implement trend detection algorithms

This monitoring system provides a solid foundation for API health monitoring and can be extended based on your specific needs.
