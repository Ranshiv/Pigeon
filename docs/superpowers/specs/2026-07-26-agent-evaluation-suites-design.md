# Feature 10 — Collection-scoped AI-agent evaluation suites

Replace the static AI Agent Tools page with a working evaluation product that
determines whether an agent used a collection's APIs safely and correctly.

## Scope (V1)
- Deterministic transcript scoring only. No LLM, no agent execution, no external
  API calls.
- Suites are collection-scoped.
- Authoring is visual UI only. Import/export out of scope.
- Run history stores the full, redacted transcript and detailed results.

## Decisions
- Scenarios persisted in a separate `EvaluationScenario` model keyed by `suiteId`
  + `order` (mirrors AsyncApiScenario / AsyncApiDocument split). 3 models.
- The static `AIAgentToolsSection` page at `/ai-agent-tools` is replaced by the
  evaluation product entry (intro + list of the user's collections linking into
  each collection's evaluation tab).

## Models (`models/Evaluation*.js`)

### EvaluationSuite
- `collectionId` (ref Collection, required, index)
- `workspaceId` (ref Workspace, required)
- `owner` (ref User, required)
- `name` (String, required)
- `description` (String, default '')
- `enabled` (Boolean, default true)
- `createdAt`, `updatedAt` (Date)
- index `{ collectionId: 1, updatedAt: -1 }`

### EvaluationScenario
- `suiteId` (ref EvaluationSuite, required, index)
- `order` (Number, default 0)
- `name` (String, required)
- `objective` (String, default '')
- `requiredToolCalls` ([String], default [])
- `forbiddenToolCalls` ([String], default [])
- `argumentAssertions` ([
    { toolName, path, operator:'equals'|'contains'|'exists'|'notExists',
      expected } ], `_id: false`)
- `maxToolCalls` (Number, default null)
- `createdAt`, `updatedAt`
- index `{ suiteId: 1, order: 1 }`

### EvaluationRun
- `suiteId` (ref EvaluationSuite, required, index)
- `scenarioId` (ref EvaluationScenario, default null — null for whole-suite runs)
- `collectionId` (ref Collection, required, index)
- `workspaceId`, `owner` (required)
- `agentName` (String, default '')
- `transcript` (String — redacted JSON; never raw secrets)
- `score` (String, e.g. `"2/3"`)
- `status` ('passed' | 'failed' | 'error')
- `violations` ([{ kind, toolName, message, expected, actual }], `_id: false`)
- `perRuleResults` ([{ rule, passed, detail }], `_id: false`)
- `createdAt`
- indexes `{ suiteId, createdAt:-1 }`, `{ scenarioId, createdAt:-1 }`

## Scoring engine — `services/EvaluationScorer.js` (pure, no I/O)

### `validateTranscript(transcript)`
Shape validation. Returns `{ ok: true, normalized }` or
`{ ok: false, message }`. Rejects malformed with a clear message used for the
400 response.
- top-level object
- `agentName` optional string
- `toolCalls` non-empty array
- each call: object with string `toolName`, object `arguments` (default `{}`),
  optional `timestamp` parseable as Date
- normalized transcript strips unknown keys and coerces types

### `scoreScenario(scenario, normalizedTranscript, allowedToolNames)`
Returns `{ status, score, violations, perRuleResults }`.
Fail rules, in order:
1. **unknown tool** — `toolName` not in `allowedToolNames`
2. **forbidden tool** — `toolName` in `scenario.forbiddenToolCalls`
3. **required tool not called** — entry in `scenario.requiredToolCalls` never
   appears in `toolCalls`
4. **failed argument assertion** — `argumentAssertions` evaluated against the
   matching calls; `equals`/`contains` coerce both sides to string,
   `exists`/`notExists` check path presence
5. **exceeds maxToolCalls** — `toolCalls.length > scenario.maxToolCalls`
`status` = `'failed'` if any violation, else `'passed'`.
`score` = `passedRules/totalRules`.
`perRuleResults` lists each rule with `passed` + short `detail`.

### `scoreSuite(suite, scenarios, normalizedTranscript, allowedToolNames)`
Runs every selected (all enabled) scenario. Suite passes iff every scenario
passes. Returns `{ status, score, scenarioResults: [...] }`.

## Allowed contract
Reuse `CollectionMcpServerService.buildToolCatalog(collection)` — the catalog
entries' `name` fields are the allowed tool-name set. Unknown tool = a
`toolName` not present in the catalog.

## Redaction
Reuse `AsyncApiRedact.redactSensitiveValues` over each `toolCall.arguments`
before storing the transcript and again when returning run results. Same
`SENSITIVE_KEY` convention as the rest of Pigeon.

## Routes — `routes/evaluation.js`, mounted `/evaluation`

Collection access via `getDb().collection('collections')` + workspace-membership
check mirroring `collections.js` `collectionAccessClauses`.

Endpoints:
- `GET    /collections/:collectionId/suites`            list suites for a collection
- `POST   /collections/:collectionId/suites`            create suite
- `GET    /suites/:id`                                   suite + ordered scenarios
- `PUT    /suites/:id`                                   edit name/description/enabled
- `DELETE /suites/:id`                                   suite + its scenarios + runs
- `POST   /suites/:id/scenarios`                        add scenario (order = max+1)
- `PUT    /scenarios/:id`                                edit scenario
- `DELETE /scenarios/:id`                                delete scenario
- `PUT    /suites/:id/scenarios/order`                   reorder
- `POST   /suites/:id/runs`                              body = transcript; runs all scenarios
- `POST   /scenarios/:id/runs`                           body = transcript; runs one scenario
- `GET    /suites/:id/runs`                              run history (paginated)
- `GET    /runs/:id`                                     single run

Malformed transcript → `400` with `{ message }` from `validateTranscript`.

## UI
- `CollectionDetail` gains a new `evaluation` tab rendering
  `EvaluationSuitePanel` (props: `collectionId`). Loads suites via the routes
  above; also loads the catalog (reuse `/api/mcp/servers/collections/:id`
  response which already returns request/tool names) for the tool pickers.
  - Suite list + create/edit/delete.
  - Visual scenario editor: required/forbidden tool multi-selects sourced from
    the collection's catalog tool names, argument-assertion rows
    (toolName / path / operator / expected), maxCalls numeric input.
  - Run panel: paste transcript JSON → run → show pass/fail, score, per-rule
    results, violations.
  - Run history list with status, score, timestamp; click to view detail.
- `AIAgentToolsSection` replaced by `EvaluationHome` — intro + list of the
  user's collections, each linking into its collection detail `evaluation` tab.

## Tests (no new frameworks)
- `tests/evaluationScorer.test.js` — pure unit tests: each fail rule, happy
  path, malformed-transcript rejection, redaction of stored arguments.
- `client/src/components/evaluation/EvaluationSuitePanel.test.js` —
  `@testing-library/react` render of pass/fail results + scenario validation
  feedback (mirrors `transformConfig.test.js` jsdom setup).

## Explicitly skipped
- Live agent execution, model-provider integrations.
- Import/export of suite definitions.
- npm runs and git commits.