/**
 * Reporter module for Pigeon CLI
 * Generates test reports in different formats (JSON, JUnit XML, HTML)
 */

const fs = require('fs').promises;
const path = require('path');
const xmlbuilder = require('xmlbuilder');

/**
 * Generate a test report from results
 * @param {Array} results - Array of test results
 * @param {Object} options - Reporter options
 * @returns {Promise<string>} - Path to the generated report
 */
async function generateReport(results, options = {}) {
  const { format = 'json', outputPath, collectionName = 'API Tests', environment = 'default', duration = 0 } = options;

  let reportContent;

  switch (format.toLowerCase()) {
    case 'junit':
      reportContent = generateJUnitXML(results, { collectionName, environment, duration });
      break;
    case 'html':
      reportContent = generateHTML(results, { collectionName, environment, duration });
      break;
    case 'csv':
      reportContent = generateCSV(results, { collectionName, environment, duration });
      break;
    case 'json':
    default:
      reportContent = generateJSON(results, { collectionName, environment, duration });
  }

  // If no output path, use default name
  const finalPath = outputPath || `./pigeon-report.${format.toLowerCase()}`;

  // Write to file
  await fs.writeFile(finalPath, reportContent);
  return finalPath;
}

/**
 * Generate a JSON report
 * @param {Array} results - Array of test results
 * @param {Object} options - Report options
 * @returns {string} - JSON string
 */
function generateJSON(results, options) {
  const { collectionName, environment, duration } = options;

  // Calculate summary data
  const totalRequests = results.length;
  const failedRequests = results.filter(r => r.error || r.tests.some(t => !t.passed)).length;
  const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0);
  const passedTests = results.reduce((sum, r) => sum + r.tests.filter(t => t.passed).length, 0);

  const report = {
    summary: {
      collection: collectionName,
      environment,
      timestamp: new Date().toISOString(),
      duration,
      totalRequests,
      failedRequests,
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    },
    results: results.map(r => ({
      name: r.request.name || r.request.url,
      url: r.request.url,
      method: r.request.method,
      duration: r.duration,
      error: r.error,
      status: r.response ? r.response.status : null,
      tests: r.tests.map(t => ({
        name: t.name,
        passed: t.passed,
        error: t.error
      }))
    }))
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Generate a JUnit XML report
 * @param {Array} results - Array of test results
 * @param {Object} options - Report options
 * @returns {string} - XML string
 */
function generateJUnitXML(results, options) {
  const { collectionName, environment, duration } = options;

  // Calculate total stats
  const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0);
  const passedTests = results.reduce((sum, r) => sum + r.tests.filter(t => t.passed).length, 0);
  const failedTests = totalTests - passedTests;

  // Create XML structure
  const root = xmlbuilder.create('testsuites', { version: '1.0', encoding: 'UTF-8' })
    .att('name', collectionName)
    .att('tests', totalTests)
    .att('failures', failedTests)
    .att('errors', results.filter(r => r.error).length)
    .att('time', (duration / 1000).toFixed(3))
    .att('timestamp', new Date().toISOString())
    .att('environment', environment);

  // Add each request as a test suite
  results.forEach((result, index) => {
    const request = result.request;
    const requestName = request.name || request.url;

    // Create test suite for this request
    const testsuite = root.ele('testsuite')
      .att('name', `${index + 1}. ${requestName}`)
      .att('tests', result.tests.length)
      .att('failures', result.tests.filter(t => !t.passed).length)
      .att('errors', result.error ? 1 : 0)
      .att('time', ((result.duration || 0) / 1000).toFixed(3))
      .att('timestamp', new Date().toISOString())
      .att('url', request.url)
      .att('method', request.method);

    // Add request properties
    const properties = testsuite.ele('properties');
    properties.ele('property')
      .att('name', 'url')
      .att('value', request.url);
    properties.ele('property')
      .att('name', 'method')
      .att('value', request.method);
    if (result.response) {
      properties.ele('property')
        .att('name', 'status')
        .att('value', result.response.status);
    }

    // Add each test as a testcase
    result.tests.forEach(test => {
      const testcase = testsuite.ele('testcase')
        .att('name', test.name)
        .att('classname', `Request.${requestName.replace(/[^a-z0-9]/gi, '_')}`)
        .att('time', ((result.duration || 0) / 1000).toFixed(3));

      if (!test.passed) {
        testcase.ele('failure')
          .att('message', test.error || 'Test assertion failed')
          .att('type', 'AssertionError');
      }
    });

    // Add request error if any
    if (result.error) {
      testsuite.ele('testcase')
        .att('name', 'Request Execution')
        .att('classname', `Request.${requestName.replace(/[^a-z0-9]/gi, '_')}`)
        .ele('error')
        .att('message', result.error.message)
        .att('type', 'RequestError')
        .txt(result.error.stack || '');
    }
  });

  return root.end({ pretty: true });
}

