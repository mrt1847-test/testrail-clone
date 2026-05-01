# Next Actions

Last aligned: 2026-05-02

This is the current implementation queue after reviewing the docs and codebase. It now includes the actionable workflow items that previously lived in `CORE_FEATURE_COMPLETION_PLAN.md`.

Feature-by-feature implementation status is tracked in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md). Update that checklist whenever a feature is completed, downgraded, or newly identified as missing.

## Execution Policy

Use this default execution loop for implementation work:

1. Select the current implementation scope from [NEXT_ACTIONS.md](./NEXT_ACTIONS.md).
2. After implementation, update `[x]/[ ]` status in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md).
3. Update phase-level status in [ROADMAP.md](./ROADMAP.md) only when needed.

Working rules:
- Treat [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) as the execution source for "what to build next."
- Treat [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) as the source of truth for implemented vs partial vs missing capability.
- Keep [ROADMAP.md](./ROADMAP.md) concise and phase-oriented; avoid duplicating detailed execution backlog there.

## PR6 Structural Refactor Sync

- Baseline done:
  - `advancedApi` responsibilities were split into domain-focused API modules (settings/planning/automation/import-export and related project API surfaces).
  - `settings.routes` was split into domain route modules (`customFields`, `statuses`, `members`, `templates`, `webhooks`, `audit`) to reduce route-file sprawl.
  - shared report metrics logic was extracted and reused by both `reports` and `importExport` routes.
  - route-service boundaries improved in refactored modules by moving business/data orchestration out of route handlers.
  - `RunDetailPage` workflow was decomposed into focused hooks/components for URL state, query orchestration, bulk actions, and result entry composition.
- Remaining debt:
  - finish removing direct Prisma/data orchestration from remaining route-heavy baseline modules.
  - continue query-key and invalidation hardening across the decomposed run detail surface.
  - keep converging report/import-export consumers onto shared metric primitives and avoid route-local drift.

## TestRail-Like Flow Priority

The implementation order should follow the daily TestRail workflow:

1. Build and maintain the case repository.
2. Compose runs from suites, sections, and selected cases.
3. Execute tests efficiently and record evidence/results.
4. Review run/report outcomes and trace risk back to requirements/cases/defects.
5. Notify people and integrations from those workflow events.
6. Expand admin, compatibility, and advanced migration depth after the core flow is dependable.

## Immediate Priority

1. Run case selection and run composition
   - Current baseline: run creation supports all cases, all cases with explicit excluded `caseIds`, or an explicit flat `caseIds` selection.
   - Missing P0: section-level include/exclude during run creation.
   - Missing P0: add/remove cases after run creation with clear rules for closed runs and existing results.
   - Missing P0: grouped selection UX by section, selected/excluded counts, and validation before creating the run.
   - Follow-up: record run composition changes in activity/audit logs and expose source links back to sections/cases.

2. Run execution workspace
   - Current baseline: run detail can list/filter/page instances, select tests via URL state, enter results, attach evidence, link defects, and close runs.
   - Baseline done: decomposition into focused hooks/components (`useRunUrlState`, `useRunDetailQueries`, `useRunBulkActions`, result-entry subcomponents) reduced `RunDetailPage` coupling.
   - Missing P0: componentized run header, summary bar, filter bar, and stable test table for large daily execution.
   - Missing P0: result history pagination per selected test.
   - Missing P0: clearer close/reopen policy and warnings.
   - Missing P0: scoped cache invalidation after result and assignment changes.

3. Case repository productivity
   - Current baseline: case/section CRUD, case steps, custom values, version history, restore, and bulk delete exist.
   - Missing P0: bulk move/update/archive beyond delete.
   - Missing P0: saved case filters/views and richer list filters.
   - Missing P1: required-field UI validation, case list custom-value presentation, and template-aware form ordering.

4. Report detail pages and risk review
   - Current baseline: run summary, result explorer, traceability, coverage gap, and defect coverage APIs/exports exist.
   - Missing P0: drilldown pages with filters, summary strips, table/chart bodies, export actions, and source links.
   - Missing P1: milestone and plan summary reports.

5. Activity events and notification inbox
   - Baseline done: `ActivityEvent`, `Notification`, and `NotificationPreference` persistence.
   - Baseline done: activity writer helper, project activity API, notification inbox API, preferences API.
   - Baseline done: UI routes for Activity and Notifications, plus shell/settings entry points.
   - Missing P0: broader event coverage for case, run composition, execution, reporting, assignment, and defect workflows.
   - Missing P0: richer notification targeting and activity drilldown links.
   - Follow-up: email/digest delivery jobs.

6. Result custom field values
   - Baseline done: `CustomField.scope` separates case and result fields.
   - Baseline done: `TestResult.customValues` persists validated result values for manual/API/bulk result entry.
   - Baseline done: `ResultEntryPanel`, result history, and result explorer render result custom values.
   - Baseline done: `ResultEntryPanel` normalizes elapsed input, includes timer controls, uses defect key chips, supports case-step-aware multi-step result editing, shows field-level validation messaging, and is split into focused subcomponents.
   - Baseline done: result custom values are included as `custom_{systemName}` columns in run result and result explorer CSV exports.
   - Baseline done: result explorer supports active result custom field exact-match filters via `custom_{systemName}` query params and UI controls.
   - Baseline done: boolean custom field type definition, validation, case/result form rendering, import parsing, and result explorer filtering.
   - Follow-up: add richer field types beyond boolean and broader result form/reporting quality improvements.

7. Case version compare and restore UI
   - Baseline done: `GET /api/cases/:caseId/versions/:versionId`.
   - Baseline done: expanded case detail shows version timeline and field/step comparison.
   - Baseline done: restore flow uses optimistic locking and creates a new version snapshot.
   - Follow-up: richer visual diffs, restore conflict messaging, attachment snapshot context, and dedicated version detail drawer.

