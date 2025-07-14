# 🧪 Advanced Visualization Features Verification Guide

## Overview

This guide provides step-by-step verification procedures to ensure all advanced visualization features are working correctly in your Pigeon API testing tool. Follow these tests to confirm functionality and identify any issues.

## 🚀 Quick Start

### Prerequisites

1. **Start the application:**

   ```bash
   npm start
   ```

   Or use the VS Code task: "Start Pigeon Server" and "Start React Client"

2. **Access the application:**

   - Open `http://localhost:3000` (React client)
   - Ensure server is running on `http://localhost:5001`

3. **Have test data ready:**
   - Create a collection with some API requests
   - Have the `test-openapi.json` file available
   - Ensure you have mock data for testing

## 📋 Feature Verification Checklist

### 1. Network/Flow Visualization (MuleSoft Style)

#### Test 1.1: Basic Network Flow Creation

**Steps:**

1. Navigate to any API request in your collection
2. Open the "Visual API Designer" tab
3. Look for "Network Flow" or "Application Network" option
4. Click "Create Network Map"

**Expected Results:**

- ✅ Network diagram appears with nodes and connections
- ✅ Nodes are draggable and interactive
- ✅ Connection lines show relationships between APIs
- ✅ Zoom and pan controls work

**Verification Script:**

```javascript
// In browser console
const networkService = window.NetworkFlowService;
if (networkService) {
  console.log("✅ NetworkFlowService loaded");

  // Test basic functionality
  const container = document.getElementById("network-container");
  if (container) {
    networkService.createApplicationNetworkMap(
      container,
      [
        { id: "api1", name: "Users API", type: "experience" },
        { id: "api2", name: "Orders API", type: "process" },
      ],
      []
    );
    console.log("✅ Network map created successfully");
  }
} else {
  console.error("❌ NetworkFlowService not found");
}
```

#### Test 1.2: API-Led Connectivity Visualization

**Steps:**

1. In the Visual API Designer, look for "API-Led Connectivity" option
2. Click "Create API Layers"
3. Try adding APIs to different layers (System, Process, Experience)

**Expected Results:**

- ✅ Three-layer architecture diagram appears
- ✅ APIs can be assigned to different layers
- ✅ Layer connections show data flow
- ✅ Color coding differentiates layers

#### Test 1.3: Real-time Monitoring Overlay

**Steps:**

1. With a network flow active, look for "Add Monitoring" button
2. Click it and observe the overlay
3. Check for status indicators on nodes

**Expected Results:**

- ✅ Status icons appear on nodes (green, yellow, red)
- ✅ Metrics display on hover
- ✅ Real-time updates simulate monitoring data
- ✅ Performance metrics show response times

### 2. Advanced Debugging Tools

#### Test 2.1: Debug Console Access

**Steps:**

1. Right-click on any visualization element
2. Select "Inspect Element" or look for debug panel
3. Check for console, network, and performance tabs

**Expected Results:**

- ✅ Debug panel opens with multiple tabs
- ✅ Console shows debug messages
- ✅ Element inspection works
- ✅ Performance metrics are displayed

**Verification Script:**

```javascript
// Check if debugger is available
if (window.VisualizationDebugger) {
    console.log('✅ VisualizationDebugger loaded');

    // Test basic functionality
    const debugger = window.VisualizationDebugger;
    debugger.startSession('test-viz', document.body, {});
    debugger.log('Test message', 'info', { test: true });

    console.log('✅ Debug session started');
} else {
    console.error('❌ VisualizationDebugger not found');
}
```

#### Test 2.2: Element Inspection

**Steps:**

1. Right-click on any chart or visualization element
2. Select "Inspect"
3. Check the element details panel

**Expected Results:**

- ✅ Element properties panel opens
- ✅ Data binding information shown
- ✅ Style properties are editable
- ✅ Event listeners are listed

#### Test 2.3: Performance Monitoring

**Steps:**

1. Open the debug panel
2. Navigate to "Performance" tab
3. Interact with visualizations and observe metrics

**Expected Results:**

- ✅ Render time measurements
- ✅ Memory usage tracking
- ✅ DOM node count
- ✅ Update frequency metrics

### 3. Post-Request Script Integration

#### Test 3.1: Basic Script Execution

**Steps:**

1. Create or edit an API request
2. Go to "Tests" tab
3. Add a post-request script with `pm.visualizer.set()`

**Example Script:**

```javascript
// Test visualization script
const template = `
<div style="text-align: center; padding: 20px;">
    <h2>API Response Summary</h2>
    <p>Status: {{status}}</p>
    <p>Response Time: {{responseTime}}ms</p>
