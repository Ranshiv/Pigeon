# Example Tests for Pigeon Features

## Workspace Feature Tests

### 1. Workspace Creation Test

```json
{
  "name": "Workspace Creation Tests",
  "requests": [
    {
      "name": "Create Personal Workspace",
      "url": "http://localhost:5001/api/workspaces",
      "method": "POST",
      "body": {
        "name": "My Personal Space",
        "description": "Testing workspace creation",
        "isPersonal": true
      },
      "testScript": "
        tests.add('Status code is 201', () => response.status === 201);
        tests.add('Workspace name matches', () => response.body.name === 'My Personal Space');
        tests.add('Is personal workspace', () => response.body.isPersonal === true);
      "
    }
  ]
}
```

### 2. Role Management Test

```json
{
  "name": "Role Management Tests",
  "requests": [
    {
      "name": "Update User Role",
      "url": "http://localhost:5001/api/workspaces/{{workspaceId}}/collaborators/{{userId}}",
      "method": "PATCH",
      "body": {
        "role": "editor"
      },
      "testScript": "
        tests.add('Status code is 200', () => response.status === 200);
        tests.add('Role updated successfully', () => response.body.role === 'editor');
      "
    }
  ]
}
```

## Version Control Tests

### 1. Branch Management Test

```json
{
  "name": "Branch Management Tests",
  "requests": [
    {
      "name": "Create New Branch",
      "url": "http://localhost:5001/api/collections/{{collectionId}}/branches",
      "method": "POST",
      "body": {
        "name": "feature/new-api",
        "baseBranch": "main"
      },
      "testScript": "
        tests.add('Branch created', () => response.status === 201);
        tests.add('Branch name correct', () => response.body.name === 'feature/new-api');
      "
    }
  ]
}
```

### 2. Merge Request Test

```json
{
  "name": "Merge Request Tests",
  "requests": [
    {
      "name": "Create Merge Request",
      "url": "http://localhost:5001/api/merge-requests",
      "method": "POST",
      "body": {
        "title": "New API Feature",
        "sourceBranch": "feature/new-api",
        "targetBranch": "main"
      },
      "testScript": "
        tests.add('Merge request created', () => response.status === 201);
        tests.add('Title matches', () => response.body.title === 'New API Feature');
        environment.set('mergeRequestId', response.body._id);
      "
    }
  ]
}
```

## Collection Tests

### 1. Collection CRUD Test

```json
{
  "name": "Collection CRUD Tests",
  "requests": [
    {
      "name": "Create Collection",
      "url": "http://localhost:5001/api/collections",
      "method": "POST",
      "body": {
        "name": "Test Collection",
        "description": "Testing collection operations"
      },
      "testScript": "
        tests.add('Collection created', () => response.status === 201);
        environment.set('collectionId', response.body._id);
      "
    },
    {
      "name": "Add Request to Collection",
      "url": "http://localhost:5001/api/collections/{{collectionId}}/requests",
      "method": "POST",
      "body": {
        "name": "Test Request",
        "method": "GET",
        "url": "https://api.example.com/test"
      },
      "testScript": "
        tests.add('Request added', () => response.status === 201);
        tests.add('Request in collection', () => response.body.requests.length > 0);
      "
    }
  ]
}
```

## Environment Variable Tests

### 1. Variable Substitution Test

```json
{
  "name": "Environment Variable Tests",
  "requests": [
    {
      "name": "Test Variable Substitution",
      "url": "http://{{API_HOST}}/api/{{API_VERSION}}/users",
      "method": "GET",
      "headers": [
        {
          "name": "Authorization",
          "value": "Bearer {{API_KEY}}"
        }
      ],
      "preRequestScript": "
        environment.set('DYNAMIC_VAR', 'test-' + Date.now());
        console.log('Set dynamic variable:', environment.get('DYNAMIC_VAR'));
      ",
      "testScript": "
        tests.add('Variables substituted', () => {
          return request.url.includes(environment.get('API_HOST')) &&
                 request.headers.Authorization.includes(environment.get('API_KEY'));
        });
      "
    }
  ]
}
```

## Real-time Collaboration Tests

### 1. Concurrent Editing Test

```json
{
  "name": "Collaboration Tests",
  "requests": [
    {
      "name": "Join Editing Session",
      "url": "http://localhost:5001/api/collections/{{collectionId}}/collaboration",
      "method": "POST",
      "testScript": "
        tests.add('Joined session', () => response.status === 200);
        tests.add('Got session ID', () => response.body.sessionId != null);
        environment.set('sessionId', response.body.sessionId);
      "
    },
    {
      "name": "Send Edit Operation",
      "url": "http://localhost:5001/api/collections/{{collectionId}}/collaboration/{{sessionId}}",
      "method": "POST",
      "body": {
        "operation": "insert",
        "position": 0,
        "content": "Test content"
      },
      "testScript": "
        tests.add('Edit applied', () => response.status === 200);
        tests.add('No conflicts', () => !response.body.conflicts);
      "
    }
  ]
}
```

## Test Environment File Example

```json
{
  "API_HOST": "localhost:5001",
  "API_VERSION": "v1",
  "API_KEY": "test-key-123",
  "WORKSPACE_ID": "test-workspace",
  "COLLECTION_ID": "test-collection",
  "USER_ID": "test-user"
}
```

These example tests can be run using the CLI:

```bash
pigeon run -c workspace-tests.json -e test-env.json -r html
pigeon run -c version-control-tests.json -e test-env.json -r junit
pigeon run -c collection-tests.json -e test-env.json -r json
```
