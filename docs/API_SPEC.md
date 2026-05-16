# API Specification (REST-first, TestRail-compatible-ready)

## API Design Principles
- Primary API style is REST under `/api`.
- Business logic lives in domain services and is reused by all API surfaces.
- TestRail-like compatibility is added as a separate adapter namespace (`/api/v2`) that calls the same services.
- Error response format is consistent across endpoints.
- Support both user-driven UI operations and machine-driven automation uploads.

## Base Conventions
- Authentication:
  - User auth (session/JWT) for UI API.
  - API token for automation endpoints.
- Content type: `application/json`
- Time format: ISO8601 UTC
- Soft-deleted records are hidden by default.
- Pagination canonical: `page`, `pageSize` (legacy alias: `page_size`).
- Large list endpoints must support server-side filtering before client-side filtering.
- Project-scoped result/run/test lists must never require loading all project history into the browser.
- Field naming canonical:
  - request/response canonical: `camelCase` (`caseId`, `testId`, `runId`)
  - backward-compatible alias accepted: `snake_case` (`case_id`, `test_id`, `run_id`)
  - alias fields are compatibility-only and planned for deprecation in strict mode.
- UI-facing endpoint policy:
  - canonical: project-scoped route (`/api/projects/{projectId}/...`)
  - global route is allowed only for compatibility or internal shortcut.

## Data Freshness and Load Policy
- The API is request/response first. Realtime subscriptions are not part of the baseline contract.
- UI clients may poll only operational execution surfaces:
  - Run detail: low-frequency refresh while a run is open.
  - My Tests: low-frequency refresh for assigned work.
- Reports, case authoring, settings, and audit views should not be polled by default.
- Result history, result steps, result attachments, and result defects are lazy-loaded by selected test/result.
- Closed runs are immutable for result entry and do not need active polling.
- Endpoints that can grow with execution volume must provide pagination and filters.

## Concurrency Policy
- Test case authoring must use optimistic concurrency control.
- `GET /api/cases/{caseId}` and case list responses expose a revision field:
  - preferred: `version` integer
  - acceptable alternative: `updatedAt` ISO timestamp
- `PATCH /api/cases/{caseId}` requires one of:
  - `expectedVersion`
  - `expectedUpdatedAt`
- If the current case revision does not match the expected revision, return:

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "The test case was modified by another user.",
    "details": {
      "currentVersion": 12,
      "expectedVersion": 11
    }
  }
}
```

- HTTP status: `409 Conflict`.
- Clients should reload the latest case while preserving the user's local unsaved edits for manual re-apply.
- Result creation remains append-only and does not use optimistic locking.
- Run close and destructive settings actions may use conflict checks later, but case authoring is the first required target.

## Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [
      {
        "field": "status",
        "reason": "must be one of: untested, passed, failed, blocked, retest"
      }
    ],
    "request_id": "req_01HV..."
  }
}
```

## API Groups

