/**
 * Safe DOM manipulation utilities to prevent React reconciliation conflicts
 * Addresses the "Failed to execute 'removeChild' on 'Node'" error
 */

/**
 * Safely append a child to a parent element with error handling
 */
export const safeAppendChild = (parent, child) => {
    try {
        if (parent && child && parent.contains && !parent.contains(child)) {
            parent.appendChild(child);
            return true;
        }
    } catch (error) {
        console.warn('Safe appendChild failed:', error);
    }
    return false;
};

/**
 * Safely remove a child from its parent with error handling
 */
export const safeRemoveChild = (parent, child) => {
    try {
        if (parent && child && parent.contains && parent.contains(child)) {
            parent.removeChild(child);
            return true;
        }
    } catch (error) {
        console.warn('Safe removeChild failed:', error);
    }
    return false;
};

/**
 * Safely remove an element from the DOM
 */
export const safeRemove = (element) => {
    try {
        if (element && element.parentNode) {
            return safeRemoveChild(element.parentNode, element);
        } else if (element && element.remove) {
            element.remove();
            return true;
        }
    } catch (error) {
        console.warn('Safe remove failed:', error);
    }
    return false;
};

/**
 * Create a DOM element with safe error handling
 */
export const safeCreateElement = (tagName, attributes = {}, styles = {}) => {
    try {
        const element = document.createElement(tagName);

        Object.entries(attributes).forEach(([key, value]) => {
            try {
                element.setAttribute(key, value);
            } catch (error) {
                console.warn(`Failed to set attribute ${key}:`, error);
            }
        });

        Object.entries(styles).forEach(([key, value]) => {
            try {
                element.style[key] = value;
            } catch (error) {
                console.warn(`Failed to set style ${key}:`, error);
            }
        });

        return element;
    } catch (error) {
        console.error('Failed to create element:', error);
        return null;
    }
};

/**
 * Schedule DOM operations for the next animation frame to avoid conflicts
 */
export const scheduleDOM = (operation) => {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            try {
                const result = operation();
                resolve(result);
            } catch (error) {
                console.warn('Scheduled DOM operation failed:', error);
                resolve(false);
            }
        });
    });
};

/**
 * Debounced DOM operation to prevent rapid successive calls
 */
const domOperationTimeouts = new Map();

export const debouncedDOM = (operationId, operation, delay = 16) => {
    if (domOperationTimeouts.has(operationId)) {
        clearTimeout(domOperationTimeouts.get(operationId));
    }

    const timeoutId = setTimeout(async () => {
        await scheduleDOM(operation);
        domOperationTimeouts.delete(operationId);
    }, delay);

    domOperationTimeouts.set(operationId, timeoutId);
};

/**
 * Global cleanup function to clear all pending DOM operations
 */
export const cleanupAllDOMOperations = () => {
    domOperationTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    domOperationTimeouts.clear();
};
