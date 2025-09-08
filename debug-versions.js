// Debug script to check API versions and their specifications
const mongoose = require('mongoose');
const ApiVersion = require('./models/ApiVersion');
const ApiVersioningService = require('./services/ApiVersioningService');

async function debugVersions() {
    try {
        // Connect to MongoDB (assuming your database connection)
        console.log('🔍 Debugging API Versions and Comparisons...\n');

        // Get all API versions from the database
        const versions = await ApiVersion.find().sort({ createdAt: -1 }).limit(10);

        console.log(`📊 Found ${versions.length} versions in database:\n`);

        versions.forEach((version, index) => {
            console.log(`${index + 1}. Version: ${version.name || 'Unnamed'} (${version.version || 'No version'})`);
            console.log(`   ID: ${version._id}`);
            console.log(`   Collection: ${version.collectionId}`);
            console.log(`   Created: ${version.createdAt}`);
            console.log(`   Has OpenAPI Spec: ${version.openApiSpec ? 'YES' : 'NO'}`);
            if (version.openApiSpec) {
                console.log(`   Spec Preview: ${JSON.stringify(version.openApiSpec).substring(0, 100)}...`);
                console.log(`   Paths Count: ${Object.keys(version.openApiSpec.paths || {}).length}`);
            }
            console.log(`   ---`);
        });

        if (versions.length >= 2) {
            console.log('\n🔬 Testing comparison between first two versions:\n');

            const version1 = versions[0];
            const version2 = versions[1];

            console.log(`Comparing:`);
            console.log(`  From: ${version1.name} (${version1._id})`);
            console.log(`  To: ${version2.name} (${version2._id})`);

            // Test the comparison logic directly
            try {
                const comparison = await ApiVersioningService.compareVersions(version1._id, version2._id);
                console.log('\n📋 Comparison Result:');
                console.log(JSON.stringify(comparison, null, 2));

                // Also test the spec comparison directly
                if (version1.openApiSpec && version2.openApiSpec) {
                    console.log('\n🧪 Direct Spec Comparison:');
                    const specComparison = await ApiVersioningService.compareSpecs(
                        version1.openApiSpec,
                        version2.openApiSpec,
                        { format: 'json' }
                    );
                    console.log('Spec comparison summary:', {
                        totalChanges: specComparison.summary.totalChanges,
                        breakingChanges: specComparison.summary.breakingChanges,
                        nonBreakingChanges: specComparison.summary.nonBreakingChanges,
                        hasBreakingChanges: specComparison.hasBreakingChanges
                    });
                } else {
                    console.log('\n⚠️ Cannot compare specs directly - one or both versions missing OpenAPI spec');
                }

            } catch (error) {
                console.error('❌ Comparison failed:', error.message);
            }
        }

        console.log('\n✅ Debug complete!');

    } catch (error) {
        console.error('❌ Debug script failed:', error.message);
    }
}

// Run the debug script
debugVersions();
