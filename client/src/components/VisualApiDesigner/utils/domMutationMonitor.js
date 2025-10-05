/**
 * DOM Mutation Observer to detect external DOM changes that might conflict with React
 */

let mutationObserver = null;
let suspiciousOperations = 0;

/**
 * Start monitoring DOM mutations for potential React conflicts
 */
export const startDOMMutationMonitoring = (targetSelector = '.design-canvas-content') => {
    if (mutationObserver) {
        stopDOMMutationMonitoring();
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
        console.warn('DOM mutation monitor target not found:', targetSelector);
        return;
    }

    mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Check for suspicious operations that might conflict with React
            if (mutation.type === 'childList') {
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if removed node had React-related attributes
                        if (node.hasAttribute && (
                            node.hasAttribute('data-reactroot') ||
                            node.className?.includes('react-') ||
                            node.className?.includes('positioned-node')
                        )) {
                            suspiciousOperations++;
                            console.warn('Suspicious DOM removal detected:', node, 'Operations:', suspiciousOperations);

                            // If we detect too many suspicious operations, log a warning
                            if (suspiciousOperations > 5) {
                                console.error('Multiple suspicious DOM operations detected. This may cause React reconciliation issues.');
                                suspiciousOperations = 0; // Reset counter
                            }
                        }
                    }
                });

                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && node.className?.includes('drag-preview')) {
                        // This is normal for drag operations
                        return;
                    }
                });
            }
        });
    });

    mutationObserver.observe(target, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });

    console.log('DOM mutation monitoring started for', targetSelector);
};

/**
 * Stop monitoring DOM mutations
 */
export const stopDOMMutationMonitoring = () => {
    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
        suspiciousOperations = 0;
        console.log('DOM mutation monitoring stopped');
    }
};

/**
 * Get the current count of suspicious operations
 */
export const getSuspiciousOperationCount = () => suspiciousOperations;
