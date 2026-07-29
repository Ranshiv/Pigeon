// The documentation hub and article pages intentionally share this registry.
// Keeping the feature list here makes new product surfaces easy to document
// without maintaining a second set of links in the UI.
export const documentationSections = [
    {
        id: 'start', title: 'Get started', description: 'Learn the Pigeon workspace and make your first request.', icon: 'home',
        guides: [
            ['Create a workspace', 'Set up a workspace for your team and API work.', '/workspace/workspaces'],
            ['Create a collection', 'Organize related requests into a reusable collection.', '/workspace/workspaces'],
            ['Send your first request', 'Build, send, and inspect a request in API Network.', '/workspace/api-network'],
            ['Find your way around Pigeon', 'Understand the workspace home, navigation, history, and settings.', '/workspace/home']
        ]
    },
    {
        id: 'requests', title: 'Requests and collections', description: 'Build requests, handle responses, and reuse API workflows.', icon: 'send',
        guides: [
            ['Build an HTTP request', 'Configure methods, URLs, headers, query parameters, and bodies.', '/workspace/api-network'],
            ['Read responses and history', 'Inspect response data and revisit previous request runs.', '/workspace/api-network'],
            ['Use authorization', 'Configure credentials and authorization details for an API.', '/workspace/api-network'],
            ['Import Postman collections', 'Bring existing Postman collections and environments into Pigeon.', '/workspace/api-network'],
            ['Run and manage collections', 'Save, organize, duplicate, and execute requests together.', '/workspace/workspaces'],
            ['Share collection work', 'Use collection collaboration, comments, review, and Git sync workflows.', '/workspace/workspaces']
        ]
    },
    {
        id: 'variables', title: 'Variables and environments', description: 'Keep values reusable and separate across development stages.', icon: 'database',
        guides: [
            ['Create an environment', 'Separate local, staging, and production request values.', '/workspace/workspaces'],
            ['Manage collection variables', 'Define values that travel with a collection.', '/workspace/workspaces'],
            ['Use global variables', 'Share common values across requests and collections.', '/workspace/workspaces'],
            ['Resolve variables in requests', 'Preview and interpolate values safely before sending.', '/workspace/api-network']
        ]
    },
    {
        id: 'automation', title: 'Scripts and automation', description: 'Add dynamic setup, assertions, and repeatable API workflows.', icon: 'code',
        guides: [
            ['Write pre-request scripts', 'Prepare variables and request data before execution.', '/workspace/api-network'],
            ['Write test scripts', 'Assert response behavior and turn checks into repeatable tests.', '/workspace/api-network'],
            ['Build visual API workflows', 'Design connected API flows with the visual designer.', '/workspace/api-network'],
            ['Use the Pigeon CLI', 'Run collections from a terminal or automated workflow.', '/workspace/home']
        ]
    },
    {
        id: 'design', title: 'API design and documentation', description: 'Design specifications, compare versions, and publish clear API docs.', icon: 'file',
        guides: [
            ['Design an API visually', 'Create resources, endpoints, schemas, and responses on the canvas.', '/workspace/api-network'],
            ['Work with OpenAPI', 'Import, validate, preview, and export OpenAPI definitions.', '/workspace/api-network'],
            ['Manage API versions', 'Track versions and compare changes with API diffs.', '/workspace/api-network'],
            ['Write collection documentation', 'Edit API documentation content and settings.', '/documentation'],
            ['Publish public documentation', 'Publish a collection documentation site for consumers.', '/documentation']
        ]
    },
    {
        id: 'network', title: 'API Network and MCP', description: 'Explore APIs, connect MCP tools, and work with shared API resources.', icon: 'globe',
        guides: [
            ['Explore the API Network', 'Find, inspect, and work with API requests in the network browser.', '/workspace/api-network'],
            ['Use the marketplace', 'Browse API listings, categories, reviews, and community discussions.', '/workspace/api-network'],
            ['Use the MCP workbench', 'Connect MCP profiles and test tool interactions.', '/workspace/api-network/mcp'],
            ['Create a collection MCP server', 'Expose collection capabilities through an MCP server.', '/workspace/workspaces'],
            ['Use AI agent tools', 'Generate tests, analyze APIs, and accelerate documentation work.', '/workspace/api-network']
        ]
    },
    {
        id: 'testing', title: 'Testing and quality', description: 'Test APIs across schemas, traces, contracts, fuzzing, and evaluations.', icon: 'check',
        guides: [
            ['Test GraphQL APIs', 'Run GraphQL operations and inspect results in the GraphQL tester.', '/workspace/graphql'],
            ['Test protocols', 'Connect to WebSocket, gRPC, SOAP, MQTT, and SSE endpoints.', '/workspace/protocols'],
            ['Convert protocols', 'Convert protocol requests into useful API representations.', '/workspace/protocols'],
            ['Generate tests from traces', 'Import traces and turn observed traffic into test cases.', '/workspace/trace-to-test'],
            ['Run consumer contract tests', 'Define, execute, and review consumer-driven contracts.', '/workspace/consumer-contracts'],
            ['Run fuzz tests', 'Find unexpected behavior by exercising schemas with generated inputs.', '/workspace/api-network'],
            ['Evaluate API scenarios', 'Create evaluation suites and score scenario results.', '/workspace/api-network']
        ]
    },
    {
        id: 'async', title: 'AsyncAPI and event-driven APIs', description: 'Design, import, test, and document event-driven API contracts.', icon: 'radio',
        guides: [
            ['Create an AsyncAPI document', 'Start an event-driven API definition in the AsyncAPI workspace.', '/workspace/asyncapi'],
            ['Import AsyncAPI', 'Bring an existing AsyncAPI document into Pigeon.', '/workspace/asyncapi'],
            ['Design channels and messages', 'Model channels, operations, messages, and schemas.', '/workspace/asyncapi'],
            ['Run AsyncAPI scenarios', 'Test event flows and review scenario results.', '/workspace/asyncapi']
        ]
    },
    {
        id: 'mocking', title: 'Mock servers', description: 'Create realistic mock APIs, traffic, state, and failure scenarios.', icon: 'server',
        guides: [
            ['Create a mock server', 'Set up a mock API from collection endpoints.', '/workspace/workspaces'],
            ['Define mock endpoints', 'Configure example responses and endpoint behavior.', '/workspace/workspaces'],
            ['Record mock traffic', 'Capture traffic and reuse it as mock behavior.', '/workspace/workspaces'],
            ['Build mock scenarios', 'Switch between realistic response scenarios.', '/workspace/workspaces'],
            ['Test failures with Fault Lab', 'Simulate faults and inspect how clients respond.', '/workspace/workspaces'],
            ['Review mock analytics', 'Understand usage and response behavior for a mock server.', '/workspace/workspaces']
        ]
    },
    {
        id: 'monitoring', title: 'Monitoring and operations', description: 'Watch API health, investigate incidents, and communicate availability.', icon: 'monitor',
        guides: [
            ['Create an API monitor', 'Schedule health checks and define what success means.', '/workspace/monitoring'],
            ['Read monitoring analytics', 'Understand latency, availability, and performance trends.', '/workspace/monitoring'],
            ['Review monitoring history', 'Trace monitor runs and investigate previous failures.', '/workspace/monitoring'],
            ['Configure alerts and policies', 'Route important changes to the right people.', '/workspace/monitoring/alerts'],
            ['Manage incidents and maintenance', 'Coordinate incidents and planned maintenance windows.', '/workspace/monitoring/incidents'],
            ['Publish a status page', 'Share service health and status updates publicly.', '/workspace/monitoring']
        ]
    },
    {
        id: 'collaboration', title: 'Collaboration and administration', description: 'Bring teams together with reviews, access controls, and shared workspaces.', icon: 'users',
        guides: [
            ['Invite and manage team members', 'Add teammates and manage team membership.', '/workspace/monitoring/teams'],
            ['Collaborate in real time', 'See active collaborators, activity, comments, and shared changes.', '/workspace/workspaces'],
            ['Create review requests', 'Ask teammates to review API and collection changes.', '/workspace/workspaces'],
            ['Configure integrations', 'Connect external services used by your team.', '/workspace/monitoring/integrations'],
            ['Configure workspace settings', 'Manage profile, appearance, notifications, and account settings.', '/workspace/settings'],
            ['Use version history', 'Review and restore previous documentation or workspace changes.', '/workspace/history']
        ]
    },
    {
        id: 'security', title: 'Governance and compliance', description: 'Set standards, audit access, and report on API security posture.', icon: 'shield',
        guides: [
            ['Score API governance', 'Review governance signals and improve API quality.', '/workspace/governance'],
            ['Configure compliance policies', 'Define policies for your workspace and API work.', '/workspace/compliance'],
            ['Review access', 'Audit workspace access and identify permission changes.', '/workspace/compliance'],
            ['Read the audit log', 'Trace important workspace and compliance activity.', '/workspace/compliance'],
            ['Manage certificates', 'Work with certificates used by API connections.', '/workspace/workspaces']
        ]
    },
    {
        id: 'performance', title: 'Performance and reporting', description: 'Measure API behavior, run load tests, and share useful reports.', icon: 'chart',
        guides: [
            ['Run a performance test', 'Configure virtual users and measure API behavior under load.', '/workspace/performance-tests'],
            ['Inspect performance metrics', 'Review collected metrics and resource behavior.', '/workspace/performance-tests'],
            ['Create monitoring reports', 'Turn monitoring data into a useful operational report.', '/workspace/monitoring/reports'],
            ['Review API analytics', 'Understand trends and activity across API work.', '/workspace/monitoring'],
            ['Export and share results', 'Use reports and result views to communicate findings.', '/workspace/monitoring/reports']
        ]
    },
    {
        id: 'reference', title: 'Developer reference', description: 'Connect Pigeon to code, automation, and delivery pipelines.', icon: 'terminal',
        guides: [
            ['Pigeon REST API reference', 'Understand the API surface, authentication, and common response shapes.', '/workspace/home'],
            ['Authentication and sessions', 'Configure authenticated requests and protect credentials in integrations.', '/workspace/settings/account'],
            ['Errors and status codes', 'Diagnose request, validation, authentication, and integration failures.', '/workspace/history'],
            ['CLI command reference', 'Run collections and automation from a terminal with predictable output.', '/workspace/home'],
            ['CI/CD integration', 'Run API checks in a delivery pipeline and publish machine-readable results.', '/workspace/home'],
            ['Configuration and secrets', 'Set environment values safely for local, staging, and CI environments.', '/workspace/workspaces'],
            ['Webhooks and integrations', 'Connect Pigeon events to the tools your team already uses.', '/workspace/monitoring/integrations']
        ]
    }
];

