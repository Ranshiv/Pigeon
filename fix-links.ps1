# PowerShell script to fix documentation links

$filePath = "client\src\components\IntegrationsManagement.js"
$content = Get-Content $filePath -Raw

# Fix Teams links (both Create and Edit modals)
$content = $content -replace 'href="/features/integrations/teams/webhook-setup.md"', 'href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"'

# Fix Jira links (both Create and Edit modals)  
$content = $content -replace 'href="/features/integrations/jira/README.md"', 'href="https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/"'

# Fix link text for Teams
$content = $content -replace 'Detailed Teams setup guide', 'Official Microsoft Teams webhook guide'

# Fix link text for Jira
$content = $content -replace 'Complete Jira integration guide', 'Official Atlassian API token guide'

# Write back to file
Set-Content $filePath $content

Write-Host "Successfully fixed all documentation links!"
