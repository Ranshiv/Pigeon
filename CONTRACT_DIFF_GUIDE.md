# Contract Diff & Breaking Change Detection

## Overview

Pigeon now includes advanced OpenAPI contract diff and breaking change detection capabilities. This feature helps teams maintain API backward compatibility and provides detailed analysis of changes between API versions.

## Features

### 🔍 **Comprehensive Diff Analysis**
- Detects additions, deletions, and modifications in OpenAPI specifications
- Identifies breaking changes that could impact API consumers
- Supports multiple diff output formats (JSON, HTML, Markdown)
- Provides detailed change location and context

### 🚨 **Breaking Change Detection**
- Endpoint removal or modification
- Parameter changes (addition of required parameters, type changes)
- Response schema changes
- Authentication requirement changes
- Media type changes

### 📊 **Detailed Reporting**
- Summary statistics (total changes, breaking vs non-breaking)
- Human-readable changelogs
- Technical diff details
- Severity classification (error, warning, info)

### 🛠 **Multiple Access Methods**
- **CLI**: Command-line tool for CI/CD integration
- **API**: RESTful endpoints for programmatic access
- **Web UI**: Interactive diff viewer in the browser

## Installation

The diff functionality uses the following dependencies:

```bash
npm install swagger-diff openapi-diff json-diff handlebars
```

## CLI Usage

### Basic Diff Command

```bash
# Compare two OpenAPI specification files
pigeon diff --base api-v1.json --head api-v2.json

# Generate HTML report
pigeon diff --base api-v1.json --head api-v2.json --format html --output report.html

# Fail on breaking changes (useful for CI/CD)
pigeon diff --base api-v1.json --head api-v2.json --fail-on-breaking

# Compare API versions from database
pigeon diff --base 507f1f77bcf86cd799439011 --head 507f1f77bcf86cd799439012 --save
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--base, -b` | Base OpenAPI specification file or API version ID | Required |
| `--head` | Head OpenAPI specification file or API version ID | Required |
| `--format, -f` | Output format: `json`, `html`, `markdown` | `json` |
| `--output, -o` | Output file to save diff report | None |
| `--include-non-breaking` | Include non-breaking changes | `true` |
| `--fail-on-breaking` | Exit with error code if breaking changes detected | `false` |
| `--save` | Save results to database (for API version IDs) | `false` |
| `--workspace-id` | Workspace ID for authorization | None |
| `--user-id` | User ID for authorization | None |

### Exit Codes

- `0`: Success (no breaking changes or not failing on breaking)
- `1`: Breaking changes detected (when `--fail-on-breaking` is used)
- `2`: Invalid input (file not found, invalid spec)
- `3`: Runtime error (network issues, parsing errors)

## API Endpoints

### Compare Two API Versions

```http
POST /api/api-versions/{baseVersionId}/diff/{newVersionId}
```

**Request Body:**
```json
{
  "format": "json",
  "includeNonBreaking": true,
  "generateChangelog": true,
  "save": false
}
```

**Response:**
```json
{
  "message": "API versions compared successfully",
  "diffResult": { /* detailed diff data */ },
  "breakingChanges": [
    {
      "type": "breaking",
      "action": "delete",
      "location": "paths./users.get.parameters",
      "description": "Required parameter 'id' was removed",
      "severity": "error"
    }
  ],
  "hasBreakingChanges": true,
  "changelog": "## Breaking Changes\n🚨 **DELETE**: Required parameter 'id' was removed",
  "format": "json",
  "summary": {
    "totalChanges": 5,
    "breakingChanges": 2,
    "nonBreakingChanges": 3,
    "addedEndpoints": 1,
    "removedEndpoints": 0,
    "modifiedEndpoints": 2
  }
}
```

### Get Diff Between Versions

```http
GET /api/api-versions/{versionId}/diff/{comparedWithVersionId}
```

### Get All Diffs for a Version

```http
GET /api/api-versions/{versionId}/diffs
```

### Check Breaking Changes

```http
GET /api/api-versions/{versionId}/breaking-changes
```

## Web UI

### Access the Diff Viewer

1. Navigate to a collection in Pigeon
2. Go to the "API Versions" tab
3. Click "Compare Versions" button
4. Select base and new versions
5. Click "Start Comparison"

### Features

- **Interactive diff viewer** with expandable sections
- **Summary dashboard** with change statistics
- **Breaking changes highlight** with severity indicators
- **Generated changelog** in markdown format
- **Export capabilities** (HTML, Markdown, JSON)
- **Responsive design** for mobile and desktop

## Breaking Change Types Detected

### 🚨 **High Severity (Error)**

| Change Type | Description | Example |
|-------------|-------------|---------|
| `path-removed` | API endpoint deleted | `DELETE /users/{id}` removed |
| `operation-removed` | HTTP method removed | `POST /users` removed |
| `parameter-removed` | Required parameter deleted | `id` parameter removed |
| `response-removed` | Success response deleted | `200` response removed |
| `parameter-required-added` | Optional parameter became required | `email` became required |
| `request-body-required-added` | Request body became required | Body now mandatory |

### ⚠️ **Medium Severity (Warning)**

| Change Type | Description | Example |
|-------------|-------------|---------|
| `parameter-type-changed` | Parameter type modified | `integer` → `string` |
| `response-schema-changed` | Response structure altered | New required field added |
| `parameter-format-changed` | Parameter format modified | `date` → `date-time` |

