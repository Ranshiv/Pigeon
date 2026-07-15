/**
 * Debounce utility for preventing excessive function calls
 * Useful for resize observers, scroll handlers, and input events
 */

/**
 * Creates a debounced version of a function
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @param {boolean} immediate - If true, trigger on the leading edge instead of trailing
 * @returns {Function} - The debounced function
 */
export const debounce = (func, wait, immediate = false) => {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };

        const callNow = immediate && !timeout;

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) func.apply(this, args);
    };
};

/**
 * Creates a throttled version of a function
 * @param {Function} func - The function to throttle
 * @param {number} limit - The number of milliseconds to wait between calls
 * @returns {Function} - The throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;

    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Safe ResizeObserver wrapper that handles errors gracefully
 * @param {Function} callback - The resize callback function
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 16ms for 60fps)
 * @returns {ResizeObserver} - A safe ResizeObserver instance
 */
export const createSafeResizeObserver = (callback, debounceMs = 16) => {
    const debouncedCallback = debounce(callback, debounceMs);

    return new ResizeObserver((entries) => {
        // Use requestAnimationFrame to prevent ResizeObserver loop errors
        requestAnimationFrame(() => {
            try {
                debouncedCallback(entries);
            } catch (error) {
                // Silently handle ResizeObserver errors to prevent console spam
                if (!error.message?.includes('ResizeObserver')) {
                    console.warn('ResizeObserver callback error:', error);
                }
            }
        });
    });
};
