# Testing Guide for Pigeon Platform

## Overview

This guide explains how to test all features of the Pigeon platform, both manually and through automated testing using the CLI tool.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Access to a terminal/command prompt

## Installation for Testing

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Install Pigeon CLI globally (optional):

```bash
npm install -g pigeon
```

## CLI Testing

### Basic CLI Usage

```bash
# Run a collection of tests
pigeon run --collection my-collection.json --environment production

# Generate HTML report
pigeon run -c api-tests.json -r html -o test-results/report.html

# Run with timeout and bail options
pigeon run -c collection.json -t 5000 -b
```

### Environment Testing

1. Create test environment file:

```json
{
  "API_URL": "http://localhost:3500",
  "API_KEY": "test-key-123"
}
```

2. Start mock server:

```bash
node mock-server.js
```

3. Run environment tests:

```bash
pigeon run -c tests/env-test-collection.json -e test-environment.json
```

## CI/CD Pipeline Testing

### GitHub Actions

1. Create `.github/workflows/api-tests.yml`:

```yaml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run cli -- run -c ./tests/api-collection.json -r junit
```

### Jenkins Pipeline

1. Configure Jenkinsfile with test stages
2. Use JUnit reporter for test results visualization
3. Archive test artifacts

### CircleCI

1. Configure circle-ci-config.yml
2. Set up scheduled test runs
3. Configure test result storage

## Feature Testing

### Workspace Testing

1. Test workspace creation (personal/team/public)
2. Verify role-based access controls
3. Test real-time collaboration features
4. Validate activity tracking

### Version Control Testing

1. Test branch creation
2. Verify merge request workflow
3. Test conflict resolution
4. Validate version history

### Collection Testing

1. Create test collections
2. Add and modify requests
3. Test environment variable substitution
4. Validate request chaining

### Real-time Collaboration Testing

1. Test multiple user presence
2. Verify concurrent editing
3. Test conflict prevention
4. Validate activity feed updates

## Running Test Suites

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### End-to-End Tests

```bash
npm run test:e2e
```

## Test Reports

### Available Formats

- JSON (default)
- HTML (visual reports)
- JUnit XML (CI/CD integration)
- CSV (data analysis)

### Generating Reports

```bash
# HTML Report
pigeon run -c collection.json -r html -o report.html

# JUnit Report for CI
pigeon run -c collection.json -r junit -o test-results.xml

# CSV Report
pigeon run -c collection.json -r csv -o results.csv
```

## Debugging Tests

### CLI Debugging

- Use --verbose flag for detailed logs
- Check test-results directory for reports
- Review error messages in terminal

### Common Issues

1. Environment variable not found
2. Request timeout
3. Authentication failures
4. Invalid test scripts

## Best Practices

1. Use descriptive test names
2. Organize collections logically
3. Maintain test environments
4. Regular CI/CD test runs
5. Monitor test coverage
6. Review test reports regularly
