# Next Actions

Last aligned: 2026-05-01

This is the current implementation queue after reviewing the docs and codebase. It now includes the actionable workflow items that previously lived in `CORE_FEATURE_COMPLETION_PLAN.md`.

## Immediate Priority

1. Activity events and notification inbox
   - Baseline done: `ActivityEvent`, `Notification`, and `NotificationPreference` persistence.
   - Baseline done: activity writer helper, project activity API, notification inbox API, preferences API.
   - Baseline done: UI routes for Activity and Notifications, plus shell/settings entry points.
   - Follow-up: broaden event coverage, add email/digest delivery jobs, add richer notification targeting, and add activity drilldown links.

2. Result custom field values
   - Baseline done: `CustomField.scope` separates case and result fields.
   - Baseline done: `TestResult.customValues` persists validated result values for manual/API/bulk result entry.
   - Baseline done: `ResultEntryPanel`, result history, and result explorer render result custom values.
   - Baseline done: `ResultEntryPanel` normalizes elapsed input, uses defect key chips, and shows field-level validation messaging.
   - Follow-up: add export columns, richer field types, timer controls, and broader result form quality improvements.

3. Case version compare and restore UI
   - Baseline done: `GET /api/cases/:caseId/versions/:versionId`.
   - Baseline done: expanded case detail shows version timeline and field/step comparison.
   - Baseline done: restore flow uses optimistic locking and creates a new version snapshot.
   - Follow-up: richer visual diffs, restore conflict messaging, attachment snapshot context, and dedicated version detail drawer.

4. Webhook delivery model
   - Baseline done: persisted webhook subscriptions with event filters and secrets.
   - Baseline done: activity events enqueue signed webhook delivery attempts.
   - Baseline done: settings UI can create, toggle, delete, inspect attempts, and mark attempts for retry.
   - Follow-up: background HTTP delivery worker, exponential backoff, response capture, manual test-send, and richer audit filters.

5. Report detail pages
   - Promote traceability, coverage gap, defect coverage, run summary, and result explorer reports from widgets/API baselines into drilldown pages.
   - Standardize filters, exports, source links, and empty/error states.

## Workflow Completion Backlog

### Test Case Management

- Case version compare and restore
  - Version detail API, restore behavior, timeline, basic field/step comparison, and restore confirmation are baseline done.
  - Remaining work: richer visual diffs, stale-conflict messaging in the UI, attachment context, and dedicated version detail drawer.

- Bulk case operations and saved views
  - Add multi-select case list UX.
  - Support bulk move, delete/archive, field updates, labels/refs/custom field changes, and per-case success/failure feedback.
  - Add saved case filters/views per user/project.

- Case step images and rich authoring
  - Extend attachment usage to cases and case steps.
  - Add upload/open/preview/delete controls for step images.
  - Preserve enough attachment context in version snapshots for historical authored content.

- Case custom values follow-up
  - Case custom value persistence, form rendering, and version snapshot inclusion are baseline done.
  - Remaining work: import/export columns, active-field validation, required-field UI validation, optional list columns/chips, and template-aware form ordering.

### Test Execution

- Result custom field values
  - Result-scoped field definitions, storage, validation, result history display, and result explorer display are baseline done.
  - Result entry now includes field-level client validation messaging.
  - Remaining work: export columns, richer field types, and normalized reporting/filtering.

- Result form quality
  - Elapsed parser/normalizer is baseline done.
  - Defect key chips are baseline done.
  - Add timer controls.
  - Support richer step result editing beyond a single shortcut row.
  - Split `ResultEntryPanel` into smaller pieces such as `StatusPicker`, `StepResultEditor`, `ResultMetadataFields`, `EvidenceQuickAttach`, and `DefectQuickLink`.

- Run detail workspace
  - Add `RunHeader`, `RunSummaryBar`, `TestInstanceFilterBar`, and `TestInstanceTable`.
  - Keep selected test/filter state in URL query params.
  - Add result history pagination per selected test.
  - Improve bulk result entry, close/reopen warnings, and scoped cache invalidation.

