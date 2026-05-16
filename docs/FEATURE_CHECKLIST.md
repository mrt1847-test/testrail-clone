# Feature Checklist

Last aligned: 2026-05-16 (custom result statuses)

This file tracks implemented, partial, and missing capabilities. It should not contain the roadmap narrative or the execution queue.

Strategy and phase intent live in [ROADMAP.md](./ROADMAP.md).

## Legend

| Symbol | Meaning |
|--------|---------|
| `[x]` | Baseline available from API and/or UI (may still lack full TestRail depth). |
| `[ ]` | Incomplete, partial, or missing. |
| `P0` | Blocks core daily TestRail-like workflow. |
| `P1` | High-value workflow or parity depth. |
| `P2` | Advanced parity, scale, administration, or Enterprise-tier. |

### Source tags (TestRail docs vs this product)

| Tag | Meaning |
|-----|---------|
| **TR-Core** | Described in TestRail Introduction / core user guide (most projects). |
| **TR-Pro** | Common professional workflow (integrations, deeper reports); not always edition-gated in docs. |
| **TR-Ent** | TestRail Enterprise or explicitly edition-gated in support docs/API. |
| **Clone+** | Intentional product extension; do not treat as TestRail `[x]` parity. |

Official reference hub: [TestRail Support Center](https://support.testrail.com/hc/en-us/).

---

## Product Foundation

- [x] **TR-Core** Projects, suites, sections, and auth baseline.
- [x] **TR-Core** Project membership, role guards, member management, and last-owner protection.
- [x] **TR-Core** Operational project shell, project switcher, primary tabs, inbox entry, and project dashboard baseline.
- [ ] **TR-Core** P1 Project archive/read-only mode.
- [ ] **TR-Core** P1 Global default access model.
- [ ] **TR-Core** P1 Users, groups, global roles, custom roles, and permission matrix.
- [ ] **TR-Core** P1 Project types: single repository, single repository with baselines, multiple test suites ([Projects and their types](https://support.testrail.com/hc/en-us/articles/7076923860244)).
- [ ] **TR-Core** P1 Baseline branches (copy from master suite without affecting master).
- [ ] **TR-Core** P1 Multi-suite rule: one suite per test run when multiple suites are enabled.
- [ ] **TR-Ent** P2 SSO (OIDC, OAuth 2.0, SAML 2.0) and enforced vs mixed login.
- [ ] **TR-Ent** P2 MFA.
- [ ] **Clone+** P2 Settings sidebar for lower-frequency admin categories.

---

## Test Case Management

- [x] **TR-Core** Case CRUD, case steps, section tree, and suite organization baseline.
- [x] **TR-Core** Case custom values, required-field validation, **field layout templates** (admin), and CSV import/export columns.
- [ ] **TR-Core** P1 Default **case templates**: Test Case (Text), Test Case (Steps), Exploratory Session, Behaviour Driven Development, AI Evaluation ([Test case templates](https://support.testrail.com/hc/en-us/articles/14927678348052)).
- [ ] **TR-Core** P1 Exploratory template fields (Mission, Goals).
- [ ] **TR-Core** P1 AI Evaluation template and result fields (Quality Rating, Input, Output, Traces, Latency).
- [ ] **TR-Pro** P2 BDD/Gherkin scenarios, scenario-level execution, `.feature` import/export and BDD API ([BDD](https://support.testrail.com/hc/en-us/articles/7827238336916-Behavior-Driven-Development-BDD)).
- [x] **Clone+** Case version persistence, timeline, compare/restore UI, conflict messaging, and snapshot detail drawer (TestRail Enterprise also offers versioning).
- [x] **TR-Core** Bulk delete, move, copy, archive/restore, priority/type update, saved views, rich filters, optional list columns, and metadata chips.
- [x] **TR-Core** Case and section drag/drop move/copy/reorder with persisted ordering and position APIs.
- [x] **TR-Core** Case/case-step attachment API and basic case detail upload/open/delete UI.
- [x] **TR-Core** P1 Dedicated case detail route (`/projects/:projectId/cases/:caseId`) with read-only page and edit drawer; legacy `?caseId=` redirects ([UX_BACKLOG.md](./UX_BACKLOG.md) UX-4).
- [ ] **TR-Core** P1 **References** field: comma-separated external IDs, View Reference URLs, autocomplete issue picker when integration active ([Reference integrations](https://support.testrail.com/hc/en-us/articles/7747333895700)).
- [x] **TR-Core** P1 Section move/copy compatibility with saved views, run composition filters, and stale drilldown links.
- [ ] **TR-Core** P1 Deeper field edits, labels/refs/custom field list presentation, and partial-failure polish.
- [x] **TR-Core** P2 Attachment preview drawer and upload progress/retry baseline for cases, case steps, and result evidence.
- [x] **TR-Core** P2 Historical attachment download semantics for version snapshots.
- [ ] **TR-Core** P2 Shared steps ([Shared Steps](https://support.testrail.com/hc/en-us/articles/7077919815572-Shared-Steps)).
- [ ] **TR-Core** P2 First-class labels, deleted case restore/permanent delete.
- [ ] **TR-Ent** P2 Test case review workflow: Design / Review / Ready, approval permissions, re-review on edit ([Test case review & approvals](https://support.testrail.com/hc/en-us/articles/7766980011028)).

---

## Run Composition And Execution

- [x] **TR-Core** Run creation: include all, select specific cases, exclusions, section subtree include/exclude ([Creating new test runs](https://support.testrail.com/hc/en-us/articles/7076838639892)).
- [x] **TR-Core** P0 **Dynamic filter** runs: auto add/remove tests when cases match filter; filter icon on new tests; single filter per run. (v1: create-time filter + manual **Sync now**; filter icon on instances deferred.)
- [x] **TR-Core** P0 **Include all** runs: new cases in project/suite automatically added to open runs (live sync, not creation-time snapshot only). (v1: case-create hook + manual sync API.)
- [x] **TR-Core** P1 Filter selection modes: set selection to filter, add filter to selection, remove filter from selection. (create UI + open-run `PATCH .../composition` with sync.)
- [x] **TR-Core** Add/remove cases from open runs with closed-run restrictions and existing-result safeguards.
- [x] **TR-Core** Test instance snapshots, server-side pagination/filtering, selected test URL state, and run detail component split.
- [x] **TR-Core** Manual result entry, bulk result entry, result history pagination, run summary, close/reopen policy, and scoped cache invalidation.
- [x] **TR-Core** Result entry: status, comments, elapsed parser/timer, defects, custom values, case-step-aware step results.
- [x] **TR-Core** Run table status-triggered result entry dialog (compact execution).
- [ ] **TR-Core** P1 Run **start date** and **end date** (optional, editable while active, milestone inheritance, plan/milestone warnings, manual complete — not auto-close on date). (partial: `startedAt` on create, `closedAt` on close/reopen, PATCH while open, run header display.)
- [ ] **TR-Core** P1 Run detail views: Status, Activity, Progress sidebar modes.
- [x] **TR-Core** P1 Policy: Untested cannot be set again after a test has any result (TestRail default behavior).
- [x] **TR-Core** P1 Configurable **custom result statuses** (up to seven), colors, `is_final`, `is_untested` ([Statuses](https://support.testrail.com/hc/en-us/articles/7077935129364)). (settings CRUD + `GET /api/projects/{id}/statuses` + run result/quick-entry status chips.)
- [x] **TR-Core** P1 Bulk result entry uses `/results/bulk` with per-row success/failure summary in run UI.
- [x] **TR-Core** P1 Activity/notification drilldown for run composition (`run.tests_added`, `run.test_removed`) with run + case links.
- [x] **TR-Core** P1 Large-run ergonomics beyond bulk feedback (status filter chips, next-failed navigation; [UX_BACKLOG.md](./UX_BACKLOG.md) UX-2).
- [ ] **TR-Core** P1 Test change indicator when underlying case changed after run was created.
- [ ] **TR-Pro** P1 Time tracking beyond elapsed entry (estimates vs actuals in reports).
- [x] **TR-Core** P1 Result comment `@mention` notification/email routing baseline.
- [ ] **TR-Core** P1 Richer comments on execution workflow beyond result-entry comments.

---

## Results And Custom Fields

- [x] **TR-Core** Result custom field scope, value persistence, validation, result history, and result explorer display.
- [x] **TR-Core** Result custom values in run result and result explorer CSV exports.
- [x] **TR-Core** Result explorer custom field exact-match filters.
- [x] **TR-Core** Boolean custom field type for definitions, validation, forms, import, exports, and filtering.
- [ ] **TR-Core** P1 Remaining TestRail field types: Checkbox, Date, Dropdown, Integer, Multi-select, String, Text, URL, User, Milestone, Rating, Steps, Step Results, Scenarios, Scenario Results ([Configuring custom fields](https://support.testrail.com/hc/en-us/articles/7373850291220)).
- [ ] **TR-Core** P1 Advanced result custom field filtering semantics.
- [ ] **TR-Core** P2 Result editing/correction policy (product decision; TestRail allows limited correction via new results).

---

## Assignments And To-Do

- [x] **TR-Core** Run assignment, test assignment, My Tests page, status/run/search filters, and execution shortcuts.
- [x] **Clone+** Assignment-related notifications in in-app inbox.
- [ ] **TR-Core** P1 **Team to-do** view: see other members’ or whole-team to-dos for workload balancing ([Introduction](https://support.testrail.com/hc/en-us/articles/7076810203028)).
- [ ] **TR-Core** P1 Due date and milestone filters when fields are available.
- [ ] **TR-Core** P1 Aging indicators and notification-driven assignment workflow polish.
- [ ] **TR-Core** P1 Email when tests are assigned and when others comment or add results to your tests.
- [x] **TR-Core** P1 Subscribe to tests (per-test **Watch** on run rows, email on assignment/failed for subscribers).

---

## Milestones, Plans, And Configurations

- [x] **TR-Core** Milestone CRUD and primary project navigation entry.
- [x] **TR-Core** Plan CRUD, configuration group/value CRUD, matrix preview, run-by-configuration, and rollup baseline.
- [x] **TR-Core** Plan detail matrix/rollup web binding and entry-configuration mapping read baseline.
- [x] **TR-Core** P1 Milestone summary report API, CSV export, report page, milestone detail execution rollup.
- [x] **TR-Core** P1 Plan summary report API, CSV export, and report page.
- [ ] **TR-Core** P1 Milestone lifecycle: Upcoming vs Open, manual complete, parent/child milestones ([Milestones](https://support.testrail.com/hc/en-us/articles/15545364561044)).
- [ ] **TR-Core** P1 Sub-milestones and richer milestone dashboard widgets beyond current rollup.
- [ ] **TR-Core** P1 Full plan-entry semantics: plan-level assignee, refs, start/due dates, per-entry include/exclude and combination editing ([Plans](https://support.testrail.com/hc/en-us/articles/7077711537684)).
- [ ] **TR-Pro** P2 Milestone forecasts and burndown-style hints.
- [ ] **TR-Core** P2 `/api/v2` compatibility for milestones, plans, and configurations.

---

## Reporting And Traceability

### Clone analysis pages (fixed routes)

- [x] **Clone+** Overview widgets and project execution summary graph.
- [x] **Clone+** Internal Requirement entity CRUD, case links, traceability, coverage gap, and defect coverage pages.
- [x] **TR-Core** Report pages: run summary, result explorer, traceability, coverage gap, defect coverage (conceptual overlap with TestRail reference/defect reports).
- [x] **TR-Core** Report export jobs/downloads and shared report UI primitives (filter bar, summary strip, CSV).
- [x] **TR-Core** P1 Saved report definitions and user-authored templates (CRUD API, Save view on report pages, open with filter query params).
- [x] **TR-Core** P1 On-demand report execution returning HTML/PDF URLs (`run_report` parity). (v1: saved report CSV execution returns export job/download URLs; HTML/PDF rendering deferred.)
- [x] **TR-Core** P1 Scheduled reports and email link/attachment recipients ([Reports](https://support.testrail.com/hc/en-us/articles/7077825062036)). (v1: interval schedules, CSV export job + email link; attachment in email deferred.)
- [x] **TR-Core** P1 Report export history and download UI (`ExportJob` queue + `/reports/saved` history table).
- [ ] **TR-Ent** P2 Cross-project reports API and UI (`get_cross_project_reports`, user workload, execution summary).
- [ ] **TR-Pro** P1 Requirement import/sync and external requirement provider integration (alongside References parity).

### TestRail built-in report catalog (template parity)

Track each template as saved-report or fixed-page parity. Current clone mapping:

| TestRail report (support docs) | Clone target | Status |
|--------------------------------|--------------|--------|
| Summary - Run | Run summary page + CSV | Partial: page exists; template/scheduling not |
| Summary - Project | Project overview/dashboard | Partial: fixed dashboard exists; report template not |
| Cases - Activity Summary | TBD | Missing |
| Cases - Coverage for References | Coverage gap page | Partial: internal requirements, not References |
| Cases - Property Distribution | TBD | Missing |
| Cases - Status Tops | TBD | Missing |
| Defects - Summary | Defect coverage / result explorer | Partial: no milestone/plan/run defect summary template |
| Defects - Summary for Cases | Defect coverage page | Partial |
| Defects - Summary for References | TBD | Missing |
| Results - Comparison for Cases | TBD | Missing (see Convenience: compare runs) |
| Results - Comparison for References | Traceability page (Case references tab + refs drilldown) | Partial |
| Results - Property Distribution | Result explorer / dashboard charts | Partial: no report template |
| Summary - Milestone | `/reports/milestones` | Baseline done |
| Summary - Plan | `/reports/plans` | Baseline done |
| Users - Workload summary | My Tests / assignments | Partial: user workload report missing |
| Cross-project: Test Execution Project Summary | TBD | Missing (Enterprise) |
| Cross-project: Test Execution User Workload | TBD | Missing (Enterprise) |
| Print from Cases/Runs/Plans/Milestones | TBD | Missing |

- [ ] **TR-Core** P1 Activity Summary (Cases) report template.
- [ ] **TR-Core** P1 Cases Property Distribution and Status Tops report templates.
- [ ] **TR-Core** P1 Defects Summary report template for milestone, plan, or selected runs.
- [ ] **TR-Core** P1 Results Comparison for Cases and Results Property Distribution report templates.
- [ ] **TR-Core** P1 Coverage / Comparison for **References** (Cases/Results) aligned to References field, not only internal requirements.
- [ ] **TR-Core** P1 Summary for References (Defects) report template.
- [ ] **TR-Core** P1 Project Summary and Users Workload summary report templates.
- [ ] **TR-Core** P1 Print-friendly exports from cases, runs, plans, and milestones ([Print reports](https://support.testrail.com/hc/en-us/articles/7101821797140)).

---

## Evidence, Attachments, And Defects

- [x] **TR-Core** Result attachment metadata, signed upload/download URLs, run detail upload/open/delete binding.
- [x] **TR-Pro** Defect links, integration settings, URL-template push, provider feedback, and unlink baseline.
- [ ] **Clone+** P1 Production object storage lifecycle and authorization hardening.
- [x] **TR-Core** P1 Attachment preview drawer and upload progress/retry baseline for case and result evidence.
- [ ] **TR-Core** P1 Attachment retention and cleanup policy.
- [ ] **TR-Pro** P1 Integration test connection and validation ([Configuring defect integrations](https://support.testrail.com/hc/en-us/articles/7747085183636)).
- [ ] **TR-Pro** P1 Push Defect dialog with provider field mapping (Jira/GitHub/Azure), including custom fields.
- [ ] **TR-Pro** P1 Provider-native issue create/sync, remote status snapshots, template preview.
- [ ] **TR-Pro** P2 Attachment import/export.

---

## Automation And API Compatibility

- [x] **TR-Core** API token baseline.
- [x] **TR-Pro** Automation upload, upload history/detail, failed-item retry, mapping summary/list, and bulk automation result API.
- [x] **TR-Pro** `/api/v2` **partial** compatibility: cases, runs, tests, results, single-resource reads (`get_project`, `get_suite`, `get_section`, `get_milestone`, `get_plan`), result listing (`get_results*`), `get_case_types`, `get_priorities`, suites/sections lists, milestones, plans, `get_statuses` (not full TestRail API surface).
- [x] **TR-Core** P1 Document supported vs unsupported `/api/v2` endpoints in product docs (`GET /api/v2` index + API_SPEC matrix).
- [x] **TR-Core** P1 `get_statuses` and custom status fields in API responses (`get_statuses?project_id=`, `custom_status_id` on status rows).
- [ ] **TR-Core** P1 Token scopes and expiration enforcement.
- [ ] **TR-Core** P1 Clearer token creation UX.
- [ ] **TR-Pro** P1 Automation mapping UI, mapping health, upload retry queues, and row-level failure guidance.
- [ ] **TR-Pro** P2 CI examples and compatibility examples.
- [ ] **TR-Pro** P2 Expanded `/api/v2`: projects, suites, sections, milestones, plans, configurations, fields, templates, users, roles, `get_reports`, `run_report`, attachments, labels, groups, shared steps. (partial: configurations, case/result fields, templates, users, saved reports, roles, case/result attachments, saved-report `run_report` CSV execution, read-only `get_labels` / `get_groups` / `get_shared_steps`, and suite/section/run write endpoints `add_suite`, `update_suite`, `add_section`, `update_section`, `delete_section`, `close_run`, `update_run`.)
- [ ] **TR-Ent** P2 `get_case_statuses`, datasets, variables, BDD endpoints, cross-project reports.
- [ ] **TR-Pro** P2 API rate-limit behavior documentation (Cloud parity).

---

## Import And Export

- [x] **TR-Core** Case CSV import dry-run/commit API and job history.
- [x] **TR-Core** Case CSV export, run result CSV export, report CSV export jobs, and import/export UI.
- [x] **TR-Core** Case and result custom values in relevant imports/exports.
- [ ] **TR-Core** P1 Mapping-driven import/export UX and richer validation guidance.
- [ ] **TR-Pro** P1 XML/JSON import/export.
- [ ] **TR-Pro** P1 Mapping wizard and large async file lifecycle.
- [ ] **TR-Pro** P2 TestRail-native export shapes beyond current CSV baselines.

---

## Activity, Notifications, Audit, And Webhooks

- [x] **Clone+** Activity event persistence, writer helper, project activity API/UI.
- [x] **Clone+** Notification inbox, preferences, unread count, and basic targeting.
- [x] **TR-Ent** Audit log query UI with server-side filters and pagination (Enterprise audit depth still partial).
- [x] **TR-Pro** Webhook subscriptions, signed delivery, DB-backed worker, backoff, manual test-send ([Webhooks](https://support.testrail.com/hc/en-us/articles/7169038183572)).
- [x] **TR-Pro** P1 Global (admin) webhooks in addition to per-project webhooks.
- [x] **Clone+** Broad activity coverage for case, run, suite, section, milestone, plan, configuration, requirement, settings, import/export, and report export mutations.
- [x] **Clone+** Drilldown links for milestone, plan, suite, section, requirement, and payload-driven sources.
- [ ] **TR-Core** P0 Broader activity event coverage for remaining assignment, defect, and reporting mutations (baseline expanded: bulk results, assignment payload fixes).
- [x] **TR-Core** P0 Email and digest delivery jobs (`EmailOutbox`, console/SMTP transport, workers, `digestEnabled` on preferences).
- [x] **TR-Core** P1 Email outbox admin UI (project settings: list, retry, digest preview).
- [x] **TR-Core** P1 Mention routing for result comments (`@email`, `@email-local-part`, `@name`) with notification preferences and email outbox.
- [x] **TR-Pro** P1 Webhook auto-disable after consecutive delivery failures (`disabledAt`, re-enable in UI).
- [x] **TR-Pro** P1 Richer webhook and audit filters (webhook `disabledAt`/failure counter; audit actor email, exact match, changes contains).
- [ ] **TR-Pro** P1 Disable-on-failure policy and delivery diagnostics UI.
- [x] **TR-Ent** P1 Audit CSV export and retention prune baseline.
- [x] **TR-Ent** P1 Full audit event coverage and admin-level cross-project audit. (v1: `scope=all` query/export/UI toggle plus assignment, defect, saved report, and scheduled report mutation audit rows; future work can add stricter global admin role boundaries.)

---

## Clone Engineering (Not TestRail Parity)

Internal quality and UI architecture; prioritize after TR-Core P0/P1 gaps unless blocking delivery.

- [x] Shared loading/error/empty states baseline.
- [x] Initial query invalidation and polling policy.
- [x] TestRail-like compact result entry dialog from run status badge.
- [x] P1 Shared `StatusBadge`, `FilterBar`, `PageHeader` in `apps/web/src/shared/ui/` (migrated: run filters, reports, My Tests).
- [ ] P1 Shared `Button`, `IconButton`, `DataTable`, `Panel`, `Drawer`, and `Toast`.
- [ ] P1 Dense, scannable table-oriented screens for large lists.
- [ ] P1 Centralized query keys per feature.
- [x] P1 UI/UX review pass (analysis: [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md); implementation waves: [UX_BACKLOG.md](./UX_BACKLOG.md); execution queue: [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) for TR-Core/API items only).

---

## Convenience And Productivity

Secondary UX depth; many items mirror TestRail but are tracked here to keep domain sections focused on data and workflow parity. Promote items to P1 in domain sections when they block daily use.

### Navigation, Search, And Deep Links

- [ ] P1 Global search across cases, runs, milestones, plans, and defects.
- [ ] P1 Jump-to by entity ID (`C123`, `R45`, `M12`) from command palette.
- [ ] P1 Recently viewed cases, runs, and milestones.
- [ ] P1 Pinned/favorite projects (and optional suites) in project switcher.
- [ ] P1 Copy entity link / ID to clipboard.
- [ ] P1 Open in new tab from context menu.
- [ ] P1 Deep links preserve list filters, sort, pagination, and selected row.
- [ ] P2 Cross-project search.

### Keyboard, Selection, And List Ergonomics

- [x] P1 Keyboard shortcuts and `?` help overlay on run detail (global palette deferred).
- [ ] P1 Shift/Ctrl range multi-select on case and run tables.
- [ ] P1 Remember last filter, sort, and column set per page per user.
- [ ] P1 Column width and visibility persistence.
- [ ] P1 Inline quick-edit for safe fields.
- [ ] P1 Hover preview for case title, steps, last result.
- [ ] P2 Density toggle (compact vs comfortable).

### Case And Run Shortcuts

- [ ] P1 Quick-add case inline in section tree.
- [ ] P1 Duplicate case with options (steps, fields, attachments).
- [ ] P1 Print-friendly case view and multi-case print.
- [ ] P1 Collapsed section tree state per suite.
- [ ] P1 Select all in section / select visible filter matches.
- [x] P1 Next/previous test, jump to failed/blocked (run detail toolbar + shortcuts; see [UX_BACKLOG.md](./UX_BACKLOG.md) Wave UX-2).
- [x] P1 Clickable status counts in run summary/sidebar (see [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md) §5).
- [ ] P1 Assign to me / clear assignee quick actions.
- [ ] P1 Duplicate run for regression cycles.
- [ ] P2 Compare two runs side-by-side (relates to Comparison for Cases report).

### Reporting And Collaboration Shortcuts

- [ ] P1 Export current filtered view; report filter presets.
- [ ] P1 Copy chart/table summary to clipboard.
- [ ] P1 @mention autocomplete; comment templates; rich text comments.
- [ ] P1 Mark all read; inbox filters; snooze/mute categories.
- [ ] P1 Push defect prefilled from case + comment; recent defects picker.
- [ ] P1 User default landing page, suite, and saved view.
- [ ] P2 Theme preference (light/dark).

### API Convenience

- [ ] P1 API docs panel with copyable curl examples.
- [ ] P1 Postman/OpenAPI export for implemented `/api/v2` endpoints.
- [ ] P2 Webhook event catalog with sample payloads.
