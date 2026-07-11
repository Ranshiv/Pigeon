import React, { useEffect, useRef } from 'react';
import { AuthVisualizationService } from '../services/AuthVisualizationService';

const AuthFlowHost = ({ authConfig }) => {
    const containerRef = useRef(null);

    useEffect(() => {
        let cy;
        const containerId = 'auth-flow-visualization-container';

        if (containerRef.current) {
            // Determine auth flow type based on configuration
            const getAuthFlowType = (config) => {
                if (!config) return 'none';
                
                switch (config.type) {
                    case 'Bearer Token':
                        return 'bearer';
                    case 'Basic Auth':
                        return 'basic';
                    case 'API Key':
                        return 'apikey';
                    case 'OAuth 2.0':
                        return config.oauth2?.grantType === 'client_credentials' 
                            ? 'oauth2-client' : 'oauth2';
                    default:
                        return 'none';
                }
            };

            const flowType = getAuthFlowType(authConfig);
            
            if (flowType !== 'none') {
                cy = AuthVisualizationService.createInteractiveAuthFlow(
                    containerId,
                    flowType,
                    authConfig
                );
            }
        }

        return () => {
            if (cy && !cy.destroyed()) {
                cy.destroy();
            }
        };
    }, [authConfig]);

    return (
        <div className="auth-visualization-wrapper" style={{ marginTop: '20px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'var(--bg-secondary)' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Authentication Flow Visualization
            </h4>
            <div 
                id="auth-flow-visualization-container" 
                ref={containerRef}
                style={{ height: '300px', width: '100%', background: 'var(--bg-primary)', borderRadius: '6px' }}
            >
                {/* Fallback for "No Auth" or unsupported types */}
                {(!authConfig || authConfig.type === 'No Auth') && (
                    <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                        No authentication configured
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthFlowHost;
