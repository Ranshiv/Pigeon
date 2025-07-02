# Gmail App Password Setup Guide

## Issue

You're encountering the error: **"534-5.7.9 Application-specific password required"** when testing email integrations.

This happens because Gmail requires an **App Password** instead of your regular account password when using SMTP with 2-factor authentication enabled.

## Current Configuration

Your `.env` file currently has:

```
EMAIL_SERVICE=gmail
EMAIL_USER=bootloader101010@gmail.com
EMAIL_PASSWORD=E|N$tein299  # ← This is your regular password, needs to be App Password
EMAIL_FROM=ranshiv369@gmail.com
```

## Solution: Generate Gmail App Password

### Step 1: Enable 2-Factor Authentication (if not already enabled)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click "2-Step Verification"
3. Follow the setup process if 2FA is not already enabled

### Step 2: Generate App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click "2-Step Verification"
3. Scroll down and click "App passwords"
4. You might need to re-enter your password
5. In the "Select app" dropdown, choose "Mail"
6. In the "Select device" dropdown, choose "Other (Custom name)"
7. Enter a name like "Pigeon Email Integration"
8. Click "Generate"
9. **Copy the 16-character app password** (it looks like: `abcd efgh ijkl mnop`)

### Step 3: Update Your .env File

Replace your current `EMAIL_PASSWORD` with the App Password:

```bash
# Replace this line in your .env file:
EMAIL_PASSWORD=your-16-character-app-password-here
```

**Example:**

```bash
EMAIL_PASSWORD=abcd efgh ijkl mnop
```

### Step 4: Test the Integration

After updating the `.env` file, restart your server and test the email integration again.

## Alternative Solutions

### Option 1: Use a Different Email Service

If you prefer not to use Gmail App Passwords, you can use other email services:

#### Outlook/Hotmail

```bash
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-regular-password
```

#### Yahoo Mail

```bash
EMAIL_SERVICE=yahoo
EMAIL_USER=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password  # Yahoo also requires app passwords
```

#### Custom SMTP

```bash
EMAIL_SERVICE=custom
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASSWORD=your-password
EMAIL_SECURE=false
```

### Option 2: Use SendGrid, Mailgun, or Other Email APIs

For production applications, consider using dedicated email services:

#### SendGrid

```bash
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=your-verified-sender@yourdomain.com
```

## Security Notes

1. **Keep your App Password secure** - treat it like a regular password
2. **Don't share your .env file** - it contains sensitive credentials
3. **Consider using environment-specific configurations** for production
4. **Regularly rotate your App Passwords** for better security

## Troubleshooting

### Still getting authentication errors?

1. Make sure you copied the App Password correctly (no spaces)
2. Verify 2FA is enabled on your Google account
3. Try generating a new App Password
4. Check if "Less secure app access" is disabled (it should be)

### App Passwords option not showing?

1. Ensure 2-Factor Authentication is enabled
2. Wait a few minutes after enabling 2FA
3. Try accessing from a different browser or incognito mode

### Need to test quickly?

You can use a temporary email service for testing:

- [Mailtrap](https://mailtrap.io/) - Email testing service
- [MailHog](https://github.com/mailhog/MailHog) - Local email testing tool

## Next Steps

1. Generate your Gmail App Password
2. Update the `.env` file
3. Restart your Pigeon server
4. Test the email integration again
5. If successful, proceed with testing other integration types

The integration system should work perfectly once the authentication is properly configured!
