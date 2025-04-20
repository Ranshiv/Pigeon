# Pigeon CLI - CI/CD Pipeline Integration

The Pigeon CLI tool enables you to run API tests in continuous integration and deployment pipelines. This allows you to automate your API testing process and ensure your APIs are working correctly before deploying to production.

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

### Export a Collection for CI/CD

```bash
pigeon export --collection "My API Tests" --output ./ci/api-tests.json
```

## Command Options

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

### `export` Command

Exports a collection for CI/CD usage.

| Option         | Alias | Description             | Default                    |
| -------------- | ----- | ----------------------- | -------------------------- |
| `--collection` | `-c`  | Collection ID to export | (Required)                 |
| `--output`     | `-o`  | Output file path        | `./pigeon-collection.json` |

## Environment Variables

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

See the `examples` directory for configuration files for popular CI/CD platforms:

- GitHub Actions: `github-actions-workflow.yml`
- Jenkins: `Jenkinsfile`
- CircleCI: `circle-ci-config.yml`

## Example Project Structure

```
project-root/
  ├── tests/
  │   ├── api-collection.json
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

### Running Multiple Collections

You can run multiple collections by using the CLI tool in a script:

```bash
pigeon run -c collection1.json -e production -r json -o results/result1.json
pigeon run -c collection2.json -e production -r json -o results/result2.json
```

### Scheduled Testing

Set up scheduled tests using your CI/CD platform's scheduling features. See the example configuration files for how to schedule daily runs.

### Output Formats

Pigeon supports multiple output formats for test reports:

- **JSON**: Detailed report with all test information (default)
- **HTML**: Human-readable report with styled UI
- **JUnit XML**: Compatible with CI/CD platforms for test result visualization
- **CSV**: Spreadsheet-friendly format for data analysis

Example of generating a CSV report:

```bash
pigeon run -c api-tests.json -r csv -o ./test-results/api-test-results.csv
```

This creates a CSV file containing test results that can be imported into Excel, Google Sheets, or other data analysis tools.
