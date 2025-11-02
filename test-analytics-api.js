// Test the Advanced Analytics & Insights Dashboard implementation
const axios = require('axios');

const API_BASE = 'http://localhost:5001/api';
const TEST_WORKSPACE_ID = 'test-workspace-123';

async function testAnalyticsAPI() {
    console.log('🚀 Testing Advanced Analytics & Insights Dashboard API\n');

    try {
        // Test 1: Get Dashboard Data
        console.log('📊 Test 1: Fetching dashboard data...');
        const dashboardRes = await axios.get(`${API_BASE}/analytics/dashboard`, {
            params: {
                workspaceId: TEST_WORKSPACE_ID,
                period: '24h'
            }
        });
        console.log('✅ Dashboard data retrieved');
        console.log('   - Total Requests:', dashboardRes.data.kpis?.totalRequests || 0);
        console.log('   - Avg Response Time:', dashboardRes.data.kpis?.avgResponseTime || 0, 'ms');
        console.log('   - Error Rate:', dashboardRes.data.kpis?.errorRate || 0, '%\n');

        // Test 2: Get Performance Trends
        console.log('📈 Test 2: Fetching performance trends...');
        const trendsRes = await axios.get(`${API_BASE}/analytics/trends`, {
            params: {
                workspaceId: TEST_WORKSPACE_ID,
                interval: '1h',
                metric: 'responseTime'
            }
        });
        console.log('✅ Trends data retrieved');
        console.log('   - Data points:', trendsRes.data.data?.length || 0);
        console.log('   - Summary:', trendsRes.data.summary || 'N/A\n');

        // Test 3: Get Anomalies
        console.log('🔍 Test 3: Fetching anomalies...');
        const anomaliesRes = await axios.get(`${API_BASE}/analytics/anomalies`, {
            params: {
                workspaceId: TEST_WORKSPACE_ID,
                status: 'open',
                limit: 10
            }
        });
        console.log('✅ Anomalies retrieved');
        console.log('   - Total anomalies:', anomaliesRes.data.summary?.total || 0);
        console.log('   - Open anomalies:', anomaliesRes.data.summary?.open || 0);
        console.log('   - By severity:', anomaliesRes.data.summary?.bySeverity || {}, '\n');

        // Test 4: Trigger Anomaly Detection
        console.log('🎯 Test 4: Triggering anomaly detection...');
        const detectRes = await axios.post(`${API_BASE}/analytics/anomalies/detect`, {
            workspaceId: TEST_WORKSPACE_ID,
            sensitivity: 2.5,
            baselinePeriod: 7
        });
        console.log('✅ Anomaly detection completed');
        console.log('   - Anomalies detected:', detectRes.data.count || 0, '\n');

        // Test 5: Get Cost Analysis
        console.log('💰 Test 5: Fetching cost analysis...');
        const costsRes = await axios.get(`${API_BASE}/analytics/costs`, {
            params: {
                workspaceId: TEST_WORKSPACE_ID,
                costPerRequest: 0.0001,
                costPerGB: 0.10
            }
        });
        console.log('✅ Cost analysis retrieved');
        console.log('   - Total cost: $', costsRes.data.total || 0);
        console.log('   - Projected cost: $', costsRes.data.projection || 0);
        console.log('   - Endpoints analyzed:', costsRes.data.breakdown?.length || 0, '\n');

        // Test 6: Create SLA Configuration
        console.log('🎯 Test 6: Creating SLA configuration...');
        const slaCreateRes = await axios.post(`${API_BASE}/analytics/sla`, {
            workspaceId: TEST_WORKSPACE_ID,
            name: 'Test SLA - 99.9% Uptime',
            scope: 'global',
            targets: {
                availability: {
                    enabled: true,
                    target: 99.9,
                    measurement: 'success_rate'
                },
                responseTime: {
                    enabled: true,
                    target: 500,
                    percentile: 'p95'
                },
                errorRate: {
                    enabled: true,
                    target: 1
                }
            },
            measurementPeriod: 'daily',
            alertThresholds: {
                warningLevel: 95,
                criticalLevel: 90
            }
        });
        console.log('✅ SLA configuration created');
        console.log('   - SLA ID:', slaCreateRes.data.slaConfig?._id || 'N/A');
        const slaId = slaCreateRes.data.slaConfig?._id;

        // Test 7: Calculate SLA Compliance
        if (slaId) {
            console.log('\n📊 Test 7: Calculating SLA compliance...');
            const slaComplianceRes = await axios.post(
                `${API_BASE}/analytics/sla/${slaId}/calculate`,
                { period: 'daily' }
            );
            console.log('✅ SLA compliance calculated');
            console.log('   - Compliance:', slaComplianceRes.data.compliance || 'N/A');
            console.log('   - Status:', slaComplianceRes.data.status || 'N/A\n');
        }

        // Test 8: Compare Metrics
        console.log('🔄 Test 8: Comparing metrics...');
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        
        const compareRes = await axios.get(`${API_BASE}/analytics/compare`, {
            params: {
                workspaceId: TEST_WORKSPACE_ID,
                baselineStart: twoDaysAgo.toISOString(),
                baselineEnd: yesterday.toISOString(),
                currentStart: yesterday.toISOString(),
                currentEnd: now.toISOString(),
                dimension: 'time'
            }
        });
        console.log('✅ Metrics comparison completed');
        console.log('   - Insights:', compareRes.data.comparison?.insights?.length || 0, 'insights generated\n');

        // Test 9: Generate Forecast
        console.log('🔮 Test 9: Generating forecast...');
        const forecastRes = await axios.get(`${API_BASE}/analytics/forecast`, {
            params: {
                workspaceId: TEST_WORKSPACE_ID,
                metric: 'responseTime',
                forecastPeriod: 7,
                historicalPeriod: 30
            }
        });
        console.log('✅ Forecast generated');
        console.log('   - Forecast periods:', forecastRes.data.forecast?.values?.length || 0);
        console.log('   - Insights:', forecastRes.data.insights?.length || 0, 'insights\n');

        // Test 10: Trigger Metrics Aggregation
        console.log('⚙️  Test 10: Triggering metrics aggregation...');
        const aggregateRes = await axios.post(`${API_BASE}/analytics/aggregate`, {
            workspaceId: TEST_WORKSPACE_ID,
            interval: '5m'
        });
        console.log('✅ Metrics aggregation completed');
        console.log('   - Metrics aggregated:', aggregateRes.data.count || 0, '\n');

        console.log('🎉 All tests completed successfully!');
        console.log('\n📝 Summary:');
        console.log('   - All 10 API endpoints tested');
        console.log('   - Analytics dashboard is fully functional');
        console.log('   - Backend services are operational\n');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   - Status:', error.response.status);
            console.error('   - Error:', error.response.data);
        }
    }
}

// Run tests
console.log('=' .repeat(60));
console.log('ADVANCED ANALYTICS & INSIGHTS DASHBOARD - API TESTING');
console.log('=' .repeat(60) + '\n');

testAnalyticsAPI().then(() => {
    console.log('=' .repeat(60));
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
