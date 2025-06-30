// services/AuthenticationService.js
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

class AuthenticationService {
    constructor() {
        this.tokenStorage = new Map();
        this.refreshTokens = new Map();
        this.authStates = new Map(); // Store OAuth state parameters
    }

    // OAuth 2.0 Authorization Code Flow
    async initiateAuthorizationCode(config) {
        const state = this.generateSecureState();
        const codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(codeVerifier);

        const authUrl = new URL(config.authUrl);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', config.clientId);
        authUrl.searchParams.set('redirect_uri', config.redirectUri);
        authUrl.searchParams.set('scope', config.scope || '');
        authUrl.searchParams.set('state', state);

        // PKCE support
        if (config.usePKCE !== false) {
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
        }

        // Store state and code verifier for later verification
        this.storeAuthState(state, { codeVerifier, config });

        return {
            authUrl: authUrl.toString(),
            state
        };
    }

    // Exchange authorization code for tokens
    async exchangeCodeForTokens(code, state, config) {
        const authState = this.getAuthState(state);
        if (!authState) {
            throw new Error('Invalid or expired state parameter');
        }

        const tokenData = {
            grant_type: 'authorization_code',
            code,
            client_id: config.clientId,
            redirect_uri: config.redirectUri
        };

        // Add client secret if provided
        if (config.clientSecret) {
            tokenData.client_secret = config.clientSecret;
        }

        // Add PKCE code verifier if used
        if (authState.codeVerifier) {
            tokenData.code_verifier = authState.codeVerifier;
        }

        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams(tokenData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch {
                error = { error: 'token_exchange_failed', error_description: errorText };
            }
            throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
        }

        const tokens = await response.json();

        // Store tokens with expiration
        this.storeTokens(config.clientId, tokens);

        // Clean up auth state
        this.authStates.delete(state);

        return tokens;
    }

    // Client Credentials Grant
    async clientCredentialsGrant(config) {
        const tokenData = {
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: config.clientSecret
        };

        if (config.scope) {
            tokenData.scope = config.scope;
        }

        const response = await fetch(config.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams(tokenData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch {
                error = { error: 'client_credentials_failed', error_description: errorText };
            }
            throw new Error(`Client credentials grant failed: ${error.error_description || error.error}`);
        }

        const tokens = await response.json();
        this.storeTokens(config.clientId, tokens);

        return tokens;
    }

    // Auto-refresh expired tokens
    async refreshAccessToken(refreshToken, config) {
        const tokenData = {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: config.clientId
        };

        if (config.clientSecret) {
            tokenData.client_secret = config.clientSecret;
        }

        const response = await fetch(config.tokenUrl || config.refreshTokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams(tokenData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let error;
            try {
                error = JSON.parse(errorText);
            } catch {
                error = { error: 'refresh_failed', error_description: errorText };
            }
            throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
        }

        const tokens = await response.json();
        this.storeTokens(config.clientId, tokens);

        return tokens;
    }

    // Get valid access token (with auto-refresh)
    async getValidToken(config) {
        const stored = this.getStoredTokens(config.clientId);

        if (!stored) {
            throw new Error('No tokens available - authentication required');
        }

        // Check if token is expired
        if (this.isTokenExpired(stored)) {
            if (stored.refresh_token) {
                return await this.refreshAccessToken(stored.refresh_token, config);
            } else {
                throw new Error('Token expired and no refresh token available');
            }
        }

        return stored;
    }

    // Apply authentication to request headers
    async applyAuthentication(requestConfig, authConfig) {
        const headers = { ...requestConfig.headers };

        switch (authConfig.type) {
            case 'Bearer Token':
                if (authConfig.bearer?.token) {
                    headers.Authorization = `Bearer ${authConfig.bearer.token}`;
                }
                break;

            case 'Basic Auth':
                if (authConfig.basic?.username && authConfig.basic?.password) {
                    const credentials = Buffer.from(
                        `${authConfig.basic.username}:${authConfig.basic.password}`
                    ).toString('base64');
                    headers.Authorization = `Basic ${credentials}`;
                }
                break;

            case 'API Key':
                if (authConfig.apiKey?.key && authConfig.apiKey?.value) {
                    if (authConfig.apiKey.location === 'header') {
                        headers[authConfig.apiKey.key] = authConfig.apiKey.value;
                    } else if (authConfig.apiKey.location === 'query') {
                        // Add to URL query parameters
                        const url = new URL(requestConfig.url);
                        url.searchParams.set(authConfig.apiKey.key, authConfig.apiKey.value);
                        requestConfig.url = url.toString();
                    }
                }
                break;

            case 'OAuth 2.0':
                try {
                    if (!authConfig.oauth2?.accessToken) {
                        console.warn('OAuth 2.0 authentication requested but no access token available');
                        break;
                    }
                    // Use the provided access token directly
                    headers.Authorization = `Bearer ${authConfig.oauth2.accessToken}`;
                } catch (error) {
                    console.warn('OAuth 2.0 token not available:', error.message);
                    // Don't throw error in production, just log warning
                    if (process.env.NODE_ENV !== 'test') {
                        throw new Error('OAuth 2.0 authentication failed: ' + error.message);
                    }
                }
                break;

            default:
                // No Auth or unsupported type
                break;
        }

        return { ...requestConfig, headers };
    }

    // Helper methods
    generateSecureState() {
        return crypto.randomBytes(32).toString('hex');
    }

    generateCodeVerifier() {
        return crypto.randomBytes(32).toString('base64url');
    }

    generateCodeChallenge(verifier) {
        return crypto.createHash('sha256').update(verifier).digest('base64url');
    }

    storeAuthState(state, data) {
        // Store with 10 minute expiration
        const expiresAt = Date.now() + (10 * 60 * 1000);
        this.authStates.set(state, { ...data, expiresAt });
    }

    getAuthState(state) {
        const stored = this.authStates.get(state);
        if (!stored) return null;

        if (Date.now() > stored.expiresAt) {
            this.authStates.delete(state);
            return null;
        }

        return stored;
    }

    storeTokens(clientId, tokens) {
        const expiresAt = tokens.expires_in ?
            Date.now() + (tokens.expires_in * 1000) :
            Date.now() + (3600 * 1000); // Default 1 hour

        this.tokenStorage.set(clientId, {
            ...tokens,
            expires_at: expiresAt,
            stored_at: Date.now()
        });
    }

    getStoredTokens(clientId) {
        return this.tokenStorage.get(clientId);
    }

    isTokenExpired(tokens) {
        if (!tokens.expires_at) return false;
        // Add 30 second buffer to avoid race conditions
        return Date.now() > (tokens.expires_at - 30000);
    }

    clearTokens(clientId) {
        this.tokenStorage.delete(clientId);
    }
}

module.exports = AuthenticationService;
