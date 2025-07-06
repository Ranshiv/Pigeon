// services/ApiVersioningService.js
const ApiVersion = require('../models/ApiVersion');
const MockServer = require('../models/MockServer');
const Collection = require('../models/Collection');

class ApiVersioningService {
    /**
     * Create a new API version for a collection
     */
    static async createVersion(collectionId, versionData, userId) {
        try {
            // Validate version format
            if (!this.isValidVersionFormat(versionData.version)) {
                throw new Error('Invalid version format. Use v1, v1.0, v1.0.0, 1, 1.0, or 1.0.0');
            }

            // Check if version already exists
            const existingVersion = await ApiVersion.findOne({
                collectionId,
                version: versionData.version
            });

            if (existingVersion) {
                throw new Error(`Version ${versionData.version} already exists for this collection`);
            }

            // Normalize version format
            const normalizedVersion = this.normalizeVersion(versionData.version);

            const apiVersion = new ApiVersion({
                collectionId,
                version: normalizedVersion,
                name: versionData.name,
                description: versionData.description || '',
                versioningStrategy: versionData.versioningStrategy || 'url',
                versioningConfig: versionData.versioningConfig || {},
                openApiSpec: versionData.openApiSpec || null,
                changelog: versionData.changelog || '',
                migrationGuide: versionData.migrationGuide || '',
                backwardCompatible: versionData.backwardCompatible !== false,
                breakingChanges: versionData.breakingChanges || [],
                createdBy: userId
            });

            await apiVersion.save();
            return apiVersion;
        } catch (error) {
            throw new Error(`Failed to create API version: ${error.message}`);
        }
    }

    /**
     * Get all versions for a collection
     */
    static async getVersions(collectionId) {
        try {
            const versions = await ApiVersion.find({ collectionId })
                .populate('createdBy', 'displayName email')
                .sort({ createdAt: -1 });

            return versions;
        } catch (error) {
            throw new Error(`Failed to get API versions: ${error.message}`);
        }
    }

    /**
     * Get a specific version
     */
    static async getVersion(versionId) {
        try {
            const version = await ApiVersion.findById(versionId)
                .populate('createdBy', 'displayName email')
                .populate('collectionId', 'name description');

            if (!version) {
                throw new Error('API version not found');
            }

            return version;
        } catch (error) {
            throw new Error(`Failed to get API version: ${error.message}`);
        }
    }