## Projects
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{projectId}`
- `PATCH /api/projects/{projectId}`
- `DELETE /api/projects/{projectId}`

## Suites
- `GET /api/projects/{projectId}/suites`
- `POST /api/projects/{projectId}/suites`
- `GET /api/suites/{suiteId}`
- `PATCH /api/suites/{suiteId}`
- `DELETE /api/suites/{suiteId}`

## Sections
- `GET /api/suites/{suiteId}/sections`
- `POST /api/suites/{suiteId}/sections`
- `PATCH /api/sections/{sectionId}`
- `DELETE /api/sections/{sectionId}`

## Cases
- `GET /api/projects/{projectId}/cases`
- `GET /api/sections/{sectionId}/cases`
- `POST /api/sections/{sectionId}/cases`
- `GET /api/cases/{caseId}`
- `PATCH /api/cases/{caseId}`
- `DELETE /api/cases/{caseId}`
- `POST /api/projects/{projectId}/cases/bulk-delete`
- `POST /api/projects/{projectId}/cases/bulk-move`
- `POST /api/projects/{projectId}/cases/bulk-update`
- `POST /api/projects/{projectId}/cases/bulk-archive`
- `POST /api/cases/{caseId}/steps`
- `PATCH /api/case-steps/{stepId}`
- `DELETE /api/case-steps/{stepId}`

Case list query baseline:
- `GET /api/projects/{projectId}/cases`
  - `sectionId`
  - `q` searches case code/title, refs, automation key, external id, labels, and custom field values
  - `priority`
  - `caseType`
  - `automation` (`manual` or `automated`)
  - `refs` (`with` or `without`)
  - `labels` (`with` or `without`)
  - `estimate` (`with` or `without`)
  - `state` (`active` default, `archived` to view archived cases)
  - `page`, `pageSize`

Bulk delete baseline:
- `POST /api/projects/{projectId}/cases/bulk-delete`
- Body: `{ "caseIds": [1, 2, 3] }`
- The server only deletes cases that belong to the project and returns per-case result rows:

```json
{
  "data": {
    "requested": 3,
    "deleted": 2,
    "failed": 1,
    "items": [
      { "caseId": "1", "success": true, "error": null },
      { "caseId": "2", "success": true, "error": null },
      { "caseId": "999", "success": false, "error": "NOT_FOUND" }
    ]
  }
}
```

Bulk move baseline:
- `POST /api/projects/{projectId}/cases/bulk-move`
- Body: `{ "caseIds": [1, 2, 3], "targetSectionId": 10 }`
- The server validates that the target section belongs to the same project, only moves project-scoped cases, and returns per-case result rows:

```json
{
  "data": {
    "requested": 3,
    "moved": 2,
    "failed": 1,
    "targetSectionId": "10",
    "items": [
      { "caseId": "1", "success": true, "error": null },
      { "caseId": "2", "success": true, "error": null },
      { "caseId": "999", "success": false, "error": "NOT_FOUND" }
    ]
  }
}
```

Bulk update baseline:
- `POST /api/projects/{projectId}/cases/bulk-update`
- Body: `{ "caseIds": [1, 2, 3], "patch": { "priority": "low", "caseType": "integration" } }`
- Current baseline supports shared updates for `priority` and `caseType` across project-scoped selected cases and returns per-case result rows:

```json
{
  "data": {
    "requested": 3,
    "updated": 2,
    "failed": 1,
    "patch": {
      "priority": "low",
      "caseType": "integration"
    },
    "items": [
      { "caseId": "1", "success": true, "error": null },
      { "caseId": "2", "success": true, "error": null },
      { "caseId": "999", "success": false, "error": "NOT_FOUND" }
    ]
  }
}
```

Bulk archive baseline:
- `POST /api/projects/{projectId}/cases/bulk-archive`
- Body: `{ "caseIds": [1, 2, 3], "archived": true }`
- Use `archived: false` to restore archived cases back into the active repository baseline.
- Archived cases are hidden from default case lists and suite-based run composition, but remain addressable by direct case detail/version APIs.

```json
{
  "data": {
    "requested": 3,
    "changed": 2,
    "failed": 1,
    "archived": true,
    "items": [
      { "caseId": "1", "success": true, "error": null },
      { "caseId": "2", "success": true, "error": null },
      { "caseId": "999", "success": false, "error": "NOT_FOUND" }
    ]
  }
}
```

Case optimistic locking (phase 2 baseline):
- `PATCH /api/cases/{caseId}` accepts either:
  - request body `expectedVersion` (preferred), or
  - `If-Match` header with version number (example: `If-Match: "3"`).
- Server stores and increments `lockVersion` on every successful case update.
- If expected version does not match current `lockVersion`, server returns `409 CONFLICT`.
- `GET /api/cases/{caseId}/versions`
- `GET /api/cases/{caseId}/versions/{versionId}`
- `POST /api/cases/{caseId}/versions/{versionId}/restore`
- `GET /api/cases/{caseId}/versions/{versionNo}/attachments/{attachmentId}/download` — returns `{ data: { attachmentId, fileName, contentType, downloadUrl, expiresAt } }` from the version `attachmentSnapshots` entry (uses snapshot `storageKey`, not the live attachment row). Auth required. `404` when the attachment id is absent from that version snapshot.
- `PATCH /api/cases/{caseId}/assignee`

Semantics (case steps):
- `POST /api/sections/{sectionId}/cases` and `PATCH /api/cases/{caseId}` accept `customValues` as an object keyed by custom field `systemName`.
- Case create/update validate `customValues` against the project's active case custom field definitions; create rejects missing required active fields, and create/update reject unknown fields or invalid option/number values.
- `GET /api/cases/{caseId}` and case list responses include `customValues`; current baseline stores scalar values (`string`, `number`, `boolean`, or `null`).
- `GET /api/cases/{caseId}` includes an ordered `steps` array. Each step exposes `id`, `stepOrder`, `content`, and `expectedResult` (nullable). Soft-deleted steps are omitted.
- `POST /api/cases/{caseId}/steps`: body requires `content`; `expectedResult` is optional (nullable). The server assigns the next `stepOrder` within the case (clients do not choose the insert position via this endpoint).
- `PATCH /api/case-steps/{stepId}`: send only fields to change among `content`, `expectedResult`, and `stepOrder`. Changing `stepOrder` re-sequences all active steps for that case to contiguous `1..n`.
- `DELETE /api/case-steps/{stepId}`: soft-deletes the step, then renumbers remaining active steps to `1..n`.
- Case and case-step mutations require the same project membership role as other project-scoped writes (mutate-capable role when authorization is enforced).
- Case updates create a new case version when any persisted case field or step changes.
- Case version restore creates a new version; it does not delete or mutate the restored historical version.
- Case version history is a TestRail-like audit/history feature for authored case changes.
- Run creation uses the current selected case definitions and stores immutable test instance snapshots.

### Case Version Payload
```json
{
  "id": "501",
  "caseId": "1001",
  "version": 7,
  "title": "Checkout with saved card",
  "snapshot": {
    "preconditions": "User has a saved payment method",
    "priority": "high",
    "caseType": "regression",
    "refs": ["REQ-1"],
    "labels": ["checkout"],
    "customValues": {
      "risk": "High",
      "automation_candidate": true
    },
    "steps": [
      { "stepOrder": 1, "content": "Open checkout", "expectedResult": "Checkout opens" }
    ]
  },
  "createdBy": "12",
  "createdAt": "2026-04-28T10:00:00.000Z",
  "comment": "Updated saved card coverage"
}
```

Current baseline:
- `GET /api/cases/{caseId}/versions` returns paged history with `versionNo`, case authored snapshot fields, step snapshot, `changeReason`, and `createdAt`.
- New versions are created automatically on meaningful authored changes (`PATCH /api/cases/{caseId}`, step create/update/delete).
- Case version snapshots include `customValuesSnapshot`.

## Runs
- `GET /api/projects/{projectId}/runs`
- `POST /api/projects/{projectId}/runs`
- `GET /api/runs/{runId}`
- `GET /api/projects/{projectId}/runs/{runId}`
- `GET /api/projects/{projectId}/runs/{runId}/instances`
- `PATCH /api/runs/{runId}`
- `POST /api/runs/{runId}/close`
- `POST /api/runs/{runId}/reopen`
- `POST /api/runs/{runId}/rerun`
- `POST /api/runs/{runId}/tests` (body: `{ "caseIds": ["101","102"] }`, open run only; `409 RUN_CLOSED` when closed)
- `POST /api/runs/{runId}/remove-test` (body: `{ "testId": "…", "confirmDataLoss"?: true }`; without `confirmDataLoss`, tests with result history return `409 TEST_HAS_RESULTS`)

Run composition baseline:
- `POST /api/projects/{projectId}/runs` accepts:
  - `includeAll: true` — all cases in `suiteId`, optional `excludedCaseIds`, optional `excludedSectionIds` (section subtree roots), optional `includedSectionIds` (restrict to subtrees).
  - `includeAll: false` — required `caseIds`, optional `includedSectionIds` (intersect selection with subtrees).
  - `compositionMode` (optional): `static` (default), `include_all_live`, or `dynamic_filter`.
  - `filterDefinition` (optional, `dynamic_filter` only): `{ priority?, state?, includedSectionIds? }`.
- `GET /api/projects/{projectId}/runs/{runId}` includes `run.composition` parsed from `TestRun.metadata`.
- `POST /api/projects/{projectId}/runs/{runId}/sync-composition` — reconcile open runs in live modes; returns `{ skipped, added, removed, reason? }`; records activity `run.composition_synced`.
- Section IDs are suite-scoped roots; the server expands each root to its descendant sections before filtering cases.

Example run creation body:

```json
{
  "suiteId": "1",
  "name": "Regression",
  "includeAll": true,
  "excludedCaseIds": ["199"],
  "includedSectionIds": ["10", "11"],
  "excludedSectionIds": ["12"]
}
```

Run query parameters:
- `GET /api/projects/{projectId}/runs`
  - `status`
  - `milestoneId`
  - `planId`
  - `assignedTo`
  - `q`
  - `page`, `pageSize`

Run instance query parameters:
- `GET /api/projects/{projectId}/runs/{runId}/instances`
  - `status`
  - `assignedTo`
  - `q` searches case code/title snapshot
  - `page`, `pageSize`

Run close semantics:
- Closing a run prevents new result writes and returns `409 RUN_CLOSED`.
- Closed run snapshots are immutable.
- Closed runs should not be actively polled by UI clients.

## Tests (Instances)
- `GET /api/runs/{runId}/tests`
- `GET /api/tests/{testId}`
- `PATCH /api/tests/{testId}`

## Results
- `GET /api/tests/{testId}/results`
  - Query: `page`, `pageSize` (default page 1, pageSize 20). Response: `{ "data": { "items": [...], "page", "pageSize", "total", "totalPages" } }` (`Ok` envelope).
- `POST /api/tests/{testId}/results`
- `POST /api/runs/{runId}/results`
- `POST /api/runs/{runId}/results/by-case`
- `POST /api/runs/{runId}/results/bulk`
- `GET /api/runs/{runId}/results`
- `GET /api/projects/{projectId}/results`

Semantics:
- `POST /api/tests/{testId}/results`: add result directly to a specific test instance.
- `POST /api/runs/{runId}/results`: accepts `testId` or `caseId` and writes a single result.
- `POST /api/runs/{runId}/results/by-case`: resolve test instance by `case_id` within the run, then add result.
- `POST /api/runs/{runId}/results/bulk`: upload multiple results in one request.
- Result creation is append-only. Editing historical results is not part of baseline behavior.
- `GET /api/projects/{projectId}/results` and `GET /api/runs/{runId}/results` must be paginated.
- Result filters:
  - `status`
  - `source`
  - `runId`
  - `caseId`
  - `testId`
  - `createdBy`
  - `createdFrom`
  - `createdTo`
  - `q`

## Assignment & Personal Work
- `PATCH /api/runs/{runId}/assignee`
- `PATCH /api/tests/{testId}/assignee`
- `GET /api/projects/{projectId}/tests/assigned-to-me`

## Overview / Reports (Dashboard)
- `GET /api/projects/{projectId}/overview`
- `GET /api/projects/{projectId}/reports/status-distribution`
- `GET /api/projects/{projectId}/reports/failure-trend`
- `GET /api/projects/{projectId}/reports/recent-failures`
- `GET /api/projects/{projectId}/reports/recent-results`
- `GET /api/projects/{projectId}/reports/run-summary`
- `GET /api/projects/{projectId}/reports/requirement-coverage`
- `GET /api/projects/{projectId}/reports/coverage-gap`
- `GET /api/projects/{projectId}/reports/traceability`
- `GET /api/projects/{projectId}/reports/defect-coverage`

Semantics (overview/reports baseline):
- `/overview` returns project-level counters used on overview cards: `totalCases`, `activeRuns`, `recentFailures`, `automationCoveragePct`.
- `recent-failures` and `recent-results` return ordered `items` with `runId`, `runName`, `caseId`, `title`, `status`, `source`, `createdAt`.
- `run-summary` returns per-run aggregation rows: `runId`, `name`, `status`, `total`, `passed`, `failed`, `progress`.
- Empty datasets return `200` with empty collections (no 404 for "no data").
- Report endpoints must not require loading all raw result history on the client.
- Expensive reports may use summary tables or materialized views after data volume grows.

Traceability report row:

```json
{
  "requirementId": "10",
  "requirementKey": "REQ-10",
  "requirementTitle": "Saved card checkout",
  "caseId": "101",
  "caseTitle": "Checkout with saved card",
  "runId": "501",
  "testId": "9001",
  "latestStatus": "failed",
  "latestResultAt": "2026-04-28T10:00:00.000Z",
  "defects": ["JIRA-777"]
}
```

## Rerun
- `POST /api/runs/{runId}/rerun`
- `POST /api/plans/{planId}/rerun`

Rerun request keys:
- `sourceRunId`
- `statusFilter` (`failed`, `blocked`, `retest`, `all`)
- `includeClosed` (optional)

## Plans
- `GET /api/projects/{projectId}/plans`
- `POST /api/projects/{projectId}/plans`
- `GET /api/projects/{projectId}/plans/{planId}` (canonical)
- `GET /api/plans/{planId}` (compatibility)
- `PATCH /api/plans/{planId}`
- `DELETE /api/plans/{planId}`
- `GET /api/projects/{projectId}/configuration-groups`
- `POST /api/projects/{projectId}/configuration-groups`
- `PATCH /api/configuration-groups/{groupId}`
- `DELETE /api/configuration-groups/{groupId}`
- `POST /api/configuration-groups/{groupId}/configurations`
- `PATCH /api/configurations/{configurationId}`
- `DELETE /api/configurations/{configurationId}`
- `POST /api/projects/{projectId}/plans/{planId}/matrix`
- `POST /api/projects/{projectId}/plans/{planId}/runs/by-configuration`

Plan/configuration semantics:
- Free-text `environment` is an MVP compatibility field.
- Target planning uses reusable configuration groups and values.
- A plan entry may map to multiple configurations, such as Browser=Chrome and Device=iOS.
- Generated runs inherit the plan entry configuration snapshot.

Current baseline:
- Configuration group/value CRUD is available via:
  - `GET|POST /api/projects/{projectId}/configuration-groups`
  - `PATCH|DELETE /api/configuration-groups/{groupId}`
  - `POST /api/configuration-groups/{groupId}/configurations`
  - `PATCH|DELETE /api/configurations/{configurationId}`
- Matrix preview and run generation baseline is available via:
  - `POST /api/projects/{projectId}/plans/{planId}/matrix`
  - `POST /api/projects/{projectId}/plans/{planId}/runs/by-configuration`
  - `GET /api/projects/{projectId}/plans/{planId}/entries/{entryId}/configurations`
  - `GET /api/projects/{projectId}/plans/{planId}/rollup-by-configuration`
- `runs/by-configuration` enforces one selected configuration per configuration group.

## Milestones
- `GET /api/projects/{projectId}/milestones`
- `POST /api/projects/{projectId}/milestones`
- `GET /api/projects/{projectId}/milestones/{milestoneId}` (canonical)
- `GET /api/milestones/{milestoneId}` (compatibility)
- `PATCH /api/milestones/{milestoneId}`
- `DELETE /api/milestones/{milestoneId}`

## Attachments
- `POST /api/attachments`
- `GET /api/attachments/{attachmentId}`
- `DELETE /api/attachments/{attachmentId}`
- `POST /api/attachments/{attachmentId}/download-url`
- `POST /api/results/{resultId}/attachments/presign`
- `POST /api/results/{resultId}/attachments`
- `GET /api/results/{resultId}/attachments`

Attachment semantics:
- File bytes are not stored in Postgres.
- Files are stored in object storage, preferably Supabase Storage.
- The database stores metadata: file name, content type, storage path, file size, owner, entity link.
- Result attachment upload may use either:
  - direct server upload
  - presigned/direct-to-storage flow
- Deleting an attachment soft-deletes DB metadata and removes or tombstones the storage object.
- Current baseline:
  - `POST /api/results/{resultId}/attachments/presign` returns upload target (`storagePath`, `uploadUrl`, `method`, `headers`, `expiresAt`).
  - `POST /api/attachments` registers metadata after upload completion.
  - `POST /api/attachments/{attachmentId}/download-url` returns short-lived download URL metadata.
  - `GET /api/attachments/{attachmentId}` and `DELETE /api/attachments/{attachmentId}` are available for detail/read and soft-delete.

## Auth / API Tokens
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/projects/{projectId}/tokens` (canonical)
- `POST /api/projects/{projectId}/tokens` (canonical)
- `DELETE /api/projects/{projectId}/tokens/{tokenId}` (canonical)
- `GET /api/tokens` (compatibility)
- `POST /api/tokens` (compatibility)
- `DELETE /api/tokens/{tokenId}` (compatibility)

