// routes/oauth.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const AuthenticationService = require('../services/AuthenticationService');

// Initialize authentication service
const authService = new AuthenticationService();

// Generate OAuth 2.0 authorization URL (no authentication required)
router.post('/authorize', async (req, res) => {
    try {
        const { clientId, clientSecret, authUrl, tokenUrl, redirectUri, scope } = req.body;

        if (!clientId || !authUrl || !tokenUrl) {
            return res.status(400).json({
                error: 'Missing required OAuth 2.0 configuration',
                required: ['clientId', 'authUrl', 'tokenUrl']
            });
        }

        const oauth2Config = {
            clientId,
            clientSecret,
            authUrl,
            tokenUrl,
            redirectUri: redirectUri || `${req.protocol}://${req.get('host')}/oauth/callback`,
            scope
        };

        const result = await authService.initiateAuthorizationCode(oauth2Config);

        res.json({
            authUrl: result.authUrl,
            state: result.state,
            redirectUri: oauth2Config.redirectUri
        });
    } catch (error) {
        console.error('OAuth authorization URL generation error:', error);
        res.status(500).json({
            error: 'Failed to generate authorization URL',
            message: error.message
        });
    }
});

// Initiate OAuth 2.0 Authorization Code flow
router.post('/initiate', ensureAuthenticated, async (req, res) => {
    try {
        const { oauth2Config } = req.body;

        if (!oauth2Config.clientId || !oauth2Config.authUrl || !oauth2Config.tokenUrl) {
            return res.status(400).json({
                error: 'Missing required OAuth 2.0 configuration',
                required: ['clientId', 'authUrl', 'tokenUrl']
            });
        }

        // Set default redirect URI if not provided
        if (!oauth2Config.redirectUri) {
            oauth2Config.redirectUri = `${req.protocol}://${req.get('host')}/api/oauth/callback`;
        }

        const result = await authService.initiateAuthorizationCode(oauth2Config);

        res.json({
            authUrl: result.authUrl,
            state: result.state,
            redirectUri: oauth2Config.redirectUri
        });
    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({
            error: 'Failed to initiate OAuth flow',
            message: error.message
        });
    }
});

// Handle OAuth 2.0 callback
router.get('/callback', async (req, res) => {
    try {
        const { code, state, error, error_description } = req.query;

        if (error) {
            return res.status(400).json({
                error: 'OAuth authorization failed',
                message: error_description || error
            });
        }

        if (!code || !state) {
            return res.status(400).json({
                error: 'Missing authorization code or state parameter'
            });
        }

        // For now, return the code and state to be handled by the frontend
        // In a production app, you'd want to complete the token exchange here
        res.json({
            code,
            state,
            message: 'Authorization code received successfully'
        });
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.status(500).json({
            error: 'OAuth callback failed',
            message: error.message
        });
    }
});

// Generate OAuth 2.0 authorization URL (no authentication required)
router.post('/authorize', async (req, res) => {
    try {
        const { clientId, authUrl, tokenUrl, scope, redirectUri } = req.body;

        if (!clientId || !authUrl || !tokenUrl) {
            return res.status(400).json({
                error: 'Missing required OAuth 2.0 configuration',
                required: ['clientId', 'authUrl', 'tokenUrl']
            });
        }

        const oauth2Config = {
            clientId,
            authUrl,
            tokenUrl,
            scope: scope || '',
            redirectUri: redirectUri || 'http://localhost:3000/oauth/callback'
        };

        const result = await authService.initiateAuthorizationCode(oauth2Config);

        res.json({
            authUrl: result.authUrl,
            state: result.state
        });
    } catch (error) {
        console.error('OAuth authorization URL generation error:', error);
        res.status(500).json({
            error: 'Failed to generate authorization URL',
            message: error.message
        });
    }
});