const playbooks = {
    start: {
        prerequisites: 'A Pigeon account. You can use any reachable demo API; the examples use JSONPlaceholder.',
        steps: [
            ['Open the right workspace', 'From the Pigeon home screen, open Workspaces and choose an existing workspace or create one. Keep related requests in the same workspace so teammates can find them.'],
            ['Create the first resource', 'Use the primary action in the current screen, enter a clear name, and save. Names such as “Payments – staging” are easier to scan than “New workspace”.'],
            ['Run and verify', 'Open the API Network or the feature named in this guide, complete the smallest useful setup, then run it once. Check the response, result, or activity entry before moving on.'],
            ['Share the result', 'Add a short description or comment explaining what you created, which environment it uses, and what a teammate should do next.']
        ],
        example: ['Request naming convention', 'text', 'GET · Users · staging\nPOST · Users · staging\nGET · Orders · production'],
        tips: ['Start with one small, working example before adding authentication, variables, or automation.', 'Use the same names in Pigeon and your source repository so handoffs are unambiguous.']
    },
    requests: {
        prerequisites: 'A workspace and an API endpoint you are allowed to call.',
        steps: [
            ['Configure the request', 'Choose the HTTP method, paste the URL, and add query parameters, headers, or a body only when the API requires them. Keep the URL readable by putting optional values in the Params section.'],
            ['Add authentication safely', 'Select the authorization method supported by the API. Put tokens in an environment or secret value instead of writing them directly into a shared request.'],
            ['Send and inspect', 'Send the request and inspect status, headers, body, and timing. A 2xx response is not enough—confirm that the returned data matches the expected shape.'],
            ['Save a repeatable request', 'Save the request in a collection, give it an action-oriented description, and add a test for the behavior that must not regress.']
        ],
        example: ['Example request', 'http', 'GET https://api.example.com/users?status=active\nAccept: application/json\nAuthorization: Bearer {{access_token}}'],
        tips: ['Start with a public or local endpoint while learning the request editor.', 'Use response history when debugging a change so you can compare the current run with the previous one.']
    },
    variables: {
        prerequisites: 'A workspace with at least one request or collection to configure.',
        steps: [
            ['Choose the smallest scope', 'Use a request value for a one-off experiment, a collection value for shared API settings, and an environment value for things that change between staging and production.'],
            ['Add the value', 'Create a descriptive variable such as `base_url` or `access_token`, set its value in the appropriate environment, and avoid putting secrets in examples or shared text.'],
            ['Reference it', 'Use the variable interpolation syntax in the URL, headers, body, or scripts. Preview the resolved value before sending so you know which scope won.'],
            ['Switch environments', 'Select a different environment and send the same request again. Only the values that belong to that environment should change.']
        ],
        example: ['Environment variables', 'text', 'base_url = https://staging.api.example.com\naccess_token = <secret>\n\nRequest URL: {{base_url}}/v1/users'],
        tips: ['Never commit real tokens or passwords to a collection.', 'Use names that describe the value, not its current value: `base_url` is better than `staging_url`.']
    },
    automation: {
        prerequisites: 'A saved request or collection and a clear condition you want to automate.',
        steps: [
            ['Decide when the logic runs', 'Use a pre-request script to prepare data before sending. Use a test script after the response arrives to validate the result or store values for the next request.'],
            ['Write one small assertion', 'Begin with a status-code or response-field check. Keep failures specific so the result tells you what needs attention.'],
            ['Chain data deliberately', 'If a request produces an ID or token, save only that value into a variable and reference it in the next request.'],
            ['Run the workflow', 'Execute the request or collection, inspect the test output, and keep the workflow green before sharing it.']
        ],
        example: ['Test script', 'javascript', "const body = pm.response.json();\npm.test('returns an active user', () => {\n  pm.expect(pm.response.status).to.equal(200);\n  pm.expect(body.status).to.equal('active');\n});"],
        tips: ['Prefer several focused assertions over one large conditional.', 'Do not log secrets while debugging a script.']
    },
    design: {
        prerequisites: 'An API idea, existing OpenAPI document, or collection that describes the API.',
        steps: [
            ['Start from a contract', 'Create a new design or import the existing specification. Define the audience and the primary resource before adding every edge case.'],
            ['Describe the happy path', 'Add the endpoint, request parameters, successful response, and representative schema. Use examples that a consumer can copy.'],
            ['Validate and compare', 'Run validation, review warnings, and compare changes against the previous version before publishing.'],
            ['Publish for consumers', 'Write an overview, authentication instructions, and useful examples, then publish only when the contract and documentation agree.']
        ],
        example: ['OpenAPI fragment', 'yaml', 'openapi: 3.0.3\npaths:\n  /users:\n    get:\n      summary: List users\n      responses:\n        \'200\':\n          description: Users returned successfully'],
        tips: ['Document an endpoint from the consumer’s point of view.', 'Treat a version comparison as a release review: explain breaking changes before publishing.']
    },
    network: {
        prerequisites: 'Access to the API Network and, for MCP work, an MCP connection profile or server URL.',
        steps: [
            ['Find the resource', 'Use search and the available filters to locate an API, request, marketplace listing, or MCP profile. Open the details before adding it to your workflow.'],
            ['Inspect trust signals', 'Check the description, examples, health information, reviews, and ownership. Do not run an unfamiliar API with production credentials.'],
            ['Try a safe operation', 'Use a read-only request or the MCP workbench to test the connection. Review the returned payload and tool output for unexpected data.'],
            ['Add it to your workflow', 'Save the useful request or collection, add variables, and record any required permissions for the next person.']
        ],
        example: ['Safe first call', 'http', 'GET https://api.example.com/health\nAccept: application/json\n\nExpected: { "status": "ok" }'],
        tips: ['Use read-only endpoints when evaluating an integration.', 'Keep third-party credentials in environment values and rotate them when access changes.']
    },
    testing: {
        prerequisites: 'A request, schema, trace, contract, or scenario to test, depending on the guide.',
        steps: [
            ['Choose the test surface', 'Select the protocol tester, trace importer, contract runner, fuzz panel, or evaluation suite that matches the behavior you need to verify.'],
            ['Provide a minimal fixture', 'Use a small valid request, schema, trace, or scenario first. A minimal fixture makes failures easier to reproduce.'],
            ['Run the check', 'Start the test and watch for connection, validation, assertion, or generated-input errors. Save the run when the setup is repeatable.'],
            ['Interpret the result', 'Separate a product failure from a fixture or environment failure. Record the input, expected result, actual result, and run time when reporting an issue.']
        ],
        example: ['Contract expectation', 'json', '{\n  "request": { "method": "GET", "path": "/users/42" },\n  "response": { "status": 200, "body": { "id": 42 } }\n}'],
        tips: ['Run a known-good fixture first to confirm the connection.', 'Keep failed test inputs so a regression can be reproduced later.']
    },
    async: {
        prerequisites: 'An AsyncAPI document or an event broker/channel you can safely test.',
        steps: [
            ['Model the event', 'Define the channel, operation, message, payload, and any required bindings. Use a realistic example payload.'],
            ['Import or design', 'Open AsyncAPI, import an existing document, or create a new one. Validate as you add channels so errors stay local.'],
            ['Create a scenario', 'Describe the publish/subscribe sequence and provide the connection details through variables.'],
            ['Run and review', 'Execute the scenario, inspect message order and payloads, then save the run or update the contract with what you learned.']
        ],
        example: ['AsyncAPI channel', 'yaml', 'channels:\n  user/signed-up:\n    publish:\n      message:\n        $ref: \'#/components/messages/UserSignedUp\''],
        tips: ['Document who publishes and who consumes every channel.', 'Use example payloads that show required fields and realistic values.']
    },
    mocking: {
        prerequisites: 'A collection or API shape that describes the endpoints you want to simulate.',
        steps: [
            ['Create the mock surface', 'Create a mock server from a collection or add an endpoint manually. Give it a purpose such as “Checkout happy path”.'],
            ['Define the response', 'Set the status, headers, body, and example data. Match the contract your frontend or consumer already expects.'],
            ['Add alternate behavior', 'Create a scenario for empty, delayed, unauthorized, or failed responses so clients can be tested before the real service is ready.'],
            ['Exercise and inspect', 'Call the mock endpoint, review recorded traffic and analytics, then adjust the scenario based on what the client actually needs.']
        ],
        example: ['Mock response', 'json', '{\n  "id": "usr_123",\n  "name": "Ada Lovelace",\n  "status": "active"\n}'],
        tips: ['Keep mock examples stable so UI tests do not change unexpectedly.', 'Include at least one failure scenario before calling a mock complete.']
    },
    monitoring: {
        prerequisites: 'A reachable endpoint and the expected healthy response or availability condition.',
        steps: [
            ['Define the check', 'Choose the endpoint, method, environment, interval, timeout, and the response conditions that mean healthy.'],
            ['Test before scheduling', 'Run the check manually. Fix authentication, DNS, certificate, or environment problems before creating alert noise.'],
            ['Set ownership and alerts', 'Choose notification recipients and an escalation policy. Include enough context in the alert to start investigation.'],
            ['Investigate the signal', 'Use analytics and history to compare latency, status, and failures. Link an incident or maintenance window when the cause is known.']
        ],
        example: ['Health check', 'text', 'GET /health\nExpected status: 200\nExpected body: {"status":"ok"}\nTimeout: 5 seconds'],
        tips: ['Alert on symptoms your team can act on.', 'Use maintenance windows for planned changes so expected downtime does not become an incident.']
    },
    collaboration: {
        prerequisites: 'Workspace owner or collaborator access, depending on the action.',
        steps: [
            ['Set the ownership boundary', 'Choose the workspace or team that should own the API work. Keep access as narrow as the workflow allows.'],
            ['Invite the right people', 'Add teammates with the minimum role they need, then explain where the source collection or design lives.'],
            ['Make changes reviewable', 'Use comments, activity, review requests, and version history to show what changed and why.'],
            ['Close the loop', 'Resolve review comments, record the decision, and keep the shared artifact in a known current state.']
        ],
        example: ['Review checklist', 'text', 'What changed: added POST /users\nWhy: onboarding flow\nRisk: creates persistent data\nVerified with: collection run #42'],
        tips: ['A short context note saves more time than a long thread later.', 'Remove access when a person no longer needs the workspace.']
    },
    security: {
        prerequisites: 'Workspace access and the policies, standards, or compliance requirements your team follows.',
        steps: [
            ['Choose the standard', 'Open Governance or Compliance and identify the policy or control you need to assess.'],
            ['Review the evidence', 'Inspect the score, policy result, access review, or audit event. Follow the detail link rather than treating the summary as the finding.'],
            ['Fix the highest-risk item', 'Update the API, permission, policy, or certificate that creates the largest exposure. Record the owner and due date.'],
            ['Re-run and report', 'Run the assessment again, confirm the finding changed, and export or share the resulting report when required.']
        ],
        example: ['Finding record', 'text', 'Finding: undocumented 401 response\nOwner: API team\nAction: add response example and test\nDue: before next release'],
        tips: ['Treat access reviews and audit logs as evidence, not just dashboards.', 'Do not paste secret values into policy notes or exported reports.']
    },
    performance: {
        prerequisites: 'A stable endpoint or collection, a safe test environment, and a load target agreed with your team.',
        steps: [
            ['Set a safe baseline', 'Run the endpoint once with a small load and record normal latency, throughput, and error behavior.'],
            ['Configure the test', 'Choose virtual users, duration, ramp-up, request mix, and resource monitoring. Start below the target load.'],
            ['Run and observe', 'Watch error rate, latency percentiles, throughput, and resource usage. Stop the run if the test threatens a shared environment.'],
            ['Compare and report', 'Compare the run with the baseline, identify the limiting resource, and attach the result to a report or release decision.']
        ],
        example: ['Starter load profile', 'text', 'Virtual users: 5\nRamp-up: 30 seconds\nDuration: 2 minutes\nTarget: staging only\nStop if errors exceed: 5%'],
        tips: ['Never load-test production without explicit approval and a rollback plan.', 'Latency percentiles usually explain user experience better than average latency alone.']
    }
};

