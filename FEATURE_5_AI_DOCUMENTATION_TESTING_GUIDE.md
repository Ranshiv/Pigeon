# How to test the AI Documentation Generator

This guide verifies Pigeon’s artificial intelligence (AI)-assisted application programming interface (API) documentation workflow. It covers import, generation, review, versioning, changelogs, and public publishing.

## Test constraints

- Do not use production API contracts, credentials, tokens, customer data, or private server URLs.
- Use a workspace and collection that can be safely changed.
- Test with owner, editor, and viewer accounts when validating permissions.
- Generated content must remain private until an owner or admin publishes it.

## Prerequisites

1. Start Pigeon using the project’s normal local startup process.
2. Sign in and create or select a workspace.
3. Create a collection named `Documentation Test API`.
4. Add at least these requests:
   - `GET https://api.example.com/users` named `List users`.
   - `GET https://api.example.com/users/{id}` named `Get user`.
   - `POST https://api.example.com/users` named `Create user` with a JSON body.
5. Add descriptions, parameters, and test-only authentication configuration to some requests. Leave at least one description and error response missing so coverage warnings can be verified.

NVIDIA Inference Microservices (NIM) is optional. Without a configured NIM profile, Pigeon should still generate a deterministic standards-based draft and display an AI-unavailable warning.

## Test fixture: OpenAPI 3.2

Save the following as `documentation-test-api.yaml`, or paste it directly into the importer:

```yaml
openapi: 3.2.0
info:
  title: Documentation Test API
  version: 1.0.0
  description: A safe contract used to test Pigeon documentation generation.
servers:
  - url: https://api.example.com
components:
  securitySchemes:
    testOAuth:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://identity.example.com/authorize
          tokenUrl: https://identity.example.com/token
          scopes:
            users:read: Read users
            users:write: Create users
  schemas:
    User:
      type: object
      required: [id, email]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        role:
          type: string
          enum: [viewer, editor]
    Problem:
      type: object
      required: [type, title, status]
      properties:
        type: { type: string }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        instance: { type: string }
paths:
  /users:
    get:
      operationId: listUsers
      summary: List users
      security:
        - testOAuth: [users:read]
      responses:
        '200':
          description: Users returned successfully
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
        '401':
          description: Authentication is missing or invalid
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
    post:
      operationId: createUser
      summary: Create a user
      security:
        - testOAuth: [users:write]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [email]
              properties:
                email: { type: string, format: email }
                role: { type: string, enum: [viewer, editor] }
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Request validation failed
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
  /users/{id}:
    get:
      operationId: getUser
      summary: Get a user
      security:
        - testOAuth: [users:read]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200':
          description: User returned successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/Problem'
```

## 1. Generate from a collection

1. Open `Documentation Test API`.
2. Open its Documentation page.
3. Select **AI Generate**.
4. Do not import a contract yet.
5. Confirm the operation picker lists the saved collection requests.
6. Deselect one operation.
7. Select the desired sections and choose an audience and style.
8. Select **Generate from collection**.

Expected results:

- The request returns immediately with a queued generation run.
- Progress advances until the run is `completed`, `partial`, or `failed`.
- A configured NIM profile enriches endpoint descriptions.
- Without NIM, generation completes with an `AI unavailable` warning.
- Only selected operations appear in the draft.
- The draft includes overview, authentication, getting-started, endpoint, error, example, and tutorial sections selected before generation.
- Generated credentials use placeholders such as `<access-token>` or `<api-key>`.

## 2. Import OpenAPI YAML

1. Return to **AI Generate**.
2. Upload `documentation-test-api.yaml`, or paste the fixture.
3. Select **Validate and import**.

Expected results:

- Import reports OpenAPI `3.2.0` and three operations.
- Spectral diagnostics appear when applicable.
- API version `v1.0.0` is created.
- Authentication scheme `testOAuth` is detected.
- Existing generated documentation is marked stale if its source hash differs.
- The operation picker switches to the imported contract operations.

Repeat the import without changing `info.version`.

Expected result: import returns `409 VERSION_EXISTS` and does not overwrite the existing API version.

