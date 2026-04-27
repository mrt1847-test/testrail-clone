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
- Pagination: `page`, `page_size`, with stable sort defaults.

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

## Runs
- `GET /api/projects/{projectId}/runs`
- `POST /api/projects/{projectId}/runs`
- `GET /api/runs/{runId}`
- `PATCH /api/runs/{runId}`
- `POST /api/runs/{runId}/close`

## Tests (Instances)
- `GET /api/runs/{runId}/tests`
- `GET /api/tests/{testId}`
- `PATCH /api/tests/{testId}`

## Results
- `GET /api/tests/{testId}/results`
- `POST /api/tests/{testId}/results`
- `POST /api/runs/{runId}/results/by-case`
- `POST /api/runs/{runId}/results/bulk`
- `GET /api/runs/{runId}/results`

Semantics:
- `POST /api/tests/{testId}/results`: add result directly to a specific test instance.
- `POST /api/runs/{runId}/results/by-case`: resolve test instance by `case_id` within the run, then add result.
- `POST /api/runs/{runId}/results/bulk`: upload multiple results in one request.

## Plans
- `GET /api/projects/{projectId}/plans`
- `POST /api/projects/{projectId}/plans`
- `GET /api/plans/{planId}`
- `PATCH /api/plans/{planId}`
- `DELETE /api/plans/{planId}`

## Milestones
- `GET /api/projects/{projectId}/milestones`
- `POST /api/projects/{projectId}/milestones`
- `GET /api/milestones/{milestoneId}`
- `PATCH /api/milestones/{milestoneId}`
- `DELETE /api/milestones/{milestoneId}`

## Attachments
- `POST /api/attachments`
- `GET /api/attachments/{attachmentId}`
- `DELETE /api/attachments/{attachmentId}`

## Auth / API Tokens
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/tokens`
- `POST /api/tokens`
- `DELETE /api/tokens/{tokenId}`

## Automation Upload Endpoints
- `POST /api/automation/runs`
- `POST /api/automation/runs/{runId}/results`
- `POST /api/automation/results/bulk`

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
- `atomic=true`: if any item fails, rollback all writes and return failure summary.
- `atomic=false`: save valid items, return failed items with per-item errors.

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

## TestRail-like Adapter (Future)
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
- Adapter remains a later-phase integration layer after automation upload API maturity.

## Metadata Field Strategy
- `test_runs.metadata` and/or `test_results.metadata` can store CI and uploader context in `jsonb`.
- Keep top-level required fields explicit; use metadata for optional provider-specific fields.
