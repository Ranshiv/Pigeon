# Integrations Feature

## Overview

The Integrations feature allows Pigeon to connect with external services for notifications, ticket creation, and workflow automation. This enables seamless integration of monitoring alerts into your existing team workflows.

## Available Integrations

### 📧 [Email Integration](./email/)

Send monitoring alerts via email with smart SMTP configuration and auto-detection.

**Features:**

- Automatic SMTP provider detection
- Gmail/Outlook support with app passwords
- HTML and text email templates
- Configurable alert types

### 💬 [Microsoft Teams Integration](./teams/)

Send alerts to Microsoft Teams channels using incoming webhooks.

**Features:**

- Rich message cards with color coding
- Direct links to monitoring dashboard
- Multiple alert types support
- Comprehensive troubleshooting guides

### 🎫 [Jira Integration](./jira/)

Automatically create Jira tickets when monitors fail.

**Features:**

- Automatic ticket creation on failures
- Configurable project and issue types
- Custom field mapping
- Priority-based ticket creation

## Integration Types

### Notification Integrations

- **Email** - Direct email notifications
- **Microsoft Teams** - Teams channel notifications
- **Slack** - Slack channel notifications (planned)
- **Discord** - Discord webhook notifications (planned)

### Ticketing Integrations

- **Jira** - Automatic ticket creation
- **ServiceNow** - Service request creation (planned)
- **GitHub Issues** - Issue creation (planned)

### Incident Management

- **PagerDuty** - Incident escalation (planned)
- **Opsgenie** - Alert management (planned)

## Getting Started

1. **Choose your integration type** based on your team's workflow
2. **Configure credentials** for the external service
3. **Test the integration** using provided test scripts
4. **Set up monitoring rules** to trigger alerts
5. **Monitor integration health** through the dashboard

## Integration Architecture

```
Pigeon Monitor → Alert Trigger → Integration Service → External Service
     ↓              ↓                    ↓               ↓
  Health Check   Alert Type        Format Message   Deliver Alert
```

### Integration Service

All integrations are managed through the `IntegrationService` class which provides:

- Unified API for all integration types
- Retry logic and error handling
- Configuration validation
- Test mode support

### Configuration Management

Integrations are stored securely with:

- Encrypted sensitive data (API tokens, passwords)
- User-specific configurations
- Team-level sharing options
- Audit logging

## Best Practices

### Security

- **Secure credentials** - Use environment variables for sensitive data
- **Rotate tokens** - Regularly update API tokens and passwords
- **Principle of least privilege** - Grant minimal required permissions
- **Audit access** - Monitor integration usage and access

### Configuration

- **Test before deploy** - Always test integrations before production use
- **Document settings** - Keep integration configurations documented
- **Monitor health** - Set up alerts for integration failures
- **Use descriptive names** - Name integrations clearly for easy identification

### Alert Management

- **Avoid spam** - Configure appropriate alert thresholds
- **Prioritize alerts** - Use different integration types for different severity levels
- **Group related alerts** - Consider using channels or labels for organization
- **Monitor integration performance** - Track delivery success rates

## API Reference

### Integration Model

```javascript
{
  _id: ObjectId,
  name: String,           // User-friendly name
  type: String,           // 'email', 'teams', 'jira', etc.
  configuration: Object,  // Integration-specific settings
  enabled: Boolean,       // Whether integration is active
  userId: ObjectId,       // Owner of the integration
  errorCount: Number,     // Failed delivery count
  lastUsed: Date,         // Last successful use
  lastError: Object       // Last error details
}
```

### Integration Service API

```javascript
// Send alert via integration
await integrationService.sendAlert(integration, alertData);

// Test integration connectivity
await integrationService.validateIntegrationConfiguration(integration);

// Send with retry logic
await integrationService.sendAlertWithRetry(integration, alertData);
```

## Testing

Each integration includes comprehensive testing tools:

### Test Scripts

- `test-teams-integration.js` - Teams webhook testing
- `test-jira-integration.js` - Jira API testing
- `test-email-integration.js` - Email delivery testing

### Testing Modes

- **Test Mode** - No actual external calls, validation only
- **Live Mode** - Real integration testing with external services
- **Debug Mode** - Detailed logging and error information

## Troubleshooting

### Common Issues

1. **Authentication failures** - Check credentials and API tokens
2. **Network connectivity** - Verify firewall and proxy settings
3. **Configuration errors** - Validate required fields and formats
4. **Rate limiting** - Monitor API usage and implement delays

### Debug Process

1. **Check integration status** in the dashboard
2. **Review error logs** for specific failure details
3. **Test connectivity** using provided test scripts
4. **Validate configuration** against service requirements
5. **Contact support** with detailed error information

## Support

### Documentation

- [Email Integration Guide](./email/README.md)
- [Teams Integration Guide](./teams/README.md)
- [Jira Integration Guide](./jira/README.md)

### Test Scripts

- Located in the root directory
- Run with `node test-[integration]-integration.js`
- Include help options with `--help`

### Community

- GitHub Issues for bug reports
- Discussion forums for questions
- Feature requests through GitHub

---

**Ready to integrate?** Choose your integration type above and follow the detailed setup guides!