const detailExamples = {
    start: {
        inputLabel: 'Starting setup', inputLanguage: 'text', input: 'Workspace: Payments API\nCollection: Checkout smoke tests\nEnvironment: staging\nFirst request: GET /health',
        outputLabel: 'Expected result', outputLanguage: 'text', output: 'Workspace opens successfully\nCollection is visible to the team\nGET /health returns 200\nEnvironment values resolve correctly',
        failureLabel: 'If setup fails', failureLanguage: 'text', failure: 'Workspace not visible → check membership\nVariable unresolved → select the staging environment\nRequest fails → verify URL and network access',
        success: 'A new teammate can open the workspace, select staging, run the health request, and understand what to do next.'
    },
    requests: {
        inputLabel: 'Request', inputLanguage: 'http', input: 'POST {{base_url}}/v1/users\nAuthorization: Bearer {{access_token}}\nContent-Type: application/json\n\n{ "name": "Ada Lovelace", "email": "ada@example.com" }',
        outputLabel: 'Expected response', outputLanguage: 'json', output: '{\n  "id": "usr_123",\n  "name": "Ada Lovelace",\n  "email": "ada@example.com",\n  "status": "active"\n}',
        failureLabel: 'Common failure response', failureLanguage: 'json', failure: '{\n  "error": "validation_error",\n  "message": "email is already registered",\n  "requestId": "req_abc123"\n}',
        success: 'The request is saved in the correct collection, uses resolved environment values, returns the expected status and body, and has a reproducible history entry.'
    },
    variables: {
        inputLabel: 'Environment values', inputLanguage: 'text', input: 'base_url = https://staging.api.example.com\naccess_token = <secret>\nuser_id = 42\n\nURL: {{base_url}}/v1/users/{{user_id}}',
        outputLabel: 'Resolved request', outputLanguage: 'http', output: 'GET https://staging.api.example.com/v1/users/42\nAuthorization: Bearer <secret>\n\nThe secret is resolved at runtime and is not written into the collection.',
        failureLabel: 'Unresolved variable', failureLanguage: 'text', failure: 'GET {{base_url}}/v1/users/{{user_id}}\n\nCause: no active environment or misspelled variable\nFix: select staging and confirm exact variable names',
        success: 'Switching from staging to production changes only environment-owned values while the request definition stays unchanged.'
    },
    automation: {
        inputLabel: 'Request and test', inputLanguage: 'javascript', input: "pm.test('creates an active user', () => {\n  pm.expect(pm.response.code).to.equal(201);\n  pm.expect(pm.response.json().status).to.equal('active');\n});",
        outputLabel: 'Expected test output', outputLanguage: 'text', output: 'PASS  creates an active user\nStatus: 201\nAssertions: 2 passed\nCollection run can continue',
        failureLabel: 'Failed assertion', failureLanguage: 'text', failure: 'FAIL  creates an active user\nExpected: 201\nReceived: 400\nAction: inspect request body and validation response',
        success: 'The automation produces a deterministic pass/fail result and exposes the first actionable assertion when behavior regresses.'
    },
    design: {
        inputLabel: 'OpenAPI contract', inputLanguage: 'yaml', input: 'openapi: 3.0.3\npaths:\n  /users/{id}:\n    get:\n      parameters:\n        - name: id\n          in: path\n          required: true\n          schema: { type: string }',
        outputLabel: 'Expected contract result', outputLanguage: 'text', output: 'Validation: passed\nEndpoint: GET /users/{id}\nParameter: id is required\nResponse: 200 User schema documented\nDocumentation: ready for preview',
        failureLabel: 'Validation failure', failureLanguage: 'yaml', failure: 'errors:\n  - path: /users/{id}\n    issue: path parameter id is not defined\n    fix: add a required parameter named id',
        success: 'The contract validates, can generate a useful request, and explains authentication, parameters, responses, and errors to consumers.'
    },
    network: {
        inputLabel: 'Safe first integration call', inputLanguage: 'http', input: 'GET https://api.example.com/health\nAccept: application/json\nAuthorization: Bearer {{integration_token}}',
        outputLabel: 'Expected response', outputLanguage: 'json', output: '{\n  "status": "ok",\n  "version": "2026.07"\n}',
        failureLabel: 'Connection failure', failureLanguage: 'json', failure: '{\n  "error": "unauthorized",\n  "message": "token is missing or expired"\n}',
        success: 'The integration is identified, tested with a read-only operation, and saved with documented credentials and permissions.'
    },
    testing: {
        inputLabel: 'Test fixture', inputLanguage: 'json', input: '{\n  "request": { "method": "GET", "path": "/users/42" },\n  "expected": { "status": 200, "body": { "id": 42 } }\n}',
        outputLabel: 'Expected test result', outputLanguage: 'text', output: 'Run: passed\nContract assertions: 3\nSchema validation: passed\nDuration: 182 ms',
        failureLabel: 'Regression result', failureLanguage: 'json', failure: '{\n  "status": "failed",\n  "assertion": "response.body.id",\n  "expected": 42,\n  "received": null\n}',
        success: 'The fixture is small enough to reproduce, the expected behavior is explicit, and failed inputs are saved for regression testing.'
    },
    async: {
        inputLabel: 'AsyncAPI message', inputLanguage: 'yaml', input: 'channel: user/signed-up\noperation: publish\npayload:\n  id: usr_123\n  email: ada@example.com',
        outputLabel: 'Expected event result', outputLanguage: 'text', output: 'Connected to broker\nSubscribed to user/signed-up\nMessage received\nPayload schema: valid\nOrder: publish → consume',
        failureLabel: 'Message failure', failureLanguage: 'text', failure: 'Connection: succeeded\nSubscription: succeeded\nPayload: invalid\nIssue: required field email is missing',
        success: 'The channel, operation, payload, and consumer behavior are represented in the contract and verified by a repeatable scenario.'
    },
    mocking: {
        inputLabel: 'Mock endpoint', inputLanguage: 'http', input: 'GET http://localhost:4010/users/123\nScenario: happy-path',
        outputLabel: 'Expected mock response', outputLanguage: 'json', output: '{\n  "id": "usr_123",\n  "name": "Ada Lovelace",\n  "status": "active"\n}',
        failureLabel: 'Alternate scenario', failureLanguage: 'json', failure: '{\n  "status": 503,\n  "body": { "message": "user service unavailable" }\n}',
        success: 'The consumer can develop against stable data, switch to failure scenarios intentionally, and keep the mock response aligned with the contract.'
    },
    monitoring: {
        inputLabel: 'Monitor definition', inputLanguage: 'text', input: 'Name: Payments health\nRequest: GET /health\nInterval: 5 minutes\nTimeout: 5 seconds\nExpected status: 200\nAlert: 3 consecutive failures',
        outputLabel: 'Expected monitor run', outputLanguage: 'text', output: 'Status: healthy\nHTTP: 200\nLatency: 184 ms\nBody check: passed\nNext run: in 5 minutes',
        failureLabel: 'Failed monitor run', failureLanguage: 'text', failure: 'Status: failed\nHTTP: 503\nLatency: 5,000 ms\nAlert: policy matched after 3 failures\nAction: investigate incident or maintenance',
        success: 'The check has a meaningful health condition, an owner, an actionable alert policy, and enough history to investigate a failure.'
    },
    collaboration: {
        inputLabel: 'Review request', inputLanguage: 'text', input: 'Change: add POST /users\nPurpose: onboarding flow\nRisk: creates persistent data\nVerification: collection run “user-create-smoke”\nReviewers: API team',
        outputLabel: 'Expected review result', outputLanguage: 'text', output: 'Review: approved\nComments: resolved\nChecks: passed\nDecision: safe to merge\nActivity: decision recorded with timestamp',
        failureLabel: 'Access issue', failureLanguage: 'text', failure: 'Collaborator cannot edit\nCheck: workspace membership\nCheck: role permissions\nCheck: collection sharing\nFix: grant the minimum required access',
        success: 'A teammate can reproduce, review, approve, and understand the change without relying on an undocumented handoff.'
    },
    security: {
        inputLabel: 'Governance finding', inputLanguage: 'text', input: 'Finding: undocumented 401 response\nOwner: Payments API\nRisk: consumers cannot handle auth failures\nAction: add error example and assertion',
        outputLabel: 'Expected compliance result', outputLanguage: 'text', output: 'Finding: resolved\nEvidence: response documented\nTest: 401 assertion passed\nAudit event: remediation recorded',
        failureLabel: 'Unresolved finding', failureLanguage: 'text', failure: 'Finding remains open\nCause: policy evaluated an older version\nAction: select current version and run assessment again',
        success: 'The finding has an owner, evidence, remediation, and a repeatable assessment that proves the issue is closed.'
    },
    performance: {
        inputLabel: 'Starter load profile', inputLanguage: 'text', input: 'Target: staging\nVirtual users: 10\nRamp-up: 60 seconds\nDuration: 5 minutes\nPass: p95 < 500 ms\nErrors: < 1%',
        outputLabel: 'Expected performance result', outputLanguage: 'text', output: 'Requests: 3,240\nThroughput: 10.8 req/s\np50: 182 ms\np95: 438 ms\nErrors: 0.3%\nResult: passed',
        failureLabel: 'Performance regression', failureLanguage: 'text', failure: 'p95: 1,240 ms\nErrors: 8.4%\nLikely causes: rate limit, dependency latency, resource saturation\nAction: compare with baseline and reduce load before rerun',
        success: 'The run answers one performance question, is compared with a baseline, and identifies the next action instead of only reporting a score.'
    },
    reference: {
        inputLabel: 'Authenticated API call', inputLanguage: 'http', input: 'GET /api/collections\nCookie: pigeon_session=<session>\nAccept: application/json',
        outputLabel: 'Expected response', outputLanguage: 'json', output: '{\n  "collections": [],\n  "total": 0\n}',
        failureLabel: 'API error response', failureLanguage: 'json', failure: '{\n  "message": "Authentication required",\n  "status": 401\n}',
        success: 'The integration uses the documented method, path, credential handling, status behavior, and response shape.'
    }
};

