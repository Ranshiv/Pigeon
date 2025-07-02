# Step-by-Step Guide: Getting Microsoft Teams Webhook URL

This guide provides detailed, illustrated instructions for creating and obtaining a Microsoft Teams webhook URL for Pigeon integration.

## ⚠️ CRITICAL: Account Type Check

**❗ MOST IMPORTANT**: Connectors are **only available** in:

- ✅ **Microsoft Teams (work or school)** - Business/organizational accounts
- ❌ **Microsoft Teams Communities (personal)** - Personal/free accounts **DO NOT** support connectors

**Quick Check**:

- If you see your organization name/logo in Teams → ✅ You have work/school Teams
- If you see generic "Microsoft Teams" branding → ❌ You have Communities/personal Teams

**If you have Communities/personal Teams**: You'll need to switch to a work/school account or use alternative integrations (email, Slack, etc.).

## 📋 Prerequisites

Before starting, ensure you have:

- [ ] **Microsoft Teams (work or school account)** - ❗ Communities/personal accounts don't support connectors
- [ ] Access to the Teams channel where you want alerts
- [ ] Permission to add connectors to the channel
- [ ] Teams desktop app or web browser access

## 🎯 Step-by-Step Instructions

### Step 1: Open Microsoft Teams

1. **Launch Teams**: Open Microsoft Teams in your browser or desktop app
2. **Sign in**: Ensure you're logged into the correct account/tenant
3. **Navigate to workspace**: Go to the team/workspace containing your target channel
4. **❗ IMPORTANT**: You need to be in a **channel view**, not the Teams settings page

### Step 2: Select Your Channel

