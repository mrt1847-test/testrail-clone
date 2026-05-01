# Roadmap

This is the single current execution roadmap. Product requirements live in [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) and its linked spec documents.

TestRail parity is not complete. The parity checklist that previously lived in `TESTRail_GAP_ANALYSIS.md` is now integrated into this roadmap.

Feature-by-feature implementation status is tracked in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md).

Immediate implementation work is tracked in [NEXT_ACTIONS.md](./NEXT_ACTIONS.md).

## Current Status Snapshot

Date: 2026-05-01

Completed or mostly completed:
- Project, suite, section, case, and case-step CRUD.
- Run creation with include-all and flat selected-case flows only; section-level include/exclude and post-creation run composition are still missing.
- Test instance snapshots during run creation.
- Manual result entry, result history, run summary, and close-run workflow.
- Auth/current-user/login/logout baseline.
- Project membership role guards for mutations.
- Overview and basic report widgets.
- API token and automation upload baseline.
- Assignment, My Tests, rerun, and bulk manual result entry baseline.
- Result attachment metadata and defect link baseline.
- Milestone and plan CRUD baseline.
- Initial query invalidation and polling policy.
- Run instance list server-side pagination/filter baseline (`/api/projects/:projectId/runs/:runId/instances`).
- Project-wide result explorer server-side pagination/filter baseline (`/api/projects/:projectId/reports/results-explorer`).
- Closed-run write protection baseline (result write rejects with `RUN_CLOSED`).
- Bulk result error handling baseline improved (atomic pre-validation with clear `BULK_VALIDATION_FAILED` diagnostics).
- Bulk validation diagnostics envelope standardized (`error.details.issues[]`) and API spec-aligned.
- Result explorer filters expanded to API-spec set (`runId`, `caseId`, `testId`, `status`, `source`, `createdFrom`, `createdTo`, `q`) with server-side pagination.
- Case version persistence baseline (`test_case_versions`) supports TestRail-style authored-change history.
- Requirement CRUD and case-requirement link API baseline.
- Traceability report and coverage-gap report baseline.
- Defect coverage report baseline.
- Configuration group/value CRUD baseline.
- Plan matrix preview and run-by-configuration baseline.
- Plan rollup by configuration baseline.
- Plan detail matrix/rollup web binding baseline.
- Plan detail entry-configuration mapping read baseline.
- Defect integration settings + defect push/delete API baseline.
- Attachment signed upload/download URL + metadata registration baseline.
- Run detail attachment presign upload web binding baseline.
- Run detail attachment open/delete web binding baseline.
- Run detail defect push web binding baseline.
- Defect integration settings web binding baseline.
- Run detail defect push provider/feedback UX baseline.
- Run detail defect unlink web binding baseline.
- Case CSV import dry-run/commit API baseline with import job history.
- Case CSV export and run result CSV export API baseline with export job history.
- Import/Export project tab web binding baseline.
- Report CSV export job baseline for run summary, result explorer, traceability, coverage gap, and defect coverage reports.
- TestRail-compatible `/api/v2` adapter baseline for core case, run, test, and result automation endpoints.
- Project custom field CRUD API, DB persistence, audit logging, and settings UI baseline.
- Project custom result status CRUD API, DB persistence, audit logging, and settings UI baseline.
- Project case template CRUD API, DB persistence, audit logging, and settings UI baseline.
- Audit log query UI with server-side filters and pagination baseline.
- Case custom field value persistence, case detail form rendering, and version snapshot inclusion baseline.
- Activity event, notification, and notification preference persistence baseline.
- Project activity feed API/UI baseline.
- Notification inbox API/UI baseline with unread count and preference toggles.
- Result entry elapsed parser/normalizer, timer controls, defect key chips, case-step-aware multi-step result editing, field-level custom result validation messaging, and focused result-entry component split.
- Result custom value CSV export columns for run result exports and result explorer report exports.
- Result explorer custom value exact-match filters via `custom_{systemName}` API params and web controls.
- Boolean custom field type for case/result definitions, validation, forms, import parsing, exports, and result explorer filtering.
- Run detail selected test, filter, search, and page state persisted in URL query params.

