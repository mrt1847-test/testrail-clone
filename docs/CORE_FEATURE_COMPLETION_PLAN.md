# Core Feature Completion Plan

Date: 2026-04-29

This plan narrows the broad TestRail parity work into the product areas that matter most for day-to-day use:

1. Test case management.
2. Test execution and result entry.
3. Result reporting and traceability.
4. The UI/UX glue needed to make those workflows feel complete.

The broader parity checklist remains in [TESTRail_GAP_ANALYSIS.md](./TESTRail_GAP_ANALYSIS.md). This document is the execution plan for turning the current MVP+ app into a strong practical test management tool before chasing every TestRail-compatible edge.

## Planning Principles

- Improve existing flows before adding more disconnected settings pages.
- Every backend capability should have a reachable UI path, useful empty/loading/error states, and clear navigation back to related work.
- Keep the project -> suite -> section -> case -> run -> test instance -> result history model intact.
- Prefer server-side pagination, filtering, and narrow projections for any list that can grow.
- Treat custom fields, versions, reports, and activity as workflow features, not just settings records.

## Current Baseline

Already strong enough to build on:

- Case CRUD, section tree, case steps, version persistence, optimistic locking baseline.
- Run creation, run detail, run instance pagination/filtering, manual result entry, result history, close-run protection.
- Bulk/manual/automation result baselines.
- Requirements, traceability, coverage gap, defect coverage report baselines.
- Milestones, plans, configurations, plan matrix and rollup baselines.
- Import/export CSV and report export job baselines.
- Custom field/status/template definition CRUD.
- Case custom field value persistence, case detail rendering, and version snapshot baseline.
- Audit log query UI.

Main issue: many capabilities exist as baselines but are not yet connected deeply into authoring, execution, reporting, and navigation.

## Workstream A: Test Case Management Completion

### A1. Custom Field Values On Cases

Goal: custom field definitions become usable in case authoring, not just configurable metadata.

Backend:
- `customValues` jsonb field on `test_cases` is now the baseline storage path.
- Validate values against active project custom field definitions.
- Include custom values in case detail, case list optional projection, CSV import/export, and version snapshots.
- Add filters for selected custom fields where practical.

UI/UX:
- Render active case-scoped custom fields inside `ExpandableCaseDetail` edit mode. (baseline done)
- Show important custom fields as optional list columns or compact metadata chips.
- Add template-aware form ordering: built-in fields and custom fields should follow the selected template field order.
- Use inline validation messages next to fields.

Existing improvements:
- Split the current large case detail UI into smaller pieces: `CaseMetaSummary`, `CaseStepEditor`, `CaseCustomFieldForm`.
- Add a visible unsaved/stale edit state for optimistic locking conflicts.
- Add better section/case empty states: no sections, no cases in selected section, no filter results.

Acceptance:
- A project admin can define a custom case field, create/edit a case with it, reload the page, and see the value.
- Case version history preserves the custom values.
- CSV export includes configured custom fields.

### A2. Case Version Compare And Restore

Goal: case history becomes an actual authoring safety feature.

Backend:
- Implement `GET /api/cases/:caseId/versions/:versionId`.
- Implement `POST /api/cases/:caseId/versions/:versionId/restore`.
- Restore should create a new version, not mutate/delete historical rows.
- Include custom values and steps in snapshots.

UI/UX:
- Add version history entry point from expanded case detail.
- Add `CaseVersionTimeline` and `CaseVersionDiff`.
- Show field-level and step-level differences.
- Restore action requires confirmation and handles stale case conflicts.

Existing improvements:
- Make case detail route query state support `mode=versions`.
- Preserve return context: after viewing versions, return to same section and expanded case.

Acceptance:
- User can inspect version differences and restore a previous version safely.

### A3. Bulk Case Operations And Saved Views

Goal: large suites become manageable.

Backend:
- Add bulk case mutation API, for example `POST /api/projects/:projectId/cases/bulk`.
- Support bulk move cases to another section.
- Support bulk delete/archive cases with clear soft-delete semantics.
- Support bulk update for priority, type, labels, refs, automation key, and custom fields.
- Return per-case success/failure results so partial failures are visible.
- Add atomic mode later if teams need all-or-nothing bulk changes.
- Saved case filters per user/project.

UI/UX:
- Add multi-select to case list.
- Add row checkboxes, select all visible, clear selection, and selected-count feedback.
- Add bulk action toolbar for move, update fields, delete/archive.
- Add confirmation dialogs for destructive bulk actions.
- Add per-field bulk edit dialog with "leave unchanged" defaults.
- Add saved filters/view selector near `CaseListToolbar`.
- Use clear count feedback and confirmation dialogs for destructive actions.