## 3. Import JSON and invalid documents

Convert the fixture to JSON or use a small JSON OpenAPI contract.

Expected result: valid JSON imports with the same behavior as YAML.

Also test these failures:

| Input | Expected result |
|---|---|
| Empty content | `400 CONTENT_REQUIRED` |
| Invalid YAML/JSON | `400 PARSE_ERROR` |
| Missing OpenAPI/Swagger version | `400 UNSUPPORTED_VERSION` |
| Unsupported version | `400 UNSUPPORTED_VERSION` |
| More than 5 MB uploaded | `413` |
| More than 2,500 operations | `413 TOO_MANY_OPERATIONS` |
| More than 250 selected operations | `400 GENERATION_LIMIT` |

## 4. External-reference security

Import this document:

```yaml
openapi: 3.2.0
info: { title: Unsafe API, version: 1.0.0 }
paths: {}
components:
  schemas:
    User:
      $ref: https://example.com/user.json
```

Expected result: `400 EXTERNAL_REF_BLOCKED`. Pigeon must not fetch the URL.

Repeat with a local filesystem reference such as `file:///etc/passwd` or `C:\secrets.json`.

Expected result: the reference is rejected and no file is read.

## 5. Review generated content

Generate from the imported API version.

Verify:

- OAuth instructions mention authorization code with PKCE and safe token handling.
- Each endpoint shows the correct HTTP method and path.
- Parameter tables contain only parameters declared by the contract.
- cURL, JavaScript, and Python examples use `https://api.example.com`.
- Request and response examples match their schemas.
- `400`, `401`, and `404` responses appear in error tables.
- Problem responses mention RFC 9457 fields: `type`, `title`, `status`, `detail`, and `instance`.
- Tutorials reference only operations contained in the source.
- Coverage data records selected, missing-description, missing-example, invalid-example, and missing-error counts. The review panel displays selected, missing-example, invalid-example, and missing-error counts.

Fail the test if generated content invents an endpoint, parameter, status, authentication method, rate limit, guarantee, or business behavior.

## 6. Selective apply and merge

1. Uncheck one generated section in the review area.
2. Choose **Merge with current docs**.
3. Select **Apply selected sections**.

Expected results:

- Only checked sections are applied.
- Existing unmarked manual content remains.
- Generated sections contain stable Pigeon section markers.
- Applying a newer generation replaces the corresponding marked section instead of duplicating it.
- A new immutable documentation revision is created with source, model, prompt version, run ID, and warnings.
- Applying a draft does not publish it.

Repeat with **Replace current docs**.

Expected result: current content is replaced by the selected reviewed sections.

## 7. Revision conflict

1. Open the same documentation in two signed-in browser windows.
2. Save a change in window A.
3. Attempt to save the older copy in window B.

Expected results:

- Window B receives `409 REVISION_CONFLICT`.
- The latest server revision is returned.
- Window A’s content is not overwritten.
- Window B must refresh and review the latest version before saving again.

## 8. Version history and restore

1. Save several manual and generated changes.
2. Open Documentation settings and locate **Documentation versions**.
3. Expand multiple revisions.
4. Restore an older revision.

Expected results:

- History is paginated and ordered newest first.
- Entries identify revision, date, source, and message.
- Content and settings are included in each snapshot.
- Restore creates a new revision; it does not delete newer history.
- Restoring requires the current revision and is conflict-safe.
- Restored documentation is private until republished.

## 9. Secret detection

Add this text to a generated or manual draft:

```text
api_key=live_1234567890abcdef
```

Expected results:

- Applying a generated section containing the value returns `422 SECRET_REVIEW_REQUIRED`.
- Publishing documentation containing the value returns `422 SECRET_REVIEW_REQUIRED`.
- The response identifies a possible secret without returning the full value.

Replace it with:

```text
api_key=<api-key>
Authorization: Bearer <access-token>
```

Expected result: placeholders do not trigger the secret detector.

## 10. Publication workflow

1. Apply or manually save reviewed documentation.
2. Select **Publish** as the collection owner or an admin.
3. Open the returned `/docs/:collectionId` URL while signed out.