## Membership / Permissions
- `GET /api/projects/{projectId}/members`
- `POST /api/projects/{projectId}/members`
- `PATCH /api/projects/{projectId}/members/{memberId}`
- `DELETE /api/projects/{projectId}/members/{memberId}`

Permission baseline:
- `owner`: full project administration, including members and destructive settings.
- `manager`: mutate cases, runs, plans, assignments, reports, and integrations.
- `tester`: enter results, attach evidence, link defects, update assigned tests.
- `viewer`: read-only access.
- Last active project owner cannot be removed or demoted.

## Project Settings
- `GET /api/projects/{projectId}/settings/custom-fields`
- `POST /api/projects/{projectId}/settings/custom-fields`
- `PATCH /api/projects/{projectId}/settings/custom-fields/{fieldId}`
- `DELETE /api/projects/{projectId}/settings/custom-fields/{fieldId}`
- `GET /api/projects/{projectId}/settings/statuses`
- `POST /api/projects/{projectId}/settings/statuses`
- `PATCH /api/projects/{projectId}/settings/statuses/{statusId}`
- `DELETE /api/projects/{projectId}/settings/statuses/{statusId}`
- `GET /api/projects/{projectId}/settings/templates`
- `POST /api/projects/{projectId}/settings/templates`
- `PATCH /api/projects/{projectId}/settings/templates/{templateId}`
- `DELETE /api/projects/{projectId}/settings/templates/{templateId}`
- `GET /api/projects/{projectId}/settings/audit-logs`
- `GET /api/projects/{projectId}/settings/audit-log-filters`
- `GET /api/projects/{projectId}/settings/audit-logs/export.csv`
- `POST /api/projects/{projectId}/settings/audit-logs/retention-prune`
- `GET /api/projects/{projectId}/settings/webhooks`
- `POST /api/projects/{projectId}/settings/webhooks`
- `PATCH /api/projects/{projectId}/settings/webhooks/{webhookId}`
- `DELETE /api/projects/{projectId}/settings/webhooks/{webhookId}`
- `GET /api/projects/{projectId}/settings/webhook-events`
- `GET /api/projects/{projectId}/settings/webhook-attempts`
- `POST /api/projects/{projectId}/settings/webhook-attempts/{attemptId}/retry`
- `POST /api/projects/{projectId}/settings/webhooks/{webhookId}/test-send` (DB mode only; synchronous probe, records `webhook_delivery_attempt`)
- `GET /api/projects/{projectId}/settings/email-outbox` (query: `status`, `kind`, `recipientEmail`, pagination)
- `POST /api/projects/{projectId}/settings/email-outbox/{outboxId}/retry`
- `GET /api/projects/{projectId}/settings/email-outbox/digest-preview` (current user; read-only body for pending digest)
- `GET /api/runs/{runId}/test-subscriptions` (current user's subscribed test IDs in run)
- `PUT /api/tests/{testId}/subscription` body `{ subscribed: boolean }`

Webhook delivery (DB-backed server process):
- Webhook create/update accepts optional `scope: "project" | "global"`; `project` is default. Global webhooks are listed in project settings and receive matching activity from every project, while delivery attempts remain tied to the project where the event occurred.
- When `USE_IN_MEMORY_REPOSITORY` is not enabled, a background interval processes `webhook_delivery_attempt` rows in `pending` state (respecting `nextRetryAt`), POSTs JSON to `targetUrl` with `X-Webhook-Signature` and `X-Webhook-Event`, and stores HTTP status/body or error with exponential backoff up to a capped attempt count.
- After a delivery attempt exhausts retries, the parent `WebhookSubscription` increments `consecutiveFailures`; when the threshold is reached (default 5, `WEBHOOK_DISABLE_FAILURE_THRESHOLD`), the webhook is set `isActive=false` with `disabledAt`. Re-enabling via PATCH clears failure counters.

Custom field shape:
```json
{
  "id": "10",
  "name": "Risk",
  "systemName": "risk",
  "fieldType": "select",
  "options": ["High", "Medium", "Low"],
  "isRequired": true,
  "isActive": true,
  "displayOrder": 0
}
```

Rules:
- `fieldType` is currently `text`, `number`, `select`, or `boolean`.
- `systemName` is project-unique and normalized to lowercase snake_case.
- Deletes are soft deletes in DB-backed mode and create audit log entries.

Custom status shape:
```json
{
  "id": "20",
  "name": "Needs Investigation",
  "systemName": "needs_investigation",
  "canonicalStatus": "retest",
  "color": "#0f766e",
  "isSystem": false,
  "isActive": true,
  "displayOrder": 50
}
```

Rules:
- `canonicalStatus` maps custom labels onto the internal execution status set: `untested`, `passed`, `failed`, `blocked`, `retest`.
- If no project rows exist yet, the API returns the five default system definitions.
- System definitions are protected from deletion.

Case template shape:
```json
{
  "id": "30",
  "name": "Exploratory",
  "description": "Lightweight testing",
  "fields": ["title", "charter", "notes"],
  "isDefault": true,
  "isActive": true,
  "displayOrder": 0
}
```

Rules:
- `fields` is an ordered list of field keys; built-in and custom field keys can both be represented.
- At most one active project template should be marked default by the settings API.
- Deletes are soft deletes in DB-backed mode and create audit log entries.

Audit log query parameters:
- `page`, `pageSize`
- `scope`: `project` (default) or `all`; `all` requires project mutation permission and returns cross-project audit rows.
- `action`, `entityType`, `entityId`, `actorUserId`, `actorEmail`, `actionExact`, `entityTypeExact`, `changesContains`
- `createdFrom`, `createdTo` as ISO datetimes
- `q` searches action, entity type, and entity id

Audit log response includes `items`, `filters`, `page`, `pageSize`, `total`, and `totalPages`; rows include `projectId`/`projectName` when available.
Audit CSV export applies the same filters, includes project columns, and caps export output at 5,000 rows.
Retention prune body: `{ "olderThanDays": 365 }` with allowed range 30-3650; the prune action writes a summary audit row.
Audited mutation groups include project/settings administration plus run/test assignment, defect link/unlink/push, saved report definition changes, and scheduled report create/update/delete/manual-run requests.

## Automation Upload Endpoints
- `POST /api/automation/runs`
- `POST /api/automation/runs/{runId}/results`
- `POST /api/automation/results/bulk`
- `POST /api/automation/uploads/{uploadId}/retry`

CI metadata fields (for automation endpoints and optionally run/result metadata):
- `external_run_id`
- `ci_provider`
- `ci_build_id`
- `job_url`
- `commit_sha`
- `branch`
- `attempt`

### Bulk Upload Request (example)
```json
{
  "results": [
    {
      "case_id": 101,
      "status": "passed",
      "comment": "Playwright automation passed",
      "elapsed": "12s",
      "version": "build-20260427.1"
    },
    {
      "case_id": 102,
      "status": "failed",
      "comment": "Cart API returned 500",
      "elapsed": "8s",
      "version": "build-20260427.1",
      "defects": ["JIRA-777"],
      "step_results": [
        {
          "step_order": 1,
          "status": "passed",
          "actual": "Entered PDP"
        },
        {
          "step_order": 2,
          "status": "failed",
          "actual": "POST /cart returned 500"
        }
      ]
    }
  ]
}
```

### Bulk Upload Response (example)
```json
{
  "run_id": 5001,
  "atomic": false,
  "total": 3,
  "saved": 2,
  "failed": 1,
  "items": [
    { "index": 0, "case_id": 101, "status": "saved", "test_id": 7001, "result_id": 9001 },
    { "index": 1, "case_id": 102, "status": "saved", "test_id": 7002, "result_id": 9002 },
    { "index": 2, "case_id": 999, "status": "failed", "error_code": "CASE_NOT_FOUND_IN_RUN", "message": "case_id 999 was not found in run 5001" }
  ]
}
```

### Partial Failure Policy
- `atomic=true`: pre-validate items first; if any item fails validation, rollback all writes and return `400 BULK_VALIDATION_FAILED`.
- `atomic=false`: save valid items, return failed items with per-item errors.

`BULK_VALIDATION_FAILED` error shape:
```json
{
  "error": {
    "code": "BULK_VALIDATION_FAILED",
    "message": "atomic bulk rejected (...issues...)",
    "details": {
      "issues": [
        {
          "index": 2,
          "caseId": "999",
          "code": "CASE_NOT_FOUND_IN_RUN",
          "message": "case 999 not found in run 5001"
        }
      ]
    }
  }
}
```

### Matching Strategy for Automation
- Preferred order:
  1) explicit `test_id` when provided
  2) `case_id` inside target run
  3) `automation_key`
  4) `external_id`