### ℹ️ **Low Severity (Info)**

| Change Type | Description | Example |
|-------------|-------------|---------|
| `parameter-added` | New optional parameter | New `limit` query param |
| `response-added` | New response code | `201` response added |
| `path-added` | New endpoint added | `GET /organizations` added |

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: API Contract Validation
on:
  pull_request:
    paths:
      - 'api-spec/**'

jobs:
  validate-api-changes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'
          
      - name: Install Pigeon CLI
        run: npm install -g pigeon-cli
        
      - name: Check for breaking changes
        run: |
          pigeon diff \
            --base api-spec/current.yaml \
            --head api-spec/proposed.yaml \
            --format html \
            --output breaking-changes.html \
            --fail-on-breaking
            
      - name: Upload diff report
        uses: actions/upload-artifact@v2
        if: always()
        with:
          name: api-diff-report
          path: breaking-changes.html
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    
    stages {
        stage('API Diff Check') {
            steps {
                script {
                    def diffExitCode = sh(
                        script: '''
                            pigeon diff \
                                --base $WORKSPACE/specs/current.json \
                                --head $WORKSPACE/specs/new.json \
                                --format json \
                                --output diff-report.json \
                                --fail-on-breaking
                        ''',
                        returnStatus: true
                    )
                    
                    if (diffExitCode == 1) {
                        currentBuild.result = 'UNSTABLE'
                        echo 'Breaking changes detected!'
                    }
                }
                
                archiveArtifacts artifacts: 'diff-report.json'
            }
        }
    }
}
```

## Best Practices

### 1. **Version Comparison Strategy**

- Always compare against the last stable version
- Use semantic versioning to indicate breaking changes
- Tag versions that introduce breaking changes

### 2. **CI/CD Integration**

- Run diff checks on pull requests
- Generate reports for review
- Block deployments with breaking changes to production
- Allow breaking changes in development/staging with approval

### 3. **Change Documentation**

- Use generated changelogs as a starting point
- Add migration guides for breaking changes
- Document the business impact of changes
- Communicate changes to API consumers

### 4. **Version Management**

```javascript
// Example: Version creation with diff
const newVersion = await ApiVersioningService.createVersion(collectionId, {
  version: '2.0.0',
  name: 'Major Update',
  description: 'Updated user model with organizations',
  openApiSpec: newSpec,
  backwardCompatible: false
});

// Compare with previous version
const diff = await ApiVersioningService.compareVersionsAdvanced(
  previousVersionId,
  newVersion._id,
  { format: 'html', generateChangelog: true }
);
```

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Spec file not found` | Invalid file path | Check file exists and permissions |
| `Invalid OpenAPI specification` | Malformed JSON/YAML | Validate spec with linter |
| `Parse error` | Syntax errors in spec | Fix JSON/YAML syntax |
| `Version not found` | Invalid version ID | Verify version exists in database |
| `Diff timeout` | Large specifications | Increase timeout or split specs |

### Error Response Format

```json
{
  "error": {
    "code": "DIFF_FAILED",
    "message": "Failed to compare specifications",
    "details": {
      "baseSpec": "Invalid JSON format",
      "location": "line 15, column 3"
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Database connection for version storage
MONGODB_URI=mongodb://localhost:27017/pigeon

# Diff processing limits
PIGEON_DIFF_TIMEOUT=30000
PIGEON_DIFF_MAX_SIZE=50MB

# Report generation
PIGEON_REPORTS_DIR=/tmp/pigeon-reports
PIGEON_ENABLE_HTML_REPORTS=true
```

### Database Schema Extensions

The feature extends the `ApiVersion` model with diff-related fields:

```javascript
{
  // Existing fields...
  diffs: [{
    comparedWithVersionId: ObjectId,
    comparedWithVersion: String,
    diffResult: Mixed,
    breakingChanges: [BreakingChange],
    hasBreakingChanges: Boolean,
    changelogGenerated: String,
    diffFormat: String,
    createdAt: Date
  }]
}
```

## Performance Considerations

### Large Specifications

- **Streaming**: Process large specs in chunks
- **Caching**: Cache diff results for repeated comparisons
- **Timeouts**: Set appropriate timeouts for diff operations
- **Limits**: Impose size limits on specifications

### Database Optimization

- **Indexes**: Index on version IDs and comparison dates
- **Cleanup**: Remove old diff results periodically
- **Compression**: Compress large diff results

## Security Considerations

### Authentication

- All API endpoints require authentication
- Workspace-based access control
- User permission validation

### Data Protection

- Diff results contain API structure information
- Ensure proper access controls
- Log access to sensitive diff data

## Troubleshooting

### Debug Mode

Enable debug logging:

```bash
DEBUG=pigeon:diff pigeon diff --base v1.json --head v2.json
```

### Common Issues

1. **Memory errors with large specs**: Increase Node.js memory limit
2. **Timeout errors**: Increase timeout configuration
3. **Permission errors**: Check file and database permissions
4. **Format errors**: Validate OpenAPI specification syntax

### Support

For issues and feature requests:
- GitHub Issues: [pigeon/issues](https://github.com/pigeon/issues)
- Documentation: [pigeon-docs.com](https://pigeon-docs.com)
- Community: [Discord](https://discord.gg/pigeon)

---

*Last updated: September 2025*