1. **🔍 Navigate to a Channel**: Click on any channel in the left sidebar

   - **NOT** in Teams Settings (gear icon) - that's the wrong place!
   - **NOT** in the main Teams dashboard
   - You need to be **inside a specific channel** (like #General, #Random, etc.)

2. **Choose the right channel**: Click on the channel where you want to receive Pigeon alerts

   - Common choices: `#alerts`, `#monitoring`, `#incidents`, `#general`
   - **Tip**: Create a dedicated channel like `#pigeon-alerts` for better organization

3. **Channel requirements**: Ensure the channel:
   - Exists and is accessible to you
   - Allows you to add connectors (admin permissions may be required)
   - Is appropriate for monitoring alerts (consider notification settings)

### Step 3: Access Channel Options

1. **🎯 You should be viewing the channel's conversation area** (not Teams settings!)

   - You'll see the channel name at the top
   - You'll see conversation messages (or "Start a conversation" if empty)
   - The left sidebar shows your teams and channels

2. **Find the channel menu**: Look for the **three dots (⋯)** next to the channel name

   - **Desktop app**: Right-click the channel name in the left sidebar OR click the ⋯ menu next to the channel name at the top
   - **Web browser**: Click the ⋯ menu next to the channel name at the top of the conversation area

3. **Open menu**: Click the **⋯** button to open the channel options menu

### Step 4: Navigate to Connectors

1. **Find Connectors**: In the dropdown menu, look for **"Connectors"**

   - If you don't see "Connectors", you may not have permission to add them
   - Contact your Teams administrator if the option is missing

2. **Click Connectors**: Select **"Connectors"** from the menu
   - This opens the Connectors gallery/marketplace

### Step 5: Find Incoming Webhook

1. **Search for webhook**: In the Connectors gallery:

   - Use the search box and type **"Incoming Webhook"**
   - OR scroll through the "All" category to find it
   - OR look in the "Productivity" category

2. **Locate the connector**: Find **"Incoming Webhook"** in the results

   - Icon: Usually shows an arrow or webhook symbol
   - Description: "Send data from external services"

3. **Click Configure**: Click the **"Configure"** button next to Incoming Webhook
   - If you see "Configured" instead, a webhook may already exist
   - You can add multiple webhooks to the same channel if needed

### Step 6: Configure the Webhook

1. **Name your webhook**: In the configuration dialog:

   - **Name**: Enter a descriptive name like:
     - `Pigeon Monitoring Alerts`
     - `Production Monitoring`
     - `API Health Alerts`
   - This name will appear in Teams messages

2. **Upload an image (Optional)**:

   - Click **"Upload Image"** to add a custom icon
   - Use your company logo, Pigeon logo, or monitoring icon
   - Supported formats: PNG, JPG, GIF
   - Recommended size: 64x64 pixels or larger

3. **Click Create**: Click the **"Create"** button to generate the webhook

### Step 7: Copy the Webhook URL

1. **Webhook created**: Teams will display a success message with your webhook URL

2. **Copy the URL**:

   - **IMPORTANT**: Copy the **entire URL** - it's usually very long
   - The URL format looks like:
     ```
     https://[tenant].webhook.office.com/webhookb2/[id1]/IncomingWebhook/[id2]/[id3]
     ```
   - Example:
     ```
     https://contoso.webhook.office.com/webhookb2/12345678-1234-1234-1234-123456789abc/IncomingWebhook/abcdef12345/67890abcdef
     ```

3. **Save securely**:

   - Copy to clipboard immediately
   - Paste into a secure notes app or password manager
   - **Never share this URL publicly** - it provides direct access to your channel

4. **Click Done**: Click **"Done"** to complete the webhook setup

### Step 8: Verify Webhook Creation

1. **Check channel**: Look in your Teams channel for a message like:

   ```
   [Your Name] added Pigeon Monitoring Alerts connector
   ```

2. **Webhook appears**: The webhook should now be visible in:
   - Channel settings → Connectors
   - Channel information panel

## 🔧 Testing Your Webhook URL

### Quick Test with curl

Once you have the URL, test it works:

```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    "summary": "Test Message",
    "text": "🧪 Testing webhook connectivity from Pigeon setup"
  }'
```

### Test with Pigeon Script

```bash
cd /path/to/pigeon
node test-teams-integration.js --webhook-url="YOUR_WEBHOOK_URL"
```

## ❌ Troubleshooting Common Issues

### Issue 1: "Connectors" Option Missing

**Problem**: Can't find Connectors in the channel menu

**❗ MOST COMMON CAUSE**: You're using **Microsoft Teams Communities** (personal account)!

**Critical Check**:

- **Microsoft Teams (work/school)**: ✅ Supports connectors
- **Microsoft Teams Communities (personal)**: ❌ No connector support

**How to identify your account type**:

1. Look at Teams interface - do you see your organization name/logo?
2. What email did you use to sign in? (company vs personal email)
3. Does Teams show company branding or generic "Microsoft Teams"?

**If you have Communities/personal account**:

- **Solution A**: Switch to Teams for work/school account
- **Solution B**: Use alternative integrations (email, Slack)
- **Solution C**: Contact your organization for business Teams access

**Other possible causes** (if you have work/school Teams):

1. **Wrong location in Teams**:

   - ❌ **NOT** in Teams Settings (gear icon) - this is global settings
   - ❌ **NOT** in the main Teams dashboard/home screen
   - ✅ **YES** - You need to be inside a specific channel conversation

2. **Channel type restrictions**:

   - ✅ Standard channels: Support connectors
   - ❌ Private channels: No connector support
   - ❌ Shared channels: No connector support

3. **Correct navigation**:

   - Click on a team in the left sidebar
   - Click on a channel within that team (like #General)
   - You should see the channel conversation area
   - Look for ⋯ menu next to the channel name at the top

4. **Permissions and policies**:
   - You may not have permission to manage connectors
   - Try a different channel where you have admin rights
   - Contact your Teams administrator
   - Organization may have disabled connectors entirely

### Issue 2: "Configure" Button Disabled

**Problem**: Cannot click Configure for Incoming Webhook

**Solutions**:

- Check if your organization allows webhook connectors
- Try from Teams desktop app instead of web browser
- Verify you're in the correct tenant/organization
- Contact IT administrator about connector policies

### Issue 3: Webhook URL Not Working

**Problem**: URL returns errors when tested

**Solutions**:

- Verify you copied the complete URL (they're very long)
- Check for extra spaces or line breaks in the URL
- Ensure the URL starts with `https://`
- Try recreating the webhook if it's been a while

### Issue 4: Messages Not Appearing

**Problem**: Webhook accepts requests but no messages show

**Solutions**:

- Check you're looking in the correct channel
- Verify the webhook hasn't been disabled
- Look in channel activity/history
- Try sending a simple test message first

## 🔐 Security Best Practices

### Webhook URL Security

1. **Keep URLs private**: Never share webhook URLs in public repositories or documentation
2. **Use environment variables**: Store URLs in environment variables, not code
3. **Regular rotation**: Consider recreating webhooks periodically
4. **Monitor usage**: Check Teams channel for unexpected messages

### Channel Security

1. **Dedicated channels**: Use specific channels for monitoring alerts
2. **Appropriate permissions**: Limit channel access to relevant team members
3. **Clear naming**: Use descriptive names for both webhooks and channels
4. **Documentation**: Document which systems use which webhooks

## 📝 Configuration Summary

After completing these steps, you should have:

✅ **Teams Channel**: Dedicated channel for alerts  
✅ **Webhook Connector**: Incoming Webhook configured  
✅ **Webhook URL**: Long, secure URL for Pigeon to use  
✅ **Test Confirmation**: Verified the webhook works

**Next Step**: Use this webhook URL in Pigeon's Teams integration configuration!

## 🔄 Managing Existing Webhooks

### Viewing Configured Webhooks

1. Go to channel → ⋯ menu → **Connectors**
2. Look for "Configured" webhooks
3. Click **"Manage"** to view or modify

### Updating Webhook Settings

1. Find your webhook in Connectors
2. Click **"Manage"** or **"Configure"**
3. Update name, image, or other settings
4. **Note**: URL remains the same unless you recreate

### Removing Webhooks

1. Go to Connectors → find your webhook
2. Click **"Remove"** or **"Delete"**
3. **Warning**: This breaks the integration - update Pigeon config

### Adding Multiple Webhooks

- You can add multiple webhooks to the same channel
- Each webhook gets a unique URL
- Useful for different environments (prod, staging, dev)

---

**🎉 You now have a Microsoft Teams webhook URL ready for Pigeon integration!**

**Next**: Configure this URL in Pigeon → Settings → Integrations → Microsoft Teams
