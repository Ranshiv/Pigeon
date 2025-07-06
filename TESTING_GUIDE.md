# API Prototyping and Versioning - User Testing Guide

## Quick Start Guide for Testing New Features

### Prerequisites

1. Ensure both Pigeon server and React client are running
2. Have a collection created in Pigeon
3. Have the sample OpenAPI specification ready (`test-openapi.json`)

### Testing Workflow

#### 1. Basic API Version Management

**Step 1: Access API Versions**

1. Navigate to a collection in Pigeon
2. Go to Documentation Manager
3. Click the "API Versions" tab/button

**Step 2: Create a Version**

1. Click "Create New Version"
2. Fill in the form:
   - Version: `1.0.0`
   - Description: `Initial API version`
   - Changelog: `First release with basic endpoints`
3. Click "Create Version"
4. Verify the version appears in the list

**Step 3: Manage Version**

1. View version details by clicking on a version
2. Test deprecation by clicking "Deprecate" on a version
3. Add migration guide information

#### 2. Enhanced OpenAPI Import

**Step 1: Prepare Test File**

1. Use the provided `test-openapi.json` file
2. Or create your own OpenAPI 3.0 specification

**Step 2: Import with Versioning**

1. In Documentation Manager, click "Import" → "OpenAPI/Swagger"
2. Select the test OpenAPI file
3. When prompted: "Would you like to create an API version?" → Click "OK"
4. When prompted: "Would you also like to create a mock server?" → Click "OK"
5. Wait for success message

**Step 3: Verify Results**

1. Check that documentation was imported and formatted correctly
2. Go to "API Versions" tab to see the new version
3. Verify the version contains the OpenAPI specification data

#### 3. Mock Server Management

**Step 1: Access Mock Servers**

1. From API Versions tab, find the version with a mock server
2. Click "Manage Mock Servers" button
3. Or navigate directly through the Mock Server Manager

**Step 2: View Generated Endpoints**

1. Check that endpoints were auto-generated from the OpenAPI spec
2. Review mock responses for each endpoint
3. Note the endpoint patterns (GET /pets, POST /pets, etc.)

**Step 3: Test Mock Endpoints**

1. Note the mock server URL format
2. Use the proxy endpoint to test: `/proxy?url=<endpoint>&mockServerId=<id>`
3. Verify mock responses match the expected format

**Step 4: Customize Mock Server**

1. Edit an existing endpoint's response
2. Add a new custom endpoint
3. Modify response codes and headers
4. Test the changes

#### 4. Integration Testing

**Step 1: End-to-End Workflow**

1. Start with OpenAPI import
2. Create API version and mock server
3. Switch between documentation view and version management
4. Test mock endpoints
5. Deprecate a version and add migration notes

**Step 2: Error Handling**

1. Try importing an invalid OpenAPI file
2. Test creating versions with duplicate numbers
3. Verify error messages and handling

#### 5. UI/UX Testing

**Step 1: Navigation Testing**

1. Test switching between different tabs in Documentation Manager
2. Verify that state is maintained when switching views
3. Check that loading states work correctly

**Step 2: Responsive Design**

1. Test on different screen sizes
2. Verify all buttons and forms are accessible
3. Check that tables and lists are properly formatted

### Expected Results

#### After OpenAPI Import with Versioning:

- Documentation tab shows formatted API documentation
- API Versions tab shows new version (e.g., "1.0.0")
- Version contains the full OpenAPI specification
- Mock server is created with auto-generated endpoints
- Success message indicates all components were created

#### After Version Management:

- Can create, view, and deprecate versions
- Version list shows status (Active, Deprecated, etc.)
- Changelog and migration guides can be added
- Version details show comprehensive metadata

#### After Mock Server Setup:

- Endpoints are automatically generated from OpenAPI paths
- Mock responses reflect the schema definitions
- Can customize responses and add new endpoints
- Mock server can be activated/deactivated

### Troubleshooting

#### Common Issues:

**Import Fails:**

- Check that the OpenAPI file is valid JSON
- Ensure it has "openapi" or "swagger" field
- Verify file size is reasonable

**Version Creation Fails:**

- Check for duplicate version numbers
- Ensure user has proper permissions
- Verify collection exists and is accessible

**Mock Server Issues:**

- Check that API version exists
- Verify endpoints are properly formatted
- Ensure server is running and accessible

**UI Issues:**

- Refresh the page if state seems inconsistent
- Check browser console for any JavaScript errors
- Verify all required React components are loaded

### Sample Data for Testing

#### Sample Version Creation:

```json
{
  "version": "2.0.0",
  "description": "Major update with breaking changes",
  "changelog": "- Added new authentication method\n- Removed deprecated endpoints\n- Updated response formats",
  "isBackwardCompatible": false
}
```

#### Sample Mock Endpoint:

```json
{
  "method": "GET",
  "path": "/users/{id}",
  "responseCode": 200,
  "responseBody": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "headers": {
    "Content-Type": "application/json"
  }
}
```

### Success Criteria

✅ **Complete Success** if:

- OpenAPI import creates documentation, version, and mock server
- All UI components render correctly
- Version management works (create, view, deprecate)
- Mock server endpoints can be tested
- Navigation between features is smooth

✅ **Partial Success** if:

- Core functionality works with minor UI issues
- Some error cases need refinement
- Performance is acceptable but could be optimized

❌ **Needs Work** if:

- Import fails or creates incomplete data
- UI has major rendering issues
- Core version/mock management doesn't work
- Significant errors in console or server logs

This testing guide provides a comprehensive approach to validating all the new API prototyping and versioning features.