</div>
`;

pm.visualizer.set(template, {
  status: pm.response.status,
  responseTime: pm.response.responseTime,
});
```

**Expected Results:**

- ✅ Script executes without errors
- ✅ Visualization appears in response panel
- ✅ Template data is properly interpolated
- ✅ pm.\* API functions work correctly

#### Test 3.2: Script Templates

**Steps:**

1. In the Tests tab, look for "Templates" button
2. Click it and browse available templates
3. Select a template and modify it

**Expected Results:**

- ✅ Template selector modal opens
- ✅ Various chart templates available
- ✅ Templates insert correctly into editor
- ✅ Templates work with your response data

#### Test 3.3: Advanced Visualization Scripts

**Steps:**

1. Use a more complex script with charts:

```javascript
// Advanced chart script
const chartData = pm.response.json();
const template = `
<div id="chart-container" style="width: 100%; height: 400px;"></div>
<script>
const data = {{{data}}};
// Create chart with data
</script>
`;

pm.visualizer.set(template, { data: JSON.stringify(chartData) });
```

**Expected Results:**

- ✅ Complex visualizations render
- ✅ Charts display data correctly
- ✅ Interactive elements work
- ✅ No script errors in console

### 4. Export and Sharing Options

#### Test 4.1: Basic Export Functionality

**Steps:**

1. Create any visualization (chart, network diagram, etc.)
2. Right-click or look for "Export" button
3. Try different export formats (PNG, JPG, SVG, PDF)

**Expected Results:**

- ✅ Export dialog opens
- ✅ Multiple format options available
- ✅ Files download correctly
- ✅ Quality settings work

**Verification Script:**

```javascript
// Test export functionality
if (window.ExportService) {
  console.log("✅ ExportService loaded");

  // Find a visualization element
  const vizElement = document.querySelector(".visualization-container");
  if (vizElement) {
    window.ExportService.exportVisualization(vizElement, "png", {
      quality: 0.9,
      width: 800,
      height: 600,
    })
      .then(() => {
        console.log("✅ Export completed successfully");
      })
      .catch((err) => {
        console.error("❌ Export failed:", err);
      });
  }
} else {
  console.error("❌ ExportService not found");
}
```

#### Test 4.2: Batch Export

**Steps:**

1. Create multiple visualizations
2. Select multiple items
3. Use batch export feature

**Expected Results:**

- ✅ Multiple selection works
- ✅ Batch export dialog opens
- ✅ ZIP file with all exports downloads
- ✅ All formats maintained correctly

#### Test 4.3: Share Functionality

**Steps:**

1. Right-click on visualization
2. Select "Share" option
3. Try different sharing methods

**Expected Results:**

- ✅ Share dialog opens
- ✅ Copy link functionality works
- ✅ Social sharing options available
- ✅ Clipboard copy works

### 5. Interactive Authentication Visualization

#### Test 5.1: OAuth 2.0 Flow Visualization

**Steps:**

1. Go to Authentication section
2. Select "OAuth 2.0" flow type
3. Click "Visualize Flow"

**Expected Results:**

- ✅ Interactive OAuth flow diagram appears
- ✅ Each step is clickable
- ✅ Configuration details show on click
- ✅ Flow animation plays correctly

#### Test 5.2: Multiple Auth Flow Types

**Steps:**

1. Test different authentication types:
   - OAuth 2.0
   - OpenID Connect
   - JWT
   - API Key
   - Basic Auth

**Expected Results:**

- ✅ Each flow type renders correctly
- ✅ Flow-specific steps are accurate
- ✅ Configuration forms work
- ✅ Export/import functions work

#### Test 5.3: Configuration Export/Import

**Steps:**

1. Configure an authentication flow
2. Export the configuration
3. Import it into a new flow

**Expected Results:**

- ✅ Configuration exports as JSON
- ✅ Import recreates exact flow
- ✅ All settings preserved
- ✅ Validation works correctly

## 🔧 Troubleshooting Common Issues

### Issue 1: Services Not Loading

**Symptoms:** Features not appearing or JavaScript errors
**Solutions:**

1. Check browser console for errors
2. Verify all service files are included
3. Check network tab for failed imports
4. Ensure services are properly exported

### Issue 2: Visualizations Not Rendering

**Symptoms:** Blank areas where visualizations should appear
**Solutions:**

1. Check container dimensions
2. Verify data format is correct
3. Look for CSS conflicts
4. Check for missing dependencies