const troubleshootingByCategory = {
    start: ['The workspace is empty: create a collection or import a small fixture before trying advanced features.', 'A feature is unavailable: confirm your workspace role and selected environment.'],
    requests: ['401 or 403: check the selected environment, authorization type, token scope, and whether the token has expired.', 'Wrong response: inspect the resolved URL, query parameters, content type, and request body before changing the server.'],
    variables: ['A variable is unresolved: confirm its spelling, scope, active environment, and whether a value was actually saved.', 'The wrong value appears: remove duplicate variable names or move the value to the intended narrower scope.'],
    automation: ['A script does not run: confirm it is attached to the correct request phase and inspect the script output for syntax errors.', 'A chained request fails: verify that the previous response actually set the variable before the next request reads it.'],
    design: ['Validation fails: fix the first schema or path warning, then validate again because later warnings may be cascading.', 'Published docs look stale: confirm the latest version is selected and publish after saving the content.'],
    network: ['A connection fails: test a read-only endpoint first and check URL, certificate, credentials, and network access.', 'A tool is missing: refresh the connection profile and confirm the server exposes the expected capabilities.'],
    testing: ['The test cannot start: run a known-good fixture and confirm the protocol, schema, or trace format first.', 'A result is unexpected: compare actual input and output with the saved run instead of relying only on the summary score.'],
    async: ['Messages do not arrive: confirm channel address, broker credentials, direction, and subscription timing.', 'Schema errors persist: validate the smallest message payload before adding optional fields or bindings.'],
    mocking: ['The mock returns the wrong data: confirm the active scenario and endpoint match before editing the response body.', 'A recorded request is missing: verify the recorder is running and that the request reaches the mock URL.'],
    monitoring: ['A monitor times out: compare the timeout with normal latency and check DNS, certificate, authentication, and maintenance windows.', 'Too many alerts: group related failures and alert on repeated actionable failures rather than one transient request.'],
    collaboration: ['A teammate cannot see a resource: check workspace membership, role, collection sharing, and the selected workspace.', 'A review is confusing: link the changed artifact, explain expected behavior, and resolve stale comments after the decision.'],
    security: ['A score does not change: re-run the assessment after saving the fix and verify that the check is evaluating the intended version.', 'An audit event is missing: confirm the time range, workspace, and actor filters before assuming the action was not recorded.'],
    performance: ['The run has high errors: lower the load, confirm the target environment, and check rate limits before increasing users.', 'Metrics are inconsistent: establish a baseline with the same endpoint mix, duration, and environment before comparing runs.'],
    reference: ['An integration returns 401: refresh the session or token and verify that the request includes the required credentials.', 'CI cannot find a value: define the secret in the pipeline environment and verify the variable name without printing its value.']
};

export const learningPaths = [
    { id: 'new-user', title: 'New to Pigeon', description: 'Go from your first workspace to a repeatable API check.', guides: ['Create a workspace', 'Create a collection', 'Send your first request', 'Create an environment', 'Write test scripts'] },
    { id: 'api-builder', title: 'API developer', description: 'Design, validate, document, and publish an API contract.', guides: ['Design an API visually', 'Work with OpenAPI', 'Manage API versions', 'Write collection documentation', 'Publish public documentation'] },
    { id: 'quality', title: 'QA engineer', description: 'Build confidence with requests, contracts, traces, and failure tests.', guides: ['Build an HTTP request', 'Write test scripts', 'Run consumer contract tests', 'Generate tests from traces', 'Run fuzz tests'] },
    { id: 'operations', title: 'Platform engineer', description: 'Set up monitors, alerts, incidents, and performance baselines.', guides: ['Create an API monitor', 'Configure alerts and policies', 'Manage incidents and maintenance', 'Run a performance test', 'Create monitoring reports'] }
];

const examplesByTitle = {
    'Create a workspace': ['Workspace setup', 'text', 'Workspace: Payments API\nMembers: API team\nDefault environment: staging\nPurpose: request development and monitoring'],
    'Send your first request': ['First request', 'http', 'GET https://jsonplaceholder.typicode.com/users/1\nAccept: application/json\n\nExpected status: 200'],
    'Build an HTTP request': ['POST request', 'http', 'POST {{base_url}}/v1/users\nContent-Type: application/json\n\n{ "name": "Ada", "email": "ada@example.com" }'],
    'Import Postman collections': ['Import checklist', 'text', 'Collection: payments.postman_collection.json\nEnvironment: staging.postman_environment.json\nAfter import: verify variables and run one read-only request'],
    'Write pre-request scripts': ['Generate a request ID', 'javascript', "pm.variables.set('request_id', crypto.randomUUID());\npm.request.headers.add({ key: 'X-Request-ID', value: pm.variables.get('request_id') });"],
    'Write test scripts': ['Status assertion', 'javascript', "pm.test('returns 200', () => {\n  pm.expect(pm.response.code).to.equal(200);\n});"],
    'Use the Pigeon CLI': ['CI command', 'bash', 'pigeon run collection ./collections/smoke.json \\\n  --environment ./environments/staging.json \\\n  --reporter junit'],
    'Design an API visually': ['Resource design', 'text', 'Resource: User\nGET /users/{id}\nPath parameter: id (string)\n200 response: User'],
    'Manage API versions': ['Version review', 'text', 'Current: v2\nPrevious: v1\nBreaking change: removed response field\nAction: add migration note before publishing'],
    'Publish public documentation': ['Publish checklist', 'text', 'Title: Payments API\nVisibility: Public\nIncluded: overview, auth, examples, errors\nVerify: open the public URL in a signed-out window'],
    'Use the MCP workbench': ['MCP connection', 'text', 'Profile: local-tools\nServer: http://localhost:3000/mcp\nFirst action: list tools\nSafety: run read-only tool first'],
    'Test GraphQL APIs': ['GraphQL query', 'graphql', 'query GetUser($id: ID!) {\n  user(id: $id) { id name status }\n}\n\nVariables: { "id": "42" }'],
    'Test protocols': ['WebSocket smoke test', 'text', 'URL: wss://echo.websocket.org\nSend: { "type": "ping" }\nExpected: matching message received'],
    'Convert protocols': ['Conversion input', 'text', 'Source: GraphQL query\nTarget: HTTP request\nReview after conversion: URL, headers, variables, and body'],
    'Generate tests from traces': ['Trace workflow', 'text', 'Input: trace.json\nFilter: POST /payments\nGenerated test: valid payment request\nVerify: remove production identifiers before saving'],
    'Run consumer contract tests': ['Contract check', 'json', '{ "consumer": "checkout-ui", "provider": "payments-api", "path": "/payments/42", "expected": 200 }'],
    'Run fuzz tests': ['Fuzz guardrails', 'text', 'Schema: User\nField: email\nInputs: valid, empty, malformed, oversized\nStop condition: rate limit or unsafe environment'],
    'Create an AsyncAPI document': ['AsyncAPI starter', 'yaml', 'asyncapi: 3.0.0\ninfo:\n  title: User events\nchannels:\n  userSignedUp:\n    address: user/signed-up'],
    'Create a mock server': ['Mock endpoint', 'text', 'GET /users/123\n200 example: user fixture\n404 example: { "message": "User not found" }'],
    'Build mock scenarios': ['Scenario switch', 'text', 'Scenario: happy path → 200\nScenario: unauthorized → 401\nScenario: dependency down → 503'],
    'Create an API monitor': ['Monitor definition', 'text', 'Name: Payments health\nRequest: GET /health\nInterval: 5 minutes\nAlert: 3 consecutive failures'],
    'Configure alerts and policies': ['Alert policy', 'text', 'Condition: availability < 99%\nGroup by: monitor\nRoute: on-call team\nEscalate after: 10 minutes'],
    'Manage incidents and maintenance': ['Incident update', 'text', 'Status: Investigating\nImpact: checkout requests failing\nNext update: 15 minutes\nRelated maintenance: database migration'],
    'Run a performance test': ['Load profile', 'text', 'Users: 10\nRamp-up: 60 seconds\nDuration: 5 minutes\nTarget: staging\nPass: p95 < 500ms, errors < 1%']
};