    /**
     * Update an API version
     */
    static async updateVersion(versionId, updateData, userId) {
        try {
            const version = await ApiVersion.findById(versionId);

            if (!version) {
                throw new Error('API version not found');
            }

            // Update allowed fields
            const allowedFields = [
                'name', 'description', 'isActive', 'isDeprecated',
                'deprecationDate', 'sunsetDate', 'versioningStrategy',
                'versioningConfig', 'openApiSpec', 'changelog',
                'migrationGuide', 'backwardCompatible', 'breakingChanges'
            ];

            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    version[field] = updateData[field];
                }
            });

            await version.save();
            return version;
        } catch (error) {
            throw new Error(`Failed to update API version: ${error.message}`);
        }
    }

    /**
     * Deprecate an API version
     */
    static async deprecateVersion(versionId, deprecationInfo, userId) {
        try {
            const version = await ApiVersion.findById(versionId);

            if (!version) {
                throw new Error('API version not found');
            }

            version.isDeprecated = true;
            version.deprecationDate = deprecationInfo.deprecationDate || new Date();
            version.sunsetDate = deprecationInfo.sunsetDate || null;

            if (deprecationInfo.migrationGuide) {
                version.migrationGuide = deprecationInfo.migrationGuide;
            }

            await version.save();
            return version;
        } catch (error) {
            throw new Error(`Failed to deprecate API version: ${error.message}`);
        }
    }

    /**
     * Delete an API version
     */
    static async deleteVersion(versionId, userId) {
        try {
            const apiVersion = await ApiVersion.findById(versionId);

            if (!apiVersion) {
                throw new Error('API version not found');
            }

            // Check if user has permission (optional: add permission check here)

            // Delete associated mock servers first
            await MockServer.deleteMany({ versionId: versionId });

            // Delete the API version
            await ApiVersion.findByIdAndDelete(versionId);

            return { message: 'API version deleted successfully' };
        } catch (error) {
            throw new Error(`Failed to delete API version: ${error.message}`);
        }
    }

    /**
     * Generate version compatibility report
     */
    static async generateCompatibilityReport(collectionId) {
        try {
            const versions = await this.getVersions(collectionId);

            const report = {
                totalVersions: versions.length,
                activeVersions: versions.filter(v => v.isActive && !v.isDeprecated).length,
                deprecatedVersions: versions.filter(v => v.isDeprecated).length,
                breakingChanges: 0,
                backwardCompatible: 0,
                versions: []
            };

            versions.forEach(version => {
                if (version.backwardCompatible) {
                    report.backwardCompatible++;
                } else {
                    report.breakingChanges++;
                }

                report.versions.push({
                    version: version.version,
                    name: version.name,
                    isActive: version.isActive,
                    isDeprecated: version.isDeprecated,
                    backwardCompatible: version.backwardCompatible,
                    breakingChanges: version.breakingChanges.length,
                    createdAt: version.createdAt
                });
            });

            return report;
        } catch (error) {
            throw new Error(`Failed to generate compatibility report: ${error.message}`);
        }
    }

    /**
     * Compare two API versions
     */
    static async compareVersions(version1Id, version2Id) {
        try {
            const [version1, version2] = await Promise.all([
                ApiVersion.findById(version1Id),
                ApiVersion.findById(version2Id)
            ]);

            if (!version1 || !version2) {
                throw new Error('One or both versions not found');
            }

            const comparison = {
                versions: {
                    from: version1.version,
                    to: version2.version
                },
                backwardCompatible: version2.backwardCompatible,
                breakingChanges: version2.breakingChanges,
                changelog: version2.changelog,
                migrationGuide: version2.migrationGuide,
                specChanges: this.compareOpenApiSpecs(version1.openApiSpec, version2.openApiSpec)
            };

            return comparison;
        } catch (error) {
            throw new Error(`Failed to compare versions: ${error.message}`);
        }
    }

    /**
     * Validate version format
     */
    static isValidVersionFormat(version) {
        const versionPattern = /^v?\d+(\.\d+){0,2}$/;
        return versionPattern.test(version);
    }

    /**
     * Normalize version format
     */
    static normalizeVersion(version) {
        // Remove 'v' prefix if present
        let normalized = version.startsWith('v') ? version.substring(1) : version;

        // Split version parts
        const parts = normalized.split('.');

        // Ensure we have major.minor.patch format
        while (parts.length < 3) {
            parts.push('0');
        }

        return `v${parts.join('.')}`;
    }

    /**
     * Compare OpenAPI specifications
     */
    static compareOpenApiSpecs(spec1, spec2) {
        if (!spec1 && !spec2) {
            return { hasChanges: false, changes: [] };
        }

        if (!spec1 || !spec2) {
            return {
                hasChanges: true,
                changes: ['OpenAPI specification added or removed']
            };
        }

        const changes = [];

        // Compare basic info
        if (spec1.info?.version !== spec2.info?.version) {
            changes.push(`Version changed from ${spec1.info?.version} to ${spec2.info?.version}`);
        }

        // Compare paths (simplified comparison)
        const paths1 = Object.keys(spec1.paths || {});
        const paths2 = Object.keys(spec2.paths || {});

        const addedPaths = paths2.filter(path => !paths1.includes(path));
        const removedPaths = paths1.filter(path => !paths2.includes(path));

        addedPaths.forEach(path => changes.push(`Added endpoint: ${path}`));
        removedPaths.forEach(path => changes.push(`Removed endpoint: ${path}`));

        return {
            hasChanges: changes.length > 0,
            changes
        };
    }

    /**
     * Get versioning URL for a request
     */
    static getVersionedUrl(baseUrl, version, strategy = 'url', config = {}) {
        switch (strategy) {
            case 'url':
                const pattern = config.urlPattern || '/api/v{version}';
                const versionPart = pattern.replace('{version}', version.replace('v', ''));
                return baseUrl.replace('/api', versionPart);

            case 'query':
                const queryParam = config.queryParam || 'version';
                const separator = baseUrl.includes('?') ? '&' : '?';
                return `${baseUrl}${separator}${queryParam}=${version}`;

            default:
                return baseUrl;
        }
    }

    /**
     * Get versioning headers for a request
     */
    static getVersionHeaders(version, strategy = 'header', config = {}) {
        if (strategy === 'header') {
            const headerName = config.headerName || 'API-Version';
            return { [headerName]: version };
        }

        if (strategy === 'accept') {
            const pattern = config.acceptPattern || 'application/vnd.api+json;version={version}';
            const acceptValue = pattern.replace('{version}', version);
            return { 'Accept': acceptValue };
        }

        return {};
    }
}

module.exports = ApiVersioningService;