- If multiple matches are found, return deterministic conflict error.

## Status and Compatibility
- Internal status set:
  - `untested`, `passed`, `failed`, `blocked`, `retest`
- Compatibility mapping:
  - `1 -> passed`
  - `2 -> blocked`
  - `3 -> untested`
  - `4 -> retest`
  - `5 -> failed`

## TestInstance Naming Rule
- Internal domain canonical term: `TestInstance`.
- API/UI short alias: `Test`.
- `testId` always maps to `test_instances.id`.

## TestRail-like Adapter

Index (supported vs deferred):

- `GET /api/v2` — returns `supported` and `deferred` endpoint lists for migration clients.

### Supported read endpoints

- `GET /api/v2/get_projects`
- `GET /api/v2/get_case/{case_id}`
- `GET /api/v2/get_cases/{project_id}` (query: `suite_id`, `section_id`)
- `GET /api/v2/get_suites/{project_id}`
- `GET /api/v2/get_sections/{project_id}` (query: **`suite_id` required**)
- `GET /api/v2/get_milestones/{project_id}` (DB mode; empty array in memory mode)
- `GET /api/v2/get_plans/{project_id}` (DB mode; empty array in memory mode)
- `GET /api/v2/get_statuses` (query: optional `project_id` for project custom status labels)
- `GET /api/v2/get_configs/{project_id}` (DB mode; configuration groups with `configs`)
- `GET /api/v2/get_case_fields/{project_id}` (DB mode; active case custom fields)
- `GET /api/v2/get_result_fields/{project_id}` (DB mode; active result custom fields)
- `GET /api/v2/get_templates/{project_id}` (DB mode; active case templates)
- `GET /api/v2/get_users` (DB mode; active users)
- `GET /api/v2/get_users/{project_id}` (DB mode; project members)
- `GET /api/v2/get_reports/{project_id}` (DB mode; saved report definitions)
- `GET /api/v2/get_roles` (static project role catalog)
- `GET /api/v2/get_attachments_for_case/{case_id}` (DB mode; live case attachments)
- `GET /api/v2/get_attachments_for_result/{result_id}` (DB mode; result attachments)
- `GET /api/v2/get_run/{run_id}`
- `GET /api/v2/get_tests/{run_id}`

