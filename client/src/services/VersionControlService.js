// client/src/services/VersionControlService.js
/**
 * Service for handling version control operations for real-time collaboration
 */

/**
 * Creates a unique version identifier
 * @returns {string} Version ID
 */
const createVersionId = () => {
    return `v-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Creates a change record for version history
 * @param {string} userId - User making the change
 * @param {string} userName - Display name of user
 * @param {string} entityType - Type of entity (request, collection, workspace)
 * @param {string} entityId - ID of the entity being changed
 * @param {Object} changes - Changes made
 * @returns {Object} Change record
 */
const createChangeRecord = (userId, userName, entityType, entityId, changes) => {
    return {
        id: createVersionId(),
        userId,
        userName,
        timestamp: new Date().toISOString(),
        entityType,
        entityId,
        changes,
    };
};

/**
 * Compares two versions of a document and generates a diff
 * @param {Object} oldVersion - Previous version
 * @param {Object} newVersion - Current version
 * @returns {Object} Difference object
 */
const generateDiff = (oldVersion, newVersion) => {
    const changes = { added: [], modified: [], deleted: [] };

    // Convert objects to compatible format if they aren't already
    const oldObj = typeof oldVersion === 'string' ? JSON.parse(oldVersion) : oldVersion;
    const newObj = typeof newVersion === 'string' ? JSON.parse(newVersion) : newVersion;

    // Track modified and added fields
    Object.keys(newObj).forEach(key => {
        if (key in oldObj) {
            if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
                changes.modified.push({
                    field: key,
                    oldValue: oldObj[key],
                    newValue: newObj[key]
                });
            }
        } else {
            changes.added.push({
                field: key,
                value: newObj[key]
            });
        }
    });

    // Track deleted fields
    Object.keys(oldObj).forEach(key => {
        if (!(key in newObj)) {
            changes.deleted.push({
                field: key,
                oldValue: oldObj[key]
            });
        }
    });

    return changes;
};

/**
 * Check if changes conflict with each other
 * @param {Array} changes1 - First set of changes
 * @param {Array} changes2 - Second set of changes
 * @returns {Boolean} Whether changes conflict
 */
const detectConflicts = (changes1, changes2) => {
    // Extract all modified fields from both change sets
    const modifiedFields1 = changes1.modified ? changes1.modified.map(change => change.field) : [];
    const modifiedFields2 = changes2.modified ? changes2.modified.map(change => change.field) : [];

    // Check for overlapping modifications (potential conflicts)
    return modifiedFields1.some(field => modifiedFields2.includes(field));
};

/**
 * Apply a set of changes to a document
 * @param {Object} document - Original document
 * @param {Object} changes - Changes to apply
 * @returns {Object} Updated document
 */
const applyChanges = (document, changes) => {
    const result = JSON.parse(JSON.stringify(document)); // Deep clone

    // Apply additions
    if (changes.added) {
        changes.added.forEach(addition => {
            result[addition.field] = addition.value;
        });
    }

    // Apply modifications
    if (changes.modified) {
        changes.modified.forEach(modification => {
            result[modification.field] = modification.newValue;
        });
    }

    // Apply deletions
    if (changes.deleted) {
        changes.deleted.forEach(deletion => {
            delete result[deletion.field];
        });
    }

    return result;
};

/**
 * Merge changes from two versions of a document
 * @param {Object} baseVersion - Common ancestor version
 * @param {Object} version1 - First version
 * @param {Object} version2 - Second version
 * @returns {Object} Merged document
 */
const mergeChanges = (baseVersion, version1, version2) => {
    // Generate diffs from base to each version
    const diff1 = generateDiff(baseVersion, version1);
    const diff2 = generateDiff(baseVersion, version2);

    // Check for conflicts
    const hasConflicts = detectConflicts(diff1, diff2);
    if (hasConflicts) {
        // In case of conflict, return object with conflict markers
        return {
            _hasConflicts: true,
            _baseVersion: baseVersion,
            _version1: version1,
            _version2: version2,
            _diff1: diff1,
            _diff2: diff2
        };
    }

    // No conflicts, perform a simple merge
    // Start with base and apply both sets of changes
    let merged = JSON.parse(JSON.stringify(baseVersion));
    merged = applyChanges(merged, diff1);
    merged = applyChanges(merged, diff2);

    return merged;
};

/**
 * Create a version branch from an existing version
 * @param {string} baseVersionId - ID of version to branch from
 * @param {string} branchName - Name of new branch
 * @param {string} userId - User creating the branch
 * @returns {Object} Branch metadata
 */
const createBranch = (baseVersionId, branchName, userId) => {
    return {
        id: `branch-${Date.now()}`,
        name: branchName,
        baseVersionId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Fetch version history for a document
 * @param {string} entityType - Type of entity (request, collection, etc.)
 * @param {string} entityId - ID of the entity
 * @returns {Promise<Array>} Promise resolving to version history
 */
const getVersionHistory = async (entityType, entityId) => {
    try {
        // If entityId contains a '#' character, it's likely truncated or malformed
        if (!entityId || entityId.includes('#')) {
            console.warn(`Skipping version history fetch for invalid ${entityType} ID: ${entityId}`);
            return [];
        }

        const response = await fetch(`/api/${entityType}s/${entityId}/versions`, {
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch version history: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        // Error is logged by the caller, no need to log again here
        return [];
    }
};

/**
 * Save a new version of a document
 * @param {string} entityType - Type of entity (request, collection, etc.) 
 * @param {string} entityId - ID of the entity
 * @param {Object} changes - Changes made in this version
 * @param {string} userId - User ID creating the version
 * @param {string} message - Commit message
 * @returns {Promise<Object>} Promise resolving to the saved version
 */
const saveVersion = async (entityType, entityId, changes, userId, message) => {
    try {
        const response = await fetch(`/api/${entityType}s/${entityId}/versions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                changes,
                message,
                userId
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to save version: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error saving version:', error);
        throw error;
    }
};

export default {
    createChangeRecord,
    generateDiff,
    detectConflicts,
    applyChanges,
    mergeChanges,
    createBranch,
    getVersionHistory,
    saveVersion
};
