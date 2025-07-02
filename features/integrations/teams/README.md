# Microsoft Teams Integration Guide

This guide provides comprehensive instructions for setting up, configuring, and troubleshooting Microsoft Teams integration with Pigeon monitoring system.

## ⚠️ CRITICAL: Account Type Requirement

**❗ IMPORTANT**: Microsoft Teams connectors are **only available** in:

- ✅ **Microsoft Teams (work or school)** - Business/organizational accounts
- ❌ **Microsoft Teams Communities (personal)** - Personal/free accounts **DO NOT** support connectors

**Quick Check**:

- **Work/School**: You see your organization name/logo in Teams
- **Communities/Personal**: You see generic "Microsoft Teams" branding

**If you have a Communities/personal account**: You'll need to either:

1. Switch to a work/school Teams account
2. Use Pigeon's email integration instead
3. Use Slack integration if available

## Table of Contents

1. [Overview](#overview)
2. [Setting Up Teams Webhook](#setting-up-teams-webhook)
3. [Configuration](#configuration)
4. [Testing](#testing)
5. [Message Format](#message-format)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Overview

The Microsoft Teams integration allows Pigeon to send monitoring alerts directly to your Teams channels using incoming webhooks. When a monitor fails, recovers, or responds slowly, you'll receive formatted notifications in your designated Teams channel.

### Features

- **Real-time alerts**: Immediate notifications for monitor status changes
- **Rich formatting**: Color-coded message cards with detailed information
- **Multiple alert types**: Failure, recovery, and slow response notifications
- **Action buttons**: Direct links to view monitor details in Pigeon
- **Customizable**: Configure message prefixes and channel targeting

## Setting Up Teams Webhook

### Prerequisites

- Microsoft Teams (work or school account) - ❗ Personal/Communities accounts don't support connectors
- Access to the Teams channel where you want alerts
- Permission to add connectors to the channel

### Step 1: Navigate to Your Teams Channel

1. Open Microsoft Teams in your browser or desktop app
2. Navigate to the channel where you want to receive Pigeon alerts
3. **❗ IMPORTANT**: Make sure you're in a **standard channel** (not private or shared)
4. Click the **"..."** (more options) menu next to the channel name

### Step 2: Add Incoming Webhook Connector

1. Select **"Connectors"** from the dropdown menu
   - **Can't find "Connectors"?** → See [troubleshooting guide](./TEAMS_CONNECTORS_MISSING_TROUBLESHOOTING.md)
2. In the connectors gallery, search for **"Incoming Webhook"**
3. Click **"Configure"** next to the Incoming Webhook option

### Step 3: Configure the Webhook

1. **Name**: Enter a descriptive name (e.g., "Pigeon Monitoring Alerts")
2. **Image**: Optionally upload a custom icon for your alerts
3. Click **"Create"** to generate the webhook

### Step 4: Copy the Webhook URL

1. Teams will display a unique webhook URL
2. **Copy this URL completely** - you'll need it for Pigeon configuration
3. Click **"Done"** to complete the setup

**Expected URL format:**

```
https://your-tenant.webhook.office.com/webhookb2/xxxxx-xxxx-xxxx-xxxx/IncomingWebhook/yyyy/zzzz
```

## Configuration

### In Pigeon Web Interface

1. Navigate to **Settings > Integrations**
2. Click **"Add Integration"**
3. Select **"Microsoft Teams"**
4. Fill in the configuration:

| Field                    | Description                       | Required | Example                                 |
| ------------------------ | --------------------------------- | -------- | --------------------------------------- |
| **Name**                 | Display name for this integration | Yes      | `Production Alerts - Teams`             |
| **Webhook URL**          | The URL from Teams setup          | Yes      | `https://tenant.webhook.office.com/...` |
| **Message Title Prefix** | Prefix for alert messages         | No       | `[PROD]` or `[ALERT]`                   |

5. Click **"Test Integration"** to verify the setup
6. Click **"Save"** to enable the integration

### Via API

```bash
POST /api/integrations
Content-Type: application/json

{
  "type": "teams",
  "name": "Production Teams Alerts",
  "enabled": true,
  "configuration": {
    "webhookUrl": "https://your-tenant.webhook.office.com/webhookb2/...",
    "titlePrefix": "[PROD]"
  }
}
```

## Testing

### Using the Test Script

Run the comprehensive Teams integration test:

```bash
# Basic test (no actual webhook calls)
node test-teams-integration.js --test-mode

# Test with your actual webhook URL
node test-teams-integration.js --webhook-url="https://your-tenant.webhook.office.com/..."

# Quick format test only
node test-teams-integration.js --quick

# Debug mode for troubleshooting
node test-teams-integration.js --webhook-url="..." --debug
```

### Manual Testing

1. Go to **Settings > Integrations**
2. Find your Teams integration
3. Click the **"Test"** button
4. Check your Teams channel for the test message

### Expected Test Message

You should see a message card in Teams with:

- Pigeon logo/icon
- "Integration Test" title
- Current timestamp
- Test status information

## Message Format

Pigeon sends rich message cards to Teams with the following structure:

### Failure Alert

```
🔴 Monitor Alert: API Health Check
Monitor is DOWN

URL: https://api.example.com/health
Status: DOWN
Response Time: -
Time: 2024-01-15T10:30:00.000Z
Error: Connection timeout after 30 seconds

[View Monitor] (button)
```

### Recovery Alert

```
🟢 Monitor Alert: API Health Check
Monitor has RECOVERED

URL: https://api.example.com/health
Status: UP
Response Time: 245ms
Time: 2024-01-15T10:35:00.000Z

[View Monitor] (button)
```

### Slow Response Alert

```
🟡 Monitor Alert: API Health Check
Monitor is responding slowly

URL: https://api.example.com/health
Status: UP
Response Time: 5200ms
Time: 2024-01-15T10:32:00.000Z

[View Monitor] (button)
```

### Color Coding

- **Red (DC3545)**: Failure alerts
- **Green (28A745)**: Recovery alerts
- **Yellow (FFC107)**: Slow response alerts
- **Blue (17A2B8)**: General/test messages

## Troubleshooting

### Common Issues

#### 1. "Invalid Teams webhook URL format" Error

**Problem**: The webhook URL doesn't match the expected Teams format.

**Solution**:

- Ensure the URL starts with `https://`
- Verify it contains `.webhook.office.com`
- Make sure you copied the complete URL from Teams
- Example: `https://tenant.webhook.office.com/webhookb2/...`

#### 2. "Webhook URL not found" Error

**Problem**: The webhook URL returns a 404 error.

**Solutions**:

- **Recreate the webhook**: The webhook may have been deleted in Teams
- **Check channel permissions**: Ensure the channel still exists and you have access
- **Verify URL**: Make sure you didn't accidentally modify the URL

#### 3. "Connection refused" Error

**Problem**: Network connectivity issues.

**Solutions**:

- Check your internet connection
- Verify firewall settings allow outbound HTTPS requests
- Test connectivity: `curl -X POST "YOUR_WEBHOOK_URL" -H "Content-Type: application/json" -d "{}"`

#### 4. Messages Not Appearing in Teams

**Problem**: No error, but messages don't show in Teams.

**Solutions**:

- Check the correct channel (webhook is channel-specific)
- Verify the webhook hasn't been disabled in Teams
- Look for messages in the channel's activity feed
- Test with a simple message first

#### 5. "Request timeout" Error

**Problem**: Requests to Teams are timing out.

**Solutions**:

- Check Microsoft Teams service status
- Verify network stability
- Increase timeout in configuration if possible
- Try during off-peak hours

### Debug Mode

Enable debug mode for detailed error information:

```bash
node test-teams-integration.js --webhook-url="..." --debug
```

This will show:

- Full error stack traces
- Request/response details
- Network connectivity information
- Service validation results

### Validation Checklist

Before contacting support, verify:

- [ ] Webhook URL is valid and complete
- [ ] Teams channel exists and is accessible
- [ ] Network connectivity allows HTTPS requests
- [ ] Integration is enabled in Pigeon
- [ ] Monitor is properly configured and active
- [ ] No firewall blocking outbound requests

## Best Practices

### Channel Setup

1. **Dedicated Channel**: Create a dedicated channel for monitoring alerts
2. **Channel Naming**: Use clear names like `#monitoring-alerts` or `#pigeon-notifications`
3. **Permissions**: Ensure relevant team members have access to the channel
4. **Notifications**: Configure Teams notification preferences for the channel

### Message Management

1. **Title Prefixes**: Use prefixes to categorize alerts (`[PROD]`, `[STAGING]`, `[DEV]`)
2. **Monitor Naming**: Use descriptive monitor names that are clear in Teams
3. **Alert Frequency**: Configure appropriate check intervals to avoid spam
4. **Maintenance Windows**: Use Pigeon's maintenance windows during planned outages

### Security

1. **Webhook URL Security**: Keep webhook URLs confidential
2. **Channel Access**: Limit channel access to relevant team members
3. **Regular Review**: Periodically review and update webhook configurations
4. **Backup Channels**: Consider multiple channels for critical alerts

### Performance

1. **Monitor Selection**: Only enable Teams integration for critical monitors
2. **Batch Alerts**: Group related alerts when possible
3. **Alert Escalation**: Use Pigeon's escalation features for critical issues
4. **Response Time**: Set reasonable thresholds for slow response alerts

## Advanced Configuration

### Multiple Teams Integrations

You can configure multiple Teams integrations for different purposes:

```javascript
// Production alerts
{
  "name": "Production Alerts",
  "type": "teams",
  "configuration": {
    "webhookUrl": "https://tenant.webhook.office.com/prod/...",
    "titlePrefix": "[PROD]"
  }
}

// Development alerts
{
  "name": "Development Alerts",
  "type": "teams",
  "configuration": {
    "webhookUrl": "https://tenant.webhook.office.com/dev/...",
    "titlePrefix": "[DEV]"
  }
}
```

### Environment Variables

For automated deployments, you can use environment variables:

```bash
TEAMS_WEBHOOK_URL=https://tenant.webhook.office.com/...
TEAMS_TITLE_PREFIX=[PROD]
```

## API Reference

### Create Teams Integration

```http
POST /api/integrations
Content-Type: application/json

{
  "type": "teams",
  "name": "string",
  "enabled": boolean,
  "configuration": {
    "webhookUrl": "string (required)",
    "titlePrefix": "string (optional)"
  }
}
```

### Update Teams Integration

```http
PUT /api/integrations/:id
Content-Type: application/json

{
  "configuration": {
    "webhookUrl": "string",
    "titlePrefix": "string"
  }
}
```

### Test Teams Integration

```http
POST /api/integrations/:id/test
```

## Support

If you continue to experience issues:

1. **Check Service Status**: Verify Microsoft Teams service status
2. **Run Diagnostics**: Use the test script with `--debug` flag
3. **Check Logs**: Review Pigeon server logs for detailed error messages
4. **Contact Support**: Provide webhook URL format and error messages (without exposing the actual URL)

For additional help, include:

- Pigeon version
- Error messages (without sensitive information)
- Test script output
- Network configuration details

---

**Need Help?** Check the [Troubleshooting](#troubleshooting) section or run the diagnostic test script included with Pigeon.
