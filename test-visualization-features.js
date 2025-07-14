#!/usr/bin/env node

/**
 * Advanced Visualization Features Testing Script
 * Run this script to verify all advanced visualization features are working
 */

const fs = require('fs');
const path = require('path');

class VisualizationFeatureTester {
    constructor() {
        this.results = {
            networkFlow: false,
            debugging: false,
            scriptIntegration: false,
            exportSharing: false,
            authVisualization: false
        };
        this.clientPath = path.join(__dirname, 'client', 'src', 'components', 'VisualApiDesigner');
    }

    async runTests() {
        console.log('🧪 Starting Advanced Visualization Features Test...\n');

        // Test 1: Check if service files exist
        await this.testServiceFiles();

        // Test 2: Verify service implementations
        await this.testServiceImplementations();

        // Test 3: Check integration points
        await this.testIntegrationPoints();

        // Display results
        this.displayResults();

        return this.results;
    }

    async testServiceFiles() {
        console.log('📁 Testing Service Files...');

        const serviceFiles = [
            'services/NetworkFlowService.js',
            'services/VisualizationDebugger.js',
            'services/PostRequestScriptService.js',
            'services/ExportService.js',
            'services/AuthVisualizationService.js'
        ];

        for (const file of serviceFiles) {
            const filePath = path.join(this.clientPath, file);
            const exists = fs.existsSync(filePath);

            if (exists) {
                console.log(`  ✅ ${file} - Found`);

                // Check file content
                const content = fs.readFileSync(filePath, 'utf8');
                const serviceName = file.split('/')[1].replace('.js', '');

                if (content.includes(`class ${serviceName}`) || content.includes(`${serviceName} = {`)) {
                    console.log(`  ✅ ${file} - Has service class`);
                    this.updateResult(serviceName, true);
                } else {
                    console.log(`  ❌ ${file} - Missing service class`);
                }
            } else {
                console.log(`  ❌ ${file} - Not found`);
            }
        }

        console.log('');
    }

    async testServiceImplementations() {
        console.log('🔧 Testing Service Implementations...');

        const implementations = [
            {
                file: 'services/NetworkFlowService.js',
                methods: ['createApplicationNetworkMap', 'createApiLedConnectivityMap', 'addRealTimeMonitoring'],
                service: 'NetworkFlowService'
            },
            {
                file: 'services/VisualizationDebugger.js',
                methods: ['startSession', 'inspectElement', 'log'],
                service: 'VisualizationDebugger'
            },
            {
                file: 'services/PostRequestScriptService.js',
                methods: ['executePostRequestScript', 'getScriptTemplates', 'createPmApi'],
                service: 'PostRequestScriptService'
            },
            {
                file: 'services/ExportService.js',
                methods: ['exportVisualization', 'shareVisualization', 'copyToClipboard'],
                service: 'ExportService'
            },
            {
                file: 'services/AuthVisualizationService.js',
                methods: ['createInteractiveAuthFlow', 'exportAuthFlowConfig', 'importAuthFlowConfig'],
                service: 'AuthVisualizationService'
            }
        ];

        for (const impl of implementations) {
            const filePath = path.join(this.clientPath, impl.file);

            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                let methodsFound = 0;

                for (const method of impl.methods) {
                    if (content.includes(method)) {
                        methodsFound++;
                    }
                }

                const percentage = (methodsFound / impl.methods.length) * 100;

                if (percentage >= 80) {
                    console.log(`  ✅ ${impl.service} - ${percentage}% methods implemented`);
                    this.updateResult(impl.service, true);
                } else {
                    console.log(`  ⚠️  ${impl.service} - ${percentage}% methods implemented`);
                }
            }
        }

        console.log('');
    }

    async testIntegrationPoints() {
        console.log('🔗 Testing Integration Points...');

        // Check RequestForm.js integration
        const requestFormPath = path.join(__dirname, 'client', 'src', 'components', 'RequestForm.js');

        if (fs.existsSync(requestFormPath)) {
            const content = fs.readFileSync(requestFormPath, 'utf8');

            if (content.includes('PostRequestScriptService')) {
                console.log('  ✅ RequestForm.js - PostRequestScriptService integrated');
            } else {
                console.log('  ❌ RequestForm.js - PostRequestScriptService not integrated');
            }

            if (content.includes('VisualizationDebugger')) {
                console.log('  ✅ RequestForm.js - VisualizationDebugger integrated');
            } else {
                console.log('  ❌ RequestForm.js - VisualizationDebugger not integrated');
            }
        }

        // Check if NetworkFlowRenderer component exists
        const rendererPath = path.join(this.clientPath, 'components', 'NetworkFlowRenderer.js');

        if (fs.existsSync(rendererPath)) {
            console.log('  ✅ NetworkFlowRenderer.js - Component exists');
        } else {
            console.log('  ❌ NetworkFlowRenderer.js - Component missing');
        }

        console.log('');
    }

    updateResult(serviceName, status) {
        switch (serviceName) {
            case 'NetworkFlowService':
                this.results.networkFlow = status;
                break;
            case 'VisualizationDebugger':
                this.results.debugging = status;
                break;
            case 'PostRequestScriptService':
                this.results.scriptIntegration = status;
                break;
            case 'ExportService':
                this.results.exportSharing = status;
                break;
            case 'AuthVisualizationService':
                this.results.authVisualization = status;
                break;
        }
    }

    displayResults() {
        console.log('📊 Test Results Summary:');
        console.log('========================');

        const features = [
            { name: 'Network Flow Visualization', key: 'networkFlow' },
            { name: 'Advanced Debugging Tools', key: 'debugging' },
            { name: 'Post-Request Script Integration', key: 'scriptIntegration' },
            { name: 'Export and Sharing Options', key: 'exportSharing' },
            { name: 'Authentication Visualization', key: 'authVisualization' }
        ];

        let passedCount = 0;

        for (const feature of features) {
            const status = this.results[feature.key];
            const icon = status ? '✅' : '❌';
            const statusText = status ? 'PASSED' : 'FAILED';

            console.log(`${icon} ${feature.name}: ${statusText}`);

            if (status) passedCount++;
        }

        console.log('========================');
        console.log(`Overall: ${passedCount}/${features.length} features passed`);

        if (passedCount === features.length) {
            console.log('🎉 All advanced visualization features are ready!');
        } else if (passedCount >= 3) {
            console.log('⚠️  Most features are working, some need attention');
        } else {
            console.log('❌ Several features need implementation work');
        }

        console.log('\n📋 Next Steps:');
        console.log('1. Start both server and client applications');
        console.log('2. Open browser and navigate to http://localhost:3000');
        console.log('3. Follow the Advanced Visualization Verification Guide');
        console.log('4. Use the browser console test script for live verification');
    }
}

// Run the tests
if (require.main === module) {
    const tester = new VisualizationFeatureTester();
    tester.runTests().then(results => {
        // Calculate passed count from results
        const passedCount = Object.values(results).filter(Boolean).length;
        process.exit(passedCount === 5 ? 0 : 1);
    });
}

module.exports = VisualizationFeatureTester;