- Assignment and to-do workflow
  - Expand `assigned-to-me` filters by project, run, status, due date, and milestone where available.
  - Improve `MyTestsPage` into a true to-do view with status counts, aging, and direct execution shortcuts.

### Reporting And Traceability

- Report detail pages
  - Add routes for run summary, results, traceability, coverage gap, and defect coverage reports.
  - Add filter bars, summary strips, table/chart bodies, export actions, and drilldown links.
  - Move report API calls into narrower report modules over time.

- Saved reports and report jobs
  - Add saved report definitions with type, filters, owner, visibility, and later schedule.
  - Reuse existing export job infrastructure where practical.
  - Add report history/download UI.

- Milestone and plan reporting
  - Add milestone and plan summary reports.
  - Add filters by milestone, plan, configuration, status, and assignee.
  - Add rollups by configuration group/value and plan entry.

### Evidence, Defects, Automation

- Evidence UX hardening
  - Finalize object storage lifecycle and authorization.
  - Add preview drawer, upload progress, retry, and consistent open/delete behavior.
  - Reuse the same attachment primitives for result evidence and case-step images.

- Defect provider workflow
  - Add provider validation and optional remote create/push.
  - Store provider response metadata and status snapshots where supported.
  - Add test-connection and template-preview UX in defect integration settings.

- Automation usability
  - Add token scopes/expiration enforcement and clearer token creation UX.
  - Add upload retry queue semantics.
  - Add mapping health and row-level failure guidance.

### UI System

- Standardize shared components: `Button`, `IconButton`, `StatusBadge`, `DataTable`, `FilterBar`, `PageHeader`, `Panel`, `Drawer`, and `Toast`.
- Keep operational screens dense, scannable, and table-oriented where lists can grow.
- Move lower-frequency settings/admin categories into a settings sidebar as project tabs become crowded.
- Add notification/inbox entry in the shell/header.
- Centralize query keys per feature and avoid broad project invalidation after narrow mutations.

## Recommended Implementation Batches

1. Activity and notifications
   - Baseline done: activity event persistence and writer helpers.
   - Baseline done: project activity API.
   - Baseline done: notification preferences, inbox, and unread indicator.
   - Remaining: delivery jobs, richer targeting, and broader event coverage.

2. Result custom values and result form quality
   - Baseline done: result custom field storage/rendering.
   - Baseline done: elapsed parser/normalizer.
   - Baseline done: defect key chips and field-level validation messaging.
   - Remaining: timer controls and richer step result editor.

3. Case version UI
   - Baseline done: version detail/compare API.
   - Baseline done: restore API.
   - Baseline done: timeline/basic diff UI and conflict-safe restore.

4. Run detail UX upgrade
   - Run header/summary/filter/table components.
   - Query-driven selected test.
   - Result history pagination and scoped cache invalidation.

5. Report detail pages
   - Report routes, filter bars, exports, and drilldown links.

6. Webhook delivery model
   - Baseline done: persisted subscriptions.
   - Baseline done: event taxonomy.
   - Baseline done: signed delivery attempts, retry state, and settings UI.
   - Remaining: delivery worker, exponential backoff, response capture, test-send, and richer audit filters.

7. Bulk case operations and saved views
   - Multi-select case list.
   - Bulk move/update/archive.
   - Saved filters/views.

8. Case step images and evidence hardening
   - Case/case-step attachment routes.
   - Upload, preview, open, delete, and version reference strategy.

## Cleanup Follow-Ups

- Revisit [API_SPEC.md](./API_SPEC.md) after each implementation batch and mark endpoints as implemented, partial, or planned.
- Revisit [COMPONENT_MAP.md](./COMPONENT_MAP.md) when granular run/result/report components are split out of large page components.
- Keep [ROADMAP.md](./ROADMAP.md) status dates current.

## Deferred

- Full users/groups/global roles administration.
- Expanded `/api/v2` compatibility beyond core case/run/test/result automation endpoints.
- Large async import/export lifecycle beyond the current baseline.
- Provider-native Jira/GitHub/Azure defect creation beyond URL-template push baseline.
- Shared steps, labels, BDD/scenario support, and advanced TestRail migration categories.