// These overrides keep the articles task-specific instead of making every
// guide in a category read like the same tutorial.
const guideOverrides = {
    'Create a workspace': {
        prerequisites: 'A Pigeon account and a clear team or project boundary for the work.',
        steps: [
            ['Open Workspaces', 'From the main navigation, open Workspaces and review the workspaces you already belong to. Create a new one only when the API, team, or access boundary is genuinely different.'],
            ['Name the workspace', 'Use a name that identifies the product and stage, such as “Payments API” or “Checkout – staging”. Add a short description explaining what belongs there.'],
            ['Invite collaborators', 'Add the people who need to build, review, or monitor the API. Start with the narrowest role that supports their work.'],
            ['Create the first collection', 'Open the new workspace, create a collection, and add one safe request. This confirms that the workspace is ready for real API work.']
        ],
        example: ['A useful workspace description', 'text', 'Payments API\nOwns checkout and refund endpoints.\nPrimary team: Payments\nEnvironments: local, staging, production'],
        tips: ['Do not create a workspace for every environment; use environments for changing values.', 'Agree on a naming convention before inviting the whole team.'],
        troubleshooting: ['The workspace is not visible: refresh the workspace list and confirm that the invitation was accepted.', 'A teammate cannot edit content: review their workspace role and the collection sharing settings.']
    },
    'Create a collection': {
        prerequisites: 'An existing workspace and a group of related API operations.',
        steps: [
            ['Choose a collection boundary', 'Group requests by service or workflow, for example “Payments API” or “Checkout smoke tests”. Avoid one collection containing unrelated services.'],
            ['Create the collection', 'Open the workspace collection area, choose Create, enter the name and description, and save it. Put authentication and base URL guidance in the description if teammates need it.'],
            ['Add a working request', 'Create a request such as GET /health or GET /users/{id}. Confirm the method, URL, environment, and response before adding more endpoints.'],
            ['Organize and share', 'Use folders for resources or workflows, add variables at the collection scope, and share the collection with the intended collaborators.']
        ],
        example: ['Collection layout', 'text', 'Payments API/\n  Health checks/\n    GET health\n  Customers/\n    GET customer\n    POST customer'],
        tips: ['Keep a health or smoke request near the top so a new teammate can verify access quickly.', 'Use descriptions to explain setup, not to duplicate every endpoint detail.'],
        troubleshooting: ['The request cannot find a variable: check whether the value belongs to the collection or active environment.', 'The collection is cluttered: move shared setup requests into a folder and group endpoints by resource.']
    },
    'Send your first request': {
        prerequisites: 'A workspace and a reachable endpoint. JSONPlaceholder is safe for a first read-only request.',
        steps: [
            ['Open API Network', 'Open API Network from the workspace navigation and choose the option to create a new request.'],
            ['Enter a read-only URL', 'Choose GET and enter `https://jsonplaceholder.typicode.com/users/1`. Leave the body empty and add `Accept: application/json` if needed.'],
            ['Send the request', 'Send the request and inspect the status, response body, headers, and timing. You should receive a JSON object for user 1.'],
            ['Save what worked', 'Save the request into a collection with a descriptive name such as “GET user by ID – demo”. Replace the demo URL with an environment variable when moving to a real API.']
        ],
        example: ['First request', 'http', 'GET https://jsonplaceholder.typicode.com/users/1\nAccept: application/json\n\nExpected: 200 and a JSON user object'],
        tips: ['Begin with GET while learning the request flow because it does not create or modify data.', 'Always inspect the response body instead of assuming a 2xx response means the data is correct.'],
        troubleshooting: ['Network error: confirm the URL is complete and that your local server or network allows outbound requests.', '404 response: check the path and resource ID; 401 or 403 means the real API requires authentication.']
    },
    'Find your way around Pigeon': {
        prerequisites: 'A signed-in Pigeon account with at least one workspace or collection.',
        steps: [
            ['Use Home as your starting point', 'Home shows recent activity, workspaces, collections, and resource links. Use it to resume work instead of searching every feature manually.'],
            ['Use the workspace navigation', 'Open Workspaces for project organization, API Network for requests, Monitoring for operations, and Settings for account and appearance controls.'],
            ['Use History to investigate', 'When a request or workflow behaves differently, open History and compare the previous run, response, or change before editing the setup.'],
            ['Use Documentation alongside the product', 'Keep this guide open while learning a feature, then use each article’s Open in Pigeon action to jump to the relevant workspace area.']
        ],
        example: ['A simple first-day route', 'text', 'Home → Workspaces → Collection → API Network → Send request\n\nIf something fails: History → inspect previous run → update request'],
        tips: ['The top navigation is global; workspace features appear inside the selected workspace.', 'If a screen looks empty, check the active workspace and environment before creating duplicate data.'],
        troubleshooting: ['A feature appears missing: confirm that you are signed in and that the current workspace has the required access.', 'You are viewing the wrong data: switch workspaces from the workspace selector before changing anything.']
    },
    'Build an HTTP request': {
        prerequisites: 'A workspace, a reachable API endpoint, and the method and payload required by that endpoint.',
        steps: [
            ['Choose the method and URL', 'Open API Network, create a request, select the method, and enter the complete URL. Use an environment variable for the host when the same request will run in multiple stages.'],
            ['Add parameters and headers', 'Put query-string values in Params and request metadata in Headers. Use the API contract to distinguish required headers from optional ones.'],
            ['Configure the body', 'For POST, PUT, and PATCH requests, select the appropriate body type and provide valid JSON or form data. Match the Content-Type header to the body format.'],
            ['Send, verify, and save', 'Send the request, inspect status, headers, body, and timing, then save it in the collection that owns the workflow.']
        ],
        example: ['Create a user', 'http', 'POST {{base_url}}/v1/users\nContent-Type: application/json\nAuthorization: Bearer {{access_token}}\n\n{ "name": "Ada Lovelace", "email": "ada@example.com" }'],
        tips: ['Keep query parameters separate from the URL so they are easy to toggle and review.', 'Add a test for the response you rely on before sharing the request.'],
        troubleshooting: ['The server receives an empty body: check the selected body mode and Content-Type header.', 'The URL is wrong across environments: move only the host into `base_url` and keep the path consistent.']
    },
    'Read responses and history': {
        prerequisites: 'At least one saved or recently executed request.',
        steps: [
            ['Run the request once', 'Send the request and wait for the response panel to finish. Record the status code and timing before interpreting the body.'],
            ['Inspect the response', 'Review the formatted body, response headers, and raw data. Confirm required fields, content type, and pagination or error metadata.'],
            ['Compare runs', 'Open request history to compare a successful run with a failing run. Look first for changes in URL, environment, headers, status, and response time.'],
            ['Turn the finding into a check', 'When a response field matters, add a test or update the request description so the expected behavior is preserved for the next run.']
        ],
        example: ['Response review checklist', 'text', 'Status: 200\nContent-Type: application/json\nRequired fields: id, email, status\nTiming: compare with previous successful run'],
        tips: ['Use history to find what changed instead of repeatedly sending a request without recording context.', 'Treat a successful status with an invalid body as a failed API contract.'],
        troubleshooting: ['The response is unreadable: inspect Content-Type and raw response data before assuming the API returned invalid JSON.', 'History is empty: confirm the request completed and that you are viewing the same workspace.']
    },
    'Use authorization': {
        prerequisites: 'The API’s authentication method, a safe test credential, and an environment where the credential can be stored.',
        steps: [
            ['Identify the auth scheme', 'Check the API contract for Bearer token, API key, Basic auth, OAuth, or another supported scheme. Do not guess based only on a 401 response.'],
            ['Store the secret', 'Create a secret or environment value such as `access_token`. Keep the actual value out of shared request text and examples.'],
            ['Configure the request', 'Choose the authorization option in the request editor and reference the stored value. Confirm whether the credential belongs in a header, query parameter, or request body.'],
            ['Verify safely', 'Send a read-only request, check the response, and rotate or remove the credential when the test is finished.']
        ],
        example: ['Bearer authorization', 'http', 'GET {{base_url}}/v1/profile\nAuthorization: Bearer {{access_token}}\n\nExpected: 200 for a valid token; 401 for an expired token'],
        tips: ['Use a least-privilege token for documentation and smoke tests.', 'Never paste a real production token into a collection example or screenshot.'],
        troubleshooting: ['401: check token expiry, spelling, environment selection, and the required `Bearer` prefix.', '403: authentication succeeded but the account or token lacks permission for the operation.']
    },
    'Import Postman collections': {
        prerequisites: 'A Postman collection export and, if needed, its matching environment export.',
        steps: [
            ['Prepare the exports', 'Export the collection as JSON and export each environment separately. Remove production secrets before sharing the files.'],
            ['Start the import', 'Open the import action in API Network or the workspace collection area, choose the collection file, and review the detected requests and folders.'],
            ['Map environments', 'Import the environment file when available, then inspect variable names and values. Confirm that Postman variables map to the environment or collection scope you intend to use.'],
            ['Run a safe request', 'Execute a read-only health or list request, compare the result with Postman, and fix unresolved variables before running mutating requests.']
        ],
        example: ['Import checklist', 'text', '1. payments.postman_collection.json\n2. staging.postman_environment.json\n3. Verify base_url and access_token\n4. Run GET /health\n5. Review imported auth and scripts'],
        tips: ['Import into a new collection first so the original organization remains easy to compare.', 'Treat imported scripts and credentials as untrusted until you review them.'],
        troubleshooting: ['Variables show as literal text: compare the imported variable name with the name used in the request.', 'Imported auth fails: inspect inherited collection auth and request-level overrides separately.']
    },
    'Run and manage collections': {
        prerequisites: 'A collection with at least one working request and an environment appropriate for the run.',
        steps: [
            ['Prepare the collection', 'Check request order, folders, variables, authentication, and scripts. Put setup requests before requests that depend on their output.'],
            ['Choose the run scope', 'Run the whole collection for a smoke or regression pass, or select a folder when validating one workflow.'],
            ['Select the environment', 'Choose the intended environment and confirm the resolved base URL and credentials before starting.'],
            ['Review and preserve results', 'Inspect failed requests and test assertions, save the run output, and fix the earliest failure before rerunning downstream requests.']
        ],
        example: ['Smoke collection order', 'text', '1. GET /health\n2. POST /auth/token\n3. GET /users/me\n4. GET /orders\n5. Cleanup test data'],
        tips: ['Keep smoke collections short enough to run on every change.', 'Make setup and cleanup explicit so a failed run does not leave confusing test data behind.'],
        troubleshooting: ['Later requests fail after setup: inspect the first failed request and the variable it was expected to create.', 'The run uses the wrong API: select the environment again and preview resolved values before rerunning.']
    },
    'Share collection work': {
        prerequisites: 'A saved collection and workspace permissions that allow sharing or collaboration.',
        steps: [
            ['Make the collection understandable', 'Add a collection description, setup notes, environment expectations, and one safe example request before inviting others.'],
            ['Set the sharing boundary', 'Share with the workspace or selected collaborators based on who needs to view, edit, or review the collection.'],
            ['Request review', 'Create a review request for meaningful changes and describe the behavior that should be checked. Link the relevant request or folder.'],
            ['Resolve and record', 'Address comments, rerun the affected requests, and keep the final decision in the activity or review context.']
        ],
        example: ['Collection handoff note', 'text', 'Purpose: checkout smoke tests\nSetup: select staging environment\nSafe first request: GET /health\nReview focus: auth failure handling'],
        tips: ['Share setup instructions with the collection so a teammate can use it without a separate meeting.', 'Use reviews for behavior changes and comments for small clarifications.'],
        troubleshooting: ['A collaborator cannot open the collection: verify workspace membership and collection-level sharing.', 'Reviewers cannot reproduce the change: include the environment, fixture data, and exact request sequence.']
    }
};

