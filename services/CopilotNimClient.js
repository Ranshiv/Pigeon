const fetch = (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

const normalizeBaseUrl = (value) => String(value || '').replace(/\/$/, '');
const splitKeys = (value) => String(value || '').split(',').map((key) => key.trim()).filter(Boolean);
const cursorByProfile = new Map();
const cooldownByModel = new Map();
const splitModels = (value, fallback) => splitKeys(value || fallback);
const requestTimeoutMs = () => Math.max(5000, Number(process.env.PIGEON_NIM_REQUEST_TIMEOUT_MS) || 12000);
const totalTimeoutMs = () => Math.max(10000, Number(process.env.PIGEON_NIM_TOTAL_TIMEOUT_MS) || 35000);
const cooldownMs = () => Math.max(30000, Number(process.env.PIGEON_NIM_MODEL_COOLDOWN_MS) || 120000);
const maxTokens = () => Math.max(128, Number(process.env.PIGEON_NIM_MAX_TOKENS) || 800);
const documentationMaxTokens = () => Math.max(maxTokens(), Number(process.env.PIGEON_NIM_DOCUMENTATION_MAX_TOKENS) || 1400);
const maxTokensFor = (messages) => {
    const prompt = String(messages?.[messages.length - 1]?.content || '');
    return /documentation|update_documentation|authentication section|add .*docs?\b/i.test(prompt)
        ? documentationMaxTokens()
        : maxTokens();
};
const RETRYABLE_STATUSES = new Set([400, 404, 408, 422, 425, 429, 500, 502, 503, 504, 529]);
const COOLDOWN_STATUSES = new Set([400, 404, 422, 429, 500, 502, 503, 504, 529]);
const PUBLIC_BUSY_MESSAGE = 'Copilot is temporarily busy. Please try again.';

const profiles = () => ([
    {
        id: 'hosted',
        label: 'NVIDIA hosted NIM',
        baseUrl: normalizeBaseUrl(process.env.PIGEON_NIM_HOSTED_BASE_URL || 'https://integrate.api.nvidia.com/v1'),
        apiKeys: splitKeys(process.env.PIGEON_NIM_HOSTED_API_KEYS || process.env.PIGEON_NIM_HOSTED_API_KEY),
        models: splitModels(
            process.env.PIGEON_NIM_HOSTED_MODELS,
            `meta/llama-3.1-8b-instruct,openai/gpt-oss-20b,minimaxai/minimax-m3,${process.env.PIGEON_NIM_HOSTED_MODEL || 'z-ai/glm-5.2'}`
        )
    },
    {
        id: 'self-hosted',
        label: 'Self-hosted NVIDIA NIM',
        baseUrl: normalizeBaseUrl(process.env.PIGEON_NIM_SELF_HOSTED_BASE_URL),
        apiKeys: splitKeys(process.env.PIGEON_NIM_SELF_HOSTED_API_KEYS || process.env.PIGEON_NIM_SELF_HOSTED_API_KEY),
        models: splitModels(process.env.PIGEON_NIM_SELF_HOSTED_MODELS || process.env.PIGEON_NIM_SELF_HOSTED_MODEL, 'glm-5.2')
    }
].filter((profile) => profile.baseUrl && profile.apiKeys.length));

const publicProfiles = () => profiles().map(({ id, label, models }) => ({ id, label, model: models[0] }));

const getProfile = (id) => profiles().find((profile) => profile.id === id) || null;

async function complete(profile, messages, transport = fetch) {
    const keys = profile.apiKeys || [];
    if (!keys.length) throw new Error('The selected NVIDIA NIM profile has no API key configured.');
    const models = profile.models?.length ? profile.models : ['glm-5.2'];
    const cursor = cursorByProfile.get(profile.id) || { key: 0, model: 0 };
    const deadline = Date.now() + totalTimeoutMs();
    const availableModels = models.filter((model) => (cooldownByModel.get(`${profile.id}:${model}`) || 0) <= Date.now());
    const candidates = availableModels.length ? availableModels : models;
    const attempts = Math.min(3, Math.max(keys.length, candidates.length));

    for (let offset = 0; offset < attempts && Date.now() < deadline; offset += 1) {
        const keyIndex = (cursor.key + offset) % keys.length;
        const model = candidates[(cursor.model + offset) % candidates.length];
        const attemptMs = Math.max(1, Math.min(requestTimeoutMs(), deadline - Date.now()));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), attemptMs);
        const startedAt = Date.now();
        try {
            const response = await transport(`${profile.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${keys[keyIndex]}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: maxTokensFor(messages), response_format: { type: 'json_object' } }),
                signal: controller.signal
            });
            if (response.status === 401 || response.status === 403) {
                console.warn('[Copilot NIM] authentication failed', { profile: profile.id, status: response.status });
                throw new Error('Copilot is not configured correctly.');
            }
            if (RETRYABLE_STATUSES.has(response.status)) {
                if (COOLDOWN_STATUSES.has(response.status)) cooldownByModel.set(`${profile.id}:${model}`, Date.now() + cooldownMs());
                console.warn('[Copilot NIM] provider attempt failed', { profile: profile.id, model, status: response.status, durationMs: Date.now() - startedAt, attempt: offset + 1 });
                continue;
            }
            if (!response.ok) {
                console.warn('[Copilot NIM] provider request failed', { profile: profile.id, status: response.status, durationMs: Date.now() - startedAt });
                throw new Error(PUBLIC_BUSY_MESSAGE);
            }
            const body = await response.json();
            const text = body?.choices?.[0]?.message?.content;
            if (!text) {
                cooldownByModel.set(`${profile.id}:${model}`, Date.now() + cooldownMs());
                console.warn('[Copilot NIM] empty provider response', { profile: profile.id, model, durationMs: Date.now() - startedAt });
                continue;
            }
            cursorByProfile.set(profile.id, { key: (keyIndex + 1) % keys.length, model: (models.indexOf(model) + 1) % models.length });
            cooldownByModel.delete(`${profile.id}:${model}`);
            return text;
        } catch (error) {
            if (error.message === 'Copilot is not configured correctly.') throw error;
            const transient = error.name === 'AbortError' || /fetch|network|socket|ECONN|ENOTFOUND/i.test(error.message || '');
            if (!transient) throw new Error(PUBLIC_BUSY_MESSAGE);
            cooldownByModel.set(`${profile.id}:${model}`, Date.now() + cooldownMs());
            console.warn('[Copilot NIM] transient provider failure', { profile: profile.id, model, type: error.name === 'AbortError' ? 'timeout' : 'network', durationMs: Date.now() - startedAt, attempt: offset + 1 });
        } finally {
            clearTimeout(timeout);
        }
    }
    throw new Error(PUBLIC_BUSY_MESSAGE);
}

module.exports = { publicProfiles, getProfile, complete };
