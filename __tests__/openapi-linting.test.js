// __tests__/openapi-linting.test.js
const IntegrationService = require('../services/IntegrationService');
const { runLint } = require('../cli/runner');
const fs = require('fs').promises;
const path = require('path');

describe('OpenAPI Linting', () => {
    let integrationService;

    beforeEach(() => {
        integrationService = new IntegrationService();
    });

    describe('IntegrationService.lintOpenApi', () => {
        test('should lint valid OpenAPI spec and return findings', async () => {
            const validSpec = {
                openapi: '3.0.0',
                info: {
                    title: 'Test API',
                    version: '1.0.0'
                },
                paths: {
                    '/test': {
                        get: {
                            summary: 'Test endpoint',
                            responses: {
                                '200': {
                                    description: 'Success'
                                }
                            }
                        }
                    }
                }
            };

            const result = await integrationService.lintOpenApi(validSpec);

            expect(result).toHaveProperty('findings');
            expect(result).toHaveProperty('counts');
            expect(result).toHaveProperty('score');
            expect(result).toHaveProperty('rulesetInfo');
            expect(result).toHaveProperty('lintedAt');
            expect(typeof result.score).toBe('number');
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        test('should handle invalid YAML and return parse error', async () => {
            const invalidSpec = 'invalid: yaml: content:\n  - broken';

            const result = await integrationService.lintOpenApi(invalidSpec);

            expect(result.parseError).toBe(true);
            expect(result.findings).toHaveLength(1);
            expect(result.findings[0].id).toBe('parse-error');
            expect(result.score).toBe(0);
        });

        test('should respect timeout setting', async () => {
            const validSpec = {
                openapi: '3.0.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {}
            };

            // Mock a slow operation by stubbing the execution
            const originalExecute = integrationService.executeLinting;
            integrationService.executeLinting = async () => {
                return new Promise(resolve => setTimeout(resolve, 2000));
            };

            await expect(
                integrationService.lintOpenApi(validSpec, { timeoutMs: 500 })
            ).rejects.toThrow('timeout');

            // Restore original method
            integrationService.executeLinting = originalExecute;
        });

        test('should handle custom ruleset path', async () => {
            const validSpec = {
                openapi: '3.0.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {}
            };

            const result = await integrationService.lintOpenApi(validSpec, {
                rulesetPath: '.pigeon/spectral.yaml'
            });

            expect(result.rulesetInfo.source).toBe('workspace');
            expect(result.rulesetInfo.sourcePath).toContain('spectral.yaml');
        });

        test('should enforce size limits', async () => {
            const largeSpec = {
                openapi: '3.0.0',
                info: { title: 'Large API', version: '1.0.0' },
                paths: {}
            };

            // Create a large spec by adding many paths
            for (let i = 0; i < 1000; i++) {
                largeSpec.paths[`/endpoint-${i}`] = {
                    get: {
                        summary: `Endpoint ${i}`,
                        responses: { '200': { description: 'Success' } }
                    }
                };
            }

            // Write to file to test file size checking
            const tempFile = path.join(__dirname, 'temp-large-spec.json');
            await fs.writeFile(tempFile, JSON.stringify(largeSpec), 'utf8');

            await expect(
                integrationService.lintOpenApi(tempFile, { maxSizeMB: 0.001 })
            ).rejects.toThrow('too large');

            // Cleanup
            await fs.unlink(tempFile);
        });
    });

    describe('CLI lint command', () => {
        test('should run lint and return appropriate exit code', async () => {
            // Create a test spec file
            const testSpec = {
                openapi: '3.0.0',
                info: { title: 'CLI Test', version: '1.0.0' },
                paths: {
                    '/test': {
                        get: {
                            // Missing summary and description to trigger warnings
                            responses: { '200': { description: 'OK' } }
                        }
                    }
                }
            };

            const tempFile = path.join(__dirname, 'temp-cli-spec.json');
            await fs.writeFile(tempFile, JSON.stringify(testSpec, null, 2), 'utf8');

            try {
                const exitCode = await runLint({
                    spec: tempFile,
                    format: 'json',
                    failOn: 'errors'
                });

                expect(typeof exitCode).toBe('number');
                expect(exitCode).toBeGreaterThanOrEqual(0);
                expect(exitCode).toBeLessThanOrEqual(3);
            } finally {
                // Cleanup
                await fs.unlink(tempFile);
            }
        });

        test('should return error code for missing spec file', async () => {
            const exitCode = await runLint({
                spec: 'non-existent-file.json',
                format: 'json'
            });

            expect(exitCode).toBe(2);
        });

        test('should validate save options', async () => {
            const testSpec = {
                openapi: '3.0.0',
                info: { title: 'Save Test', version: '1.0.0' },
                paths: {}
            };

            const tempFile = path.join(__dirname, 'temp-save-spec.json');
            await fs.writeFile(tempFile, JSON.stringify(testSpec, null, 2), 'utf8');

            try {
                const exitCode = await runLint({
                    spec: tempFile,
                    save: true
                    // Missing apiVersionId should trigger validation error
                });

                expect(exitCode).toBe(2);
            } finally {
                await fs.unlink(tempFile);
            }
        });
    });

    describe('Scoring system', () => {
        test('should calculate scores correctly', async () => {
            const { calculateLintScore } = require('../utils/spectral');

            // Test with various finding combinations
            const findings = [
                { severity: 'error' },
                { severity: 'error' },
                { severity: 'warn' },
                { severity: 'info' },
                { severity: 'hint' }
            ];

            const result = calculateLintScore(findings);

            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
            expect(result.counts.error).toBe(2);
            expect(result.counts.warn).toBe(1);
            expect(result.counts.info).toBe(1);
            expect(result.counts.hint).toBe(1);
        });

        test('should return perfect score for no findings', async () => {
            const { calculateLintScore } = require('../utils/spectral');

            const result = calculateLintScore([]);

            expect(result.score).toBe(100);
            expect(result.counts.error).toBe(0);
            expect(result.counts.warn).toBe(0);
        });
    });

    describe('Ruleset resolution', () => {
        test('should resolve workspace ruleset', async () => {
            const { resolveRuleset } = require('../utils/spectral');

            const result = await resolveRuleset(null, process.cwd());

            // Should find the .pigeon/spectral.yaml we created
            expect(result.source).toBe('workspace');
            expect(result.path).toContain('spectral.yaml');
        });

        test('should validate ruleset security', async () => {
            const { validateRuleset } = require('../utils/spectral');

            const dangerousRuleset = {
                extends: ['@stoplight/spectral-rulesets/dist/oas/index.js'],
                rules: {
                    'dangerous-rule': {
                        given: '$.info',
                        then: {
                            function: 'eval("malicious code")'
                        }
                    }
                }
            };

            expect(() => {
                validateRuleset(dangerousRuleset);
            }).toThrow('potentially dangerous code');
        });
    });
});
