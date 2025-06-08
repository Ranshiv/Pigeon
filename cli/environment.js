/**
 * Environment module for Pigeon CLI
 * Handles loading environment variables for test runs with full scoping support
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const VariableResolver = require('../services/VariableResolver');
const Environment = require('../models/Environment');
const Collection = require('../models/Collection');

/**
 * Load environment variables with full scoping support
 * @param {string|Object} environmentInput - Environment name, path to file, or options object
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Resolved environment variables with metadata
 */
async function loadEnvironment(environmentInput, options = {}) {
  try {
    // Handle options object input
    if (typeof environmentInput === 'object') {
      return await loadEnvironmentWithScoping(environmentInput);
    }

    // Handle string input (backward compatibility)
    const environmentName = environmentInput;

    // First try to load from a file path
    if (environmentName.endsWith('.json') ||
      environmentName.endsWith('.env') ||
      environmentName.includes('/') ||
      environmentName.includes('\\')) {

      // Handle as file path
      const fileVars = await loadEnvironmentFromFile(environmentName);
      return { variables: fileVars, source: 'file', path: environmentName };
    }

    // Otherwise try to load from database
    const dbVars = await loadEnvironmentFromDatabase(environmentName, options);
    return { variables: dbVars, source: 'database', name: environmentName };
  } catch (error) {
    console.warn(`Warning: Failed to load environment "${environmentName}": ${error.message}`);
    // Return empty environment in case of failure
    return { variables: {}, source: 'empty', error: error.message };
  }
}

/**
 * Load environment with full variable scoping
 * @param {Object} options - Environment loading options
 * @returns {Promise<Object>} - Resolved variables with full scoping
 */
async function loadEnvironmentWithScoping(options = {}) {
  const {
    userId,
    workspaceId,
    environmentId,
    environmentName,
    collectionId,
    requestLocalVariables = {}
  } = options;

  try {
    // Create a context for variable resolution
    const contextId = `cli-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    let finalEnvironmentId = environmentId;

    // If environment name provided instead of ID, resolve it
    if (environmentName && !environmentId && userId) {
      const environment = await Environment.findOne({
        name: environmentName,
        userId: userId,
        workspaceId: workspaceId || null
      });

      if (environment) {
        finalEnvironmentId = environment._id;
      } else {
        console.warn(`Environment "${environmentName}" not found for user`);
      }
    }

    // Create variable resolution context
    const context = await VariableResolver.createContext(contextId, {
      userId,
      workspaceId,
      environmentId: finalEnvironmentId,
      collectionId,
      requestLocalVariables
    });

    // Get all resolved variables
    const allVariables = VariableResolver.getAllVariables(contextId);

    // Create final variables object with just the values
    const resolvedVariables = {};
    Object.entries(allVariables).forEach(([key, metadata]) => {
      resolvedVariables[key] = metadata.value;
    });

    // Cleanup context
    VariableResolver.destroyContext(contextId);

    return {
      variables: resolvedVariables,
      source: 'scoped',
      contextId,
      layers: context.layers,
      metadata: allVariables,
      resolution: {
        global: Object.keys(context.layers.global).length,
        collection: Object.keys(context.layers.collection).length,
        environment: Object.keys(context.layers.environment).length,
        request: Object.keys(context.layers.request).length
      }
    };

  } catch (error) {
    console.error('Error loading environment with scoping:', error);
    return {
      variables: requestLocalVariables || {},
      source: 'fallback',
      error: error.message
    };
  }
}

/**
 * Load environment variables from a file
 * @param {string} filePath - Path to environment file
 * @returns {Promise<Object>} - Environment variables
 */
async function loadEnvironmentFromFile(filePath) {
  // Resolve path
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.join(process.cwd(), filePath);

  try {
    // Read and parse based on file extension
    const fileContent = await fs.readFile(resolvedPath, 'utf8');

    if (filePath.endsWith('.json')) {
      // JSON format
      return JSON.parse(fileContent);
    } else if (filePath.endsWith('.env')) {
      // .env format
      return parseEnvFile(fileContent);
    } else {
      // Try JSON first, fall back to .env format
      try {
        return JSON.parse(fileContent);
      } catch (e) {
        return parseEnvFile(fileContent);
      }
    }
  } catch (error) {
    throw new Error(`Failed to load environment file: ${error.message}`);
  }
}

/**
 * Parse .env format file content
 * @param {string} content - File content
 * @returns {Object} - Environment variables
 */
function parseEnvFile(content) {
  const env = {};

  // Split by lines and process each line
  const lines = content.split('\n');

  for (let line of lines) {
    // Remove comments
    const commentPosition = line.indexOf('#');
    if (commentPosition !== -1) {
      line = line.substring(0, commentPosition);
    }

    // Trim whitespace
    line = line.trim();
    if (!line) continue;

    // Extract key and value (supporting quotes)
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

      env[key] = value;
    }
  }

  return env;
}

/**
 * Load environment from database
 * @param {string} environmentName - Environment name
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Environment variables
 */
async function loadEnvironmentFromDatabase(environmentName, options = {}) {
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

    // Build query conditions
    const query = { name: environmentName };
    if (options.userId) {
      query.userId = options.userId;
    }
    if (options.workspaceId) {
      query.workspaceId = options.workspaceId;
    }

    // Find environment by name and user context
    const environment = await Environment.findOne(query);

    if (!environment) {
      throw new Error(`Environment "${environmentName}" not found in database`);
    }

    // Convert from database format to flat key-value pairs
    const envVars = {};

    for (const variable of environment.variables || []) {
      envVars[variable.key] = variable.value;
    }

    return envVars;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Save an environment to file
 * @param {Object} env - Environment variables
 * @param {string} filePath - Path to save environment to
 * @returns {Promise<void>}
 */
async function saveEnvironment(env, filePath) {
  try {
    // Determine format based on file extension
    if (filePath.endsWith('.json')) {
      // Save as JSON
      await fs.writeFile(filePath, JSON.stringify(env, null, 2));
    } else {
      // Save as .env format
      const content = Object.entries(env)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      await fs.writeFile(filePath, content);
    }
  } catch (error) {
    throw new Error(`Failed to save environment: ${error.message}`);
  }
}

module.exports = {
  loadEnvironment,
  saveEnvironment
};