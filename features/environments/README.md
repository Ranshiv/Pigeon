# Environment Management Feature

## Overview

Environment Management in Pigeon enables teams to manage multiple testing environments, variables, and configurations for API testing and development. This feature provides a comprehensive solution for organizing and sharing environment-specific configurations across different development stages.

## Key Features

### 🌍 Multiple Environment Support

- **Development, Staging, Production** environments
- **Global variables** shared across all environments
- **Environment-specific variables** for targeted configurations
- **Environment switching** with persistent selection across page reloads
- **Environment inheritance** and variable overrides

### 🔐 Security & Access Control

- **Secret variables** with encrypted storage
- **Role-based access control** (viewer, editor, admin)
- **Environment isolation** between users and workspaces
- **Secure sharing** with controlled permissions
- **Audit logging** for environment changes

### 🎯 Variable Management

- **Global variables** - Available across all environments
- **Collection variables** - Scoped to specific collections
- **Environment-specific variables** - Unique to each environment
- **Dynamic variables** - Computed at runtime
- **Request-local variables** - Temporary variables for specific requests

### 🤝 Collaboration Features

- **Shared environments** with team members
- **Real-time synchronization** of environment changes
- **Change notifications** for team updates
- **Environment cloning** for quick setup
- **Access logging** and activity tracking

## Getting Started

### 1. Creating Your First Environment

1. Navigate to any collection in your workspace
2. Click on the **Environment Selector** dropdown in the collection header
3. Click the **"+"** button to create a new environment
4. Fill in the environment details:
   - **Name**: Development, Staging, Production, etc.
   - **Description**: Purpose and usage notes
   - **Variables**: Key-value pairs for your environment

### 2. Adding Variables

Environment variables can be added in several ways:

#### Through the UI:

- Open the environment editor
- Click "Add Variable"
- Enter key, value, and optional description
- Mark as secret if the variable contains sensitive data

#### Through Collection Variables Tab:

- Go to any collection
- Click the "Variables" tab
- Manage both collection and environment variables in one place

### 3. Environment Selection

The environment selector is available in every collection header:

- **Dropdown selection** - Choose from available environments
- **Persistent selection** - Your choice is saved across page reloads
- **"No Environment"** option - Run requests without any environment variables

## Environment Types

### 🌐 Global Environments

- Shared across all collections in a workspace
- Perfect for common variables like API keys, timeouts, and base URLs
- Accessible to all team members with appropriate permissions

### 📦 Collection-Specific Environments

- Scoped to individual collections
- Ideal for collection-specific configurations
- Can override global variables when needed

### 🔒 Private Environments

- Personal environments visible only to the creator
- Perfect for local development and testing
- Can be shared with team members when needed

## Variable Precedence

Variables are resolved in the following order (highest to lowest priority):

1. **Request-local variables** - Set during request execution
2. **Collection variables** - Defined at collection level
3. **Environment variables** - From selected environment
4. **Global variables** - Workspace-wide variables

## Advanced Features

### 🔄 Environment Cloning

Quickly create new environments based on existing ones:

- Copy all variables and settings
- Modify as needed for new environment
- Maintain consistency across similar environments

### 📊 Variable Preview

- **Hover tooltips** show variable values when selecting environments
- **Variable resolution preview** before sending requests
- **Conflict detection** when variables are overridden

### 🔐 Secret Management

- Mark sensitive variables as "secrets"
- Encrypted storage in the database
- Masked display in the UI
- Controlled access based on user permissions

### ⚡ Dynamic Variables

Support for computed variables:

- `{{$timestamp}}` - Current timestamp
- `{{$uuid}}` - Generate UUID
- `{{$randomInt}}` - Random integer
- Custom functions for complex computations

## Integration & Automation

### 🔧 CLI Integration

Use environments in automated testing:

```bash
# Run tests with specific environment
pigeon run collection.json --environment "Staging"

# Load environment from file
pigeon run collection.json --env-file .env.staging

# Use environment variables in CI/CD
pigeon run collection.json --environment "Production" --output junit
```

### 🔄 CI/CD Integration

- **Environment synchronization** with external systems
- **Configuration import** from cloud providers
- **Automated environment validation**
- **Health checks** and monitoring

### 📁 File-Based Environments

Support for external environment files:

- `.env` format support
- JSON format support
- Import/export functionality
- Version control integration

## API Reference

### Environment Operations

#### Get Environments

```javascript
GET /api/environments?workspaceId={id}&type={type}
```

#### Create Environment

```javascript
POST /api/environments
{
  "name": "Development",
  "description": "Dev environment",
  "variables": [
    {"key": "API_URL", "value": "http://localhost:3000"}
  ]
}
```

#### Update Environment

```javascript
PUT / api / environments / { id };
```

#### Delete Environment

```javascript
DELETE / api / environments / { id };
```

#### Set Active Environment

```javascript
POST / api / environments / { id } / set - active;
```

### Variable Resolution

```javascript
GET / api / environments / { id } / resolve;
```

## Best Practices

### 🏗️ Environment Organization

- **Consistent naming** - Use clear, descriptive names
- **Logical grouping** - Group related variables together
- **Documentation** - Provide descriptions for all variables
- **Regular cleanup** - Remove unused environments and variables

### 🔐 Security Guidelines

- **Mark secrets appropriately** - Always mark sensitive data as secret
- **Principle of least privilege** - Only share environments with necessary team members
- **Regular audits** - Review environment access and permissions
- **Backup critical environments** - Export important configurations

### 🚀 Performance Tips

- **Minimize variable count** - Only include necessary variables
- **Use global variables** for common values
- **Avoid circular references** in variable values
- **Cache frequently accessed environments**

## Troubleshooting

### Common Issues

#### Environment Not Persisting

- **Cause**: Browser storage issues or incorrect collection ID
- **Solution**: Clear browser cache and re-select environment

#### Variables Not Resolving

- **Cause**: Variable precedence conflicts or circular references
- **Solution**: Check variable hierarchy and resolve conflicts

#### Permission Denied

- **Cause**: Insufficient access rights to environment
- **Solution**: Request access from environment owner or admin

### Debugging Variables

- Use the **Variable Preview** tooltip to see resolved values
- Check the **Variables tab** for conflicts and overrides
- Review **browser console** for error messages
- Use **request logs** to trace variable resolution

## Migration & Backup

### Exporting Environments

- Export individual environments as JSON files
- Bulk export for backup purposes
- Include variable metadata and permissions

### Importing Environments

- Import from JSON files
- Import from .env files
- Merge with existing environments
- Validation and conflict resolution

## Future Enhancements

- **Environment templates** for quick setup
- **Advanced variable types** (arrays, objects)
- **Conditional variables** based on request context
- **Integration with external secret managers**
- **Environment versioning** and rollback
- **Advanced analytics** and usage metrics

## Support

For issues and questions:

- Check the [troubleshooting section](#troubleshooting)
- Review the [API documentation](#api-reference)
- Contact the development team for advanced use cases

---

_Environment Management is a core feature of Pigeon that enables scalable and secure API testing across different development stages. By following the best practices outlined in this documentation, teams can effectively manage their testing environments and maintain consistency across their development workflow._