### Supported write endpoints

- `POST /api/v2/add_case/{section_id}`
- `POST /api/v2/update_case/{case_id}`
- `POST /api/v2/add_run/{project_id}`
- `POST /api/v2/run_report/{report_id}` (DB mode; executes a saved report as CSV export and returns job/download URLs)
- `POST /api/v2/add_result_for_case/{run_id}/{case_id}`
- `POST /api/v2/add_results_for_cases/{run_id}`

### Deferred (not implemented)

Suite/section mutations, run close/update, labels/groups/shared steps, richer role permissions, and other TestRail catalog endpoints — see `GET /api/v2` `deferred` array in the running server.

Adapter rules:
- No duplicated business logic in adapter handlers.
- Adapter maps payloads/status codes and delegates to internal services.
- Adapter is a compatibility layer, not the canonical product API.

Current baseline:
- Implemented under `/api/v2` for cases, runs, tests, results, suites, sections, milestones, plans, statuses, configurations, custom fields, templates, users, saved reports, roles, attachments, and saved-report CSV execution.
- List endpoints return **JSON arrays** (not TestRail 9.x `{ offset, limit, suites: [...] }` wrappers).
- Accepts TestRail-style `status_id`, `case_id`, `suite_id`, `include_all`, and `case_ids` where applicable.
- `get_statuses?project_id=` returns project custom statuses when DB-backed; includes `custom_status_id` on each row when mapped from `CustomStatus`.
- Mutating adapter endpoints reuse project membership authorization and existing domain services.
- Remaining compatibility work: pagination wrappers, token scopes, labels/groups/shared steps, richer role permissions, suite/section mutations, run close/update, and other deferred endpoints per `GET /api/v2`.

