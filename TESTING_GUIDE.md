# 🧪 Testing Guide: Contract Diff & Breaking Change Detection

## Quick Start Testing (Choose Your Method)

### Option 1: CLI Testing (Fastest - No UI Setup Required)

The CLI tool is immediately ready to test:

```bash
# Navigate to CLI directory
cd cli

# Test basic diff functionality
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json --format json

# Test with HTML output
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json --format html --output ../test-report.html

# Test with breaking change detection
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v3-breaking.json --fail-on-breaking
```

**Expected Results:**
- ✅ CLI outputs diff summary with statistics
- ✅ Generates reports in specified format
- ✅ Detects changes between API specifications
- ✅ Proper exit codes for CI/CD integration

### Option 2: Backend API Testing (Direct Service Testing)

Test the backend service directly:

```bash
# Run the complete workflow test
node test-complete-workflow.js
```

**Expected Results:**
- ✅ Specifications loaded successfully
- ✅ Diff comparison completed
- ✅ Breaking change detection completed
- ✅ HTML/Markdown reports generated
- ✅ Test files created: test-diff-report.html, test-diff-report.md, test-diff-report.json

### Option 3: Full Application Testing (UI + Backend)

If you want to test the complete web interface:

1. **Start the Pigeon server:**
   ```bash
   npm run start:server
   # OR use VS Code task: "Start Pigeon Server"
   ```

2. **Start the React client:**
   ```bash
   cd client && npm start
   # OR use VS Code task: "Start React Client"
   ```

3. **Test in browser:**
   - Navigate to http://localhost:3000
   - Go to a collection
   - Click "API Versions" tab
   - Click "Compare Versions" button
   - Select two versions and start comparison

## 📋 Step-by-Step Testing Scenarios

### Scenario 1: CLI Basic Functionality Test

```bash
# From the cli directory
cd cli

# Test 1: Basic diff
echo "Testing basic diff functionality..."
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json

# Test 2: HTML report generation
echo "Testing HTML report generation..."
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json --format html --output ../cli-test-report.html

# Test 3: Markdown output
echo "Testing Markdown output..."
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json --format markdown --output ../cli-test-report.md

# Test 4: Breaking change detection
echo "Testing breaking change detection..."
node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v3-breaking.json --fail-on-breaking
```

### Scenario 2: Backend Service Testing

```javascript
// Create a test file: test-api-service.js
const ApiVersioningService = require('./services/ApiVersioningService');
const fs = require('fs');

async function testApiService() {
    try {
        console.log('🧪 Testing ApiVersioningService...\n');
        
        // Load test specs
        const baseSpec = JSON.parse(fs.readFileSync('test-api-v1.json', 'utf8'));
        const headSpec = JSON.parse(fs.readFileSync('test-api-v2.json', 'utf8'));
        
        // Test comparison
        const result = await ApiVersioningService.compareSpecs(baseSpec, headSpec, {
            format: 'json',
            includeNonBreaking: true,
            generateChangelog: true
        });
        
        console.log('✅ Comparison completed');
        console.log('📊 Summary:', {
            totalChanges: result.summary?.totalChanges || 0,
            breakingChanges: result.summary?.breakingChanges || 0,
            hasBreakingChanges: result.hasBreakingChanges
        });
        
        // Test report generation
        const htmlReport = await ApiVersioningService.formatDiffAsHtml(result.diffResult, result.breakingChanges);
        console.log('✅ HTML report generated:', htmlReport.length, 'characters');
        
        const markdownReport = await ApiVersioningService.formatDiffAsMarkdown(result.diffResult, result.breakingChanges);
        console.log('✅ Markdown report generated:', markdownReport.length, 'characters');
        
        console.log('\n🎉 All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

testApiService();
```

Run with: `node test-api-service.js`

### Scenario 3: Database Integration Testing

```javascript
// Create test-database-integration.js
const mongoose = require('mongoose');
const ApiVersion = require('./models/ApiVersion');
const ApiVersioningService = require('./services/ApiVersioningService');

async function testDatabaseIntegration() {
    try {
        // Connect to test database
        await mongoose.connect('mongodb://localhost:27017/pigeon-test');
        console.log('✅ Connected to test database');
        
        // Create test API versions
        const baseVersion = new ApiVersion({
            collectionId: new mongoose.Types.ObjectId(),
            version: 'v1.0.0',
            name: 'Test API v1',
            createdBy: new mongoose.Types.ObjectId(),
            openApiSpec: { /* base spec */ }
        });
        
        const newVersion = new ApiVersion({
            collectionId: baseVersion.collectionId,
            version: 'v2.0.0', 
            name: 'Test API v2',
            createdBy: baseVersion.createdBy,
            openApiSpec: { /* new spec */ }
        });
        
        await baseVersion.save();
        await newVersion.save();
        console.log('✅ Test versions created');
        
        // Test diff storage
        const diffResult = await ApiVersioningService.compareVersionsAdvanced(
            baseVersion._id,
            newVersion._id,
            { save: true }
        );
        
        console.log('✅ Diff computed and saved');
        console.log('📊 Diff result:', diffResult.message);
        
        // Verify storage
        const updatedVersion = await ApiVersion.findById(newVersion._id);
        console.log('✅ Diffs stored:', updatedVersion.diffs.length);
        
        // Cleanup
        await ApiVersion.deleteMany({ _id: { $in: [baseVersion._id, newVersion._id] } });
        await mongoose.disconnect();
        
        console.log('\n🎉 Database integration test passed!');
        
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

testDatabaseIntegration();
```

