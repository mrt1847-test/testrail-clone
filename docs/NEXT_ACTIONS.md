# Next Actions

Last aligned: 2026-05-13

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
- Treat UI/API contract consistency as a release gate: every feature change should verify request/response shape, pagination completeness, and behavior parity between UI copy and backend policy.
- During implementation and review, explicitly check for frontend-backend mismatches (scope semantics, mutation constraints, error handling), then either align code or document intentional differences in the same PR.

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

1. Case repository productivity
   - Current baseline: case/section CRUD, case steps, custom values, version history, restore, bulk delete, bulk move, bulk copy API with cloned case fields/custom values/ordered steps, per-section case ordering with append-on-create/move/copy semantics, reorder API support for persisted arbitrary case ordering, position-based case reorder API support for filtered/paginated views, stable section sibling ordering with a reorder API, section subtree move/copy API behavior, section tree drag/drop move/reorder UI, bulk priority/type update, bulk archive/restore semantics, saved case views, richer search/filtering (`q`/priority/type/automation/archive state/refs/labels/estimate), optional list columns, list metadata/custom-value chips, template-aware required-field authoring validation, and drag-and-drop case move/copy/reorder UI with selection-aware drag, section-node and case-row drop targets, before/after position indicators, append drop zone, and a move-vs-copy chooser modal wired to the bulk move/copy and position APIs exist.
   - Remaining P1: richer visual diffs, stale restore conflict messaging, dedicated version detail surfaces, and deeper section move/copy compatibility polish.

2. Activity events and notification inbox
   - Baseline done: `ActivityEvent`, `Notification`, and `NotificationPreference` persistence.
   - Baseline done: activity writer helper, project activity API, notification inbox API, preferences API.
   - Baseline done: UI routes for Activity and Notifications, plus shell/settings entry points.
   - Baseline done: report export and case import/export workflows now emit activity events with drilldown payloads.
   - Baseline done: assignment/failed-result notifications route to explicit assignee targets when payload includes assignee context.
   - Baseline done: project create/update/delete mutations now emit project-level activity events.
   - Baseline done: settings mutations (custom fields/statuses/templates/members) now emit activity events on create/update/delete lifecycle.
   - Baseline done: incremental activity coverage for case step CRUD, run metadata updates, assignment drilldown payloads, defect unlinking, result/defect case drilldown payloads, and matching webhook event filter options.
   - Missing P0: broader event coverage for case, run composition, execution, reporting, assignment, and defect workflows.
   - Missing P0: richer notification targeting and activity drilldown links.
   - Missing P0: email/digest notification delivery jobs.

3. Report detail pages and risk review polish
   - Baseline done: nested report routes/pages for run summary, results explorer, traceability, coverage gap, and defect coverage.
   - Baseline done: report APIs and CSV export jobs.
   - Missing P1: standard filter bars, summary strips, chart/table composition, and drilldown/source-link consistency.
   - Missing P1: milestone and plan summary reports.

4. Run composition and execution UX hardening
   - Baseline done: section-level include/exclude during run creation.
   - Baseline done: add/remove cases after run creation with closed-run restrictions and existing-result safeguards.
   - Baseline done: result history pagination, scoped cache invalidation, and reopen policy baseline.
   - Baseline done: run create/add/remove activity payloads now include run/test/case references for drilldown linking.
   - Baseline done: grouped section-tree selection UX in run create with subtree case counts and scope validation feedback.
   - Missing P1: run header/summary/filter/table split for large daily execution.
   - Follow-up: add richer activity/audit coverage and source links for composition changes.

5. Compatibility and migration depth (`/api/v2`)
   - Baseline done: core case/run/test/result automation endpoints plus `GET /api/v2/get_projects`.
   - Missing P1/P2: projects/suites/sections/milestones/plans/configurations and customization/admin/report categories.

## Workflow Completion Backlog

### Test Case Management

- Case version compare and restore
  - Version detail API, restore behavior, timeline, basic field/step comparison, and restore confirmation are baseline done.
  - Remaining work: richer visual diffs, stale-conflict messaging in the UI, attachment context, and dedicated version detail drawer.

- Bulk case operations and saved views
  - Baseline done: multi-select case list UX with project-scoped bulk delete.
  - Baseline done: bulk move can reassign selected cases to another section with per-case API feedback.
  - Baseline done: bulk copy can clone selected cases into another section with copied case fields, custom values, ordered steps, per-case API feedback, and activity output.
  - Baseline done: bulk update can apply shared priority/type changes to selected cases with per-case API feedback.
  - Baseline done: bulk archive can hide selected cases from the active repository/run composition baseline, and archived views can bulk-restore them with per-case API feedback.
  - Baseline done: bulk delete returns per-case success/failure feedback and records a bulk activity event.
  - Baseline done: saved case views can store section + `q`/priority/type/automation/archive-state/refs/labels/estimate filters and selected list columns per user/project, then re-apply them from the case toolbar.
  - Baseline done: case list search/filtering covers title, refs, automation key, labels, and visible custom values; collapsed rows show metadata/custom-value chips for faster scanning.
  - Baseline done: drag-and-drop case move/copy/reorder is wired into the case list and section tree, with selection-aware drag, section-node drop targets, before/after row drop indicators, an end-of-list append drop zone, and a post-drop move-vs-copy chooser modal that reuses the bulk move/copy mutations for cross-section drops and the position API for same-section reordering.
  - Implementation note: `move` reuses the bulk move mutation; `copy` reuses the bulk copy mutation, keeps originals in place, and surfaces per-case success/failure feedback; same-section drops skip the chooser and call the position API directly using direct-section anchors.
  - Baseline done: cases now have persisted `displayOrder`; create/copy/move append to the target section and direct section views sort by `displayOrder` then `id` instead of pure creation order.
  - Baseline done: case reorder API can persist an explicit section ordering, keeps omitted cases after the explicit order, validates section scope, emits activity, and has web API client support.
  - Baseline done: case listing supports an explicit `sectionScope=direct|subtree` contract, preserving existing subtree behavior by default while letting reorder flows operate on direct section membership only.
  - Baseline done: case position API can move a visible subset before/after an anchor or append it while preserving non-visible cases in the same section, which gives filtered/paginated reorder flows a whole-section-safe backend contract.
  - Baseline done: case list drag/drop UI now invokes the position API with a direct-section anchor (the dragged-over case row or the end-of-list append zone), so paginated/filtered views never resend the visible page as the full ordering.
  - Implementation note: define subtree ordering as section tree order plus each section's case order before introducing section-level drag/drop.
  - Implementation note: use `sectionScope=direct` for reorder/drop-position UI and `sectionScope=subtree` for browsing/run-composition-style views.
  - Remaining work: deeper field updates, labels/refs/custom field edits, richer partial-failure UI, and explicit drop-position ordering rules for moved/copied items.

