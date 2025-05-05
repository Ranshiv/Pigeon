# CI/CD Testing Guide

## Overview

This guide details how to set up and maintain automated testing pipelines for the Pigeon platform across different CI/CD providers.

## Test Environment Setup

### Mock Server Configuration

1. Create `mock-server.js` configuration:

```javascript
const app = require("express")();
const PORT = process.env.PORT || 3500;

app.use(express.json());
// Add middleware and routes
app.listen(PORT);
```

2. Define test environment variables:

```env
MOCK_SERVER_PORT=3500
API_KEY=test-key-123
TEST_USER_ID=test-user-id
```

## Pipeline Configurations

### GitHub Actions Pipeline

```yaml
name: Pigeon API Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 0 * * *" # Daily at midnight

jobs:
  api-tests:
    runs-on: ubuntu-latest
    services:
      mock-api:
        image: node:18-alpine
        ports:
          - 3500:3500
        options: --health-cmd "curl -f http://localhost:3500/health"

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "18"
          cache: "npm"

      - name: Install Dependencies
        run: npm ci

      - name: Run API Tests
        run: npm run cli -- run -c tests/ci/*.json -e ci/env.json -r junit

      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Jenkins Pipeline

```groovy
pipeline {
    agent {
        docker {
            image 'node:18-alpine'
        }
    }

    environment {
        MOCK_SERVER_PORT = '3500'
    }

    stages {
        stage('Setup') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Start Mock Server') {
            steps {
                sh 'node mock-server.js &'
                sh 'sleep 5' // Wait for server startup
            }
        }

        stage('Run Tests') {
            steps {
                sh '''
                    npm run cli -- run \
                    --collection ./tests/ci/*.json \
                    --environment ./ci/env.json \
                    --reporter junit \
                    --output ./test-results/pigeon-results.xml
                '''
            }
            post {
                always {
                    junit '**/test-results/*.xml'
                }
            }
        }
    }
}
```

### CircleCI Configuration

```yaml
version: 2.1

orbs:
  node: circleci/node@5.1.0

jobs:
  api-tests:
    docker:
      - image: cimg/node:18.16
    steps:
      - checkout
      - node/install-packages
      - run:
          name: Start Mock Server
          command: node mock-server.js
          background: true
      - run:
          name: Run Tests
          command: |
            sleep 5
            npm run cli -- run \
              -c ./tests/ci/*.json \
              -e ./ci/env.json \
              -r junit \
              -o ./test-results/pigeon-results.xml
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: test-results

workflows:
  daily-tests:
    triggers:
      - schedule:
          cron: "0 0 * * *"
    jobs:
      - api-tests
```

## Test Organization

### Directory Structure

```
project-root/
  ├── tests/
  │   └── ci/
  │       ├── workspaces.test.json
  │       ├── collections.test.json
  │       └── collaboration.test.json
  ├── ci/
  │   ├── env.json
  │   └── scripts/
  │       └── setup-tests.sh
  └── test-results/
      └── (generated reports)
```

### Test Categories for CI

1. **Smoke Tests**

   - Basic API connectivity
   - Authentication flow
   - Core feature availability

2. **Integration Tests**

   - Cross-feature interactions
   - Data flow between components
   - WebSocket communication

3. **Performance Tests**
   - Response time benchmarks
   - Concurrent user simulation
   - Resource usage monitoring

## Pipeline Test Strategy

### Test Execution Order

1. Run smoke tests first
2. Run integration tests if smoke tests pass
3. Run performance tests in dedicated environment
4. Generate and publish test reports

### Environment Management

1. Use separate environments for different test types
2. Reset test data between runs
3. Clean up resources after tests
4. Maintain test isolation

### Error Handling

1. Capture detailed error logs
2. Create issue reports for failures
3. Notify team on critical failures
4. Maintain failure history

## Monitoring and Reporting

### Test Reports

- Generate HTML reports for human readability
- Create JUnit XML for CI integration
- Export CSV for trend analysis

### Metrics to Track

1. Test success rate
2. Average response time
3. Test coverage
4. Error frequency

### Notification Setup

1. Configure Slack/Teams notifications
2. Set up email alerts
3. Create dashboard for metrics
4. Track trends over time
