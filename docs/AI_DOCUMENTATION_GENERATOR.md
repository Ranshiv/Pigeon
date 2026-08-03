# AI documentation generator

Pigeon generates private, reviewable Markdown drafts from an HTTP collection or an imported Swagger/OpenAPI contract. A draft is never saved or published until an editor selects and applies its sections.

## Supported inputs

- Swagger 2.0 and OpenAPI 3.0, 3.1, and 3.2 in JSON or YAML.
- Pigeon HTTP collection snapshots.
- Internal JSON references. Network and file references are rejected; bundle them before import.
- Up to 5 MB per uploaded contract, 2,500 imported operations, and 250 operations per generation run.

Imports create immutable API versions and run the configured Spectral ruleset. Generated examples are checked with JSON Schema Draft 2020-12. Authentication guidance uses placeholders and current OAuth security recommendations; possible credentials block draft application and publication.

## Workflow

1. Open a collection's Documentation page and choose **AI Generate**.
2. Use the collection as-is or validate and import an OpenAPI file/paste.
3. Select operations, sections, audience, and style.
4. Review generation warnings and every generated section.
5. Apply selected sections in merge or replace mode.
6. Save manual edits, review the immutable revision, and publish explicitly.

Generation uses the existing hosted or self-hosted NVIDIA NIM profiles. If no profile is configured, Pigeon still produces the deterministic contract-derived draft and marks AI enrichment unavailable.

## API summary

- `POST /api/collections/:id/openapi-imports`
- `POST /api/collections/:id/documentation/generations`
- `GET /api/collections/:id/documentation/generations/:runId`
- `POST /api/collections/:id/documentation/generations/:runId/apply`
- `GET|PUT /api/collections/:id/documentation`
- `GET /api/collections/:id/documentation/versions`
- `POST /api/collections/:id/documentation/versions/:versionId/restore`
- `POST /api/collections/:id/documentation/publish`
- `GET /api/api-versions/:fromId/compare/:toId/changelog`

All mutation routes require editor access. Publication requires collection owner or admin access. Saves require the current numeric `revision` and return `409 REVISION_CONFLICT` when another editor has already changed the document.

## Existing-data migration

Preview the canonical-store migration without writing:

```powershell
node scripts/migrate-documentation-canonical.js
```

After reviewing the counts and conflict summary, apply it during a maintenance window:

```powershell
node scripts/migrate-documentation-canonical.js --apply
```

Conflicting embedded and standalone records are preserved in `documentationMigrationConflicts`. Legacy content/settings versions are copied into `documentationVersions`; source collections are not deleted by the migration.