Partially complete:
- Run composition is partial: creation can include all suite cases, all-with-case-exclusions, or an explicit flat case list, but section-level include/exclude and add/remove cases after run creation are still missing.
- Result evidence has metadata and signed URL API/UI baseline; production object storage configuration and preview polish remain.
- Defect links and URL-template push baseline exist; provider-native create/update integrations remain.
- Case optimistic locking moved to `lockVersion` + `expectedVersion`/`If-Match` baseline.
- Reports baseline exists, but advanced traceability/coverage refinement is still pending.
- Plan matrix semantics and rollup depth still need refinement, but Plan detail now consumes matrix/rollup APIs as a baseline.
- Import/export exists as API/UI baseline; report export has a job/download baseline, while larger async file lifecycle is still pending.
- Activity/notifications baseline exists, but event coverage, targeting, and delivery jobs are still shallow.

Not yet complete:
- Notification delivery jobs such as email/digest.
- Webhook event delivery model beyond settings/subscription baseline.
- Advanced custom field validation and richer field semantics beyond the current case/result value baselines.
- Full users/groups/roles/permission administration.
- Saved/scheduled reports and broader report catalog.
- Expanded TestRail-compatible `/api/v2` adapter across the official API categories.

## TestRail Parity Snapshot

| Area | Current status | Remaining gap |
| --- | --- | --- |
| Projects | Mostly complete | Project archive/read-only mode, global default access, and project-level admin model. |
| Suites/sections/cases | Mostly complete | Case version compare/restore and bulk delete baselines are done; remaining gaps are rich case filters, saved views, bulk move/update/archive depth, and import/export depth for custom values. |
| Case history | Partial | Compare/restore detail UI and restore path. |
| Case fields/types/priorities/templates | Partial | Case/result field scopes and case custom value import/export baselines are done; remaining gaps are broader field types, priorities/types APIs, list/report presentation depth, and richer validation UX. |
| Runs/tests/results | Partial | Run creation has include-all, include-all-with-case-exclusions, and flat selected-case baselines, but still lacks section-level include/exclude, post-creation add/remove cases, reopen policy, richer filters, time tracking, comments/mentions, and full custom result fields. |
| Assignments/to-dos | Partial | Notification-driven assignment workflow and richer workload/task views. |
| Milestones | Partial | Sub-milestones, forecasts, milestone summary reports, and richer dashboards. |
| Plans/configurations | Partial | Full plan-entry semantics, assigned users, include/exclude depth, combination editing, and plan report parity. |
| Reports | Partial | Saved/scheduled reports, report access/history, richer report catalog, and cross-project reports. |
| Requirements/traceability | Partial | Requirement import/sync, external provider integration, and advanced matrix UI. |
| Attachments/evidence | Partial | Production object storage lifecycle, preview UX, retention, cleanup, and upload progress/resume. |
| Defects/integrations | Partial | Provider-native Jira/GitHub/Azure create/sync, validation, status sync, and richer defect reports. |
| Automation | Partial | Mapping UI, token scopes/expiration UI, retry queues, CI examples, and broader API compatibility. |
| Import/export | Partial | XML/JSON, mapping wizard depth, async file lifecycle, attachments import/export, and TestRail-compatible shapes. |
| Users/roles/permissions | Partial | Global users, groups, custom roles/permissions, default project access, and user APIs parity. |
| Audit logs | Partial | Full audit event coverage, export, retention, admin audit, and access controls. |
| Activity/notifications | Partial | Event coverage, richer targeting, email/digest preferences, and delivery jobs. |
| Webhooks | Partial | Persisted model, event taxonomy, signing, retries, delivery logs, and disable-on-failure behavior. |
| TestRail `/api/v2` adapter | Partial | Core cases/runs/tests/results only; many official categories remain missing. |

## Missing `/api/v2` Compatibility Categories

Current adapter baseline:

- cases
- runs
- tests
- add result for case
- bulk results for cases