Existing improvements:
- Introduce a reusable `DataTable` primitive for selection, sorting, density, and empty states.
- Keep card-like decoration minimal; case management should be dense and scannable.
- Preserve current section/filter context after a bulk mutation.
- Add optimistic cache updates only where safe; otherwise refetch the affected section/list.

Acceptance:
- User can select many cases, move them to another section, update shared fields, delete/archive them, and save a reusable filtered view.
- Bulk delete clearly states the affected count and can be cancelled before mutation.

### A4. Case Step Images And Rich Authoring

Goal: test case steps can include visual instructions, not only plain text.

Current state:
- Case steps currently store only `content` and `expectedResult`.
- The case step edit UI currently uses plain textareas.
- Attachment upload/download exists for result evidence, but not for case or case-step authoring.

Backend:
- Extend the attachment model usage to support `entityType = "case"` and `entityType = "caseStep"` or add explicit case-step attachment routes.
- Add `GET /api/case-steps/:stepId/attachments`.
- Add `POST /api/case-steps/:stepId/attachments/presign` and metadata registration.
- Add `DELETE /api/case-steps/:stepId/attachments/:attachmentId`.
- Include case-step attachments in case detail or lazy-load them when a step editor opens.
- Ensure case version snapshots preserve enough image/attachment references to understand historical authored content.

UI/UX:
- Add image upload controls inside the case step editor.
- Support drag-and-drop or paste-to-upload for images where practical.
- Show inline thumbnails below the related step action/expected fields.
- Add preview/open/delete actions for each step image.
- Consider markdown insertion later, but keep the first implementation simple: attached images displayed with the step.

Existing improvements:
- Reuse result attachment upload primitives where possible.
- Add shared `AttachmentList`, `AttachmentUploader`, and `ImagePreviewDrawer` components.
- Keep upload progress and errors local to the step being edited.

Acceptance:
- User can add an image to a test case step, reload the case, preview the image, and delete it.
- Run creation preserves enough case-step image context for testers to follow authored instructions.

## Workstream B: Test Execution And Result Entry Completion

### B1. Result Custom Fields And Result Form Quality

Goal: execution forms can capture the project-specific data teams need.

Current state:
- Manual result entry already accepts status, comment, elapsed, version, comma-separated defect keys, and a basic step comment.
- Result history displays comment, elapsed, version, defects, step results, evidence attachments, and defect links.
- Defect links can be added after selecting a saved result, including provider selection such as Jira.
- Missing: elapsed timer, elapsed format validation, Jira-specific issue key UX, richer step result entry, and result custom fields.

Backend:
- Add result-scoped custom field definitions or scopes to existing custom fields.
- Store result custom values in `test_result_custom_values` or `test_results.customValues`.
- Validate values on manual and automation result entry.
- Include values in result history, result explorer, and exports.
- Add elapsed parser/normalizer so values like `90s`, `1m 30s`, and `00:01:30` are stored consistently.
- Keep raw elapsed input for audit/debug if normalization is lossy.

UI/UX:
- Extend `ResultEntryPanel` to render result-scoped custom fields.
- Keep the form compact; use collapsible advanced fields for less common metadata.
- Preserve user input on mutation errors.
- Use status-specific affordances: failed/retest should put comment, defects, evidence, and custom fields closer at hand.
- Add start/stop/reset timer controls that populate elapsed automatically.
- Add Jira/issue key input chips instead of a comma-separated text field.
- Validate and highlight likely issue keys such as `ABC-123`, while still allowing custom defect keys.
- Let users add/link a defect directly before or immediately after saving a failed result.
- Expand step result editing beyond a single hard-coded first step.

Existing improvements:
- Split `ResultEntryPanel` into `StatusPicker`, `StepResultEditor`, `ResultMetadataFields`, `EvidenceQuickAttach`, `DefectQuickLink`.
- Use consistent status badges and colors from custom status definitions.

Acceptance:
- Result custom values are saved, displayed in history, and exportable.
- Tester can time a test execution from the result panel and save normalized elapsed time.
- Tester can enter or push a Jira-style defect key without using a comma-separated raw text field.

### B2. Run Detail Workspace UX

Goal: run execution feels like a focused workbench, not a generic detail page.

Backend:
- Ensure run instance list supports all UI filters: status, assignee, section, priority, type, q.
- Add run reopen policy if product wants it.
- Add result history pagination per selected test.