## Metadata Field Strategy
- `test_runs.metadata` and/or `test_results.metadata` can store CI and uploader context in `jsonb`.
- Keep top-level required fields explicit; use metadata for optional provider-specific fields.

## Result Explorer
- `GET /api/projects/{projectId}/reports/results-explorer`

Query filters:
- `runId`, `caseId`, `testId`
- `status`, `source`
- `createdFrom`, `createdTo`
- `q`
- `custom_{systemName}` for active result custom field exact-match filtering.

## Traceability / Coverage
- `GET /api/projects/{projectId}/requirements`
- `POST /api/projects/{projectId}/requirements`
- `PATCH /api/requirements/{requirementId}`
- `DELETE /api/requirements/{requirementId}`
- `POST /api/cases/{caseId}/requirements/{requirementId}`
- `DELETE /api/cases/{caseId}/requirements/{requirementId}`
- `GET /api/projects/{projectId}/reports/traceability`
- `GET /api/projects/{projectId}/reports/coverage-gap`

Current baseline:
- Requirement CRUD is project-scoped with soft-delete behavior.
- Requirement status uses `active`, `changed`, `deprecated`.
- Case-requirement linking validates that both entities belong to the same project.
- `GET /api/projects/{projectId}/reports/traceability` baseline returns requirement -> case -> latest run/test/result context (including defect keys).
- `GET /api/projects/{projectId}/reports/coverage-gap` baseline returns requirement coverage classification (`uncovered`, `untested`, `covered`, `at_risk`).
- `GET /api/projects/{projectId}/reports/defect-coverage` baseline returns requirement-level defect linkage summary (`atRiskResultCount`, `linkedDefectCount`, `defectCoverage`).