const specificTitleGuidance = {
    'Create an environment': ['Open the environment manager from the workspace and create a name for the target stage.', 'Add the base URL and stage-specific values, then mark secrets as sensitive where supported.', 'Select the environment and preview the resolved values in one request.', 'Run a safe health request and document who owns the environment.'],
    'Manage collection variables': ['Open the collection variable manager and add only values shared by that collection.', 'Give each variable a stable name and define the example or local value without exposing secrets.', 'Reference the variable from a request URL, header, or body and preview its resolved value.', 'Run the collection in the intended environment and confirm the collection value is not masking a stage value.'],
    'Use global variables': ['Open global variables from the workspace tools and identify values truly shared across projects.', 'Create a narrowly named variable and set its value in the appropriate scope.', 'Use it in a request only where a collection or environment value would be less appropriate.', 'Remove or rename global values that create ambiguity for teammates.'],
    'Resolve variables in requests': ['Open a request that contains interpolation syntax and select the intended environment.', 'Preview each resolved URL, header, and body value before sending.', 'Trace an unresolved value back to its scope, spelling, and saved value.', 'Send the request and save the working variable setup with the collection.'],
    'Write pre-request scripts': ['Open the request script editor and choose the pre-request phase.', 'Create or derive the value needed before the request, such as a timestamp or request ID.', 'Set the value in the correct variable scope and reference it from the request.', 'Run the request and inspect script output before sharing the script.'],
    'Write test scripts': ['Open the test script editor after the request response is available.', 'Assert the status and one response field that represents the behavior you need.', 'Run the request and read the assertion result, including the first failing condition.', 'Save the test with the request and keep test data deterministic.'],
    'Build visual API workflows': ['Open the visual API designer and start with the first request in the workflow.', 'Connect request, response, and transformation nodes in the order the consumer needs.', 'Configure variables and failure branches before generating or exporting the workflow.', 'Validate the flow with sample data and save a named version.'],
    'Use the Pigeon CLI': ['Install or expose the Pigeon CLI in the environment where the collection will run.', 'Prepare a collection, environment file, and reporter output directory.', 'Run the collection with non-production credentials and inspect the exit code and report.', 'Add the command to local scripts or CI after the manual run is repeatable.'],
    'Design an API visually': ['Open the visual designer and create the API resource that consumers will call.', 'Add an endpoint with parameters, request schema, and at least one successful response.', 'Use the validation panel to fix missing types, descriptions, and response details.', 'Preview the generated specification and save the design for review.'],
    'Work with OpenAPI': ['Import an OpenAPI file or open the specification associated with a collection.', 'Review paths, schemas, security schemes, and examples before changing the document.', 'Run validation and address the first warning or error before continuing.', 'Export or apply the corrected specification and verify one endpoint in API Network.'],
    'Manage API versions': ['Open the collection version manager and create a version from the current contract.', 'Add a meaningful version label and release note describing the change.', 'Compare the new version with the previous one and inspect breaking-change results.', 'Publish, deprecate, or keep the version in review based on the compatibility decision.'],
    'Write collection documentation': ['Open documentation for the collection and write the audience, purpose, and authentication overview.', 'Add endpoint usage, examples, errors, and environment setup in the order a new consumer needs them.', 'Preview the rendered content and compare it with the current collection requests.', 'Save the content and review its version history before publishing.'],
    'Publish public documentation': ['Open collection documentation settings and confirm the title and public visibility choice.', 'Review examples, secrets, internal URLs, and private comments before publishing.', 'Publish the documentation and copy the generated public URL.', 'Open the URL signed out and verify a consumer can follow the first request without internal context.'],
    'Explore the API Network': ['Open API Network Explore and search by API name, request name, method, or URL.', 'Open a result and inspect its description, ownership, health, and available actions.', 'Run a safe read-only request with a non-production environment.', 'Save useful requests to a collection and record any required credentials.'],
    'Use the marketplace': ['Open the marketplace from API Network and choose a category or search term.', 'Read the listing details, reviews, health information, guide content, and plan requirements.', 'Open the API detail and try a safe operation with test credentials.', 'Add the useful resource to a collection and note its ownership and limits.'],
    'Use the MCP workbench': ['Open MCP Workbench and select or create a connection profile.', 'Verify the server URL and authentication without exposing the secret in a shared note.', 'List tools first, then run one read-only tool with a small input.', 'Record the tool output and permission requirements before enabling write actions.'],
    'Create a collection MCP server': ['Open the collection MCP server panel from the collection detail view.', 'Choose which collection capabilities and request actions should be exposed.', 'Configure access and the server profile, then start the server in a safe environment.', 'Connect from MCP Workbench and verify a read-only collection operation.'],
    'Use AI agent tools': ['Open AI agent tools and choose the task such as test generation, API analysis, or documentation.', 'Provide the smallest collection or specification context needed for a useful result.', 'Review generated content for secrets, incorrect assumptions, and unsupported behavior.', 'Apply only the verified changes and save the human decision with the artifact.'],
    'Test GraphQL APIs': ['Open GraphQL Tester and select the endpoint and schema context.', 'Write a query or mutation and define variables separately from the operation.', 'Run the operation and inspect both data and the errors array.', 'Save a working query and add an assertion for the fields the client depends on.'],
    'Test protocols': ['Open Protocol Tester and choose WebSocket, gRPC, SOAP, MQTT, or SSE.', 'Provide the endpoint-specific connection details and a safe sample payload.', 'Connect or send once, then inspect messages, metadata, and connection errors.', 'Save the working setup and document any broker, certificate, or schema requirement.'],
    'Convert protocols': ['Open Protocol Converter and select the source and target protocol.', 'Import or enter the smallest valid source request.', 'Review the generated endpoint, headers, variables, and body for semantic differences.', 'Export or save the converted request, then verify it against a safe endpoint.'],
    'Generate tests from traces': ['Open Trace to Test and import a sanitized trace or supported telemetry file.', 'Filter the trace to the operation and status patterns worth testing.', 'Review generated requests, variables, and assertions before saving them.', 'Run one generated test and remove production identifiers from the resulting collection.'],
    'Run consumer contract tests': ['Open Consumer Contracts and create or select a consumer/provider contract.', 'Define the interaction, request, expected status, and response fields the consumer requires.', 'Run the contract against the provider environment and inspect the diff if it fails.', 'Save the run and notify the provider with the exact incompatible interaction.'],
    'Run fuzz tests': ['Open the fuzz testing panel and choose a schema or request to exercise.', 'Set safe limits for generated cases, rate, duration, and target environment.', 'Run the test and inspect the failing input, response, and reproducibility details.', 'Save a minimized failing case as a regression test and stop excessive or unsafe runs.'],
    'Evaluate API scenarios': ['Open the evaluation suite panel and create a suite for the behavior being scored.', 'Add scenarios with inputs, expected outcomes, and a clear scoring rule.', 'Run the suite against a stable environment and inspect individual scenario results.', 'Use the score and failed cases to update the API or the evaluation fixture.'],
    'Create an AsyncAPI document': ['Open AsyncAPI and create a document with title, version, and service description.', 'Add one channel and define the publish or subscribe operation.', 'Attach a message and payload schema with a realistic example.', 'Validate and save the document before adding additional channels.'],
    'Import AsyncAPI': ['Prepare a valid AsyncAPI YAML or JSON document without production secrets.', 'Open AsyncAPI import and review detected channels, messages, and operations.', 'Fix validation warnings and confirm bindings match the broker you use.', 'Save the imported document and run a safe scenario if an endpoint is available.'],
    'Design channels and messages': ['Open the AsyncAPI document and identify the event boundary to model.', 'Create the channel address and choose the producer or consumer operation.', 'Define the message payload, required fields, and examples.', 'Validate the document and review the generated contract with the event owner.'],
    'Run AsyncAPI scenarios': ['Open the scenario manager for an AsyncAPI document.', 'Create the publish/subscribe sequence and provide connection values through variables.', 'Run with a small fixture and inspect message order, payload, and errors.', 'Save the run and update the scenario or contract when behavior changes.'],
    'Create a mock server': ['Open a collection and create a mock server from its documented endpoints.', 'Choose the base URL and define the default response examples.', 'Start the mock and call one endpoint from a client or request in Pigeon.', 'Share the mock URL and setup notes with the frontend or consumer team.'],
    'Define mock endpoints': ['Open the mock endpoint editor and choose the method and path.', 'Add response status, headers, body schema, and a representative example.', 'Add a negative response when the client needs to handle errors.', 'Run the endpoint and compare its shape with the API contract.'],
    'Record mock traffic': ['Open Traffic Recorder and choose the mock or target workflow.', 'Start recording before sending the client request sequence.', 'Review captured method, path, headers, and response data for secrets.', 'Convert useful captures into stable mock examples and stop the recorder.'],
    'Build mock scenarios': ['Open Scenario Builder for the mock server.', 'Create a named happy-path scenario with its expected response.', 'Add unauthorized, empty, timeout, or dependency-failure scenarios as needed.', 'Switch scenarios from a client request and verify each response is intentional.'],
    'Test failures with Fault Lab': ['Open Fault Lab and select the mock endpoint or scenario.', 'Choose one fault such as delay, error status, malformed data, or dropped connection.', 'Run the client workflow and record how it handles the fault.', 'Disable the fault and preserve the case as a repeatable regression scenario.'],
    'Review mock analytics': ['Open mock analytics for the server or collection.', 'Choose the time range and inspect request count, response status, and latency.', 'Filter unusual traffic back to the endpoint or scenario that produced it.', 'Use the finding to update examples, capacity assumptions, or client tests.'],
    'Create an API monitor': ['Open Monitoring and choose create monitor.', 'Select the request, environment, schedule, timeout, and expected status or body condition.', 'Run the monitor manually and fix setup failures before enabling notifications.', 'Save the monitor with an owner and a description of the user impact it represents.'],
    'Read monitoring analytics': ['Open analytics for a monitor and choose a meaningful time range.', 'Compare availability, latency, error rate, and percentile trends.', 'Drill into an anomaly and correlate its timestamp with history or incidents.', 'Record the baseline and the threshold that should trigger action.'],
    'Review monitoring history': ['Open a monitor’s history and select a failed or slow run.', 'Inspect request, response, timing, environment, and error details.', 'Compare it with a nearby successful run to isolate the changed condition.', 'Link the finding to an incident or document the confirmed transient failure.'],
    'Configure alerts and policies': ['Open Alerts or Alert Policies and define the condition that deserves attention.', 'Set grouping, severity, recipients, escalation timing, and notification channels.', 'Trigger or preview the policy with a safe test event.', 'Confirm the alert contains monitor, environment, time, and next-action context.'],
    'Manage incidents and maintenance': ['Open Incidents or Maintenance and create the operational record.', 'Define impact, start time, owner, status, affected monitors, and next update.', 'Post concise updates as the investigation or maintenance progresses.', 'Resolve the record with cause, duration, and follow-up action so history remains useful.'],
    'Publish a status page': ['Open status page configuration and choose the services and components to display.', 'Set public name, description, incident visibility, and subscription options.', 'Preview the page and publish only information safe for external consumers.', 'Open the public status URL signed out and test a status update or subscription.'],
    'Invite and manage team members': ['Open Teams from Monitoring or workspace administration.', 'Invite a teammate using their work email and choose the role required for their tasks.', 'Review existing members, roles, and pending invitations.', 'Remove or downgrade access when the team or project boundary changes.'],
    'Collaborate in real time': ['Open the shared workspace or collection and confirm collaborators are connected.', 'Use activity, presence, comments, and inline threads to coordinate a change.', 'Make one change at a time when reviewing live behavior and explain the intent in context.', 'Check the activity feed and resolve stale threads after the work is complete.'],
    'Create review requests': ['Open the collection or change that needs review.', 'Create a review request with scope, expected behavior, risk, and verification steps.', 'Assign the appropriate reviewers and attach the relevant request or version.', 'Address comments, rerun checks, and approve or update the request with the final decision.'],
    'Configure integrations': ['Open Integrations and choose the service to connect.', 'Enter provider URL, credentials, event scope, and notification or transformation settings.', 'Run the connection health check and inspect the returned status.', 'Save the integration and verify one real or test event reaches the destination.'],
    'Configure workspace settings': ['Open Settings and choose profile, appearance, notifications, or account.', 'Change one setting and review its scope before saving.', 'Reload the workspace and verify the setting affects the intended account or workspace.', 'Record organization-wide choices so teammates understand the default behavior.'],
    'Use version history': ['Open History or the version history for the relevant collection or documentation.', 'Select a version and inspect its author, timestamp, message, and content difference.', 'Compare the candidate version with the current state before restoring anything.', 'Restore only after confirming the change is safe, then add a note explaining why.'],
    'Score API governance': ['Open Governance and select the workspace or API scope to assess.', 'Review the score categories and open individual findings for evidence.', 'Assign owners and fix the highest-impact contract or documentation gap.', 'Re-run the score and record the improvement in a review or report.'],
    'Configure compliance policies': ['Open Compliance Policies and choose the workspace policy scope.', 'Set required controls, retention, access, or reporting options according to your organization.', 'Save the policy and review which teams or resources it affects.', 'Run a report or audit check to confirm the policy is producing evidence.'],
    'Review access': ['Open Compliance Access Review and choose the workspace and review period.', 'Inspect members, roles, recent access, and resources that need attention.', 'Confirm each access grant has an owner and remove unnecessary permissions.', 'Save or export the review evidence for the approval record.'],
    'Read the audit log': ['Open Compliance Audit Log and set the actor, action, resource, and time filters.', 'Open an event to inspect who acted, what changed, and when it happened.', 'Correlate the event with a review, incident, or version when investigating behavior.', 'Export the relevant evidence without exposing unrelated secrets or personal data.'],
    'Manage certificates': ['Open certificate management and choose the workspace or certificate action.', 'Upload or select the certificate and verify hostname, expiry, and trust requirements.', 'Run validation or a server check before attaching it to a request or integration.', 'Rotate expiring certificates and remove the old credential after verification.'],
    'Run a performance test': ['Open Performance Tests and create a run for a safe staging target.', 'Set virtual users, ramp-up, duration, request mix, and stop thresholds.', 'Run the smallest profile that can answer the performance question.', 'Compare results with the baseline and attach the run to a report or release decision.'],
    'Inspect performance metrics': ['Open the completed performance run and select the relevant time window.', 'Review throughput, latency percentiles, error rate, and resource utilization together.', 'Drill into the slowest operation or highest-error period.', 'Record the bottleneck, baseline, and next experiment rather than only the headline score.'],
    'Create monitoring reports': ['Open Reports and choose the monitoring sources and time range.', 'Select the metrics, monitors, incidents, and status details the audience needs.', 'Add a clear title, scope, and interpretation of significant changes.', 'Save or export the report and link it to the operational review.'],
    'Review API analytics': ['Open analytics for the relevant monitor, API, or workspace activity.', 'Choose a time range and compare volume, latency, errors, and health score.', 'Filter by monitor, endpoint, or environment to find the responsible behavior.', 'Turn the finding into a monitor threshold, backlog item, or report note.'],
    'Export and share results': ['Open the completed test, monitor, or report result.', 'Choose the output or export format required by the audience.', 'Check that secrets, internal URLs, and unrelated workspace data are excluded.', 'Share the result with scope, date, environment, and interpretation included.'],
    'Pigeon REST API reference': ['Choose the API domain that matches your integration, such as collections, requests, or monitoring.', 'Use the documented method and path with an authenticated session where required.', 'Send a minimal request and compare status, body, and error shape with the reference.', 'Add retries, pagination, and validation only after the basic request is working.'],
    'Authentication and sessions': ['Start with the authentication endpoint or session mechanism required by the integration.', 'Store the resulting session or token in a secret-capable environment value.', 'Send an authenticated request and verify that credentials are not included in logs.', 'Rotate or revoke credentials when the integration owner or environment changes.'],
    'Errors and status codes': ['Capture the HTTP status, response body, request ID, and timestamp for the failure.', 'Map the status to authentication, authorization, validation, rate-limit, or server behavior.', 'Use the request history and server logs to identify the first failing operation.', 'Add a regression test or clearer error handling after fixing the cause.'],
    'CLI command reference': ['Choose the CLI command that matches the job: run, diff, lint, or report.', 'Provide explicit collection, environment, output, and reporter arguments.', 'Run locally and inspect the exit code plus generated report.', 'Pin the command and configuration in the repository or pipeline for repeatability.'],
    'CI/CD integration': ['Create a pipeline step that checks out the collection and environment configuration.', 'Inject secrets through the CI provider rather than committing them to the repository.', 'Run the Pigeon command and publish the machine-readable report as an artifact.', 'Fail the pipeline on the agreed quality threshold and retain enough logs to debug safely.'],
    'Configuration and secrets': ['List the values required by the local, staging, and CI workflows.', 'Put non-secret defaults in versioned configuration and secrets in the environment or CI secret store.', 'Reference values by stable names and validate required values before a run.', 'Rotate secrets without changing collection logic or exposing the new value in output.'],
    'Webhooks and integrations': ['Choose the Pigeon event and external destination that should receive it.', 'Configure endpoint, authentication, payload, retry, and filtering behavior.', 'Send a test event and inspect the destination response and delivery history.', 'Document ownership, replay behavior, and what to do when delivery fails.']
};