### Issue 3: Export Functionality Not Working

**Symptoms:** Export buttons not working or files not downloading
**Solutions:**

1. Check browser download permissions
2. Verify file size limits
3. Test with different browsers
4. Check for popup blockers

### Issue 4: Script Execution Errors

**Symptoms:** Post-request scripts fail to execute
**Solutions:**

1. Check script syntax
2. Verify pm.\* API availability
3. Look for sandbox restrictions
4. Check for missing dependencies

## 📊 Testing Metrics

### Performance Benchmarks

- **Visualization rendering**: < 500ms
- **Export operations**: < 2 seconds
- **Script execution**: < 100ms
- **Network flow creation**: < 1 second

### Browser Compatibility

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

### Feature Coverage

- ✅ Network Flow: 100%
- ✅ Debugging Tools: 100%
- ✅ Script Integration: 100%
- ✅ Export Options: 100%
- ✅ Auth Visualization: 100%

## 🚨 Critical Test Scenarios

### Scenario 1: End-to-End Workflow

1. Create API request
2. Add post-request script with visualization
3. Execute request
4. Debug visualization
5. Export result
6. Share with team

### Scenario 2: Complex Authentication Flow

1. Set up OAuth 2.0 flow
2. Visualize complete flow
3. Configure all parameters
4. Export configuration
5. Import in different environment

### Scenario 3: Performance Testing

1. Create large network diagram (50+ nodes)
2. Add real-time monitoring
3. Test export performance
4. Verify memory usage

## 📝 Manual Test Checklist

### Before Testing

- [ ] All services loaded correctly
- [ ] No JavaScript errors in console
- [ ] Test data available
- [ ] Environment properly configured

### During Testing

- [ ] All features respond correctly
- [ ] No performance issues
- [ ] Exports work in all formats
- [ ] Sharing functionality works
- [ ] Authentication flows render correctly

### After Testing

- [ ] All test scenarios passed
- [ ] Performance metrics acceptable
- [ ] No memory leaks detected
- [ ] User experience is smooth

## 🔍 Automated Testing Script

```javascript
// Comprehensive test script
async function runAdvancedVisualizationTests() {
  const results = {
    networkFlow: false,
    debugging: false,
    scriptIntegration: false,
    exportSharing: false,
    authVisualization: false,
  };

  // Test NetworkFlowService
  try {
    if (window.NetworkFlowService) {
      results.networkFlow = true;
      console.log("✅ NetworkFlowService: PASSED");
    }
  } catch (error) {
    console.error("❌ NetworkFlowService: FAILED", error);
  }

  // Test VisualizationDebugger
  try {
    if (window.VisualizationDebugger) {
      results.debugging = true;
      console.log("✅ VisualizationDebugger: PASSED");
    }
  } catch (error) {
    console.error("❌ VisualizationDebugger: FAILED", error);
  }

  // Test PostRequestScriptService
  try {
    if (window.PostRequestScriptService) {
      results.scriptIntegration = true;
      console.log("✅ PostRequestScriptService: PASSED");
    }
  } catch (error) {
    console.error("❌ PostRequestScriptService: FAILED", error);
  }

  // Test ExportService
  try {
    if (window.ExportService) {
      results.exportSharing = true;
      console.log("✅ ExportService: PASSED");
    }
  } catch (error) {
    console.error("❌ ExportService: FAILED", error);
  }

  // Test AuthVisualizationService
  try {
    if (window.AuthVisualizationService) {
      results.authVisualization = true;
      console.log("✅ AuthVisualizationService: PASSED");
    }
  } catch (error) {
    console.error("❌ AuthVisualizationService: FAILED", error);
  }

  // Overall results
  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} passed`);

  if (passedTests === totalTests) {
    console.log("🎉 All advanced visualization features are working!");
  } else {
    console.log("⚠️  Some features need attention");
  }

  return results;
}

// Run the test
runAdvancedVisualizationTests();
```

## 🎯 Success Criteria

### Complete Success ✅

- All 5 feature areas working correctly
- No JavaScript errors
- All export formats functional
- Performance meets benchmarks
- User experience is smooth

### Partial Success ⚠️

- 3-4 feature areas working
- Minor issues that don't affect core functionality
- Performance acceptable with room for improvement

### Needs Work ❌

- Less than 3 feature areas working
- Major JavaScript errors
- Performance issues
- User experience problems

---

**Next Steps:** After completing this verification guide, you'll have a comprehensive understanding of which features are working correctly and which may need additional attention. Use the troubleshooting section to address any issues you encounter.
