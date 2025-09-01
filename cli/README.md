# Pigeon CLI - CI/CD Pipeline Integration

The Pigeon CLI tool enables you to run API tests and lint OpenAPI specifications in continuous integration and deployment pipelines. This allows you to automate your API testing and validation process to ensure your APIs are working correctly and follow best practices before deploying to production.

## Installation

Add Pigeon to your project:

```bash
npm install --save-dev pigeon
```

Or install globally:

```bash
npm install -g pigeon
```

## Basic Usage

### Running a Collection

```bash
pigeon run --collection my-collection.json --environment production
```

### Linting an OpenAPI Specification

```bash
pigeon lint --spec openapi.yaml --format stylish
```

### Export a Collection for CI/CD

```bash
pigeon export --collection "My API Tests" --output ./ci/api-tests.json
```

## Commands

### `run` Command

Runs a collection of API tests.

| Option          | Alias | Description                                  | Default                    |
| --------------- | ----- | -------------------------------------------- | -------------------------- |
| `--collection`  | `-c`  | Collection ID or path to collection file     | (Required)                 |
| `--environment` | `-e`  | Environment name or path to environment file | `default`                  |
| `--reporter`    | `-r`  | Reporter format (json, junit, html, csv)     | `json`                     |
| `--output`      | `-o`  | Output file for test results                 | `./pigeon-report.[format]` |
| `--bail`        | `-b`  | Stop on first test failure                   | `false`                    |
| `--timeout`     | `-t`  | Request timeout in milliseconds              | `30000`                    |

### `lint` Command

Lints an OpenAPI specification using Spectral rules.

| Option              | Alias | Description                                         | Default     |
| ------------------- | ----- | --------------------------------------------------- | ----------- |
| `--spec`            | `-s`  | Path to OpenAPI specification file (JSON or YAML)   | (Required)  |
| `--ruleset`         |       | Path to custom Spectral ruleset file               |             |
| `--format`          | `-f`  | Output format (json, table, stylish)               | `stylish`   |
| `--output`          | `-o`  | Output file to write results                        |             |
| `--fail-on`         |       | Exit with error when threshold breached (off, warnings, errors) | `errors` |
| `--save`            |       | Save lint results to database                       | `false`     |
| `--api-version-id`  |       | API Version ID for saving results                   |             |
| `--workspace-id`    |       | Workspace ID for authorization checks               |             |
| `--timeout`         |       | Timeout in milliseconds                             | `10000`     |
| `--max-size`        |       | Maximum spec file size in MB                        | `20`        |

#### Exit Codes

The `lint` command returns different exit codes:

- `0`: Success, no issues or within acceptable threshold
- `1`: Fail threshold breached (warnings or errors)
- `2`: Invalid input, parse error, or configuration error
- `3`: Runtime error or timeout

### `export` Command

Exports a collection for CI/CD usage.

| Option         | Alias | Description             | Default                    |
| -------------- | ----- | ----------------------- | -------------------------- |
| `--collection` | `-c`  | Collection ID to export | (Required)                 |
| `--output`     | `-o`  | Output file path        | `./pigeon-collection.json` |

## OpenAPI Linting

### Ruleset Configuration

Pigeon uses Spectral for OpenAPI linting with the following ruleset precedence:

1. `--ruleset <path>` flag (highest priority)
2. Workspace override at `.pigeon/spectral.(yaml|yml|json)`
3. Root `spectral.(yaml|yml|json)` if present
4. Default: Spectral recommended for OpenAPI

### Creating Custom Rulesets

Create a `.pigeon/spectral.yaml` file in your project root:

```yaml
# Pigeon OpenAPI Linting Ruleset
extends: ["@stoplight/spectral-rulesets/dist/oas/index.js"]

rules:
  # Override default rules
  operation-description: warn
  operation-summary: warn
  
  # Make info fields more strict
  info-contact: error
  info-license: warn
  
  # Custom rules for API standards
  operation-operationId: error
```

### Environment Variables

Control linting behavior with environment variables:

- `PIGEON_LINT_ENABLED=true|false` - Enable/disable linting (default: true)

## Environment Variables for Testing

You can create environment files in JSON or .env format:

### JSON Format (environments/production.json)

```json
{
  "API_URL": "https://api.example.com/v1",
  "API_KEY": "your-api-key"
}
```

### .env Format (environments/staging.env)

```
API_URL=https://staging-api.example.com/v1
API_KEY=your-staging-api-key
```

## CI/CD Integration

### Examples

#### GitHub Actions

```yaml
name: API Tests and Linting
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
      
      - name: Install dependencies
        run: npm install
      
      - name: Lint OpenAPI Specification
        run: pigeon lint --spec api/openapi.yaml --fail-on warnings --output lint-results.json
      
      - name: Run API Tests
        run: pigeon run --collection tests/api-collection.json --environment production --reporter junit --output test-results.xml
      
      - name: Upload test results
        uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: |
            test-results.xml
            lint-results.json
```

#### Jenkins Pipeline

```groovy
pipeline {
    agent any
    
    stages {
        stage('Lint API Spec') {
            steps {
                sh 'pigeon lint --spec openapi.yaml --format json --output lint-results.json'
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: '.',
                    reportFiles: 'lint-results.json',
                    reportName: 'API Lint Report'
                ])
            }
        }
        
        stage('API Tests') {
            steps {
                sh 'pigeon run -c api-tests.json -e production -r junit -o test-results.xml'
                junit 'test-results.xml'
            }
        }
    }
}
```

## Example Project Structure

```
project-root/
  ├── .pigeon/
  │   └── spectral.yaml          # Custom linting rules
  ├── api/
  │   └── openapi.yaml           # OpenAPI specification
  ├── tests/
  │   ├── api-collection.json    # Test collection
  │   └── environments/
  │       ├── production.json
  │       ├── staging.json
  │       └── development.json
  ├── test-results/
  │   └── (generated reports)
  └── ci/
      ├── github-workflow.yml
      └── Jenkinsfile
```

## Advanced Usage

### Lint Examples

#### Basic linting with stylish output:

```bash
pigeon lint --spec openapi.yaml
```

#### Lint with custom ruleset and JSON output:

```bash
pigeon lint --spec api.json --ruleset .pigeon/spectral.yaml --format json --output lint-results.json
```

#### Fail build on warnings:

```bash
pigeon lint --spec openapi.yaml --fail-on warnings
```

#### Save results to database:

```bash
pigeon lint --spec openapi.yaml --save --api-version-id 507f1f77bcf86cd799439011
```

### Running Multiple Collections

You can run multiple collections by using the CLI tool in a script:

```bash
pigeon run -c collection1.json -e production -r json -o results/result1.json
pigeon run -c collection2.json -e production -r json -o results/result2.json
```

### Output Formats

#### Test Reports

Pigeon supports multiple output formats for test reports:

- **JSON**: Detailed report with all test information (default)
- **HTML**: Human-readable report with styled UI
- **JUnit XML**: Compatible with CI/CD platforms for test result visualization
- **CSV**: Spreadsheet-friendly format for data analysis

#### Lint Reports

Pigeon supports multiple output formats for lint reports:

- **stylish**: Human-readable console output with colors and icons (default)
- **table**: Tabular format for easy reading
- **json**: Machine-readable JSON format for integration with other tools

Example of generating a CSV test report:

```bash
pigeon run -c api-tests.json -r csv -o ./test-results/api-test-results.csv
```

Example of generating a JSON lint report:

```bash
pigeon lint -s openapi.yaml -f json -o ./lint-results/api-lint-results.json
```
