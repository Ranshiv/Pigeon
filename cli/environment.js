/**
 * Environment module for Pigeon CLI
 * Handles loading environment variables for test runs
 */

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

/**
 * Load an environment from file or database
 * @param {string} environmentName - Environment name or path to file
 * @returns {Promise<Object>} - Environment variables
 */
async function loadEnvironment(environmentName) {
  try {
    // First try to load from a file path
    if (environmentName.endsWith('.json') ||
      environmentName.endsWith('.env') ||
      environmentName.includes('/') ||
      environmentName.includes('\\')) {

      // Handle as file path
      return await loadEnvironmentFromFile(environmentName);
    }

    // Otherwise try to load from database
    return await loadEnvironmentFromDatabase(environmentName);
  } catch (error) {
    console.warn(`Warning: Failed to load environment "${environmentName}": ${error.message}`);
    // Return empty environment in case of failure
    return {};
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
 * @returns {Promise<Object>} - Environment variables
 */
async function loadEnvironmentFromDatabase(environmentName) {
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

    // Find environment by name
    // This assumes you have an Environment model defined elsewhere
    const Environment = mongoose.model('Environment');
    const environment = await Environment.findOne({ name: environmentName });

    if (!environment) {
      throw new Error(`Environment "${environmentName}" not found in database`);
    }

    // Convert from database format to flat key-value pairs
    const envVars = {};

    for (const variable of environment.variables) {
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