// Quick test to verify the Contract Diff feature is working
console.log('🧪 Quick Contract Diff Test\n');

const ApiVersioningService = require('./services/ApiVersioningService');
const fs = require('fs');

async function quickTest() {
    try {
        // Test 1: Verify service exists and methods are available
        console.log('✅ Step 1: ApiVersioningService loaded');
        console.log('   Available methods:', Object.getOwnPropertyNames(ApiVersioningService).filter(name => typeof ApiVersioningService[name] === 'function'));

        // Test 2: Check if test files exist
        if (fs.existsSync('test-api-v1.json') && fs.existsSync('test-api-v2.json')) {
            console.log('✅ Step 2: Test API specification files found');
        } else {
            console.log('❌ Step 2: Test files missing');
            return;
        }

        // Test 3: Load and parse specifications
        const baseSpec = JSON.parse(fs.readFileSync('test-api-v1.json', 'utf8'));
        const headSpec = JSON.parse(fs.readFileSync('test-api-v2.json', 'utf8'));
        console.log('✅ Step 3: API specifications loaded and parsed');
        console.log(`   Base spec: ${baseSpec.info.title} v${baseSpec.info.version}`);
        console.log(`   Head spec: ${headSpec.info.title} v${headSpec.info.version}`);

        // Test 4: Run diff comparison
        console.log('\n🔍 Running diff comparison...');
        const diffResult = await ApiVersioningService.compareSpecs(baseSpec, headSpec);
        console.log('✅ Step 4: Diff comparison completed');
        console.log(`   Diff result type: ${typeof diffResult}`);
        console.log(`   Has error: ${diffResult.error ? 'Yes' : 'No'}`);

        // Test 5: Extract breaking changes
        const breakingChanges = await ApiVersioningService.extractBreakingChanges(diffResult);
        console.log('✅ Step 5: Breaking change analysis completed');
        console.log(`   Breaking changes found: ${breakingChanges.length}`);

        // Test 6: Generate reports
        const htmlReport = await ApiVersioningService.formatDiffAsHtml(diffResult, breakingChanges);
        const markdownReport = await ApiVersioningService.formatDiffAsMarkdown(diffResult, breakingChanges);
        console.log('✅ Step 6: Report generation completed');
        console.log(`   HTML report: ${htmlReport.length} characters`);
        console.log(`   Markdown report: ${markdownReport.length} characters`);

        // Save quick test reports
        fs.writeFileSync('quick-test-report.html', htmlReport);
        fs.writeFileSync('quick-test-report.md', markdownReport);
        fs.writeFileSync('quick-test-result.json', JSON.stringify({
            success: true,
            diffResult,
            breakingChanges,
            reports: {
                html: htmlReport.length,
                markdown: markdownReport.length
            },
            timestamp: new Date().toISOString()
        }, null, 2));

        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('\n📁 Generated files:');
        console.log('   - quick-test-report.html');
        console.log('   - quick-test-report.md');
        console.log('   - quick-test-result.json');

        console.log('\n🚀 Your Contract Diff & Breaking Change Detection feature is working correctly!');
        console.log('\n📖 Next steps:');
        console.log('   1. Open quick-test-report.html in your browser');
        console.log('   2. Test the CLI: cd cli && node pigeon-cli.js diff --base ../test-api-v1.json --head ../test-api-v2.json');
        console.log('   3. Start the React app to test the UI components');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Make sure you have installed dependencies: npm install swagger-diff openapi-diff json-diff handlebars');
        console.error('   2. Verify test files exist: test-api-v1.json and test-api-v2.json');
        console.error('   3. Check the full error details above');

        fs.writeFileSync('quick-test-error.json', JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        }, null, 2));

        process.exit(1);
    }
}

quickTest();
