import React from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            errorCount: 0,
            isDOMError: false
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error details
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Check if this is a DOM manipulation error
        const isDOMError = error.message && (
            error.message.includes('removeChild') ||
            error.message.includes('appendChild') ||
            error.message.includes('insertBefore') ||
            error.message.includes('NotFoundError') ||
            error.message.includes('Node to be removed is not a child')
        );

        this.setState({
            error: error,
            errorInfo: errorInfo,
            errorCount: this.state.errorCount + 1,
            isDOMError
        });

        // Auto-recovery for DOM errors after a short delay
        if (isDOMError && this.state.errorCount < 3) {
            console.log('Attempting auto-recovery for DOM manipulation error...');
            setTimeout(() => {
                this.setState({
                    hasError: false,
                    error: null,
                    errorInfo: null,
                    isDOMError: false
                });
            }, 1000);
        }
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            errorCount: 0,
            isDOMError: false
        });
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary">
                    <div className="error-boundary-content">
                        <div className="error-icon">
                            <FiAlertTriangle size={48} color="#ff6b6b" />
                        </div>
                        <h3>Something went wrong</h3>
                        <p>
                            {this.state.isDOMError
                                ? 'A temporary DOM rendering issue occurred. The component will recover automatically.'
                                : (this.props.fallbackMessage ||
                                    'An error occurred while rendering this component. This might be due to invalid data or a temporary issue.')
                            }
                        </p>
                        {this.state.isDOMError && this.state.errorCount < 3 && (
                            <p className="error-recovery-message" style={{ color: '#666', fontSize: '14px' }}>
                                Auto-recovery in progress...
                            </p>
                        )}
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details style={{ marginTop: '1rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                                <summary>Error Details (Development)</summary>
                                <pre style={{ overflow: 'auto', fontSize: '12px', marginTop: '0.5rem' }}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                        <button
                            className="error-retry-button"
                            onClick={this.handleRetry}
                            disabled={this.state.isDOMError && this.state.errorCount < 3}
                            style={{
                                marginTop: '1rem',
                                padding: '0.5rem 1rem',
                                background: this.state.isDOMError && this.state.errorCount < 3 ? '#ccc' : '#014C75',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: this.state.isDOMError && this.state.errorCount < 3 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <FiRefreshCw size={16} />
                            {this.state.isDOMError && this.state.errorCount < 3 ? 'Recovering...' : 'Try Again'}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
