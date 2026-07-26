// Maps the integration form's snake_case fields onto the camelCase keys the
// API stores. An unmapped key is silently dropped, so every field the form can
// produce must have an entry here.
const RENAMES = {
    smtp_host: 'smtpHost',
    smtp_port: 'smtpPort',
    smtp_user: 'smtpUser',
    smtp_pass: 'smtpPass',
    smtp_password: 'smtpPass',
    from_email: 'fromEmail',
    use_tls: 'useTls',
    integration_key: 'routingKey',
    routing_key: 'routingKey',
    bot_token: 'botToken',
    chat_id: 'chatId',
    server_url: 'serverUrl',
    base_url: 'serverUrl',
    api_token: 'apiToken',
    project_key: 'projectKey',
    issue_type: 'issueType'
};

const WEBHOOK_TYPES = ['slack', 'teams', 'discord', 'webhook', 'googlechat'];

export default function transformConfigForBackend(type, config) {
    const out = {};

    for (const [key, value] of Object.entries(config || {})) {
        out[RENAMES[key] || key] = value;
    }

    if (WEBHOOK_TYPES.includes(type)) {
        if (out.webhook_url) { out.webhookUrl = out.webhook_url; delete out.webhook_url; }
        if (out.url) { out.webhookUrl = out.url; delete out.url; }
    }

    if (type === 'email') {
        if (!out.smtpPort) out.smtpPort = 587;
        if (out.useTls === undefined) out.useTls = true;
    }

    // The headers textarea holds JSON text; the API wants structured data.
    if (typeof out.headers === 'string') {
        const raw = out.headers.trim();
        if (!raw) {
            delete out.headers;
        } else {
            try {
                out.headers = JSON.parse(raw);
            } catch {
                throw new Error('Custom Headers must be valid JSON');
            }
        }
    }

    return out;
}
