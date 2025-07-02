# Variable Management System Documentation

## Overview

The Pigeon API testing tool now includes a comprehensive variable management system that supports multiple scopes and environments. This system allows you to define variables at different levels and use them throughout your API requests with automatic interpolation.

## Variable Scopes and Precedence

Variables are resolved with the following precedence order (highest to lowest):

1. **Request Variables** - Defined within individual requests
2. **Environment Variables** - Environment-specific variables (dev, staging, prod)
3. **Collection Variables** - Shared across all requests in a collection
4. **Global Variables** - Workspace-wide variables

### Example

If you have the same variable name defined at multiple levels:

- Global: `apiKey = "global-key"`
- Environment: `apiKey = "env-key"`
- Request: `apiKey = "request-key"`

The request will use `"request-key"` because request variables have the highest precedence.

## Variable Syntax

Variables use the `{{variableName}}` syntax and can be used in:

- Request URLs
- Header keys and values
- Parameter keys and values
- Request body content

### Examples

```
URL: https://{{baseUrl}}/{{version}}/users/{{userId}}
Header: Authorization: Bearer {{apiToken}}
Body: {"userId": "{{userId}}", "action": "{{action}}"}
```

## Frontend Integration

### RequestForm Component

The `RequestForm` component now includes:

#### Variable Validation

- Automatic detection of undefined variables
- Visual indicators for missing variables
- Send button is disabled when variables are missing
- Error messages listing missing variables

#### Visual Indicators

- Input fields with variables show blue border (resolved variables)
- Input fields with missing variables show red border
- Variable validation error appears below Send/Save buttons

#### Variable Preview Tab

- Shows all resolved variables and their values
- Lists missing variables that need to be defined
- Displays preview of interpolated request (URL, headers, body)
- Real-time updates as you type

### Variable Editor Component

Provides interface for managing variables at different scopes:

- Request-level variables (in Variables tab)
- Environment variables (via EnvironmentSelector)
- Collection variables (via collection management)
- Global variables (via workspace settings)

## Backend API

### Environment Variables

- `GET /api/environments/:id` - Get environment with variables
- `PUT /api/environments/:id/variables` - Update environment variables

### Global Variables

- `GET /api/workspaces/:id/global-variables` - Get global variables
- `PUT /api/workspaces/:id/global-variables` - Update global variables

### Collection Variables

- Stored in collection schema
- Managed through collection endpoints

## CLI Integration

The CLI runner automatically:

- Loads environment variables from selected environment
- Loads global variables from workspace
- Resolves variables with proper precedence
- Interpolates request data before execution

### Usage Example

```bash
# Run request with specific environment
pigeon run my-request --environment dev

# Variables from 'dev' environment will be loaded and used
```

## Utility Functions

### Variable Interpolation (`utils/variableInterpolation.js`)

```javascript
// String interpolation
interpolateString(template, variables);

// Request data interpolation
interpolateRequest(requestData, resolvedVariables);

// Variable resolution with precedence
resolveVariables(requestVars, envVars, collectionVars, globalVars);

// Variable validation
validateVariables(requestData, resolvedVariables);

// Extract variables from strings
extractVariables(template);

// Preview interpolation
previewInterpolation(requestData, resolvedVariables);
```

## Data Models

### Workspace Model (Enhanced)

```javascript
{
  // ... existing fields
  globalVariables: [
    {
      key: String,
      value: String,
      description: String,
    },
  ];
}
```

### Environment Model (Enhanced)

```javascript
{
  // ... existing fields
  variables: [
    {
      key: String,
      value: String,
      description: String,
    },
  ];
}
```

### Request Model (Enhanced)

```javascript
{
  // ... existing fields
  variables: [
    {
      key: String,
      value: String,
      description: String,
    },
  ];
}
```

## Best Practices

1. **Use Descriptive Names**: Choose clear variable names like `baseUrl`, `apiToken`, `userId`

2. **Organize by Scope**:

   - Global: Common URLs, shared API keys
   - Environment: Environment-specific URLs, credentials
   - Collection: Endpoints, shared IDs for collection
   - Request: Request-specific parameters

3. **Environment Management**:

   - Create separate environments for dev, staging, production
   - Use same variable names across environments with different values
   - Keep sensitive data (API keys, tokens) in environment variables

4. **Variable Naming Conventions**:
   - Use camelCase: `baseUrl`, `apiToken`
   - Be descriptive: `userApiEndpoint` instead of `endpoint`
   - Group related variables: `auth.token`, `auth.refreshToken`

## Migration from Existing Environments

If you have existing environments without the new variable structure, they will automatically work with the new system. The CLI and frontend will gracefully handle missing variable fields.

## Security Considerations

- Environment variables can contain sensitive data
- Global variables are visible to all workspace members
- Request variables are stored with the request
- Consider using environment variables for API keys and secrets

## Troubleshooting

### Common Issues

1. **Variables Not Resolving**

   - Check variable name spelling
   - Verify variable is defined in correct scope
   - Check variable precedence order

2. **Send Button Disabled**

   - Missing variables detected
   - Check the variable validation error message
   - Define missing variables in appropriate scope

3. **Variables Not Loading**
   - Verify environment/workspace ID is correct
   - Check API connectivity
   - Ensure proper authentication

### Debugging

Use the Variable Preview tab to:

- See all resolved variables
- Identify missing variables
- Preview interpolated request data
- Verify variable precedence

## Future Enhancements

Planned improvements include:

- Variable autocomplete in input fields
- Import/export functionality for environments
- Variable templates and snippets
- Environment cloning
- Variable usage analytics
- Encrypted variable storage for sensitive data
