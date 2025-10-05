import { useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for safe DOM operations that prevents React reconciliation conflicts
 * Addresses the "Failed to execute 'removeChild' on 'Node'" error
 */
const useSafeDOMOperations = () => {
    const pendingOperations = useRef(new Map());
    const operationTimeouts = useRef(new Map());

    // Cleanup function to clear pending operations on unmount
    useEffect(() => {
        const timeoutMap = operationTimeouts.current;
        const operationsMap = pendingOperations.current;

        return () => {
            // Clear all pending timeouts
            timeoutMap.forEach(timeoutId => {
                clearTimeout(timeoutId);
            });
            timeoutMap.clear();
            operationsMap.clear();
        };
    }, []);

    const scheduleOperation = useCallback((operationId, operation, delay = 16) => {
        // Cancel any existing operation with the same ID
        if (operationTimeouts.current.has(operationId)) {
            clearTimeout(operationTimeouts.current.get(operationId));
        }

        // Check if operation is already pending
        if (pendingOperations.current.has(operationId)) {
            console.warn(`Operation ${operationId} is already pending, skipping duplicate`);
            return;
        }

        // Mark operation as pending
        pendingOperations.current.set(operationId, true);

        // Schedule the operation
        const timeoutId = setTimeout(() => {
            try {
                operation();
            } catch (error) {
                console.error(`Safe operation ${operationId} failed:`, error);
            } finally {
                // Clean up tracking
                pendingOperations.current.delete(operationId);
                operationTimeouts.current.delete(operationId);
            }
        }, delay);

        operationTimeouts.current.set(operationId, timeoutId);
    }, []);

    const cancelOperation = useCallback((operationId) => {
        if (operationTimeouts.current.has(operationId)) {
            clearTimeout(operationTimeouts.current.get(operationId));
            operationTimeouts.current.delete(operationId);
            pendingOperations.current.delete(operationId);
        }
    }, []);

    const isOperationPending = useCallback((operationId) => {
        return pendingOperations.current.has(operationId);
    }, []);

    return {
        scheduleOperation,
        cancelOperation,
        isOperationPending
    };
};

export default useSafeDOMOperations;
