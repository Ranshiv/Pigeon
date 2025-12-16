// utils/spectral.js
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { oas } = require('@stoplight/spectral-rulesets');

/**
 * Utility functions for Spectral ruleset resolution and management
 */

/**
 * Resolve ruleset path based on precedence:
 * 1. Explicit ruleset path (flag)
 * 2. Workspace override at .pigeon/spectral.(yaml|yml|json)
 * 3. Root spectral.(yaml|yml|json) if present
 * 4. Default: Spectral recommended for OpenAPI
 */
async function resolveRuleset(explicitRulesetPath, workspaceRoot = process.cwd()) {
    // Handle built-in rulesets first
    if (explicitRulesetPath === 'oas' || explicitRulesetPath === 'openapi') {
        return {
            type: 'builtin',
            name: 'OpenAPI',
            ruleset: 'oas',
            source: 'built-in',
            sourcePath: '@stoplight/spectral-rulesets/oas'
        };
    }

    // 1. Explicit ruleset path takes highest precedence
    if (explicitRulesetPath) {
        const resolvedPath = path.resolve(explicitRulesetPath);
        if (await fileExists(resolvedPath)) {
            // If the user explicitly points at the standard workspace/root override files,
            // keep the same source classification expected by the rest of the system.
            const workspaceAbs = path.resolve(workspaceRoot);
            const pigeonAbs = path.join(workspaceAbs, '.pigeon');
            const base = path.basename(resolvedPath).toLowerCase();

            const isWithin = (parent, child) => {
                const rel = path.relative(parent, child);
                return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
            };

            let source = 'explicit';
            if (base === 'spectral.yaml' || base === 'spectral.yml' || base === 'spectral.json') {
                if (isWithin(pigeonAbs, resolvedPath)) {
                    source = 'workspace';
                } else if (isWithin(workspaceAbs, resolvedPath)) {
                    source = 'root';
                }
            }

            return {
                type: 'file',
                path: resolvedPath,
                source,
                sourcePath: resolvedPath
            };
        }
        throw new Error(`Ruleset file not found: ${explicitRulesetPath}`);
    }

    // 2. Workspace override in .pigeon directory
    const workspaceOverrides = [
        path.join(workspaceRoot, '.pigeon', 'spectral.yaml'),
        path.join(workspaceRoot, '.pigeon', 'spectral.yml'),
        path.join(workspaceRoot, '.pigeon', 'spectral.json')
    ];

    for (const overridePath of workspaceOverrides) {
        if (await fileExists(overridePath)) {
            return {
                type: 'file',
                path: overridePath,
                source: 'workspace',
                sourcePath: overridePath
            };
        }
    }

    // 3. Root spectral config files
    const rootConfigs = [
        path.join(workspaceRoot, 'spectral.yaml'),
        path.join(workspaceRoot, 'spectral.yml'),
        path.join(workspaceRoot, 'spectral.json')
    ];

    for (const rootPath of rootConfigs) {
        if (await fileExists(rootPath)) {
            return {
                type: 'file',
                path: rootPath,
                source: 'root',
                sourcePath: rootPath
            };
        }
    }

    // 4. Default: Spectral recommended OpenAPI ruleset
    return {
        type: 'builtin',
        name: 'OpenAPI',
        ruleset: 'oas',
        source: 'default',
        sourcePath: '@stoplight/spectral-rulesets/oas'
    };
}

/**
 * Load and parse a ruleset configuration
 */
async function loadRuleset(rulesetConfig) {
    if (rulesetConfig.type === 'builtin') {
        // Return builtin ruleset identifier
        return {
            ruleset: rulesetConfig.ruleset || 'oas',
            info: {
                name: 'OpenAPI Recommended',
                version: 'builtin',
                source: rulesetConfig.source,
                sourcePath: rulesetConfig.sourcePath
            }
        };
    }

    // Load file-based ruleset
    const content = await fs.readFile(rulesetConfig.path, 'utf8');
    const ext = path.extname(rulesetConfig.path).toLowerCase();

    let parsed;
    if (ext === '.json') {
        parsed = JSON.parse(content);
    } else if (ext === '.yaml' || ext === '.yml') {
        parsed = yaml.load(content);
    } else {
        throw new Error(`Unsupported ruleset format: ${ext}. Use .json, .yaml, or .yml`);
    }

    // Spectral core expects `extends` entries to already be ruleset objects.
    // Support common string aliases used in YAML rulesets.
    if (parsed && typeof parsed === 'object' && parsed.extends) {
        const rawExtends = Array.isArray(parsed.extends) ? parsed.extends : [parsed.extends];
        const resolvedExtends = rawExtends.map((ref) => {
            if (typeof ref !== 'string') return ref;

            const normalized = ref.trim().toLowerCase();
            if (normalized === 'spectral:oas' || normalized === 'oas' || normalized === 'openapi' || normalized === 'spectral:openapi') {
                return oas;
            }

            throw new Error(`Unsupported ruleset extends reference: ${ref}`);
        });

        parsed = {
            ...parsed,
            extends: resolvedExtends
        };
    }

    return {
        ruleset: parsed,
        info: {
            name: parsed.name || path.basename(rulesetConfig.path),
            version: parsed.version || 'unknown',
            source: rulesetConfig.source,
            sourcePath: rulesetConfig.path
        }
    };
}