Requirement fields:
- `key`: project-unique display key such as `REQ-100`.
- `title`
- `description`
- `status`
- `externalUrl`

Coverage semantics:
- A requirement is uncovered when it has no linked active test cases.
- A requirement is untested when linked cases exist but no active/open run has a non-untested latest result.
- A requirement is at risk when any linked latest result is `failed`, `blocked`, or `retest`.

## Defect Integration
- `GET /api/projects/{projectId}/integrations/defects`
- `PATCH /api/projects/{projectId}/integrations/defects`
- `POST /api/results/{resultId}/defects`
- `GET /api/results/{resultId}/defects`
- `DELETE /api/results/{resultId}/defects/{defectLinkId}`
- `POST /api/results/{resultId}/defects/push`

Defect integration semantics:
- `defects` string arrays on `test_results` are compatibility metadata only.
- Canonical defect links live in `result_defect_links`.
- Provider settings define URL templates and optional push/create behavior.
- Baseline provider support can start with URL-template-only links.
- Current baseline:
  - Project-level defect integration settings persist in `DefectIntegrationSetting` (`provider`, `isEnabled`, `issueUrlTemplate`, `defaultProjectKey`).
  - `POST /api/results/{resultId}/defects/push` creates or reactivates a canonical defect link and derives URL from `issueUrlTemplate` with `{key}` replacement when configured.
  - `DELETE /api/results/{resultId}/defects/{defectLinkId}` soft-deletes the canonical link.