// Exchange authorization code for tokens
router.post('/exchange', async (req, res) => {
    try {
        const { code, state, clientId, clientSecret, redirectUri, tokenUrl } = req.body;

        if (!code || !state || !clientId || !tokenUrl) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['code', 'state', 'clientId', 'tokenUrl']
            });
        }

        // Reconstruct oauth2Config from individual fields
        const oauth2Config = {
            clientId,
            clientSecret,
            redirectUri: redirectUri || 'http://localhost:3000/oauth/callback',
            tokenUrl
        };

        const tokens = await authService.exchangeCodeForTokens(code, state, oauth2Config);

        res.json({
            access_token: tokens.access_token,
            token_type: tokens.token_type || 'Bearer',
            expires_in: tokens.expires_in,
            refresh_token: tokens.refresh_token,
            scope: tokens.scope,
            tokenStatus: 'authenticated'
        });
    } catch (error) {
        console.error('Token exchange error:', error);
        res.status(400).json({
            error: 'Token exchange failed',
            message: error.message
        });
    }
});

// Refresh OAuth 2.0 token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken, clientId, clientSecret, tokenUrl } = req.body;

        if (!refreshToken || !clientId || !tokenUrl) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['refreshToken', 'clientId', 'tokenUrl']
            });
        }

        // Reconstruct oauth2Config from individual fields
        const oauth2Config = {
            clientId,
            clientSecret,
            tokenUrl
        };

        const tokens = await authService.refreshAccessToken(refreshToken, oauth2Config);

        res.json({
            access_token: tokens.access_token,
            token_type: tokens.token_type || 'Bearer',
            expires_in: tokens.expires_in,
            refresh_token: tokens.refresh_token || refreshToken,
            scope: tokens.scope,
            tokenStatus: 'authenticated'
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(400).json({
            error: 'Token refresh failed',
            message: error.message
        });
    }
});

// Client Credentials Grant
router.post('/client-credentials', ensureAuthenticated, async (req, res) => {
    try {
        const { oauth2Config } = req.body;

        if (!oauth2Config.clientId || !oauth2Config.clientSecret || !oauth2Config.tokenUrl) {
            return res.status(400).json({
                error: 'Missing required configuration for client credentials',
                required: ['clientId', 'clientSecret', 'tokenUrl']
            });
        }

        const tokens = await authService.clientCredentialsGrant(oauth2Config);

        res.json({
            access_token: tokens.access_token,
            token_type: tokens.token_type || 'Bearer',
            expires_in: tokens.expires_in,
            scope: tokens.scope,
            tokenStatus: 'authenticated'
        });
    } catch (error) {
        console.error('Client credentials error:', error);
        res.status(400).json({
            error: 'Client credentials grant failed',
            message: error.message
        });
    }
});

// Test OAuth 2.0 configuration
router.post('/test', ensureAuthenticated, async (req, res) => {
    try {
        const { oauth2Config, grantType } = req.body;

        let result;
        switch (grantType) {
            case 'client_credentials':
                result = await authService.clientCredentialsGrant(oauth2Config);
                break;
            case 'authorization_code':
                result = await authService.initiateAuthorizationCode(oauth2Config);
                break;
            default:
                return res.status(400).json({
                    error: 'Unsupported grant type for testing',
                    supportedTypes: ['client_credentials', 'authorization_code']
                });
        }

        res.json({
            success: true,
            message: 'OAuth 2.0 configuration test successful',
            result: grantType === 'authorization_code' ?
                { authUrl: result.authUrl, state: result.state } :
                { tokenReceived: !!result.access_token }
        });
    } catch (error) {
        console.error('OAuth test error:', error);
        res.status(400).json({
            success: false,
            error: 'OAuth 2.0 configuration test failed',
            message: error.message
        });
    }
});

// Clear stored tokens
router.post('/clear-tokens', ensureAuthenticated, async (req, res) => {
    try {
        const { clientId } = req.body;

        if (!clientId) {
            return res.status(400).json({
                error: 'Missing client ID'
            });
        }

        authService.clearTokens(clientId);

        res.json({
            success: true,
            message: 'Tokens cleared successfully'
        });
    } catch (error) {
        console.error('Clear tokens error:', error);
        res.status(500).json({
            error: 'Failed to clear tokens',
            message: error.message
        });
    }
});

module.exports = router;