/**
 * Generate an HTML report
 * @param {Array} results - Array of test results
 * @param {Object} options - Report options
 * @returns {string} - HTML string
 */
function generateHTML(results, options) {
  const { collectionName, environment, duration } = options;

  // Calculate summary data
  const totalRequests = results.length;
  const failedRequests = results.filter(r => r.error || r.tests.some(t => !t.passed)).length;
  const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0);
  const passedTests = results.reduce((sum, r) => sum + r.tests.filter(t => t.passed).length, 0);
  const failedTests = totalTests - passedTests;
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // Generate timestamp
  const timestamp = new Date().toLocaleString();

  // Generate results HTML
  const requestResults = results.map((result, index) => {
    const requestName = result.request.name || result.request.url;
    const hasError = result.error !== null;
    const testsPassed = result.tests.filter(t => t.passed).length;
    const testsFailed = result.tests.length - testsPassed;
    const requestSuccess = !hasError && testsFailed === 0;

    // Generate test results HTML
    const testResults = result.tests.map(test => `
      <div class="test-result ${test.passed ? 'passed' : 'failed'}">
        <span class="test-status">${test.passed ? '✓' : '✗'}</span>
        <span class="test-name">${escapeHTML(test.name)}</span>
        ${!test.passed ? `<div class="test-error">${escapeHTML(test.error || 'Assertion failed')}</div>` : ''}
      </div>
    `).join('');

    // Generate error HTML if any
    const errorHTML = hasError ? `
      <div class="request-error">
        <h4>Request Error</h4>
        <div class="error-message">${escapeHTML(result.error.message)}</div>
        <pre class="error-stack">${escapeHTML(result.error.stack || '')}</pre>
      </div>
    ` : '';

    // Generate request result HTML
    return `
      <div class="request-result ${requestSuccess ? 'passed' : 'failed'}">
        <div class="request-header">
          <h3>
            <span class="request-status">${requestSuccess ? '✓' : '✗'}</span>
            [${index + 1}/${totalRequests}] ${escapeHTML(requestName)}
          </h3>
          <span class="request-method ${result.request.method}">${result.request.method}</span>
        </div>
        <div class="request-url">${escapeHTML(result.request.url)}</div>
        
        <div class="request-details">
          <div class="detail">
            <span class="label">Status:</span>
            <span class="value">${result.response ? result.response.status : 'N/A'}</span>
          </div>
          <div class="detail">
            <span class="label">Duration:</span>
            <span class="value">${result.duration ? `${result.duration}ms` : 'N/A'}</span>
          </div>
          <div class="detail">
            <span class="label">Tests:</span>
            <span class="value">${testsPassed}/${result.tests.length} passed</span>
          </div>
        </div>
        
        ${errorHTML}
        
        ${result.tests.length > 0 ? `
          <div class="tests-container">
            <h4>Test Results</h4>
            <div class="test-results">
              ${testResults}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Complete HTML template
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pigeon API Test Results - ${escapeHTML(collectionName)}</title>
  <style>
    :root {
      --color-bg: #f8f9fa;
      --color-text: #343a40;
      --color-primary: #FF6C37;
      --color-success: #28a745;
      --color-danger: #dc3545;
      --color-warning: #ffc107;
      --color-info: #17a2b8;
      --color-border: #dee2e6;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--color-text);
      background-color: var(--color-bg);
      margin: 0;
      padding: 20px;
    }
    .report-container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .report-header {
      background-color: var(--color-primary);
      color: white;
      padding: 20px;
      display: flex;
      flex-direction: column;
    }
    .report-title {
      margin: 0;
      font-size: 24px;
      display: flex;
      align-items: center;
    }
    .report-title .pigeon-logo {
      margin-right: 10px;
      font-size: 28px;
    }
    .report-meta {
      margin-top: 10px;
      font-size: 14px;
      opacity: 0.9;
    }
    .report-summary {
      display: flex;
      padding: 20px;
      background-color: #f1f3f5;
      border-bottom: 1px solid var(--color-border);
      flex-wrap: wrap;
    }
    .summary-item {
      flex: 1;
      min-width: 120px;
      padding: 10px;
      text-align: center;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .summary-label {
      font-size: 14px;
      color: #6c757d;
    }
    .report-content {
      padding: 20px;
    }
    .request-result {
      margin-bottom: 20px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      overflow: hidden;
    }
    .request-result.passed {
      border-left: 4px solid var(--color-success);
    }
    .request-result.failed {
      border-left: 4px solid var(--color-danger);
    }
    .request-header {
      background-color: #f8f9fa;
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--color-border);
    }
    .request-status {
      display: inline-block;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      text-align: center;
      line-height: 24px;
      margin-right: 10px;
    }
    .request-result.passed .request-status {
      background-color: rgba(40, 167, 69, 0.2);
      color: var(--color-success);
    }
    .request-result.failed .request-status {
      background-color: rgba(220, 53, 69, 0.2);
      color: var(--color-danger);
    }
    .request-method {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      color: white;
    }
    .GET {
      background-color: var(--color-info);
    }
    .POST {
      background-color: var(--color-success);
    }
    .PUT {
      background-color: var(--color-warning);
    }
    .DELETE {
      background-color: var(--color-danger);
    }
    .request-url {
      padding: 10px 15px;
      font-family: monospace;
      border-bottom: 1px solid var(--color-border);
      word-break: break-all;
      background-color: #f8f9fa;
    }
    .request-details {
      display: flex;
      flex-wrap: wrap;
      padding: 15px;
      border-bottom: 1px solid var(--color-border);
      background-color: white;
    }
    .detail {
      margin-right: 20px;
      margin-bottom: 5px;
    }
    .label {
      font-weight: bold;
      margin-right: 5px;
    }
    .request-error {
      padding: 15px;
      background-color: rgba(220, 53, 69, 0.1);
      border-bottom: 1px solid var(--color-border);
    }
    .error-message {
      color: var(--color-danger);
      font-weight: bold;
    }
    .error-stack {
      margin-top: 10px;
      padding: 10px;
      background-color: #f1f3f5;
      border-radius: 4px;
      overflow: auto;
      font-size: 12px;
      max-height: 200px;
    }
    .tests-container {
      padding: 15px;
    }
    .tests-container h4 {
      margin-top: 0;
      margin-bottom: 10px;
    }
    .test-results {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .test-result {
      padding: 8px 10px;
      border-radius: 4px;
      display: flex;
      align-items: flex-start;
    }
    .test-result.passed {
      background-color: rgba(40, 167, 69, 0.1);
    }
    .test-result.failed {
      background-color: rgba(220, 53, 69, 0.1);
    }
    .test-status {
      display: inline-block;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      text-align: center;
      line-height: 20px;
      margin-right: 10px;
      flex-shrink: 0;
    }
    .test-result.passed .test-status {
      color: var(--color-success);
    }
    .test-result.failed .test-status {
      color: var(--color-danger);
    }
    .test-error {
      margin-top: 5px;
      padding: 5px;
      border-radius: 4px;
      background-color: rgba(220, 53, 69, 0.2);
      color: var(--color-danger);
      font-size: 12px;
    }
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 12px;
      color: #6c757d;
    }
    .success-bar {
      height: 8px;
      background-color: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 10px;
    }
    .success-progress {
      height: 100%;
      background-color: ${successRate === 100 ? 'var(--color-success)' : 'var(--color-warning)'};
      width: ${successRate}%;
    }
    @media (max-width: 768px) {
      .summary-item {
        min-width: calc(50% - 20px);
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <h1 class="report-title">
        <span class="pigeon-logo">🐦</span> Pigeon API Test Results
      </h1>
      <div class="report-meta">
        <div>Collection: ${escapeHTML(collectionName)}</div>
        <div>Environment: ${escapeHTML(environment)}</div>
        <div>Generated: ${timestamp}</div>
      </div>
    </div>
    
    <div class="report-summary">
      <div class="summary-item">
        <div class="summary-value">${totalRequests}</div>
        <div class="summary-label">Requests</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${totalTests}</div>
        <div class="summary-label">Tests</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: var(--color-success)">${passedTests}</div>
        <div class="summary-label">Passed</div>
      </div>
      <div class="summary-item">
        <div class="summary-value" style="color: var(--color-danger)">${failedTests}</div>
        <div class="summary-label">Failed</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${successRate}%</div>
        <div class="summary-label">Success Rate</div>
        <div class="success-bar">
          <div class="success-progress"></div>
        </div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${Math.round(duration / 1000)}</div>
        <div class="summary-label">Duration (s)</div>
      </div>
    </div>
    
    <div class="report-content">
      ${requestResults}
    </div>
  </div>
  
  <div class="footer">
    Generated by Pigeon API Testing Tool - ${new Date().getFullYear()}
  </div>
</body>
</html>
  `;
}

/**
 * Escape HTML special characters
 * @param {string} str - Input string
 * @returns {string} - Escaped string
 */
function escapeHTML(str) {
  if (!str) return '';

  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a CSV report
 * @param {Array} results - Array of test results
 * @param {Object} options - Report options
 * @returns {string} - CSV string
 */
function generateCSV(results, options) {
  const { collectionName, environment, duration } = options;

  // Initialize CSV with headers
  let csv = 'Request Name,URL,Method,Status,Duration (ms),Error,Test Count,Tests Passed,Tests Failed\n';

  // Add each request as a row
  results.forEach(result => {
    const requestName = result.request.name || result.request.url;
    const url = result.request.url;
    const method = result.request.method;
    const status = result.response ? result.response.status : 'N/A';
    const requestDuration = result.duration || 'N/A';
    const error = result.error ? escapeCsvField(result.error.message) : '';
    const testCount = result.tests.length;
    const testsPassed = result.tests.filter(t => t.passed).length;
    const testsFailed = testCount - testsPassed;

    csv += `${escapeCsvField(requestName)},${escapeCsvField(url)},${method},${status},${requestDuration},${error},${testCount},${testsPassed},${testsFailed}\n`;
  });

  // Add detailed test results section
  csv += '\n\nDetailed Test Results\n';
  csv += 'Request Name,Test Name,Result,Error\n';

  // Add each test as a row
  results.forEach(result => {
    const requestName = result.request.name || result.request.url;

    result.tests.forEach(test => {
      const testName = test.name;
      const passed = test.passed ? 'PASS' : 'FAIL';
      const error = test.error ? escapeCsvField(test.error) : '';

      csv += `${escapeCsvField(requestName)},${escapeCsvField(testName)},${passed},${error}\n`;
    });
  });

  // Add summary section
  const totalRequests = results.length;
  const failedRequests = results.filter(r => r.error || r.tests.some(t => !t.passed)).length;
  const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0);
  const passedTests = results.reduce((sum, r) => sum + r.tests.filter(t => t.passed).length, 0);
  const failedTests = totalTests - passedTests;
  const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  csv += '\n\nSummary\n';
  csv += `Collection,${escapeCsvField(collectionName)}\n`;
  csv += `Environment,${escapeCsvField(environment)}\n`;
  csv += `Timestamp,${new Date().toISOString()}\n`;
  csv += `Duration (ms),${duration}\n`;
  csv += `Total Requests,${totalRequests}\n`;
  csv += `Failed Requests,${failedRequests}\n`;
  csv += `Total Tests,${totalTests}\n`;
  csv += `Passed Tests,${passedTests}\n`;
  csv += `Failed Tests,${failedTests}\n`;
  csv += `Success Rate,${successRate}%\n`;

  return csv;
}

/**
 * Escape fields for CSV format
 * @param {string} field - Input field
 * @returns {string} - Escaped CSV field
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';

  // Convert to string
  const str = String(field);

  // If the field contains quotes, commas, or newlines, wrap it in quotes
  // and escape any quotes within the field
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

module.exports = {
  generateReport,
  generateJSON,
  generateJUnitXML,
  generateHTML,
  generateCSV
};