const routeOverrides = {
    'Send your first request': '/workspace/api-network/requests/new',
    'Build an HTTP request': '/workspace/api-network/requests/new',
    'Read responses and history': '/workspace/history',
    'Use authorization': '/workspace/api-network/requests/new',
    'Test GraphQL APIs': '/workspace/graphql',
    'Test protocols': '/workspace/protocols',
    'Convert protocols': '/workspace/protocols',
    'Generate tests from traces': '/workspace/trace-to-test',
    'Run consumer contract tests': '/workspace/consumer-contracts',
    'Run fuzz tests': '/workspace/api-network',
    'Evaluate API scenarios': '/workspace/consumer-contracts',
    'Create an AsyncAPI document': '/workspace/asyncapi',
    'Import AsyncAPI': '/workspace/asyncapi',
    'Design channels and messages': '/workspace/asyncapi',
    'Run AsyncAPI scenarios': '/workspace/asyncapi',
    'Create an API monitor': '/workspace/monitoring/new',
    'Read monitoring analytics': '/workspace/monitoring',
    'Review monitoring history': '/workspace/monitoring',
    'Configure alerts and policies': '/workspace/monitoring/alerts',
    'Manage incidents and maintenance': '/workspace/monitoring/incidents',
    'Publish a status page': '/workspace/monitoring',
    'Invite and manage team members': '/workspace/monitoring/teams',
    'Configure integrations': '/workspace/monitoring/integrations',
    'Configure workspace settings': '/workspace/settings/profile',
    'Use version history': '/workspace/history',
    'Score API governance': '/workspace/governance',
    'Configure compliance policies': '/workspace/compliance/policies',
    'Review access': '/workspace/compliance/access-review',
    'Read the audit log': '/workspace/compliance/audit-log',
    'Run a performance test': '/workspace/performance-tests',
    'Inspect performance metrics': '/workspace/performance-tests',
    'Create monitoring reports': '/workspace/monitoring/reports',
    'Review API analytics': '/workspace/monitoring',
    'Export and share results': '/workspace/monitoring/reports',
    'Use the MCP workbench': '/workspace/api-network/mcp',
    'Explore the API Network': '/workspace/api-network/explore',
    'Use the marketplace': '/workspace/api-network/explore',
    'Use AI agent tools': '/workspace/api-network/ai-agent-tools'
};

