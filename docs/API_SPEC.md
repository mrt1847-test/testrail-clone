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
- `POST /api/cases/{caseId}/steps`
- `PATCH /api/case-steps/{stepId}`
- `DELETE /api/case-steps/{stepId}`

Case optimistic locking (phase 2 baseline):
- `PATCH /api/cases/{caseId}` accepts either:
  - request body `expectedVersion` (preferred), or
  - `If-Match` header with version number (example: `If-Match: "3"`).
- Server stores and increments `lockVersion` on every successful case update.
- If expected version does not match current `lockVersion`, server returns `409 CONFLICT`.
- `GET /api/cases/{caseId}/versions`
- `GET /api/cases/{caseId}/versions/{versionId}` (planned)
- `POST /api/cases/{caseId}/versions/{versionId}/restore` (planned)
- `PATCH /api/cases/{caseId}/assignee`

Semantics (case steps):
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

## Runs
- `GET /api/projects/{projectId}/runs`
- `POST /api/projects/{projectId}/runs`
- `GET /api/runs/{runId}`
- `GET /api/projects/{projectId}/runs/{runId}`
- `GET /api/projects/{projectId}/runs/{runId}/instances`
- `PATCH /api/runs/{runId}`
- `POST /api/runs/{runId}/close`
- `POST /api/runs/{runId}/rerun`

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
- `GET /api/v2/get_case/{case_id}`
- `GET /api/v2/get_cases/{project_id}`
- `POST /api/v2/add_case/{section_id}`
- `POST /api/v2/update_case/{case_id}`
- `GET /api/v2/get_run/{run_id}`
- `POST /api/v2/add_run/{project_id}`
- `GET /api/v2/get_tests/{run_id}`
- `POST /api/v2/add_result_for_case/{run_id}/{case_id}`
- `POST /api/v2/add_results_for_cases/{run_id}`

Adapter rules:
- No duplicated business logic in adapter handlers.
- Adapter maps payloads/status codes and delegates to internal services.
- Adapter is a compatibility layer, not the canonical product API.

Current baseline:
- Implemented under `/api/v2` for the listed core case, run, test, and result endpoints.
- Accepts TestRail-style `status_id`, `case_id`, `suite_id`, `include_all`, and `case_ids` where applicable.
- Maps TestRail status IDs to internal statuses using the compatibility mapping below.
- Mutating adapter endpoints reuse project membership authorization and existing domain services.
- Remaining compatibility work includes richer TestRail response parity, pagination shape parity, token-scope examples, and non-core endpoints only when needed by migration/automation clients.

## Metadata Field Strategy
- `test_runs.metadata` and/or `test_results.metadata` can store CI and uploader context in `jsonb`.
- Keep top-level required fields explicit; use metadata for optional provider-specific fields.

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
- Report export supports `run_summary`, `results_explorer`, `traceability`, `coverage_gap`, and `defect_coverage` as CSV.
- `POST /reports/export` creates an export job and returns a download URL; the baseline generates CSV on download and marks the job completed.
- `GET /reports/export` is a compatibility shortcut that immediately returns CSV and records a completed export job.

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