UI/UX:
- Add `RunHeader`, `RunSummaryBar`, `TestInstanceFilterBar`, `TestInstanceTable`.
- Keep selected test state in query params so reload/share preserves context.
- Improve keyboard flow for rapid manual testing.
- Add bulk result entry affordance from selected instances.
- Add close/reopen warnings with counts and links to untested items.

Existing improvements:
- Normalize status display through a single `StatusBadge`.
- Reduce unnecessary project-wide invalidation after result entry.
- Use loading states per panel: run summary, instance table, result history, evidence/defects.

Acceptance:
- Tester can filter assigned failures, enter results, inspect history, attach evidence/link defects, and move to next test without losing context.

### B3. Assignment And To-Do Workflow

Goal: testers know what to work on next.

Backend:
- Add activity events for assignments and result writes.
- Expand `assigned-to-me` filters: project, run, status, due/milestone if available.
- Add optional notification generation for assignments and failures.

UI/UX:
- Improve `MyTestsPage` into a true to-do view.
- Add project/run shortcuts from assignments.
- Show counts by status and aging.
- Add notification inbox entry point in shell/header.

Existing improvements:
- Project tabs may become crowded; consider moving lower-frequency settings/admin into a settings sidebar while keeping execution tabs prominent.

Acceptance:
- Tester can open My Tests, filter actionable items, enter results, and see updates reflected in run detail.

## Workstream C: Reporting And Traceability Completion

### C1. Report Detail Pages And Drilldown

Goal: reports answer real questions and link back to source data.

Backend:
- Add server-side filters to traceability, coverage gap, defect coverage, run summary, failure trend.
- Add pagination where reports produce row sets.
- Add consistent CSV export for every report view with the same filters.

UI/UX:
- Add dedicated report detail routes:
  - `/projects/:projectId/reports/run-summary`
  - `/projects/:projectId/reports/results`
  - `/projects/:projectId/reports/traceability`
  - `/projects/:projectId/reports/coverage-gap`
  - `/projects/:projectId/reports/defect-coverage`
- Each report should have a filter bar, summary strip, table/chart, export action, and drilldown links.
- Drilldown links should preserve context: requirement -> case -> run/test/result.

Existing improvements:
- `ReportsPage` should become a dashboard/index, not the only report surface.
- Move report API calls into a dedicated `features/reports/api` module.
- Use shared table/chart wrappers for consistent empty/error states.

Acceptance:
- User can answer: what is failing, what is untested, what requirement is uncovered, and where is the evidence.

### C2. Saved Reports And Report Jobs

Goal: recurring reporting becomes operational.

Backend:
- Add `saved_reports` with type, filters, owner, visibility, schedule.
- Add report generation jobs and downloadable artifacts.
- Add report history.

UI/UX:
- Add save report action on report detail pages.
- Add report history/download list.
- Add schedule UI only after manual saved reports work.

Existing improvements:
- Reuse existing export jobs rather than creating a separate report job concept if possible.
- Make report export status visible in Import/Export or Reports.

Acceptance:
- User can save a filtered report and download generated output later.

### C3. Milestone And Plan Reporting

Goal: planning artifacts become useful for release risk decisions.

Backend:
- Add milestone summary and plan summary reports.
- Add filters by milestone, plan, configuration, status, assignee.
- Add rollups by configuration group/value and plan entry.

UI/UX:
- Add milestone detail report section with progress, failures, untested counts, defect links.
- Add plan detail report section with matrix rollup and drilldowns to runs/tests.
- Keep plan matrix dense and table-like.

Acceptance:
- User can review a milestone or plan and immediately identify untested, failing, and defect-linked areas.

## Workstream D: Evidence, Defects, And Automation Glue

### D1. Evidence UX Hardening

Goal: evidence is easy to add and inspect during result entry.

Backend:
- Finalize object storage lifecycle.
- Add metadata authorization and cleanup rules.
- Add upload/download error states.
- Generalize attachment ownership beyond results so cases and case steps can use the same storage lifecycle.

UI/UX:
- Add attachment preview drawer.
- Add upload progress and retry.
- Make evidence visible in result history and result detail.
- Reuse the same preview/open/delete affordances for result evidence and case-step images.

Acceptance:
- User can attach, preview, open, and delete evidence reliably.
- User can use the same attachment behavior consistently in result execution and case authoring.

### D2. Defect Provider Workflow

Goal: defect links are more than text.

Backend:
- Add provider validation and optional remote create/push.
- Store provider response metadata.
- Add sync/status snapshot where provider supports it.

UI/UX:
- Defect panel should show provider badge, external link, create/push feedback, duplicate warning.
- Defect integration settings should include test connection and template preview.

