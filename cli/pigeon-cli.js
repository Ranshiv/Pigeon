#!/usr/bin/env node

/**
 * Pigeon CLI
 * Command-line tool for running Pigeon API tests in CI/CD pipelines
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const chalk = require('chalk');
const { runCollection } = require('./runner');
const { generateReport } = require('./reporter');
const { loadEnvironment } = require('./environment');
const { runLint } = require('./runner');

// For Windows compatibility
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Print startup banner
console.log(chalk.blue('🐦 Pigeon CLI - API Testing Tool'));
console.log(chalk.gray('Version: 1.0.0\n'));

// CLI configuration
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .command('run', 'Run a collection of API tests', (yargs) => {
    return yargs
      .option('collection', {
        alias: 'c',
        describe: 'Collection ID or path to collection file',
        type: 'string',
        demandOption: true
      })
      .option('environment', {
        alias: 'e',
        describe: 'Environment name or path to environment file',
        type: 'string'
      })
      .option('userId', {
        describe: 'User ID for database environment access',
        type: 'string'
      })
      .option('workspaceId', {
        describe: 'Workspace ID for scoped environment access',
        type: 'string'
      })
      .option('environmentId', {
        describe: 'Environment ID for direct environment access',
        type: 'string'
      })
      .option('reporter', {
        alias: 'r',
        describe: 'Reporter format (json, junit, html, csv)',
        type: 'string',
        default: 'json'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output file for test results',
        type: 'string'
      })
      .option('bail', {
        alias: 'b',
        describe: 'Stop on first test failure',
        type: 'boolean',
        default: false
      })
      .option('timeout', {
        alias: 't',
        describe: 'Request timeout in milliseconds',
        type: 'number',
        default: 30000
      });
  })
  .command('lint', 'Lint an OpenAPI specification using Spectral', (yargs) => {
    return yargs
      .option('spec', {
        alias: 's',
        describe: 'Path to OpenAPI specification file (JSON or YAML)',
        type: 'string',
        demandOption: true
      })
      .option('ruleset', {
        describe: 'Path to custom Spectral ruleset file',
        type: 'string'
      })
      .option('format', {
        alias: 'f',
        describe: 'Output format',
        type: 'string',
        choices: ['json', 'table', 'stylish'],
        default: 'stylish'
      })
      .option('output', {
        alias: 'o',
        describe: 'Output file to write results',
        type: 'string'
      })
      .option('fail-on', {
        describe: 'Exit with error code when threshold is breached',
        type: 'string',
        choices: ['off', 'warnings', 'errors'],
        default: 'errors'
      })
      .option('save', {
        describe: 'Save lint results to database (requires api-version-id)',
        type: 'boolean',
        default: false
      })
      .option('api-version-id', {
        describe: 'API Version ID for saving results to database',
        type: 'string'
      })
      .option('workspace-id', {
        describe: 'Workspace ID for authorization checks',
        type: 'string'
      })
      .option('timeout', {
        describe: 'Timeout in milliseconds',
        type: 'number',
        default: 10000
      })
      .option('max-size', {
        describe: 'Maximum spec file size in MB',
        type: 'number',
        default: 20
      });
  })
  .command('export', 'Export a collection for CI/CD usage', (yargs) => {
    return yargs
      .option('collection', {
        alias: 'c',
        describe: 'Collection ID to export',
        type: 'string',
        demandOption: true
      })
      .option('output', {
        alias: 'o',
        describe: 'Output file path',
        type: 'string',
        default: './pigeon-collection.json'
      });
  })
  .example('$0 run --collection my-collection --environment prod --reporter junit', 'Run tests with production environment and generate JUnit report')
  .example('$0 run --collection api-tests.json --reporter csv --output ./test-results/api-test-results.csv', 'Run tests and generate CSV report for data analysis')
  .example('$0 lint --spec openapi.yaml --format json --output lint-results.json', 'Lint OpenAPI spec and save results as JSON')
  .example('$0 lint --spec api.json --ruleset .pigeon/spectral.yaml --fail-on warnings', 'Lint with custom ruleset and fail on warnings')
  .example('$0 export --collection my-collection --output ./ci/api-tests.json', 'Export collection for CI/CD usage')
  .epilogue('For more information, visit https://pigeon-api.com/docs/cli')
  .help()
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .argv;

// Main execution
async function main() {
  try {
    const command = argv._[0];

    if (command === 'run') {
      console.log(chalk.cyan(`Running collection: ${argv.collection}`));

      // Prepare environment options for the new scoping system
      const environmentOptions = {
        environment: argv.environment,
        environmentId: argv.environmentId,
        environmentName: argv.environment,
        userId: argv.userId,
        workspaceId: argv.workspaceId,
        bail: argv.bail,
        timeout: argv.timeout
      };

      // Legacy support: Load environment variables if specified in the old way
      if (argv.environment && !argv.environmentId && !argv.userId) {
        try {
          const envData = await loadEnvironment(argv.environment);
          console.log(chalk.gray(`Loaded environment: ${argv.environment} (${envData.source})`));
          environmentOptions.environment = envData.variables;
        } catch (error) {
          console.warn(chalk.yellow(`Failed to load environment: ${error.message}`));
          environmentOptions.environment = {};
        }
      } else if (argv.environmentId || argv.userId) {
        console.log(chalk.gray(`Using scoped environment resolution`));
      }

      // Run the collection
      const startTime = Date.now();
      const results = await runCollection(argv.collection, environmentOptions);
      const duration = Date.now() - startTime;

      // Calculate summary
      const total = results.length;
      const passed = results.filter(r => !r.error && r.tests.every(t => t.passed)).length;
      const failed = total - passed;

      // Generate report
      const reportPath = argv.output || `./pigeon-report.${argv.reporter}`;
      await generateReport(results, {
        format: argv.reporter,
        outputPath: reportPath,
        collectionName: argv.collection,
        environment: argv.environment,
        duration
      });

      // Print summary
      console.log('\n' + chalk.cyan('Test Results Summary:'));
      console.log(`Total: ${total}, Passed: ${chalk.green(passed)}, Failed: ${chalk.red(failed)}`);
      console.log(`Duration: ${duration}ms`);
      console.log(chalk.gray(`Report saved to: ${reportPath}`));

      // Exit with appropriate code
      process.exit(failed > 0 ? 1 : 0);
    }
    else if (command === 'lint') {
      console.log(chalk.cyan(`Linting OpenAPI spec: ${argv.spec}`));

      const lintOptions = {
        spec: argv.spec,
        ruleset: argv.ruleset,
        format: argv.format,
        output: argv.output,
        failOn: argv['fail-on'],
        save: argv.save,
        apiVersionId: argv['api-version-id'],
        workspaceId: argv['workspace-id'],
        timeout: argv.timeout,
        maxSize: argv['max-size']
      };

      const startTime = Date.now();
      const exitCode = await runLint(lintOptions);
      const duration = Date.now() - startTime;

      console.log(chalk.gray(`Lint completed in ${duration}ms`));
      process.exit(exitCode);
    }
    else if (command === 'export') {
      console.log(chalk.cyan(`Exporting collection: ${argv.collection}`));

      // TODO: Implement collection export
      console.log(chalk.yellow('Export feature coming soon!'));

      console.log(chalk.gray(`Collection exported to: ${argv.output}`));
    }
    else {
      console.log(chalk.yellow('No command specified. Use --help for usage information.'));
      // Show help if no command is provided
      yargs(hideBin(process.argv)).showHelp();
      process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Immediately invoke main function
main().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});