- Section tree folder semantics
  - Current baseline: sections support parent-child nesting via `parentSectionId`; case listing and run composition treat a selected section as a subtree.
  - Baseline done: sections now expose persisted `displayOrder`, create/move appends within the target sibling group, root/child sibling groups can be explicitly reordered via API, and parent changes reject self-parenting, descendant-parent cycles, and cross-suite parents.
  - Baseline done: section move changes parent for the whole existing subtree and emits activity; section copy clones the full subtree under a target parent, clones contained cases with ordered steps/custom values, clears unique automation/external IDs, returns source-to-copy ID mappings, and emits activity with webhook filter support.
  - Missing parity: section move/copy/delete should define how saved views, run-composition section filters, and activity/drilldown payloads continue to resolve moved or copied section IDs.
  - Implementation note: section move must reject self-parenting, descendant-parent cycles, and cross-suite/cross-project parent changes unless an explicit cross-suite copy flow is designed.
  - Baseline done: section tree UI can drag sections before/after sibling targets, drag into another section or the root drop zone, then choose move vs copy before committing; subtree copy remains available from the section action menu.
  - Baseline done: section tree has local collapsed/expanded state, child-count-based expand controls, and keeps the selected section's ancestor path expanded.
  - Remaining work: saved-view/run-composition compatibility handling and clear empty-section deletion/move messaging.

- Case step images and rich authoring
  - Extend attachment usage to cases and case steps.
  - Add upload/open/preview/delete controls for step images.
  - Preserve enough attachment context in version snapshots for historical authored content.

- Case custom values follow-up
  - Case custom value persistence, form rendering, version snapshot inclusion, CSV import/export columns, active-field import validation, required-field UI validation, and template-aware authoring order are baseline done.
  - Remaining work: deeper custom-value table presentation beyond current optional list visibility and collapsed-row chip baselines.

### Test Execution

- Run case selection and composition
  - Current baseline: create run from all cases in a suite, all-with-case-exclusions, flat selected cases, and optional section subtree include/exclude.
  - Baseline done: add/remove cases after run creation, closed-run restrictions, and existing-result safeguards.
  - Baseline done: grouped section UI and selection feedback in run create.
  - Remaining work: richer composition activity/audit events and cross-screen source-link wiring.

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
  - Baseline done: result history pagination per selected test.
  - Baseline done: close/reopen endpoint+UI policy baseline.
  - Baseline done: scoped cache invalidation after key run/result mutations.
  - Add `RunHeader`, `RunSummaryBar`, `TestInstanceFilterBar`, and `TestInstanceTable`.
  - Selected test, filter, search, and page state in URL query params are baseline done.
  - Improve bulk result entry feedback and large-run table ergonomics.

- Assignment and to-do workflow
  - Expand `assigned-to-me` filters by project, run, status, due date, and milestone where available.
  - Improve `MyTestsPage` into a true to-do view with status counts, aging, and direct execution shortcuts.

### Reporting And Traceability

- Report detail pages
  - Baseline done: routes/pages for run summary, results, traceability, coverage gap, and defect coverage reports.
  - Add standardized filter bars, summary strips, table/chart bodies, export actions, and drilldown links.
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

1. Case repository productivity
   - Bulk move/update/archive plus drag-and-drop move/copy parity.
   - Saved filters/views.
   - Rich case filters and case list columns.

2. Activity and notifications
   - Expand event coverage for case/run/result/assignment/defect/report workflows.
   - Add notification targeting, drilldown links, and email/digest jobs.

3. Run composition and execution UX hardening
   - Section-grouped run creation UX with selected/excluded counts and validation.
   - Run header, summary bar, filter bar, and test instance table components.
   - Execution table ergonomics for large runs.

4. Reporting polish and operations
   - Standard filter bars/summary strips and consistent drilldown/source links.
   - Milestone/plan summary reports.
   - Saved report definitions and report history/download UX.

5. Result custom value depth
   - Richer field types beyond boolean.
   - Advanced reporting/filter semantics and list/report presentation improvements.

6. Webhook and delivery hardening
   - Disable-on-failure policy and richer webhook/audit filters.
   - Non-DB mode delivery strategy.

7. `/api/v2` compatibility expansion
   - Extend by migration impact priority (projects/suites/sections/milestones/plans/configurations first).

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
