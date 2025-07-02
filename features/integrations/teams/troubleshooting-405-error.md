# Teams Webhook 405 Error - Troubleshooting Guide

## 🚨 Error: "405 Method Not Allowed"

If you're seeing this error when testing your Teams integration:

```
Error testing integration: Error: Webhook error: 405 Method Not Allowed
```

This means the Teams webhook endpoint is rejecting the POST request. Here's how to fix it:

## 🔍 Common Causes & Solutions

### 1. **Invalid Webhook URL Format** (Most Common)

**Problem**: The webhook URL is malformed or incomplete.

**Check your URL format**:

```
✅ Correct: https://tenant.webhook.office.com/webhookb2/12345678-1234-1234-1234-123456789abc/IncomingWebhook/abcdef12345/67890abcdef

❌ Wrong: https://teams.microsoft.com/l/channel/...
❌ Wrong: https://tenant.webhook.office.com/webhook/...
❌ Wrong: https://webhook.office.com/webhookb2/... (missing tenant)
```

**Solution**:

- Verify your URL contains all required components:
  - `https://[tenant].webhook.office.com`
  - `/webhookb2/`
  - `/IncomingWebhook/`
  - Two UUID-like identifiers

### 2. **Webhook Has Been Deleted**

**Problem**: The webhook was deleted in Teams but you're still using the old URL.

**Solution**:

1. Go to your Teams channel
2. Click **⋯** → **Connectors**
3. Check if your webhook still exists
4. If not, create a new one and update Pigeon with the new URL

### 3. **Wrong URL Type**

**Problem**: You copied a Teams channel URL instead of a webhook URL.

**Symptoms**:

- URL contains `teams.microsoft.com`
- URL looks like: `https://teams.microsoft.com/l/channel/...`

**Solution**:

- This is not a webhook URL!
- Follow the webhook setup guide to create a proper Incoming Webhook

### 4. **Incomplete URL Copy**

**Problem**: You didn't copy the complete webhook URL (they're very long).

**Solution**:

- Webhook URLs are typically 200+ characters long
- Make sure you copied the entire URL from Teams
- Check for line breaks or truncation

## 🔧 Diagnostic Steps

### Step 1: Validate URL Format

Run the diagnostic test:

```bash
node test-teams-integration.js --webhook-url="YOUR_URL" --debug
```

### Step 2: Test with curl

Test the webhook directly:

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'
```

**Expected responses**:

- ✅ Success: `1` (just the number 1)
- ❌ 405 Error: `Method not allowed` or HTML error page

### Step 3: Check Teams Channel

1. Go to your Teams channel
2. Click **⋯** → **Connectors**
3. Look for your webhook under "Configured"
4. If missing, it was deleted - create a new one

### Step 4: Recreate Webhook

If validation fails or webhook is missing:

1. Delete the old webhook (if it exists)
2. Follow the [webhook setup guide](TEAMS_WEBHOOK_SETUP_GUIDE.md)
3. Copy the new URL completely
4. Update Pigeon configuration

## 🎯 Quick Fixes

### Fix 1: URL Format Check

```javascript
// Your URL should match this pattern:
const validPattern =
  /^https:\/\/[^.]+\.webhook\.office\.com\/webhookb2\/.+\/IncomingWebhook\/.+/;

// Test your URL:
console.log(validPattern.test("YOUR_WEBHOOK_URL"));
```

### Fix 2: Create New Webhook

1. **Teams** → **Channel** → **⋯** → **Connectors**
2. **Incoming Webhook** → **Configure**
3. **Name**: `Pigeon Alerts` → **Create**
4. **Copy** the complete URL
5. **Update** Pigeon integration

### Fix 3: Test Before Using

```bash
# Always test new webhooks first:
curl -X POST "NEW_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "✅ Webhook is working!"}'
```

## 🚫 What NOT to Do

- ❌ Don't use Teams channel URLs (`teams.microsoft.com`)
- ❌ Don't manually edit webhook URLs
- ❌ Don't use old/deleted webhook URLs
- ❌ Don't copy partial URLs
- ❌ Don't use webhooks from other channels/tenants

## ✅ Verification Checklist

Before using the webhook in Pigeon:

- [ ] URL starts with `https://[tenant].webhook.office.com`
- [ ] URL contains `/webhookb2/`
- [ ] URL contains `/IncomingWebhook/`
- [ ] URL is 200+ characters long
- [ ] Webhook exists in Teams Connectors
- [ ] curl test returns `1` (success)
- [ ] No 405 errors in testing

## 🔄 Still Getting 405 Errors?

If you've verified everything above and still get 405 errors:

1. **Check Organization Policies**:

   - Your IT admin may have disabled webhooks
   - Contact Teams administrator

2. **Try Different Channel**:

   - Some channels may have restrictions
   - Test with a channel you own/admin

3. **Recreate Webhook**:

   - Delete and recreate the webhook
   - Sometimes webhooks get corrupted

4. **Check Teams Status**:
   - Visit [Microsoft 365 Status](https://status.office365.com/)
   - Teams webhook service may be down

## 📞 Need Help?

Run the diagnostic script for detailed analysis:

```bash
node test-teams-integration.js --webhook-url="YOUR_URL" --debug
```

This will provide specific guidance for your URL and error type.

---

**💡 Pro Tip**: Always test webhooks with curl before using them in Pigeon to catch URL issues early!