Missing or incomplete categories:

- attachments
- BDDs
- case fields
- case types
- configurations
- datasets
- groups
- labels
- milestones
- plans
- priorities
- projects
- reports and cross-project reports
- result fields
- roles
- sections
- shared steps
- statuses
- suites
- templates
- users
- variables

Compatibility priority should be driven by migration and automation needs:

1. Projects, suites, sections, milestones, plans, configurations.
2. Case fields, result fields, case types, priorities, statuses, templates.
3. Attachments, reports, users, roles.
4. Labels, groups, shared steps, datasets, variables, BDDs.

## Highest-Value Parity Gaps

- P0: run case selection and composition, including section-level include/exclude and add/remove cases after run creation.
- P0: execution workspace depth, including stable run header/summary/filter/table components, result history pagination, close/reopen warnings, and scoped invalidation.
- P0: case repository productivity, including bulk move/update/archive, saved views, and rich case filters.
- P0: report drilldown pages for run summary, results, traceability, coverage gap, and defect coverage.
- P0: activity events and notifications across the core case/run/result/assignment/defect/report workflows.
- P1: custom fields as actual case/result data with scopes, validation, filtering, sorting, and export support.
- P1: persisted webhook subscriptions, event taxonomy, signed delivery, retries, logs, and manual test-send.
- P1: full admin model with users, groups, global roles, permission matrix, default project access, and project-level overrides.
- P1: reporting depth with saved reports, scheduled/email reports, history/downloads, milestone/project/plan reports, and access controls.
- P1: plan/configuration depth with richer plan entry editing, assigned users, include/exclude cases, combination management, reports, and `/api/v2` compatibility.
- P2: import/export expansion for XML/JSON, mapping wizard, large file lifecycle, attachments, and TestRail-compatible export fields.
- P2: evidence storage hardening for object storage, authorization, retention, cleanup, preview, and retry UX.
- P2: provider-native defect integrations for Jira/GitHub/Azure creation, status sync, remote error handling, and field mapping.
- P2: case authoring depth for bulk move/update/archive actions, saved filters/views, shared steps, labels, deleted case restore, and permanent delete semantics.

## Delivery Phases From Here

### Phase 1: Stabilize Execution Core

Goal: make the current run/result workflow dependable under real team usage.

Scope:
- Section-level include/exclude during run creation.
- Include-all-with-exclusions for large suites.
- Add/remove cases after run creation with closed-run restrictions and existing-result safeguards.
- Grouped case selection UX by section with selected/excluded counts.
- Server-side pagination and filtering for run instance lists.
- Project-wide result explorer with server-side pagination/filtering.
- Consistent result-entry cache invalidation.
- Closed-run write protection policy.
- Better bulk result error handling.

Exit criteria:
- Large runs do not require loading every related object at once.
- Result entry remains responsive and does not refresh unrelated project data.
- Closed runs cannot receive accidental results.

### Phase 2: Case History and Edit Safety

Goal: make authored test cases safe for collaboration.

Scope:
- `test_case_versions` persistence.
- Case version creation on meaningful authored-content changes.
- Version history API and UI.
- Consistent optimistic locking with `lock_version` or `If-Match`.

Exit criteria:
- Concurrent edits produce conflict responses instead of silent overwrites.
- Runs can record the selected case version.

### Phase 3: Traceability and Reporting

Goal: answer release-risk questions like "what requirement is untested or failing?"

Scope:
- Requirement CRUD.
- Case-to-requirement links.
- Requirement coverage report.
- Coverage gap report.
- Traceability matrix.
- Defect coverage report.

Exit criteria:
- Requirements can be linked to cases.
- Reports can trace requirement -> case -> run/test/result -> defect.
- Coverage reports support milestone/run/plan filters.

### Phase 4: Planning Matrix

Goal: support TestRail-style planning across real environment combinations.

Scope:
- Configuration groups and values.
- Plan entry configuration mapping.
- Matrix preview and run generation.
- Plan rollup by configuration.

