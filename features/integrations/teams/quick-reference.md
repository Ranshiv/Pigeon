# Teams Webhook Quick Reference Card

## ⚠️ Account Type Check First!

**❗ CRITICAL**: Only **Microsoft Teams (work/school)** supports connectors

- ✅ Work/school account: Has organization name/logo
- ❌ Communities/personal account: Generic "Teams" branding - **No connectors!**

**Using Communities?** → Switch to work/school account or use email integration

## 🚀 Quick Setup (5 Minutes)

### 1️⃣ Open Teams Channel

- **❗ IMPORTANT**: Go to a specific channel (NOT Teams settings!)
- Choose or create a channel for alerts
- Click **⋯** menu next to channel name

### 2️⃣ Add Incoming Webhook

- Click **"Connectors"** (won't show if using Communities account!)
- Search for **"Incoming Webhook"**
- Click **"Configure"**

### 3️⃣ Configure Webhook

- **Name**: `Pigeon Monitoring Alerts`
- **Image**: Optional custom icon
- Click **"Create"**

### 4️⃣ Copy Webhook URL

- Copy the **full URL** (very long!)
- Format: `https://tenant.webhook.office.com/webhookb2/...`
- Keep it secure and private

### 5️⃣ Test in Pigeon

1. Configure the webhook URL in Pigeon's integration settings
2. Create a test monitor that will trigger alerts
3. Verify messages appear in your Teams channel

---

## 🔗 URL Format Example

```
https://contoso.webhook.office.com/webhookb2/12345678-1234-1234-1234-123456789abc/IncomingWebhook/abcdef12345/67890abcdef
```

## ⚠️ Common Issues

- **No "Connectors" option**: ❗ Make sure you're in a CHANNEL, not Teams Settings!
- **Can't configure**: Contact Teams admin
- **URL not working**: Verify complete URL copied
- **No messages**: Check correct channel

## 🔧 Testing Your Webhook

Use curl or PowerShell to test your webhook:

```bash
# curl test
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message from Pigeon setup"}'

# PowerShell test
Invoke-RestMethod -Uri "YOUR_WEBHOOK_URL" -Method Post \
  -Body '{"text": "Test message from Pigeon setup"}' \
  -ContentType "application/json"
```

## 📚 Full Guides

- **Detailed Setup**: `webhook-setup.md`
- **Integration Guide**: `README.md`
- **Missing Connectors**: `troubleshooting-connectors.md`
- **405 Error Guide**: `troubleshooting-405-error.md`

---

**Need help?** See the detailed guides above for step-by-step instructions
