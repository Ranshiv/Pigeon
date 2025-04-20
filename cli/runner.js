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

/**
 * Run a collection of API tests
 * @param {string} collectionId - Collection ID or path to collection file
 * @param {Object} options - Runner options
 * @returns {Array} - Array of test results
 */
async function runCollection(collectionId, options = {}) {
  const { environment = {}, bail = false, timeout = 30000, parallel = false } = options;

  // Load the collection (from file or database)
  const collection = await loadCollection(collectionId);
  console.log(chalk.gray(`Loaded collection with ${collection.requests.length} requests`));

  // Store results for each request
  const results = [];
  let currentEnvironment = { ...environment };

  // Run each request in the collection
  for (let i = 0; i < collection.requests.length; i++) {
    const request = collection.requests[i];
    console.log(chalk.cyan(`[${i + 1}/${collection.requests.length}] Running: ${request.name || request.url}`));

    try {
      // Run the individual request with current environment
      const result = await runRequest(request, {
        environment: currentEnvironment,
        timeout
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
  const { environment = {}, timeout = 30000 } = options;
  const startTime = Date.now();

  try {
    // Clone environment to avoid mutations
    let currentEnv = { ...environment };
    const requestObj = { ...request };

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
    // This would require connecting to the database and using your models
    // For example purposes, this is a placeholder
    throw new Error("Database loading not implemented yet");

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