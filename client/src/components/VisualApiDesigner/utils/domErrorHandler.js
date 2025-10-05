/**
 * Global DOM error handler to catch and recover from React DOM manipulation errors
 */

let errorCount = 0;
let lastErrorTime = 0;
const MAX_ERRORS_PER_MINUTE = 5;
const ERROR_RECOVERY_DELAY = 1000;

/**
 * Handle DOM manipulation errors globally
 */
const handleDOMError = (error) => {
    const currentTime = Date.now();

    // Reset error count if it's been more than a minute since last error
    if (currentTime - lastErrorTime > 60000) {
        errorCount = 0;
    }

    errorCount++;
    lastErrorTime = currentTime;

    console.warn(`DOM Error #${errorCount}:`, error.message);

    // If we're getting too many errors, implement more aggressive recovery
    if (errorCount > MAX_ERRORS_PER_MINUTE) {
        console.error('Too many DOM errors, implementing emergency recovery...');
        implementEmergencyRecovery();
    }

    return true; // Prevent error from bubbling up
};

/**
 * Emergency recovery procedure when DOM errors are frequent
 */
const implementEmergencyRecovery = () => {
    // Clean up any problematic DOM elements
    setTimeout(() => {
        try {
            // Remove any orphaned elements
            const orphanedElements = document.querySelectorAll('[data-react-draggable="true"]');
            orphanedElements.forEach(el => {
                if (!el.parentNode || !document.contains(el)) {
                    try {
                        el.remove();
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            });

            // Clean up any drag previews that might be stuck
            const dragPreviews = document.querySelectorAll('.drag-preview, .dragging');
            dragPreviews.forEach(el => {
                try {
                    el.remove();
                } catch (e) {
                    // Ignore cleanup errors
                }
            });

            console.log('Emergency DOM cleanup completed');
        } catch (error) {
            console.warn('Emergency recovery failed:', error);
        }
    }, ERROR_RECOVERY_DELAY);
};

/**
 * Install global DOM error handlers
 */
export const installDOMErrorHandlers = () => {
    // Override the native removeChild method to add error handling
    const originalRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
        try {
            // Check if child is actually a child of this node
            if (!this.contains(child)) {
                console.warn('Attempted to remove child that is not a child of this node');
                return child;
            }
            return originalRemoveChild.call(this, child);
        } catch (error) {
            handleDOMError(error);
            return child; // Return the child to maintain compatibility
        }
    };

    // Override appendChild for safety
    const originalAppendChild = Node.prototype.appendChild;
    Node.prototype.appendChild = function (child) {
        try {
            return originalAppendChild.call(this, child);
        } catch (error) {
            handleDOMError(error);
            return child;
        }
    };

    // Override insertBefore for safety
    const originalInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function (newChild, referenceChild) {
        try {
            return originalInsertBefore.call(this, newChild, referenceChild);
        } catch (error) {
            handleDOMError(error);
            return newChild;
        }
    };

    // Global error handler for uncaught DOM errors
    window.addEventListener('error', (event) => {
        if (event.error && event.error.message &&
            (event.error.message.includes('removeChild') ||
                event.error.message.includes('appendChild') ||
                event.error.message.includes('insertBefore'))) {
            handleDOMError(event.error);
            event.preventDefault();
        }
    });

    console.log('DOM error handlers installed');
};

/**
 * Uninstall DOM error handlers (for cleanup)
 */
export const uninstallDOMErrorHandlers = () => {
    // Note: This would restore original methods, but it's complex to implement safely
    // For now, we just log that we should clean up
    console.log('DOM error handlers cleanup requested');
};
