# Testing Environment Variable Improvements in CI/CD

This document provides instructions for testing the environment variable handling improvements both locally and in a CI/CD pipeline.

## Local Testing

Before pushing changes to GitHub where the CI/CD pipeline will run automatically, you can test the setup locally:

1. Start the mock server:

   ```bash
   node server.js
   ```

   This will start the mock server on port 3000 by default. To change the port:

   ```bash
   PORT=3500 node server.js
   ```

2. Run the tests using Pigeon CLI:

   ```bash
   cd cli
   node pigeon-cli.js run --collection ../test-collection.json --environment ../test-environment.json --report html
   ```

3. Examine the HTML report generated at `pigeon-report.html` in the root directory.

## CI/CD Testing

The GitHub Actions workflow will automatically run when:

- You push to `main`, `master`, or `develop` branches
- You create a pull request targeting `main` or `master`
- You manually trigger the workflow from the GitHub Actions tab

### How the CI/CD Pipeline Works

1. The workflow checks out the code and sets up Node.js
2. Installs dependencies for both the main project and the CLI
3. Starts the mock API server on port 3500
4. Runs the Pigeon tests against the mock server
5. Uploads the HTML report as an artifact for inspection
6. Checks the test results and fails the build if any tests fail

### Accessing Test Reports

After the workflow completes:

1. Go to the GitHub Actions tab for your repository
2. Select the completed workflow run
3. Scroll down to the "Artifacts" section
4. Download the "pigeon-report" artifact to view the HTML test results

## Customizing Tests

To test additional environment variable functionality:

1. Modify `test-environment.json` to add new variables
2. Update `test-collection.json` to include new test cases
3. Extend the mock server in `server.js` to handle new endpoints if needed

## Troubleshooting

If you encounter issues with the CI/CD pipeline:

- Check the workflow logs for detailed error messages
- Verify that the mock server is running correctly (look for startup messages)
- Examine the test reports for specific test failures
- Try running the tests locally with the same configuration to reproduce the issue