/**
 * Validate ruleset structure and security
 */
function validateRuleset(ruleset, rulesetPath) {
    // Basic structure validation
    if (typeof ruleset !== 'object' || ruleset === null) {
        throw new Error('Ruleset must be an object');
    }

    // Security: validate rule function references are simple identifiers.
    // (Spectral core executes functions by name; disallow inline code like eval("...")).
    const isSafeFunctionName = (value) => {
        if (typeof value !== 'string') return true;
        // Allow common Spectral function naming patterns: letters/numbers/_/./-
        return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value);
    };

    const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach(walk);
            return;
        }

        for (const [key, value] of Object.entries(node)) {
            if (key === 'function' && typeof value === 'string' && !isSafeFunctionName(value)) {
                throw new Error('Ruleset contains potentially dangerous code: invalid function reference');
            }
            walk(value);
        }
    };

    walk(ruleset);

    // Validate path traversal
    if (rulesetPath && (rulesetPath.includes('..') || path.isAbsolute(rulesetPath))) {
        throw new Error('Ruleset path must be relative and cannot contain ".."');
    }

    return true;
}

/**
 * Calculate lint score based on findings
 */
function calculateLintScore(findings, options = {}) {
    const weights = {
        error: 2,
        warn: 1,
        info: 0.5,
        hint: 0.1,
        ...options.weights
    };

    const counts = {
        error: 0,
        warn: 0,
        info: 0,
        hint: 0
    };

    // Count findings by severity
    findings.forEach(finding => {
        const severity = finding.severity || 'error';
        if (counts.hasOwnProperty(severity)) {
            counts[severity]++;
        }
    });

    // Calculate weighted penalty
    const penalty =
        counts.error * weights.error +
        counts.warn * weights.warn +
        counts.info * weights.info +
        counts.hint * weights.hint;

    // Base score of 100, subtract penalty, cap at [0, 100]
    const score = Math.max(0, Math.min(100, 100 - penalty));

    return {
        score: Math.round(score),
        counts,
        weights,
        penalty
    };
}

/**
 * Map Spectral severity to our severity format
 */
function mapSeverity(spectralSeverity) {
    const severityMap = {
        0: 'error',
        1: 'warn',
        2: 'info',
        3: 'hint'
    };

    return severityMap[spectralSeverity] || 'error';
}

/**
 * Normalize Spectral findings to our format
 */
function normalizeFindings(spectralResults) {
    return spectralResults.map(result => ({
        id: result.code || 'unknown',
        message: result.message || 'No message provided',
        severity: mapSeverity(result.severity),
        path: result.path || [],
        range: result.range ? {
            start: {
                line: result.range.start?.line || 0,
                character: result.range.start?.character || 0
            },
            end: {
                line: result.range.end?.line || 0,
                character: result.range.end?.character || 0
            }
        } : undefined,
        source: result.source || 'unknown',
        suggested: Boolean(result.suggested),
        ruleTags: result.ruleTags || []
    }));
}

/**
 * Check if file exists
 */
async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Create default .pigeon directory and sample ruleset
 */
async function createSampleRuleset(workspaceRoot = process.cwd()) {
    const pigeonDir = path.join(workspaceRoot, '.pigeon');
    const rulesetPath = path.join(pigeonDir, 'spectral.yaml');

    // Create .pigeon directory if it doesn't exist
    try {
        await fs.mkdir(pigeonDir, { recursive: true });
    } catch (error) {
        // Directory might already exist
    }

    // Check if ruleset already exists
    if (await fileExists(rulesetPath)) {
        return rulesetPath;
    }

    // Create sample ruleset
    const sampleRuleset = `# Pigeon OpenAPI Linting Ruleset
# Extends the default OpenAPI 3 rules with custom overrides

extends: ["@stoplight/spectral-rulesets/dist/oas/index.js"]

rules:
  # Override default rules
  operation-description: warn
  operation-summary: warn
  
  # Custom rules for your API standards
  # info-contact: error
  # info-license: error
  
  # Disable rules that don't fit your standards
  # operation-operationId: false
`;

    await fs.writeFile(rulesetPath, sampleRuleset, 'utf8');
    return rulesetPath;
}

module.exports = {
    resolveRuleset,
    loadRuleset,
    validateRuleset,
    calculateLintScore,
    mapSeverity,
    normalizeFindings,
    createSampleRuleset,
    fileExists
};