Exit criteria:
- Plans no longer depend only on free-text environment strings.
- Users can generate runs from selected configuration combinations.
- Plan detail shows status per entry/configuration.

### Phase 5: Evidence, Defects, and Integrations

Goal: make execution evidence and defect workflows production-grade.

Scope:
- Object storage upload/download signed URLs.
- Attachment preview and deletion permissions.
- Defect integration settings.
- Jira/GitHub/Azure-style URL templates.
- Push/create defect action baseline.

Exit criteria:
- Binary evidence is stored outside PostgreSQL.
- Result detail can reliably show evidence and linked defects.
- Defect links power reporting rather than remaining display-only text.

### Phase 6: Import, Export, and Compatibility

Goal: make migration and automation adoption realistic.

Scope:
- Case CSV import with dry-run validation. (API baseline done)
- Cases/results CSV exports. (API baseline done)
- Import/export job history. (API baseline done)
- Browser import/export UI. (baseline done)
- Report exports as async jobs. (job/download baseline done)
- TestRail-compatible `/api/v2` adapter baseline. (core case/run/test/result endpoints done)
- Token scopes and compatibility examples.

Exit criteria:
- Users can validate imports before committing.
- Large exports do not block the browser.
- Existing automation clients can target a compatibility surface.

### Phase 7: Collaboration and Administration

Goal: support daily team operations and project administration.

Scope:
- Activity feed.
- Notification inbox and preferences.
- Custom fields. (CRUD baseline done)
- Custom result statuses. (CRUD baseline done)
- Case templates. (CRUD baseline done)
- Audit log query UI. (filter/pagination baseline done)
- Webhook event model.

Exit criteria:
- Users can follow assignments, failures, and project activity.
- Admins can configure project behavior without schema changes.
- Auditable product events are queryable.

### Phase 8: TestRail Parity Completion

Goal: close the highest-value TestRail parity gaps after the core workflow and administration baselines.

Scope:
- Activity feed and notification delivery.
- Webhook subscriptions, event taxonomy, signed delivery, retry logs.
- Custom field value depth beyond current case/result baselines, including richer validation UX, list/report presentation, and broader field types.
- Saved and scheduled reports with report history/downloads.
- Users, groups, global roles, permission matrix, and project-level administration.
- Expanded `/api/v2` compatibility for projects, suites, sections, milestones, plans, configurations, customization metadata, reports, users, and roles.

Exit criteria:
- P0/P1 parity gaps in this roadmap are either implemented or intentionally deferred with product sign-off.
- TestRail migration and automation clients can cover projects, cases, runs, plans, configurations, results, and core metadata without manual reshaping.
- Team collaboration workflows have visible activity, actionable notifications, and auditable webhook delivery logs.

### Phase 8A: Core Workflow Completion

Goal: finish the main daily workflows before broad parity expansion.

Scope:
- Case custom field value persistence and case form integration. (baseline done)
- Case version compare/restore UI.
- Run detail workspace UX upgrade.
- Report detail pages with filters, exports, and drilldowns.
- Activity and notifications as workflow glue.
- Webhook delivery model after activity events exist.

Execution source:
- [NEXT_ACTIONS.md](./NEXT_ACTIONS.md)

Exit criteria:
- Test case management, execution/result entry, and result reporting can be used end-to-end from UI without hidden API-only behavior.
- Settings definitions are reflected in actual case/result forms.
- Reports link back to source requirements, cases, runs, tests, results, defects, and evidence.

## Priority Rules

1. Preserve the case -> run -> instance -> result history model before adding decorative UI.
2. Prefer DB-backed, paginated, indexed workflows over client-only expansion.
3. Fix execution bottlenecks before advanced administration.
4. If implementation conflicts with specs, update [PRODUCT_SPEC.md](./PRODUCT_SPEC.md), [API_SPEC.md](./API_SPEC.md), [DOMAIN_MODEL.md](./DOMAIN_MODEL.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), or [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md) first.
5. Keep immediate implementation batches in [NEXT_ACTIONS.md](./NEXT_ACTIONS.md); this file remains the phase-level delivery source.
