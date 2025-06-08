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

  try {
    // Clone environment to avoid mutations
    let currentEnv = { ...environment };
    const requestObj = { ...request };

    // If we have a context ID, create request-specific variables context
    let requestContextId;
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
      headers: {}
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
        const connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/pigeon';
        await mongoose.connect(connectionString, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        });
      }

      // Try to find collection by ID
      const collection = await Collection.findById(collectionId);

      if (collection) {
        return collection.toObject();
      } else {
        throw new Error(`Collection "${collectionId}" not found in database`);
      }
    } catch (dbError) {
      console.warn(chalk.yellow(`Database error: ${dbError.message}`));

      // As a fallback, try to treat it as a collection name and create a mock collection
      console.log(chalk.gray(`Creating mock collection for "${collectionId}"`));
      return {
        _id: collectionId,
        name: collectionId,
        description: `Mock collection for ${collectionId}`,
        requests: [],
        variables: []
      };
    }

  } catch (error) {
    throw new Error(`Failed to load collection "${collectionId}": ${error.message}`);
  }
}

module.exports = {
  runCollection,
  runBatch,
  runRequest,
  replaceEnvVars
};