const referenceEntriesByTitle = {
    'Pigeon REST API reference': [
        ['GET', '/api/workspaces', 'List workspaces available to the authenticated user.'],
        ['GET', '/api/collections', 'List collections available in the current account.'],
        ['POST', '/api/requests', 'Create a saved API request.'],
        ['GET', '/api/history', 'Read recent request execution history.'],
        ['GET', '/api/monitoring', 'Read configured monitors and monitoring state.']
    ],
    'Authentication and sessions': [
        ['GET', '/api/auth/check', 'Check whether the current session is authenticated.'],
        ['POST', '/api/auth/login', 'Start an authenticated session when credentials are accepted.'],
        ['POST', '/api/auth/logout', 'End the current authenticated session.'],
        ['GET', '/api/auth/me', 'Read the current user profile when supported by the auth route.']
    ],
    'Errors and status codes': [
        ['400', 'Validation error', 'The request body, path, or query value is invalid.'],
        ['401', 'Authentication required', 'The session or credential is missing or expired.'],
        ['403', 'Forbidden', 'The identity is valid but lacks permission.'],
        ['404', 'Not found', 'The requested resource does not exist or is not visible.'],
        ['500', 'Server error', 'The server failed while processing a valid-looking request.']
    ],
    'CLI command reference': [
        ['run', 'pigeon run <collection>', 'Execute a collection with an optional environment and reporter.'],
        ['diff', 'pigeon diff --base <file> --head <file>', 'Compare two API definitions or versions.'],
        ['lint', 'pigeon lint <spec>', 'Validate an API specification against configured rules.'],
        ['report', '--reporter <format>', 'Choose a machine-readable or human-readable result format.']
    ],
    'CI/CD integration': [
        ['Input', 'COLLECTION_FILE', 'Versioned collection fixture used by the pipeline.'],
        ['Secret', 'PIGEON_TOKEN', 'Injected by the CI provider and never committed.'],
        ['Command', 'pigeon run collection.json --reporter junit', 'Run checks and produce a pipeline-readable report.'],
        ['Artifact', 'test-results/', 'Persist the report for failed-run investigation.']
    ],
    'Configuration and secrets': [
        ['Public', 'base_url', 'Environment-specific host or API base URL.'],
        ['Secret', 'access_token', 'Credential injected at runtime and never committed.'],
        ['Scope', 'collection / environment / CI', 'Choose the narrowest scope that satisfies the workflow.'],
        ['Validation', 'required values', 'Fail early when a required value is missing.']
    ],
    'Webhooks and integrations': [
        ['POST', 'External webhook URL', 'Destination that receives the event payload.'],
        ['Auth', 'Bearer or provider secret', 'Credential required by the receiving service.'],
        ['Retry', 'Delivery policy', 'Retry behavior for temporary destination failures.'],
        ['Audit', 'Delivery history', 'Evidence of payload, response, timestamp, and result.']
    ]
};

export const documentationGuides = documentationSections.flatMap((section) => section.guides.map(([title, summary, openTo]) => ({
    id: `${section.id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
    category: section.id,
    categoryTitle: section.title,
    title,
    summary,
    openTo,
    ...(playbooks[section.id] || playbooks.start),
    ...(detailExamples[section.id] || detailExamples.start),
    ...(guideOverrides[title] || {}),
    ...(specificTitleGuidance[title] ? { steps: specificTitleGuidance[title].map((detail, index) => [`Step ${index + 1}`, detail]) } : {}),
    openTo: routeOverrides[title] || openTo,
    example: guideOverrides[title]?.example || examplesByTitle[title] || (playbooks[section.id] || playbooks.start).example,
    troubleshooting: guideOverrides[title]?.troubleshooting || troubleshootingByCategory[section.id] || troubleshootingByCategory.start,
    reference: referenceEntriesByTitle[title] || null,
    keywords: `${title} ${summary} ${section.title} ${openTo}`.toLowerCase().split(/[^a-z0-9/]+/).filter(Boolean),
    lastUpdated: 'July 2026',
    related: []
}))); 

const troubleshootingGuideTitle = (guide, message) => {
    const text = message.toLowerCase();
    if (/variable|environment|resolved value/.test(text)) return 'Resolve variables in requests';
    if (/401|403|auth|token|credential|permission/.test(text)) return 'Use authorization';
    if (/history|previous run|response/.test(text)) return 'Read responses and history';
    if (/monitor|timeout|alert/.test(text)) return text.includes('alert') ? 'Configure alerts and policies' : 'Create an API monitor';
    if (/workspace|collaborator|member/.test(text)) return 'Create a workspace';
    if (/collection/.test(text)) return 'Create a collection';
    if (/schema|channel|message|broker/.test(text)) return guide.category === 'async' ? 'Design channels and messages' : 'Work with OpenAPI';
    if (/protocol|connection/.test(text)) return 'Test protocols';
    if (/mcp|tool/.test(text)) return 'Use the MCP workbench';
    if (/mock|scenario|recorded/.test(text)) return 'Create a mock server';
    if (/performance|load|latency|metric/.test(text)) return 'Run a performance test';
    if (/compliance|audit|access/.test(text)) return 'Read the audit log';
    if (/review|comment/.test(text)) return 'Create review requests';
    return guide.title;
};

documentationGuides.forEach((guide) => {
    guide.troubleshooting = guide.troubleshooting.map((message) => {
        const destinationTitle = troubleshootingGuideTitle(guide, message);
        const destination = documentationGuides.find((candidate) => candidate.title === destinationTitle && candidate.id !== guide.id);
        return {
            text: message,
            to: destination ? `/documentation/${destination.category}/${destination.id}` : guide.openTo
        };
    });
    guide.keywords = [...new Set([
        ...guide.keywords,
        guide.example[1],
        ...guide.steps.flatMap(([stepTitle, detail]) => `${stepTitle} ${detail}`.toLowerCase().split(/[^a-z0-9/]+/).filter(Boolean)),
        ...guide.troubleshooting.flatMap((item) => item.text.toLowerCase().split(/[^a-z0-9/]+/).filter(Boolean))
    ])];
    const guideTerms = new Set(guide.keywords);
    guide.related = documentationGuides
        .filter((candidate) => candidate.id !== guide.id)
        .map((candidate) => {
            const overlap = candidate.keywords.reduce((score, keyword) => score + (guideTerms.has(keyword) ? 1 : 0), 0);
            const sameCategoryBonus = candidate.category === guide.category ? 2 : 0;
            return { candidate, score: overlap + sameCategoryBonus };
        })
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map(({ candidate: { id, title } }) => ({ id, title }));
});

export const getGuide = (category, guideId) => documentationGuides.find((guide) => guide.category === category && guide.id === guideId);
