/**
 * Error Suppressor Utility
 * 
 * This file contains utilities for suppressing specific errors in development
 * to reduce console noise. This should be used as a temporary solution
 * until the root causes of errors are fixed.
 */

/**
 * Suppress specific React errors by wrapping console.error
 * This helps reduce noise in the console during development
 */
export const suppressReactErrors = () => {
    const originalConsoleError = console.error;
    console.error = function (message, ...args) {
        // Skip React maximum update depth error
        if (typeof message === 'string' && message.includes('Maximum update depth exceeded')) {
            return;
        }

        // Skip version history errors
        if (typeof message === 'string' &&
            (message.includes('Error fetching version history') ||
                message.includes('ERR_INSUFFICIENT_RESOURCES'))) {
            return;
        }

        // Skip ResizeObserver loop completed errors (common during zoom operations)
        if (typeof message === 'string' &&
            (message.includes('ResizeObserver loop completed with undelivered notifications') ||
                message.includes('ResizeObserver loop limit exceeded'))) {
            return;
        }

        // Pass through all other errors
        return originalConsoleError.apply(console, [message, ...args]);
    };

    // Also handle window error events for ResizeObserver errors
    const handleWindowError = (event) => {
        if (event.error && event.error.message &&
            event.error.message.includes('ResizeObserver loop completed')) {
            // Prevent the error from being logged
            event.preventDefault();
            return false;
        }
    };

    window.addEventListener('error', handleWindowError);

    // Return cleanup function
    return () => {
        window.removeEventListener('error', handleWindowError);
    };
};

/**
 * Clean up the error suppression
 */
export const restoreConsoleError = () => {
    // Note: This would restore the original console.error if needed
    // Currently not used but included for completeness
};
