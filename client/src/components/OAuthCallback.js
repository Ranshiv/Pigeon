// client/src/components/OAuthCallback.js
import React, { useEffect, useState } from 'react';
import './OAuthCallback.css';

const OAuthCallback = () => {
    const [status, setStatus] = useState('loading');
    const [message, setMessage] = useState('Processing OAuth callback...');

    useEffect(() => {
        const handleOAuthCallback = async () => {
            try {
                // Get URL parameters
                const urlParams = new URLSearchParams(window.location.search);
                const code = urlParams.get('code');
                const state = urlParams.get('state');
                const error = urlParams.get('error');

                if (error) {
                    setStatus('error');
                    setMessage(`OAuth error: ${error}`);

                    // Send error to parent window if available
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'OAUTH_CALLBACK',
                            error,
                            code: null,
                            state: null
                        }, window.location.origin);
                    }
                    return;
                }

                if (!code) {
                    setStatus('error');
                    setMessage('No authorization code received');
                    return;
                }

                // Store the code and state for the parent window
                const result = {
                    success: true,
                    code,
                    state,
                    timestamp: Date.now()
                };

                // Try to communicate with the parent window
                if (window.opener) {
                    // Send result to parent window (matching the expected format)
                    window.opener.postMessage({
                        type: 'OAUTH_CALLBACK',
                        code,
                        state,
                        error: null
                    }, window.location.origin);

                    setStatus('success');
                    setMessage('Authorization successful! You can close this window.');

                    // Auto-close window after 3 seconds
                    setTimeout(() => {
                        window.close();
                    }, 3000);
                } else {
                    // If no parent window, store in localStorage for main app to pick up
                    localStorage.setItem('oauth_result', JSON.stringify(result));

                    setStatus('success');
                    setMessage('Authorization successful! Please return to the main application.');
                }

            } catch (err) {
                console.error('OAuth callback error:', err);
                setStatus('error');
                setMessage(`Error processing OAuth callback: ${err.message}`);
            }
        };

        handleOAuthCallback();
    }, []);

    const getStatusClass = () => {
        switch (status) {
            case 'loading': return 'loading';
            case 'success': return 'success';
            case 'error': return 'error';
            default: return 'loading';
        }
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'loading': return '⏳';
            case 'success': return '✅';
            case 'error': return '❌';
            default: return '⏳';
        }
    };

    return (
        <div className="oauth-callback-container">
            <div className="oauth-callback-content">
                <div className="logo">🕊️ Pigeon</div>
                <div className={`status ${getStatusClass()}`}>
                    <div className="status-icon">{getStatusIcon()}</div>
                    <div className="status-message">{message}</div>
                </div>

                {status === 'success' && (
                    <div className="instructions">
                        <p>This window will close automatically in a few seconds.</p>
                        <button
                            onClick={() => window.close()}
                            className="close-button"
                        >
                            Close Window
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="instructions">
                        <p>Please return to the main application and try again.</p>
                        <button
                            onClick={() => window.close()}
                            className="close-button"
                        >
                            Close Window
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OAuthCallback;