## Import / Export
- `POST /api/projects/{projectId}/cases/import/csv`
- `GET /api/projects/{projectId}/import-jobs`
- `GET /api/projects/{projectId}/cases/export/csv`
- `GET /api/projects/{projectId}/runs/{runId}/results/export/csv`
- `GET /api/projects/{projectId}/export-jobs`
- `POST /api/projects/{projectId}/reports/export`
- `GET /api/projects/{projectId}/reports/export`
- `GET /api/projects/{projectId}/export-jobs/{jobId}/download`

CSV case import baseline:
- Supports section path, title, preconditions, priority, type, refs, labels, automation key, external id, steps.
- Current API baseline accepts JSON body with `csv`, `dryRun`, `atomic`, and optional `sectionId`.
- Supports dry-run validation before commit.
- Returns row-level validation errors.
- Does not partially import invalid rows unless `atomic=false` is explicitly provided.
- Case export and run result export return `text/csv` and create completed export job records.
- Case and result custom values are exported as `custom_{systemName}` columns where active custom fields exist; result custom columns are included in run result CSV exports and `results_explorer` report CSV exports.
- Report export supports `run_summary`, `results_explorer`, `traceability`, `coverage_gap`, and `defect_coverage` as CSV.
- `POST /reports/export` creates an export job and returns a download URL; the baseline generates CSV on download and marks the job completed.
- `GET /reports/export` is a compatibility shortcut that immediately returns CSV and records a completed export job.

Saved reports:
- `GET /api/projects/{projectId}/saved-reports`
- `POST /api/projects/{projectId}/saved-reports`
- `PATCH /api/projects/{projectId}/saved-reports/{savedReportId}`
- `DELETE /api/projects/{projectId}/saved-reports/{savedReportId}`

Scheduled reports:
- `GET /api/projects/{projectId}/scheduled-reports`
- `POST /api/projects/{projectId}/scheduled-reports` — body: `name`, `intervalMinutes`, `recipientEmails[]`, optional `savedReportId`, optional `reportType`, optional `filters`.
- `PATCH /api/projects/{projectId}/scheduled-reports/{scheduledReportId}` — `name`, `intervalMinutes`, `recipientEmails`, `enabled`.
- `DELETE /api/projects/{projectId}/scheduled-reports/{scheduledReportId}`
- `POST /api/projects/{projectId}/scheduled-reports/{scheduledReportId}/run` — manual run; creates export job, queues email per recipient, activity `report.schedule_run` / `report.schedule_email_sent`.

## Notifications / Activity
- `GET /api/notifications`
- `PATCH /api/notifications/preferences`
- `GET /api/projects/{projectId}/activity`
- `GET /api/runs/{runId}/activity`
- `GET /api/cases/{caseId}/activity`

Activity event semantics:
- Domain events should be written for:
  - case created/updated/deleted
  - case version restored
  - run created/closed
  - result added
  - assignment changed
  - attachment added/deleted
  - defect linked/unlinked
- Activity endpoints return a paged feed sorted by newest first.
- Notifications are derived from selected activity events and user preferences.
