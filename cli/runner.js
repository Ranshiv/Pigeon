/**
 * Runner module for Pigeon CLI
 * Handles the execution of collections, batches, and individual requests
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const chalk = require('chalk');
const { executePreRequestScript, executeTestScript } = require('../utils/scriptRunner');
const { loadEnvironment } = require('./environment');
const VariableResolver = require('../services/VariableResolver');
const Collection = require('../models/Collection');

/**
 * Run a collection of API tests
 * @param {string} collectionId - Collection ID or path to collection file
 * @param {Object} options - Runner options
 * @returns {Array} - Array of test results
 */
async function runCollection(collectionId, options = {}) {
  const {
    environment = {},
    bail = false,
    timeout = 30000,
    parallel = false,
    userId,
    workspaceId,
    environmentId,
    environmentName
  } = options;

  // Load the collection (from file or database)
  const collection = await loadCollection(collectionId);
  console.log(chalk.gray(`Loaded collection with ${collection.requests.length} requests`));

  // Initialize environment with scoping support
  let environmentData;
  let contextId;

  if (typeof environment === 'string' || environmentId || environmentName) {
    // Load environment with full scoping
    try {
      environmentData = await loadEnvironment({
        userId,
        workspaceId,
        environmentId,
        environmentName: environmentName || environment,
        collectionId: collection._id || collection.id
      });

      console.log(chalk.gray(`Loaded environment with ${environmentData.source} source`));
      if (environmentData.resolution) {
        const res = environmentData.resolution;
        console.log(chalk.gray(`Variable layers: Global(${res.global}) Collection(${res.collection}) Environment(${res.environment}) Request(${res.request})`));
      }
    } catch (error) {
      console.warn(chalk.yellow(`Failed to load environment: ${error.message}`));
      environmentData = { variables: {}, source: 'empty' };
    }
  } else {
    // Use provided environment object (backward compatibility)
    environmentData = { variables: environment, source: 'provided' };
  }

  // Store results for each request
  const results = [];
  let currentEnvironment = { ...environmentData.variables };

  // Create a persistent context for the collection run
  if (environmentData.source === 'scoped') {
    contextId = `cli-collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await VariableResolver.createContext(contextId, {
      userId,
      workspaceId,
      environmentId,
      collectionId: collection._id || collection.id,
      requestLocalVariables: {}
    });
  }

  // Run each request in the collection
  for (let i = 0; i < collection.requests.length; i++) {
    const request = collection.requests[i];
    console.log(chalk.cyan(`[${i + 1}/${collection.requests.length}] Running: ${request.name || request.url}`));

    try {
      // Run the individual request with current environment
      const result = await runRequest(request, {
        environment: currentEnvironment,
        timeout,
        contextId,
        collectionId: collection._id || collection.id,
        userId,
        workspaceId,
        environmentId
      });

      // Update environment with any variables set during this request
      currentEnvironment = { ...currentEnvironment, ...result.environment };

      // Add to results
      results.push(result);

      // Show test results summary
      const passedTests = result.tests.filter(t => t.passed).length;
      const failedTests = result.tests.length - passedTests;

      if (failedTests > 0) {
        console.log(chalk.red(`  ✗ ${failedTests} tests failed, ${passedTests} passed`));

        // List failed tests
        result.tests.filter(t => !t.passed).forEach(t => {
          console.log(chalk.red(`    ✗ ${t.name}`));
        });

        // Stop on first test failure if bail is enabled
        if (bail) {
          console.log(chalk.yellow('Stopping due to test failure (--bail option)'));
          break;
        }
      } else if (passedTests > 0) {
        console.log(chalk.green(`  ✓ ${passedTests} tests passed`));
      } else {
        console.log(chalk.yellow('  ⚠ No tests in this request'));
      }
    } catch (error) {
      // Handle request execution error
      const result = {
        request,
        response: null,
        error: {
          message: error.message,
          stack: error.stack
        },
        tests: [],
        environment: currentEnvironment
      };
      results.push(result);

      console.log(chalk.red(`  ✗ Error: ${error.message}`));

      if (bail) {
        console.log(chalk.yellow('Stopping due to request error (--bail option)'));
        break;
      }
    }
  }

  // Cleanup context if created
  if (contextId) {
    VariableResolver.destroyContext(contextId);
  }

  return results;
}

/**
 * Replace environment variables in a string
 * @param {string} text - Text to process
 * @param {Object} env - Environment variables
 * @returns {string} - Processed text
 */
function replaceEnvVars(text, env) {
  if (!text || typeof text !== 'string') return text;

  // Match patterns like {{VARIABLE_NAME}} with optional spaces inside
  const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;

  return text.replace(regex, (match, varName) => {
    const key = varName.trim();

    // Direct lookup with same case
    if (env[key] !== undefined) {
      return env[key];
    }

    // Case insensitive lookup
    const lowerKey = key.toLowerCase();
    const validKey = Object.keys(env).find(k => k.toLowerCase() === lowerKey);

    if (validKey !== undefined) {
      return env[validKey];
    }

    // Keep original if no match
    console.log(chalk.yellow(`  ⚠ Warning: Environment variable '${key}' not found`));
    return match;
  });
}

/**
 * Run a batch of API requests (in parallel or series)
 * @param {Array} requests - Array of request objects
 * @param {Object} options - Runner options
 * @returns {Array} - Array of test results
 */
async function runBatch(requests, options = {}) {
  const { parallel = false } = options;

  if (parallel) {
    // Run requests in parallel
    return Promise.all(requests.map(request => runRequest(request, options)));
  } else {
    // Run requests in series (with shared environment)
    const results = [];
    let environment = { ...(options.environment || {}) };

    for (const request of requests) {
      const result = await runRequest(request, {
        ...options,
        environment
      });
      results.push(result);
      environment = { ...environment, ...result.environment };
    }

    return results;
  }
}

/**
 * Run an individual API request
 * @param {Object} request - The request configuration
 * @param {Object} options - Runner options
 * @returns {Object} - Test result object
 */
async function runRequest(request, options = {}) {
  const {
    environment = {},
    timeout = 30000,
    contextId,
    collectionId,
    userId,
    workspaceId,
    environmentId
  } = options;
  const startTime = Date.now();
  let requestContextId;

  try {
    // Clone environment to avoid mutations
    let currentEnv = { ...environment };
    const requestObj = { ...request };

    // If we have a context ID, create request-specific variables context
    if (contextId) {
      requestContextId = `${contextId}-req-${Date.now()}`;

      // Get any request-local variables from the request
      const requestLocalVars = {};
      if (request.variables && Array.isArray(request.variables)) {
        request.variables.forEach(variable => {
          requestLocalVars[variable.key] = variable.value;
        });
      }

      // Create request context with local variables
      try {
        await VariableResolver.createContext(requestContextId, {
          userId,
          workspaceId,
          environmentId,
          collectionId,
          requestLocalVariables: requestLocalVars
        });

        // Get resolved variables for this request
        const resolvedVars = VariableResolver.getAllVariables(requestContextId);
        currentEnv = {};
        Object.entries(resolvedVars).forEach(([key, metadata]) => {
          currentEnv[key] = metadata.value;
        });
      } catch (error) {
        console.log(chalk.yellow(`  ⚠ Variable resolution error: ${error.message}`));
        // Fall back to provided environment
      }
    }

    // Process environment variables in URL and headers before script execution
    requestObj.url = replaceEnvVars(requestObj.url, currentEnv);

    if (Array.isArray(requestObj.headers)) {
      requestObj.headers = requestObj.headers.map(header => ({
        ...header,
        value: replaceEnvVars(header.value, currentEnv)
      }));
    }

    // Process environment variables in body
    if (requestObj.body && typeof requestObj.body === 'string') {
      requestObj.body = replaceEnvVars(requestObj.body, currentEnv);
    }

    // Execute pre-request script if present
    if (request.preRequestScript) {
      // Add needed objects that scripts might expect
      const preRequestContext = {
        environment: currentEnv, // Add environment object for compatibility
        request: requestObj,
        variables: {} // Add variables for script use
      };

      const preRequestResult = executePreRequestScript(
        request.preRequestScript,
        preRequestContext,
        currentEnv
      );

      if (preRequestResult.error) {
        console.log(chalk.yellow(`  ⚠ Pre-request script error: ${preRequestResult.error.message}`));
      } else {
        // Update request and environment
        Object.assign(requestObj, preRequestResult.request);
        currentEnv = preRequestResult.environment;
      }
    }

    // Process environment variables again after script execution
    requestObj.url = replaceEnvVars(requestObj.url, currentEnv);

    if (Array.isArray(requestObj.headers)) {
      requestObj.headers = requestObj.headers.map(header => ({
        ...header,
        value: replaceEnvVars(header.value, currentEnv)
      }));
    }

    // Prepare request configuration for axios
    const config = {
      url: requestObj.url,
      method: requestObj.method || 'GET',
      timeout,
      headers: {},
      // API tests must inspect negative responses (4xx/5xx) instead of
      // treating them as transport failures. Assertions determine whether the
      // returned status is correct for the case.
      validateStatus: () => true
    };

    // Add headers
    if (Array.isArray(requestObj.headers)) {
      requestObj.headers.forEach(header => {
        if (header.name && header.value) {
          config.headers[header.name] = header.value;
        }
      });
    } else if (typeof requestObj.headers === 'object') {
      Object.assign(config.headers, requestObj.headers);
    }

    // Add body if applicable
    if (requestObj.body && ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())) {
      try {
        if (requestObj.bodyType === 'json') {
          // Try to parse JSON or use as is if already an object
          config.data = typeof requestObj.body === 'string' ? JSON.parse(requestObj.body) : requestObj.body;
        } else if (requestObj.bodyType === 'x-www-form-urlencoded') {
          const params = new URLSearchParams();
          const bodyObj = typeof requestObj.body === 'string' ? JSON.parse(requestObj.body) : requestObj.body;

          for (const [key, value] of Object.entries(bodyObj)) {
            params.append(key, value);
          }

          config.data = params;
        } else {
          config.data = requestObj.body;
        }
      } catch (bodyError) {
        console.log(chalk.yellow(`  ⚠ Body parsing error: ${bodyError.message}`));
        config.data = requestObj.body; // Use raw body as fallback
      }
    }

    // Send the request
    const response = await axios(config);
    const duration = Date.now() - startTime;

    // Process response
    const responseObj = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.data,
      duration,
      size: JSON.stringify(response.data).length // Approximate size calculation
    };

    // Execute test script if present
    let tests = [];
    if (request.testScript) {
      const testScriptResult = executeTestScript(
        request.testScript,
        responseObj,
        currentEnv
      );

      if (testScriptResult.error) {
        console.log(chalk.yellow(`  ⚠ Test script error: ${testScriptResult.error.message}`));
        tests = [{
          name: 'Test Script Error',
          passed: false,
          error: testScriptResult.error.message
        }];
      } else {
        // Get results and update environment
        tests = testScriptResult.results;
        currentEnv = testScriptResult.environment;
      }
    }

    // Cleanup request context if created
    if (requestContextId) {
      VariableResolver.destroyContext(requestContextId);
    }

    // Return result object
    return {
      request: requestObj,
      response: responseObj,
      tests,
      error: null,
      environment: currentEnv,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Cleanup request context if created
    if (requestContextId) {
      VariableResolver.destroyContext(requestContextId);
    }

    // Format axios error response if available
    let responseObj = null;
    if (error.response) {
      responseObj = {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        body: error.response.data,
        duration,
        size: error.response.data ? JSON.stringify(error.response.data).length : 0
      };
    }

    throw {
      message: error.message,
      stack: error.stack,
      response: responseObj
    };
  }
}

/**
 * Load a collection from file or database
 * @param {string} collectionId - Collection ID or path to file
 * @returns {Object} - Collection object
 */
async function loadCollection(collectionId) {
  try {
    // First try to load as a file path
    if (collectionId.endsWith('.json') || collectionId.includes('/') || collectionId.includes('\\')) {
      // Handle as file path
      const filePath = path.isAbsolute(collectionId)
        ? collectionId
        : path.join(process.cwd(), collectionId);

      const fileContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(fileContent);
    }

    // Otherwise try to load from database
    try {
      // Check if MongoDB connection exists
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        // Connect to database (using connection string from env)
        const connectionString = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/pigeon';
        await mongoose.connect(connectionString, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });
      }

      // Try to find collection by ID when valid ObjectId, otherwise by name
      const isObjectId = mongoose.Types.ObjectId.isValid(collectionId);
      const collection = isObjectId
        ? await Collection.findById(collectionId)
        : await Collection.findOne({ name: collectionId }).sort({ updatedAt: -1 });

      if (collection) {
        return collection.toObject();
      } else {
        throw new Error(`Collection "${collectionId}" not found in database`);
      }
    } catch (dbError) {
      // Do not silently fall back to an empty mock collection — that makes
      // runCollection run zero requests and report success (0/0/0) in CI,
      // masking a total DB failure. Surface the error and exit non-zero.
      console.error(chalk.red(`Database error loading collection "${collectionId}": ${dbError.message}`));
      throw dbError;
    }

  } catch (error) {
    throw new Error(`Failed to load collection "${collectionId}": ${error.message}`);
  }
}

/**
 * Export a collection to a CI/CD-friendly JSON file
 * @param {string} collectionId - Collection ID or path to file
 * @param {string} outputPath - Output JSON file path
 * @returns {Object} Export metadata summary
 */
async function exportCollection(collectionId, outputPath) {
  const collection = await loadCollection(collectionId);

  const normalizedRequests = Array.isArray(collection.requests)
    ? collection.requests.map((request, index) => ({
      name: request.name || `Request ${index + 1}`,
      url: request.url,
      method: request.method || 'GET',
      headers: Array.isArray(request.headers) ? request.headers : [],
      params: Array.isArray(request.params) ? request.params : [],
      body: request.body || '',
      bodyType: request.bodyType || 'none',
      preRequestScript: request.preRequestScript || '',
      testScript: request.testScript || '',
      graphql: request.graphql || null,
      variables: Array.isArray(request.variables) ? request.variables : []
    }))
    : [];

  const exportedPayload = {
    schemaVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    source: {
      collectionId: collection._id || collection.id || collectionId,
      name: collection.name || String(collectionId)
    },
    // Keep top-level structure compatible with `runCollection` loader.
    name: collection.name || String(collectionId),
    description: collection.description || '',
    variables: Array.isArray(collection.variables) ? collection.variables : [],
    requests: normalizedRequests,
    metadata: {
      requestCount: normalizedRequests.length,
      generatedBy: 'pigeon-cli'
    }
  };

  const absoluteOutputPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath);

  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await fs.writeFile(absoluteOutputPath, JSON.stringify(exportedPayload, null, 2), 'utf8');

  return {
    outputPath: absoluteOutputPath,
    requestCount: normalizedRequests.length,
    name: exportedPayload.name
  };
}

/**
 * Run OpenAPI linting with Spectral
 * @param {Object} options - Lint options
 * @returns {number} - Exit code (0=success, 1=fail threshold, 2=invalid input, 3=runtime error)
 */
async function runLint(options) {
  const {
    spec,
    ruleset,
    format = 'stylish',
    output,
    failOn = 'errors',
    save = false,
    apiVersionId,
    workspaceId,
    timeout = 10000,
    maxSize = 20
  } = options;

  try {
    // Validate inputs
    if (!spec) {
      console.error(chalk.red('Error: Spec file path is required'));
      return 2;
    }

    // Check if spec file exists
    try {
      const fsSync = require('fs');
      fsSync.accessSync(spec);
    } catch {
      console.error(chalk.red(`Error: Spec file not found: ${spec}`));
      return 2;
    }

    // Validate save options
    if (save && !apiVersionId) {
      console.error(chalk.red('Error: --api-version-id is required when using --save'));
      return 2;
    }

    console.log(chalk.gray(`📋 Linting OpenAPI specification: ${spec}`));

    // Use direct Spectral implementation to avoid service loading issues
    const { Spectral, Document } = require('@stoplight/spectral-core');
    const { Json, Yaml } = require('@stoplight/spectral-parsers');
    const { oas } = require('@stoplight/spectral-rulesets');
    const fsSync = require('fs');

    // Read and parse spec file
    const specContent = fsSync.readFileSync(spec, 'utf8');
    const ext = path.extname(spec).toLowerCase();
    const parser = (ext === '.yaml' || ext === '.yml') ? Yaml : Json;

    // Create Spectral instance and run linting
    const spectral = new Spectral();
    spectral.setRuleset(oas);
    const doc = new Document(specContent, parser);
    const results = await spectral.run(doc);

    // Process results into expected format
    const errors = results.filter(r => r.severity === 0);
    const warnings = results.filter(r => r.severity === 1);
    const infos = results.filter(r => r.severity === 2);
    const hints = results.filter(r => r.severity === 3);

    const deduction = errors.length * 10 + warnings.length * 5 + infos.length * 2 + hints.length * 1;
    const score = Math.max(0, Math.min(100, 100 - deduction));

    const lintResult = {
      score,
      findings: results,
      counts: {
        errors: errors.length,
        warnings: warnings.length,
        infos: infos.length,
        hints: hints.length
      },
      rulesetInfo: {
        name: 'OpenAPI',
        sourcePath: 'built-in'
      },
      lintedAt: new Date().toISOString(),
      parseError: false
    };

    // Handle parse errors
    if (lintResult.parseError) {
      console.error(chalk.red('Parse error in OpenAPI specification:'));
      console.error(chalk.red(lintResult.findings[0]?.message || 'Unknown parse error'));
      return 2;
    }

    // Format and display results
    const { formatLintOutput } = require('./lintFormatter');
    const formattedOutput = formatLintOutput(lintResult, format);
    console.log(formattedOutput);

    // Print summary
    const { counts } = lintResult;
    console.log('\n' + chalk.cyan('📊 Lint Summary:'));
    console.log(`Score: ${lintResult.score}/100`);
    console.log(`Errors: ${chalk.red(counts.errors)}, Warnings: ${chalk.yellow(counts.warnings)}, Info: ${chalk.blue(counts.infos)}, Hints: ${chalk.gray(counts.hints)}`);
    console.log(`Ruleset: ${lintResult.rulesetInfo.name} (${lintResult.rulesetInfo.sourcePath})`);

    // Save to file if requested
    if (output) {
      let outputData;
      if (format === 'json') {
        outputData = JSON.stringify(lintResult, null, 2);
      } else {
        outputData = formattedOutput;
      }

      await fs.writeFile(output, outputData, 'utf8');
      console.log(chalk.gray(`Results saved to: ${output}`));
    }

    // Save to database if requested
    if (save && apiVersionId) {
      try {
        await saveLintResults(apiVersionId, lintResult);
        console.log(chalk.gray(`Results saved to database for API version: ${apiVersionId}`));
      } catch (saveError) {
        console.warn(chalk.yellow(`Warning: Failed to save to database: ${saveError.message}`));
      }
    }

    // Determine exit code based on fail threshold
    let exitCode = 0;
    if (failOn === 'warnings' && (counts.warnings > 0 || counts.errors > 0)) {
      exitCode = 1;
    } else if (failOn === 'errors' && counts.errors > 0) {
      exitCode = 1;
    }

    if (exitCode === 1) {
      console.log(chalk.red(`\n❌ Lint failed: ${failOn} threshold breached`));
    } else {
      console.log(chalk.green(`\n✅ Lint passed`));
    }

    return exitCode;

  } catch (error) {
    console.error(chalk.red('❌ Lint execution failed:'), error.message);

    // Check for specific error types
    if (error.message.includes('timeout')) {
      console.error(chalk.gray('Try increasing the timeout with --timeout option'));
      return 3;
    } else if (error.message.includes('too large')) {
      console.error(chalk.gray('Try increasing the size limit with --max-size option'));
      return 3;
    } else if (error.message.includes('ruleset')) {
      console.error(chalk.gray('Check your ruleset file path and format'));
      return 2;
    }

    return 3;
  }
}

/**
 * Save lint results to database via API
 */
async function saveLintResults(apiVersionId, lintResult) {
  // Ensure database connection
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    const connectionString = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/pigeon';
    await mongoose.connect(connectionString, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }

  const ApiVersion = require('../models/ApiVersion');

  const severityMap = {
    0: 'error',
    1: 'warn',
    2: 'info',
    3: 'hint',
    error: 'error',
    warn: 'warn',
    warning: 'warn',
    info: 'info',
    hint: 'hint'
  };

  const findings = (lintResult.findings || []).map((finding) => ({
    id: finding.code || finding.id || 'unknown-rule',
    message: finding.message || 'Unknown lint finding',
    severity: severityMap[finding.severity] || 'error',
    path: Array.isArray(finding.path) ? finding.path : [],
    range: finding.range || undefined,
    docsUrl: finding.documentationUrl || finding.docsUrl || undefined,
    suggested: Boolean(finding.suggested),
    source: finding.source || undefined,
    ruleTags: Array.isArray(finding.tags) ? finding.tags : []
  }));

  const updated = await ApiVersion.findByIdAndUpdate(
    apiVersionId,
    {
      lintFindings: findings,
      lintScore: typeof lintResult.score === 'number' ? lintResult.score : null,
      lintedAt: lintResult.lintedAt ? new Date(lintResult.lintedAt) : new Date(),
      rulesetInfo: lintResult.rulesetInfo || null
    },
    { new: true }
  );

  if (!updated) {
    throw new Error(`API version not found: ${apiVersionId}`);
  }
}

module.exports = {
  runCollection,
  runBatch,
  runRequest,
  replaceEnvVars,
  runLint,
  exportCollection
};
