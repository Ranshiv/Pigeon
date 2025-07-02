# 🎫 Jira Integration Testing Guide

## 🎯 Overview

This guide helps you test and set up Jira integration in Pigeon to automatically create tickets when monitors fail.

## 🧪 Testing Options

### Option 1: Manual Web Interface Testing

1. Open `http://localhost:5001`
2. Log in with your account
3. Go to Integrations → Add Integration → Jira
4. Fill in your details and test

### Option 2: Command Line Testing

```bash
# Test basic connectivity
curl -I https://your-company.atlassian.net

# Test authentication
curl -u "your-email@company.com:your-api-token" \
  https://your-company.atlassian.net/rest/api/2/myself
```

## 📋 Prerequisites

### 1. 🌐 Jira Instance

- **Jira Cloud**: `https://your-company.atlassian.net`
- **Jira Server**: `https://jira.your-company.com`
- **Jira Data Center**: Your organization's URL

### 2. 🔑 API Token (Required for Jira Cloud)

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Label: "Pigeon Monitoring"
4. Copy the token (you won't see it again!)

### 3. 📋 Project Information

- **Project Key**: Short code (e.g., "PROJ", "DEV", "BUG")
- **Issue Type**: Valid type in your project (e.g., "Bug", "Task", "Story")
- **Permissions**: You must be able to create issues in the project

## 🔧 Configuration

### Required Fields

```javascript
{
  "name": "Production Jira Alerts",
  "type": "jira",
  "configuration": {
    "baseUrl": "https://your-company.atlassian.net",  // Your Jira URL
    "username": "your-email@company.com",             // Your Jira email
    "apiToken": "ATATT3xFfGF0...",                    // Your API token
    "projectKey": "PROJ",                             // Project key
    "issueType": "Bug"                                // Issue type
  }
}
```

### Finding Your Project Key

1. Go to your Jira project
2. Look at the URL: `/projects/PROJ/` ← "PROJ" is your key
3. Or check Project Settings → Details

### Valid Issue Types

Common issue types:

- **Bug** - For system failures
- **Task** - For maintenance items
- **Story** - For feature requests
- **Incident** - For urgent issues
- **Epic** - For large initiatives

## 🧪 Step-by-Step Testing

### Step 1: Basic Connectivity Test

```bash
# Test if your Jira instance is reachable
curl -I https://your-company.atlassian.net

# Should return: HTTP/2 200
```

### Step 2: API Authentication Test

```bash
# Test API token (replace with your details)
curl -X GET \
  -H "Authorization: Basic $(echo -n 'your-email:your-api-token' | base64)" \
  https://your-company.atlassian.net/rest/api/2/myself
```

### Step 3: Project Access Test

```bash
# Test project access (replace PROJ with your project key)
curl -X GET \
  -H "Authorization: Basic $(echo -n 'your-email:your-api-token' | base64)" \
  https://your-company.atlassian.net/rest/api/2/project/PROJ
```

### Step 4: Pigeon Integration Test

1. **Create Integration**:

   ```bash
   node test-jira-integration.js
   ```

2. **Manual Test in UI**:

   - Go to http://localhost:5001
   - Integrations → Add Integration → Jira
   - Fill in your details
   - Click "Test Integration"

3. **Verify Test Ticket**:
   - Check your Jira project
   - Look for ticket: "Monitor Alert: Test Monitor is down"

## 🎫 What Happens When Alerts Trigger

### Alert Ticket Content

```
Summary: Monitor Alert: Production Website is down
Description:
Monitor: Production Website
URL: https://example.com
Status: down
Response Time: timeout
Error: Connection refused
Time: 2025-07-01T14:30:00Z

Labels: monitoring, automated, monitor-abc123
Priority: High (based on alert type)
Issue Type: Bug (as configured)
```

### Ticket Creation Rules

- ✅ **Failures**: Creates new tickets
- ❌ **Recoveries**: No tickets created (avoids spam)
- 🔄 **Repeated Failures**: May create multiple tickets

## 🔧 Troubleshooting

### Common Issues

#### 401 Unauthorized

```
❌ Error: Jira API error: 401 Unauthorized
```

**Solutions**:

- Check your email/username is correct
- Verify API token is valid and not expired
- Ensure you're using email (not username) for Jira Cloud

#### 404 Not Found

```
❌ Error: Jira API error: 404 Not Found
```

**Solutions**:

- Verify Jira base URL is correct
- Check project key exists and you have access
- Ensure URL includes protocol (https://)

#### 400 Bad Request

```
❌ Error: Jira API error: 400 Bad Request
```

**Solutions**:

- Check issue type is valid for your project
- Verify all required fields are provided
- Check project key format (usually uppercase)

#### Network Issues

```
❌ Error: fetch failed
```

**Solutions**:

- Check internet connection
- Verify Jira instance is accessible
- Check for firewall/proxy issues

### Debug Tips

1. **Enable Logging**:

   - Check server console for detailed error messages
   - Look for "Jira API error" logs

2. **Test Components Separately**:

   - Test Jira URL in browser first
   - Verify API token with curl command
   - Check project access before integration

3. **Validate Configuration**:
   ```javascript
   // Use the validation function
   const errors = validateJiraConfig(config);
   console.log("Config errors:", errors);
   ```

## 🎯 Best Practices

### Security

- 🔐 **Keep API tokens secret** - Never commit to code
- 🔄 **Rotate tokens regularly** - Generate new ones periodically
- 🎯 **Use specific permissions** - Limit token scope if possible
- 📁 **Separate environments** - Different tokens for dev/prod

### Configuration

- 📝 **Use descriptive names** - "Production Alerts", "Dev Environment"
- 🎫 **Choose appropriate issue types** - "Bug" for failures, "Task" for maintenance
- 🏷️ **Leverage labels** - Helps organize and filter tickets
- ⚠️ **Set appropriate priorities** - Critical for urgent issues

### Monitoring

- 📊 **Monitor integration health** - Check for failed deliveries
- 🎯 **Avoid ticket spam** - Configure alerts appropriately
- 🔍 **Review created tickets** - Ensure they're useful and actionable

## 📚 Additional Resources

### Jira API Documentation

- [Jira REST API v2](https://developer.atlassian.com/cloud/jira/platform/rest/v2/)
- [API Tokens](https://confluence.atlassian.com/cloud/api-tokens-938839638.html)
- [Issue Creation](https://developer.atlassian.com/cloud/jira/platform/rest/v2/api-group-issues/#api-rest-api-2-issue-post)

### Pigeon Integration Docs

- [Integration Management](./client/src/components/IntegrationsManagement.js)
- [Integration Service](./services/IntegrationService.js)
- [Test Scripts](./test-jira-integration.js)

---

## ✅ Quick Start Checklist

- [ ] Have Jira Cloud/Server access
- [ ] Generated API token
- [ ] Know your project key
- [ ] Identified valid issue type
- [ ] Tested API connectivity
- [ ] Created Pigeon integration
- [ ] Verified test ticket creation
- [ ] Configured monitor alerts

🎉 **Ready to go!** Your Jira integration will now create tickets automatically when monitors fail.
