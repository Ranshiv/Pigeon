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

        // Pass through all other errors
        return originalConsoleError.apply(console, [message, ...args]);
    };
};

/**
 * Clean up the error suppression
 */
export const restoreConsoleError = () => {
    // Note: This would restore the original console.error if needed
    // Currently not used but included for completeness
};