Expected results:

- Public documentation loads without authentication.
- Only title, Markdown content, safe display settings, revision, timestamps, collection name, and contributor names are returned.
- Internal provenance, generation warnings, model details, actor IDs, custom JavaScript, and unrestricted CSS are not exposed.
- Editing content or settings creates a new private revision and requires another explicit publish.

Permission checks:

| Role | Read | Import/generate/apply | Publish |
|---|---:|---:|---:|
| Owner | Yes | Yes | Yes |
| Admin collaborator | Yes | Yes | Yes |
| Editor collaborator | Yes | Yes | No |
| Viewer collaborator | Yes | No | No |
| Unauthenticated | Public page only | No | No |

## 11. Changelog generation

1. Import `v1.0.0`.
2. Change the fixture version to `1.1.0` and add an endpoint.
3. Import it.
4. Open **API Virtualizations** from Documentation.
5. In **Generate changelog**, select `v1.0.0` as the base and `v1.1.0` as the target.
6. Select **Generate**.

Expected results:

- Added, changed, and removed paths are derived from the contract diff.
- Breaking changes and migration notes appear when applicable.
- An additive endpoint suggests a minor release.
- A removed endpoint or breaking change suggests a major release.
- A non-breaking correction suggests a patch release.
- Changelog text contains no change absent from the deterministic diff.

## 12. Worker retry and cached generation

1. Start a generation using a configured NIM profile.
2. Temporarily make the provider unavailable or use a test transport that fails.

Expected results:

- The run is retained with progress and warnings or failure information.
- Expired running leases are retried.
- After three unsuccessful attempts, the run becomes `failed` instead of remaining stuck.
- Manual editing and deterministic generation remain available.

Generate again with the same source, selected operations, sections, audience, style, model, and prompt version.

Expected result: Pigeon reuses the cached draft and records the source generation run.

## 13. Migration dry run

Do not start with `--apply`.

```powershell
node scripts/migrate-documentation-canonical.js
```

Expected results:

- The command reports scanned documents, records to create, conflicts, which store is newer, and legacy versions to migrate.
- No database records change during the dry run.

After backing up the database and reviewing the report, test `--apply` only in a disposable or staging database:

```powershell
node scripts/migrate-documentation-canonical.js --apply
```

Verify standalone documentation becomes canonical, embedded data is synchronized, conflicts are preserved in `documentationMigrationConflicts`, and legacy versions appear in `documentationVersions`.

## Automated verification without npm commands

Run the focused backend tests:

```powershell
node --experimental-vm-modules ./node_modules/jest/bin/jest.js tests/openApiDocumentationService.test.js tests/documentationGenerationService.test.js tests/documentationGeneratorRoute.test.js --runInBand
```

Expected result: all feature suites pass.

Run the client workflow test:

```powershell
Set-Location client
node ./node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand DocumentationGeneratorPanel.test.js
```

Expected result: the generation review workflow test passes. A React testing-library deprecation warning may be printed by the existing dependency versions.

Build the client:

```powershell
Set-Location client
node ./node_modules/react-scripts/scripts/build.js
```

Expected result: the optimized build completes. Existing unrelated lint warnings may still be reported.

## Completion checklist

- [ ] Collection generation works with and without NIM.
- [ ] JSON and YAML OpenAPI imports work.
- [ ] External references are blocked.
- [ ] Spectral and schema diagnostics are visible.
- [ ] Operation and section selection are respected.
- [ ] Authentication, examples, errors, tutorials, and coverage are grounded.
- [ ] Selective merge and replace work without duplicate sections.
- [ ] Revision conflicts prevent lost updates.
- [ ] Unified version history and restore work.
- [ ] Secret findings block apply and publish.
- [ ] Owner/admin publication and signed-out public viewing work.
- [ ] API-version changelogs and SemVer suggestions are correct.
- [ ] Worker retries, failure handling, and caching work.
- [ ] Migration dry run is non-mutating.
- [ ] Focused backend tests, client test, and production build pass.