## 📊 Test Results Validation

### What to Look For

#### ✅ **Successful CLI Test Results:**
```
🐦 Pigeon CLI - API Testing Tool
Version: 1.0.0

Comparing OpenAPI specifications:
Base: test-api-v1.json
Head: test-api-v2.json

📊 Diff Summary:
Total Changes: X
Breaking Changes: X  
Non-Breaking Changes: X
Added Endpoints: X
Removed Endpoints: X
Modified Endpoints: X

✅ Diff completed successfully
Diff completed in XXXms
```

#### ✅ **Successful Backend Test Results:**
```
✓ Test specifications loaded successfully
✓ Spec comparison completed
  - Changes detected: X
✓ Breaking change detection completed
  - Breaking changes found: X
✓ HTML report generation completed
  - HTML length: XXXX characters
✓ Markdown report generation completed  
  - Markdown length: XXXX characters
✓ Test reports saved successfully

🎉 Complete workflow test PASSED!
```

#### ✅ **Generated Files to Check:**
- `test-diff-report.html` - Professional HTML report
- `test-diff-report.md` - Markdown documentation  
- `test-diff-report.json` - Machine-readable diff data
- `cli-test-report.html` - CLI-generated HTML report

## 🔧 Troubleshooting Common Issues

### Issue 1: "Module not found" errors
**Solution:** Ensure dependencies are installed:
```bash
npm install swagger-diff openapi-diff json-diff handlebars
```

### Issue 2: "Cannot find file" errors  
**Solution:** Verify test files exist:
```bash
ls -la test-api-*.json
```

### Issue 3: "Port already in use" 
**Solution:** Kill existing processes:
```bash
# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Or use a different port
```

### Issue 4: Database connection errors
**Solution:** Use file-based testing (CLI) which doesn't require database

### Issue 5: React compilation errors
**Solution:** The icon imports have been fixed. If still seeing errors:
```bash
cd client
npm install react-icons
npm start
```

## 🚀 Quick Validation Commands

Run these one-liners to quickly verify functionality:

```bash
# CLI quick test
cd cli && node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json --format json

# Backend quick test  
node test-complete-workflow.js

# Check generated reports
ls -la *diff-report* *test-report*

# Validate HTML report
start test-diff-report.html  # Windows
open test-diff-report.html   # Mac
xdg-open test-diff-report.html  # Linux
```

## 📈 Performance Benchmarks

**Expected Performance:**
- CLI diff execution: < 2 seconds for typical APIs
- HTML report generation: < 1 second
- Backend service calls: < 3 seconds
- Database operations: < 5 seconds

**Test with larger specs:**
```bash
# Create larger test specs for performance testing
node -e "
const fs = require('fs');
const baseSpec = JSON.parse(fs.readFileSync('test-api-v1.json'));
// Add 100 more endpoints
for(let i = 0; i < 100; i++) {
    baseSpec.paths[\`/test\${i}\`] = baseSpec.paths['/users'];
}
fs.writeFileSync('large-api-v1.json', JSON.stringify(baseSpec, null, 2));
console.log('Created large-api-v1.json with', Object.keys(baseSpec.paths).length, 'endpoints');
"

# Test performance
time node pigeon-cli.js diff --base large-api-v1.json --head test-api-v2.json
```

## 🎯 Success Criteria

Your implementation is working correctly if:

- ✅ CLI executes without errors
- ✅ Reports are generated in all formats (JSON, HTML, Markdown)
- ✅ Breaking changes are properly detected and classified
- ✅ Generated HTML reports open in browser and display correctly
- ✅ Exit codes are appropriate for CI/CD integration
- ✅ Backend service methods execute without throwing errors
- ✅ Database integration stores diff results properly
- ✅ React components compile without errors

## 📞 Next Steps

Once basic testing is successful:

1. **Integrate with CI/CD:** Add to your deployment pipeline
2. **Customize Rules:** Modify breaking change detection rules
3. **Extend Reports:** Add custom report templates  
4. **Performance Optimize:** Profile with large API specifications
5. **User Training:** Create team documentation and workflows

---

**🎉 Your Contract Diff & Breaking Change Detection feature is ready for production use!**