8. Webhook delivery model
   - Baseline done: persisted webhook subscriptions with event filters and secrets.
   - Baseline done: activity events enqueue signed webhook delivery attempts.
   - Baseline done: settings UI can create, toggle, delete, inspect attempts, and mark attempts for retry.
   - Follow-up: background HTTP delivery worker, exponential backoff, response capture, manual test-send, and richer audit filters.

## Workflow Completion Backlog

### Test Case Management

- Case version compare and restore
  - Version detail API, restore behavior, timeline, basic field/step comparison, and restore confirmation are baseline done.
  - Remaining work: richer visual diffs, stale-conflict messaging in the UI, attachment context, and dedicated version detail drawer.

- Bulk case operations and saved views
  - Baseline done: multi-select case list UX with project-scoped bulk delete.
  - Baseline done: bulk delete returns per-case success/failure feedback and records a bulk activity event.
  - Remaining work: bulk move, archive/restore semantics, field updates, labels/refs/custom field changes, richer partial-failure UI, and saved filters/views.
  - Add saved case filters/views per user/project.

- Case step images and rich authoring
  - Extend attachment usage to cases and case steps.
  - Add upload/open/preview/delete controls for step images.
  - Preserve enough attachment context in version snapshots for historical authored content.

- Case custom values follow-up
  - Case custom value persistence, form rendering, version snapshot inclusion, CSV import/export columns, and active-field import validation are baseline done.
  - Remaining work: required-field UI validation, optional list columns/chips, and template-aware form ordering.

### Test Execution

- Run case selection and composition
  - Current baseline: create run from all cases in a suite, all-with-case-exclusions, or from a flat manually selected case list.
  - Remaining work: section-level include/exclude, add/remove cases after run creation, closed-run restrictions, existing-result safeguards, grouped section UI, and composition activity/audit events.

- Result custom field values
  - Result-scoped field definitions, storage, validation, result history display, and result explorer display are baseline done.
  - Result entry now includes field-level client validation messaging.
  - Result custom values are included in run result and result explorer CSV exports.
  - Result explorer supports active result custom field exact-match filters.
  - Boolean custom field type is baseline done for definitions, validation, forms, import parsing, and result explorer filtering.
  - Remaining work: richer field types beyond boolean and advanced reporting/filtering semantics.

- Result form quality
  - Elapsed parser/normalizer is baseline done.
  - Timer controls are baseline done.
  - Defect key chips are baseline done.
  - Multi-step result editing with per-step status, actual result, and comment is baseline done.
  - Case-step context in the result editor is baseline done.
  - `ResultEntryPanel` is split into focused pieces for elapsed timing, defect keys, custom fields, and step results.

- Run detail workspace
  - Baseline done: query/url/bulk-action concerns were split into dedicated hooks and result entry is decomposed into focused subcomponents.
  - Add `RunHeader`, `RunSummaryBar`, `TestInstanceFilterBar`, and `TestInstanceTable`.
  - Selected test, filter, search, and page state in URL query params are baseline done.
  - Add result history pagination per selected test.
  - Improve bulk result entry, close/reopen warnings, and scoped cache invalidation.

- Assignment and to-do workflow
  - Expand `assigned-to-me` filters by project, run, status, due date, and milestone where available.
  - Improve `MyTestsPage` into a true to-do view with status counts, aging, and direct execution shortcuts.

### Reporting And Traceability

- Report detail pages
  - Add routes for run summary, results, traceability, coverage gap, and defect coverage reports.
  - Add filter bars, summary strips, table/chart bodies, export actions, and drilldown links.
  - Baseline done: shared report metrics extraction is reused by report/import-export routes to reduce duplication.
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

1. Run case selection and composition
   - Section-grouped run creation UI.
   - Include/exclude model for cases and sections.
   - Existing run add/remove cases API/UI with closed-run and result-history safeguards.

2. Run execution workspace
   - Run header, summary bar, filter bar, and test instance table components.
   - Result history pagination and scoped cache invalidation.
   - Close/reopen policy and warnings.

3. Case repository productivity
   - Bulk move/update/archive.
   - Saved filters/views.
   - Rich case filters and case list columns.

4. Report detail pages
   - Report routes, filter bars, exports, and drilldown links.

5. Activity and notifications
   - Baseline done: activity event persistence and writer helpers.
   - Baseline done: project activity API.
   - Baseline done: notification preferences, inbox, and unread indicator.
   - Remaining: broader event coverage, richer targeting, drilldown links, and delivery jobs.

6. Result custom values and result form quality
   - Baseline done: result custom field storage/rendering.
   - Baseline done: result custom value CSV export columns.
   - Baseline done: result explorer custom value filters.
   - Baseline done: boolean custom field type.
   - Baseline done: elapsed parser/normalizer.
   - Baseline done: elapsed timer controls.
   - Baseline done: defect key chips, case-step-aware multi-step result editor, and field-level validation messaging.
   - Baseline done: `ResultEntryPanel` component split.
   - Remaining: richer field types beyond boolean and advanced reporting/filtering semantics.

7. Case version UI
   - Baseline done: version detail/compare API.
   - Baseline done: restore API.
   - Baseline done: timeline/basic diff UI and conflict-safe restore.

8. Webhook delivery model
   - Baseline done: persisted subscriptions.
   - Baseline done: event taxonomy.
   - Baseline done: signed delivery attempts, retry state, and settings UI.
   - Remaining: delivery worker, exponential backoff, response capture, test-send, and richer audit filters.

9. Case step images and evidence hardening
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