Acceptance:
- User can push/link a defect from a failed result and see it in defect coverage reports.

### D3. Automation Usability

Goal: automation upload is understandable and debuggable.

Backend:
- Add token scopes/expiration enforcement.
- Add upload retry queue semantics.
- Improve mapping diagnostics for automation key/external id conflicts.

UI/UX:
- Add mapping health table.
- Add failed upload detail with row-level resolution guidance.
- Add token creation UX that clearly shows scope and expiration.

Acceptance:
- Automation owner can create a token, upload results, diagnose failures, and retry resolved items.

## Workstream E: UI/UX System Improvements

### E1. Shared Components

Build or standardize:
- `Button`
- `IconButton`
- `StatusBadge`
- `DataTable`
- `FilterBar`
- `PageHeader`
- `Panel`
- `Drawer`
- `Toast`

Guidance:
- Operational screens should be dense, scannable, and restrained.
- Use cards for repeated items or bounded panels, not nested page decoration.
- Prefer tables for large lists and comparison.
- Keep text inside controls short and non-wrapping where possible.

### E2. Navigation IA

Current project tabs are becoming crowded. Recommended adjustment:
- Keep top tabs for daily work: Overview, Cases, Runs, My Tests, Results, Reports, Automation, Milestones, Plans.
- Move advanced settings categories into a settings sidebar or internal settings nav.
- Add notification/inbox entry in the shell/header.
- Add breadcrumbs and report/case/run context links consistently.

### E3. State And Feedback

Every major screen should have:
- skeleton/loading state for the primary data area
- empty state that distinguishes no data from no filter results
- error state with retry
- mutation pending state
- success/error toast
- stale/conflict messaging for authored edits

### E4. Query And Cache

Recommendations:
- Centralize query keys per feature.
- Avoid invalidating entire project queries after narrow mutations.
- Keep result entry cache updates scoped to active run/test/result history.
- Debounce text filters.
- Use URL query params for selected section/case/test/report filters where shareable.

## Recommended Implementation Order

### Batch 1: Case Custom Values

Files likely touched:
- `apps/server/prisma/schema.prisma`
- `apps/server/src/modules/cases/*`
- `apps/server/src/modules/settings/settings.routes.ts`
- `apps/web/src/features/cases/*`
- `apps/web/src/features/projects/api/advancedApi.ts`

Deliverables:
- Case custom value persistence. (baseline done)
- Case detail form rendering. (baseline done)
- Version snapshot inclusion. (baseline done)
- Import/export column support.
- Active field validation and required-field UI validation.

### Batch 2: Case Version UI

Deliverables:
- Version detail/compare API.
- Restore API.
- Version timeline/diff UI.
- Conflict-safe restore behavior.

### Batch 3: Bulk Case Operations

Deliverables:
- Multi-select case list.
- Bulk action toolbar.
- Bulk move to section.
- Bulk update priority/type/labels/refs/custom fields.
- Bulk delete/archive with confirmation and per-case result feedback.

### Batch 4: Case Step Images

Deliverables:
- Case/case-step attachment routes.
- Step image upload, preview, open, and delete.
- Case detail integration.
- Case version snapshot reference strategy for authored images.

### Batch 5: Run Detail UX Upgrade

Deliverables:
- Run header/summary/filter/table components.
- Query-driven selected test.
- Result history pagination.
- Better status badges and scoped cache invalidation.
- Result elapsed timer.
- Jira/issue key chips and quick defect linking.
- Full step result editor instead of only a first-step shortcut.

### Batch 6: Report Detail Pages

Deliverables:
- Report routes and filter bars.
- Traceability/coverage/defect/run summary detail pages.
- Export using current filters.
- Drilldown links.

### Batch 7: Activity And Notifications

Deliverables:
- Activity event persistence and writer helpers.
- Project/run/case activity APIs.
- Notification preferences and inbox.
- Shell unread indicator.

### Batch 8: Webhook Delivery Model

Deliverables:
- Webhook persistence.
- Event taxonomy.
- Delivery attempts/retries/logs.
- Settings UI for test delivery and delivery history.

## Definition Of Done For Main Feature Completion

The product can be considered strong on the main TestRail workflows when:

- Case authoring supports custom values, version compare/restore, bulk operations, and saved views.
- Run execution supports efficient filtering, result entry, evidence/defects, assignments, and result history without context loss.
- Reports have dedicated filtered views, export parity, and drilldowns back to requirements/cases/runs/results.
- Activity and notifications connect collaboration events to users.
- Settings definitions are reflected in actual authoring/execution forms.
- Core workflows are accessible from UI routes without relying on hidden API-only behavior.
