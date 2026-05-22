# Feature Checklist

Last aligned: 2026-05-18 (UX realignment checklist)

This file tracks implemented, partial, and missing capabilities. It should not contain the roadmap narrative or the execution queue.

Strategy and phase intent live in [ROADMAP.md](./ROADMAP.md).

## Legend

| Symbol | Meaning |
|--------|---------|
| `[x]` | **Baseline shipped** — API and/or UI exists for the named capability; parenthetical notes describe what actually landed. **Not** “full TestRail parity.” |
| `[ ]` | Incomplete, partial, or missing. |
| `P0` | Blocks core daily TestRail-like workflow. |
| `P1` | High-value workflow or parity depth. |
| `P2` | Advanced parity, scale, administration, or Enterprise-tier. |

### Completion depth (what `[x]` does *not* mean)

Use these labels when reading bullets, parentheticals, and the report-catalog **Status** column:

| Depth | Meaning | Typical signals in this repo |
|-------|---------|------------------------------|
| **Baseline done** | Minimum slice closes the checklist line: fixed report page and/or GET API, often plus CSV export and saved/scheduled **type registration**. Gaps called out in `(…)` or “out of scope”. | `GET /reports/…`, `/reports/…` page, `reportType` in export/saved/scheduled; “deferred” for HTML/PDF engine. |
| **Partial** | Usable surface exists but template depth, scheduling, provider-native behavior, or TestRail-equivalent UX is incomplete. | Page without full template/scheduling; internal Requirement entity vs References field; v2 empty/stub lists. |
| **Full parity** | Behavior, data model, and operator workflow match TestRail docs closely enough to claim replacement for that feature. | Rare for `[x]` lines; prefer explicit “full parity” wording in the note when true. |
| **Missing** | No intentional baseline yet. | `[ ]` or catalog **Status** = Missing. |

**Rule of thumb:** if the closing note says *baseline*, *fixed page*, *CSV*, *saved/scheduled/export*, or *deferred*, treat the line as **Baseline done**, not full parity.

### Progress meter vs product completeness

| Metric | What it measures | What it does *not* measure |
|--------|------------------|----------------------------|
| **`[x]` count / total lines** | Roadmap checkbox progress for batches in [NEXT_ACTIONS.md](./NEXT_ACTIONS.md). | Weighted product quality or TestRail replacement readiness. |
| **Report catalog Status** | Per-template mapping (page, API, export). | A single report engine or PDF pipeline. |
| **Server tests** | API/domain regression coverage (~70 files in tree). | End-to-end UI workflow safety. |
| **Web tests** | Very small today. | Click-path or visual regression confidence. |

**Honest completeness bands (code-informed, not a scorecard):** use for planning and stakeholder language, not for marketing “% complete.”

| Area | Rough band | Notes |
|------|------------|--------|
| Daily workflow (cases → runs → results) | **75–85%** | High code density; suitable for internal pilot / small-team daily use. |
| TestRail Core parity (breadth) | **60–70%** | Many `[x]` baselines; shared steps, restore/permanent delete, deep print, etc. still open. |
| Reporting parity | **55–65%** | Fixed reports + CSV jobs, not HTML/PDF report engine depth. |
| `/api/v2` compatibility | **55–65%** | Broad surface; some endpoints are compatibility-only or empty lists. |
| Collaboration / integrations | **50–60%** | Inbox, email, webhooks, audit skeletons; provider-native defect flows thinner. |
| Enterprise (SSO, MFA, cross-project, datasets) | **20–30%** | Mostly placeholder or minimal compat. |
| Production hardening | **45–55%** | Builds and server tests OK; rate limits, storage lifecycle, scale proof, web tests weak. |

**Product positioning (short):** past **MVP+** for core test management and execution on a single instance; **not** yet a credible “TestRail replacement” without closing parity depth, reference/integration credibility, report engine, UI regression tests, and ops hardening.

When closing a batch, prefer parentheticals that name **depth** explicitly, e.g. `(baseline: fixed page + CSV + saved/scheduled; HTML/PDF deferred)`.

### Source tags (TestRail docs vs this product)

| Tag | Meaning |
|-----|---------|
| **TR-Core** | Described in TestRail Introduction / core user guide (most projects). |
| **TR-Pro** | Common professional workflow (integrations, deeper reports); not always edition-gated in docs. |
| **TR-Ent** | TestRail Enterprise or explicitly edition-gated in support docs/API. |
| **Clone+** | Intentional product extension; do not treat as TestRail `[x]` parity. |

Official reference hub: [TestRail Support Center](https://support.testrail.com/hc/en-us/).

## Working with [NEXT_ACTIONS.md](./NEXT_ACTIONS.md)

Use this file as the **progress meter**: each development batch should advance **exactly one** checklist line from `[ ]` to `[x]`.

| Rule | Detail |
|------|--------|
| One batch → one line | [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) **Current batch** must quote the target line below verbatim (section + full bullet text). |
| No extra bullets | Do not add new checklist lines to record polish inside an already `[x]` area. Extend that line’s parenthetical when closing a remaining gap, or split a `[ ]` line first, then run a batch against it. |
| Done means `[x]` | When the batch ships, flip **only** the named line to `[x]` and add a short `(…)` note stating **depth** (baseline / partial) and what shipped (routes, pages, export types). |
| Pick work from `[ ]` | Batch candidates are unchecked lines here, not free-form themes. |

If a line is too large for 1–2 PRs, **split it into multiple `[ ]` lines** here first, then queue one line per batch.

---

## TestRail UI/UX Realignment

These lines track the TestRail workbench realignment from [UX_BACKLOG.md](./UX_BACKLOG.md) and [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md). Closing one of these lines requires more than a feature existing: the screen must preserve context, use dense table/list/pane layouts, avoid generic SaaS card/dashboard drift, and include desktop + narrow screenshot walkthrough notes.

- [ ] **TR-Core** P0 UX gate: add a per-PR TestRail parity checklist and current-screen screenshot capture workflow for project overview, cases, run list, run detail, My Tests, milestones, plans, and reports. (Phase 0; do not mark feature work as UX-complete without this gate.)
- [x] **TR-Core** P1 Project shell realignment: make Overview, Test Cases, Test Runs & Results, Milestones, Test Plans, Reports, My Tests, and Settings visible as daily workspace navigation, with consistent project context and compact page chrome. (baseline: `ProjectTabs` now exposes the eight daily project work areas as primary tabs, with Team Todo, Result Explorer, Activity, Automation, Import/Export, and Shared Steps retained under More.)
- [x] **TR-Core** P0 Case repository workbench shell: configurable suite/section tree, center compact case table, right selected-case detail pane, with section/case/filter/page state preserved in the URL. (baseline: TestCaseWorkspace keeps the current persisted left/right section tree position, suite-wide section-grouped case table, QPane detail panel, and `suiteId`/`sectionId`/`panelCaseId`/`display`/`groupBy`/filter/column URL state.)
- [x] **TR-Core** P0 Case repository authoring flow: edit in full-height drawer or dedicated editor while preserving tree/table/detail context; keep Add Case and bulk actions table/section-native. (`CaseEditDrawer` portal + `panelMode=edit`; QPane stays view; row/title opens panel; single-case Edit → drawer; Add Case inline in table.)
- [x] **TR-Core** P1 Run list realignment: dense run table with progress bars, status counts, milestone/plan/assignee/dates, and direct drilldown into filtered execution work. (`GET /runs-overview`; Open plan+run rows with `RunPlanProgressBar`; Completed date grid; sidebar Add Run/Plan + `ChooseSuiteForRunDialog`.)
- [x] **TR-Core** P1 Run creation composition workbench: include-all, selected-cases, dynamic-filter, and set/add/remove semantics shown through a section-tree + case-table picker rather than a generic form-only layout. (`RunCompositionWorkbench`: section tree with include/exclude roots, case table with Set/Add/Remove filter, scheduling strip + scope sidebar.)
- [x] **TR-Core** P0 Run execution workbench shell: persistent status count sidebar/rail, compact test table, and selected-test detail/result pane visible together without losing context. (baseline: RunDetail workbench now keeps status rail, section tree, compact test table, and QPane together; `testId`/`sectionId`/`groupBy` URL state preserved.)
- [x] **TR-Core** P0 Run execution speed actions: row status dropdown, Add Result, Pass & Next, next failed/blocked/untested, bulk results, and closed-run read-only behavior all usable from the execution workbench. (baseline: row quick status/Add Result, QPane Add Result with Pass & Next, failed/blocked/untested navigation, bulk result entry, and closed-run read-only guards are available in the RunDetail workbench.)
- [ ] **TR-Core** P1 My Tests queue realignment: assigned work becomes a primary queue with due/status grouping, direct run/test links, and quick execution entry.
- [ ] **TR-Core** P1 Milestone hub realignment: milestone detail shows linked runs/plans, progress, risk, dates, and one/two-click drilldown. (Ref: MILESTONES_VIEW_PARITY.md)
- [ ] **TR-Core** P1 Test Plan hub realignment: plan detail shows entries/configurations, generated runs, per-entry progress, and run creation under a plan without leaving planning context.
- [ ] **TR-Core** P2 Reports UX realignment: reports start from a TestRail-like template catalog and Add Report configuration flow (Name/Description, Report Options, Access/Scheduling), not a generic dashboard-first layout.
- [ ] **TR-Core** P1 Visual density pass: replace card-heavy product sections with compact toolbars, table sections, sidebars, drawers, status badges, and progress bars across core workflows.

---

## Product Foundation

- [x] **TR-Core** Projects, suites, sections, and auth baseline.
- [x] **TR-Core** Project membership, role guards, member management, and last-owner protection.
- [x] **TR-Core** Operational project shell, project switcher, primary tabs, inbox entry, and project dashboard baseline.
- [x] **TR-Core** P1 Project archive/read-only mode. (`POST .../archive|restore`, `PROJECT_ARCHIVED` on mutations, settings UI + archived banner.)
- [x] **TR-Core** P1 Global default access model. (`InstanceAccessDefaults`, `GET/PATCH /api/admin/access-defaults`, new-project grant mode, member-invite default role, `/admin/access-defaults` UI. Out of scope: custom roles/groups/full permission matrix — line 52.)
- [x] **TR-Core** P1 Users, groups, global roles, custom roles, and permission matrix. (`User.globalRole`, `UserGroup`/`UserGroupMember`, `CustomRole` + project CRUD; `GET /api/admin/users|groups|permission-matrix`; custom roles on members; `cases.write`/`runs.write`/`results.write`/`settings.write`/`members.manage` enforcement on core routes; `/admin/users` + project custom roles UI.)
- [x] **TR-Core** P1 Project types: single repository, single repository with baselines, multiple test suites ([Projects and their types](https://support.testrail.com/hc/en-us/articles/7076923860244)). (`projectType` on projects; suite policy enforcement; master/baseline flags; project create + settings UI; suite switcher on cases; full baseline merge/diff tooling out of scope.)
- [x] **TR-Core** P1 Baseline branches (copy from master suite without affecting master). (`POST .../suites/baselines` copies master sections plus active cases, steps, scenarios, and snapshots into an independent baseline suite; case workspace can create/select baselines without mutating master.)
- [x] **TR-Core** P1 Multi-suite rule: one suite per test run when multiple suites are enabled. (`RUN_SUITE_CASE_MISMATCH` 409 on cross-suite `caseIds`; validate on run create, add tests, and v2 `add_run`; run create UI copy when multiple suites.)
- [ ] **TR-Ent** P2 SSO (OIDC, OAuth 2.0, SAML 2.0) and enforced vs mixed login.
- [ ] **TR-Ent** P2 MFA.
- [ ] **Clone+** P2 Settings sidebar for lower-frequency admin categories.

---

## Test Case Management

- [x] **TR-Core** Case CRUD, case steps, section tree, and suite organization baseline.
- [x] **TR-Core** Case custom values, required-field validation, **field layout templates** (admin), and CSV import/export columns.
- [x] **TR-Core** P1 Default **case templates**: Test Case (Text), Test Case (Steps), Exploratory Session, Behaviour Driven Development, AI Evaluation ([Test case templates](https://support.testrail.com/hc/en-us/articles/14927678348052)). (Five built-in templates per project, template-driven authoring UX, `caseTemplateId` + `expectedResult` on cases; BDD `.feature` import and AI execution pipeline out of scope.)
- [x] **TR-Core** P1 Exploratory template fields (Mission, Goals). (`mission`/`goals` columns; template authoring + read view; CSV import/export; legacy customValues lift)
- [x] **TR-Core** P1 AI Evaluation template and result fields (Quality Rating, Input, Output, Traces, Latency). (`aiInput`/`aiExpectedOutput` on cases; `aiActualOutput`/`aiQualityRating`/`aiLatencyMs`/`aiTraces` on results; authoring + run entry UI; CSV round-trip; legacy customValues lift)
- [x] **TR-Pro** P2 BDD/Gherkin scenarios, scenario-level execution, `.feature` import/export and BDD API ([BDD](https://support.testrail.com/hc/en-us/articles/7827238336916-Behavior-Driven-Development-BDD)). (TestCaseScenario model, case scenario CRUD, result scenarioResults, .feature import/export, BDD UI + v2 get_scenarios/add_scenario.)
- [x] **Clone+** Case version persistence, timeline, compare/restore UI, conflict messaging, and snapshot detail drawer (TestRail Enterprise also offers versioning).
- [x] **TR-Core** Bulk delete, move, copy, archive/restore, priority/type update, saved views, rich filters, optional list columns, and metadata chips.
- [x] **TR-Core** Case and section drag/drop move/copy/reorder with persisted ordering and position APIs.
- [x] **TR-Core** Case/case-step attachment API and basic case detail upload/open/delete UI.
- [x] **TR-Core** P1 Dedicated case detail route (`/projects/:projectId/cases/:caseId`) with read-only page and edit drawer; legacy `?caseId=` redirects ([UX_BACKLOG.md](./UX_BACKLOG.md) UX-4).
- [x] **TR-Core** P1 **References** field: comma-separated external IDs, View Reference URLs, autocomplete issue picker when integration active ([Reference integrations](https://support.testrail.com/hc/en-us/articles/7747333895700)). (`refs` validate/normalize, `reference-urls` + `issues/search` APIs, `CaseRefTokens` + `ReferencesInput` UI; full provider matrix out of scope.)
- [x] **TR-Core** P1 Section move/copy compatibility with saved views, run composition filters, and stale drilldown links.
- [x] **TR-Core** P1 Deeper field edits, labels/refs/custom field list presentation, and partial-failure polish. (Quick-edit metadata panel; label chips + ref tokens in list; custom-field list rows; bulk partial-failure banner with per-case errors)
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
- [x] **TR-Core** P1 Run **start date** and **end date** (optional, editable while active, milestone inheritance, plan/milestone warnings, manual complete — not auto-close on date). (`startedAt`/`dueOn` on create and PATCH while open; milestone inheritance on create; `dateWarnings` on run detail; schedule panel + create form; close via `/close` only — PATCH rejects `closedAt` on open runs.)
- [x] **TR-Core** P1 Run detail views: Status, Activity, Progress sidebar modes.
- [x] **TR-Core** P1 Policy: Untested cannot be set again after a test has any result (TestRail default behavior); run entry, quick entry, and bulk picker use project statuses with disable rules and inline policy copy.
- [x] **TR-Core** P1 Configurable **custom result statuses** (up to seven), colors, `is_final`, `is_untested` ([Statuses](https://support.testrail.com/hc/en-us/articles/7077935129364)). (settings CRUD + `GET /api/projects/{id}/statuses` + run result/quick-entry status chips.)
- [x] **TR-Core** P1 Bulk result entry uses `/results/bulk` with per-row success/failure summary in run UI.
- [x] **TR-Core** P1 Activity/notification drilldown for run composition (`run.tests_added`, `run.test_removed`) with run + case links.
- [x] **TR-Core** P1 Large-run ergonomics beyond bulk feedback (status filter chips, next-failed navigation; [UX_BACKLOG.md](./UX_BACKLOG.md) UX-2).
- [x] **TR-Core** P1 Test change indicator when underlying case changed after run was created. (lockVersion at run + snapshot diff; API `caseChanged` / `changedFields`; run test list badge)
- [x] **TR-Pro** P1 Time tracking beyond elapsed entry (estimates vs actuals in reports). (Shared duration parser, case estimate create/update, run-summary API/CSV estimated vs actual seconds/display/delta fields, report UI columns and overview hints, focused tests.)
- [x] **TR-Core** P1 Run-level progress and completion metrics in UI and API. (`buildRunProgressMetrics`; metrics on run list/detail + `/runs/:id/summary`; run detail UI uses single API; completion counts all non-untested statuses.)
- [x] **TR-Core** P1 Result comment `@mention` notification/email routing baseline.
- [x] **TR-Core** P1 Richer comments on execution workflow beyond result-entry comments. (test/run `ExecutionComment` threads; list/create APIs; run detail discussion panels; @mention on post)

---

## Results And Custom Fields

- [x] **TR-Core** Result custom field scope, value persistence, validation, result history, and result explorer display.
- [x] **TR-Core** Result custom values in run result and result explorer CSV exports.
- [x] **TR-Core** Result explorer custom field exact-match filters.
- [x] **TR-Core** Boolean custom field type for definitions, validation, forms, import, exports, and filtering.
- [x] **TR-Core** P1 Remaining TestRail field types: Checkbox, Date, Dropdown, Integer, Multi-select, String, Text, URL, User, Milestone, Rating, Steps, Step Results, Scenarios, Scenario Results ([Configuring custom fields](https://support.testrail.com/hc/en-us/articles/7373850291220)). (shared type registry + API validation; case/result forms; legacy text/number/select/boolean aliases)
- [x] **TR-Core** P1 Custom field visibility rules per role or template. (`visibility` JSON on definitions; case/result read filtering and write enforcement; `forUse` field list with `access`; settings UI)
- [x] **TR-Core** P1 Advanced result custom field filtering semantics. (operator query params `custom_{name}_op`; contains/range/empty per field type; Result Explorer UI)
- [x] **TR-Core** P2 Result editing/correction policy (product decision; TestRail allows limited correction via new results). (append-only `RESULT_CORRECTION_POLICY`; block PATCH/PUT/DELETE on results; UI hints + add-result copy)

---

## Assignments And To-Do

- [x] **TR-Core** Run assignment, test assignment, My Tests page, status/run/search filters, and execution shortcuts.
- [x] **Clone+** Assignment-related notifications in in-app inbox.
- [x] **TR-Core** P1 **Team to-do** view: see other members’ or whole-team to-dos for workload balancing ([Introduction](https://support.testrail.com/hc/en-us/articles/7076810203028)). (`GET .../tests/team-todo`; member/run/status filters; Team to-do tab + execution links)
- [x] **TR-Core** P1 Due date and milestone filters when fields are available. (`milestoneId`/`dueBefore`/`overdue`/`dueUnset` on assigned-to-me + team-todo; My Tests & Team to-do UI)
- [x] **TR-Core** P1 Aging indicators and notification-driven assignment workflow polish. (`agingLevel` on assignment lists; overdue/due soon/stale badges + summary chips; assignment email deep links + inbox My Tests link)
- [x] **TR-Core** P1 Email when tests are assigned and when others comment or add results to your tests. (`activity` notifications + `activityEnabled` preference; assignee email on execution comments and non-failed results)
- [x] **TR-Core** P1 Subscribe to tests (per-test **Watch** on run rows, email on assignment/failed for subscribers).

---

## Milestones, Plans, And Configurations

- [x] **TR-Core** Milestone CRUD and primary project navigation entry.
- [x] **TR-Core** Plan CRUD, configuration group/value CRUD, matrix preview, run-by-configuration, and rollup baseline.
- [x] **TR-Core** Plan detail matrix/rollup web binding and entry-configuration mapping read baseline.
- [x] **TR-Core** P1 Milestone summary report API, CSV export, report page, milestone detail execution rollup.
- [x] **TR-Core** P1 Plan summary report API, CSV export, and report page.
- [x] **TR-Core** P1 Milestone lifecycle: Upcoming vs Open, manual complete, parent/child milestones ([Milestones](https://support.testrail.com/hc/en-us/articles/15545364561044)). (`lifecycleStatus` from dates/completion; parentMilestoneId hierarchy; start-now/complete/reopen API + list/detail UI)
- [x] **TR-Core** P1 Sub-milestones and richer milestone dashboard widgets beyond current rollup. (hierarchy rollup in milestone-summary API + dashboard; hub/overview/detail progress chips)
- [x] **TR-Core** P1 Full plan-entry semantics: plan-level assignee, refs, start/due dates, per-entry include/exclude and combination editing ([Plans](https://support.testrail.com/hc/en-us/articles/7077711537684)). (plan/entry scheduling fields; include/exclude case selection on run generation; PUT entry configurations + detail UI)
- [x] **TR-Pro** P2 Milestone forecasts and burndown-style hints. (domain forecast + burndown from dates/velocity; milestone-summary `forecast` field; `GET .../milestones/:id/forecast`; detail panel + schedule badges on list/report)
- [x] **TR-Core** P2 `/api/v2` compatibility for milestones, plans, and configurations. (`add/update_milestone`, `add/update_plan`, `add/update_config_group`, `add/update_config`; TestRail field mapping `start_on`/`due_on`/`milestone_id`; contract + mapper tests)

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

Track each template as saved-report or fixed-page parity. **Status** uses the [completion depth](#completion-depth-what-x-does-not-mean) labels above (`Baseline done`, `Partial`, `Missing`) — not “full TestRail template parity.”

Current clone mapping:

| TestRail report (support docs) | Clone target | Status |
|--------------------------------|--------------|--------|
| Summary - Run | Run summary page + CSV | Partial: page exists; template/scheduling not |
| Summary - Project | `/reports/project-summary` + CSV | Baseline done |
| Cases - Activity Summary | `/reports/case-activity` + CSV | Baseline done |
| Cases - Coverage for References | `/reports/refs-coverage` + CSV | Baseline done |
| Cases - Property Distribution | `/reports/case-properties` + CSV | Baseline done |
| Cases - Status Tops | `/reports/status-tops` + CSV | Baseline done |
| Defects - Summary | `/reports/defect-summary` + CSV | Baseline done |
| Defects - Summary for Cases | Defect coverage page | Partial |
| Defects - Summary for References | `/reports/refs-defects` + CSV | Baseline done |
| Results - Comparison for Cases | `/reports/results-comparison` + CSV | Baseline done |
| Results - Comparison for References | `/reports/refs-comparison` + CSV | Baseline done |
| Results - Property Distribution | `/reports/results-properties` + CSV | Baseline done |
| Summary - Milestone | `/reports/milestones` | Baseline done |
| Summary - Plan | `/reports/plans` | Baseline done |
| Users - Workload summary | `/reports/users-workload` + CSV | Baseline done |
| Cross-project: Test Execution Project Summary | TBD | Missing (Enterprise) |
| Cross-project: Test Execution User Workload | TBD | Missing (Enterprise) |
| Print from Cases/Runs/Plans/Milestones | `/print` routes + HTML download | Baseline done |

- [x] **TR-Core** P1 Activity Summary (Cases) report template. (`GET /reports/case-activity-summary`, `/reports/case-activity`, saved/scheduled/export)
- [x] **TR-Core** P1 Cases Property Distribution and Status Tops report templates. (`GET /reports/cases-property-distribution`, `GET /reports/status-tops`, fixed pages, saved/scheduled/export)
- [x] **TR-Core** P1 Defects Summary report template for milestone, plan, or selected runs. (`GET /reports/defect-summary`, scope filters, saved/scheduled/export)
- [x] **TR-Core** P1 Results Comparison for Cases and Results Property Distribution report templates. (`GET /reports/results-case-comparison`, `GET /reports/results-property-distribution`, fixed pages, saved/scheduled/export)
- [x] **TR-Core** P1 Coverage / Comparison for **References** (Cases/Results) aligned to References field, not only internal requirements. (`GET /reports/refs-coverage`, `GET /reports/refs-comparison`, fixed pages, saved/scheduled/export)
- [x] **TR-Core** P1 Summary for References (Defects) report template. (`GET /reports/refs-defect-summary`, `/reports/refs-defects`, saved/scheduled/export)
- [x] **TR-Core** P1 Project Summary and Users Workload summary report templates. (`GET /reports/project-summary`, `GET /reports/users-workload-summary`, fixed pages, saved/scheduled/export)
- [x] **TR-Core** P1 Print-friendly exports from cases, runs, plans, and milestones. (`GET /*/print`, print pages, HTML download; [Print reports](https://support.testrail.com/hc/en-us/articles/7101821797140))

---

## Evidence, Attachments, And Defects

- [x] **TR-Core** Result attachment metadata, signed upload/download URLs, run detail upload/open/delete binding.
- [x] **TR-Pro** Defect links, integration settings, URL-template push, provider feedback, and unlink baseline.
- [x] **Clone+** P1 Production object storage lifecycle and authorization hardening. (project-scoped storage keys + path boundary checks; tombstone on delete + backfill worker; signed URL TTL env; project permission on attachment list/read/download/delete)
- [x] **TR-Core** P1 Attachment preview drawer and upload progress/retry baseline for case and result evidence.
- [x] **TR-Core** P1 Attachment retention and cleanup policy. (env retention bounds + `GET/POST .../settings/attachments/retention-*`; scheduled prune in attachment worker; hard-delete soft-deleted rows past cutoff)
- [x] **TR-Pro** P1 Integration test connection and validation ([Configuring defect integrations](https://support.testrail.com/hc/en-us/articles/7747085183636)). (`POST .../integrations/defects/test-connection`; provider/template validation on save; settings UI Test connection + checks)
- [x] **TR-Pro** P1 Push Defect dialog with provider field mapping (Jira/GitHub/Azure), including custom fields. (`GET .../defects/push-fields`; `PushDefectDialog` on failed/blocked/retest; custom field rows; push payload validation + result traceback)
- [x] **TR-Pro** P1 Provider-native issue create/sync, remote status snapshots, template preview. (`createMode` url_template|provider_api; simulated/HTTP provider create; `POST .../defects/:id/sync`; template-preview API + settings UI; remote status on defect links)
- [x] **TR-Pro** P2 Attachment import/export. (JSON manifest export/import for case, case_step, and result attachments; optional inline base64 + download URLs; async export job `attachments_json`; Import/Export UI section)

---

## Automation And API Compatibility

- [x] **TR-Core** API token baseline.
- [x] **TR-Pro** Automation upload, upload history/detail, failed-item retry, mapping summary/list, and bulk automation result API.
- [x] **TR-Pro** `/api/v2` **partial** compatibility: cases, runs, tests, results, single-resource reads (`get_project`, `get_suite`, `get_section`, `get_milestone`, `get_plan`), result listing (`get_results*`), `get_case_types`, `get_priorities`, suites/sections lists, milestones, plans, `get_statuses` (not full TestRail API surface).
- [x] **TR-Core** P1 Document supported vs unsupported `/api/v2` endpoints in product docs (`GET /api/v2` index + API_SPEC matrix).
- [x] **TR-Core** P1 `get_statuses` and custom status fields in API responses (`get_statuses?project_id=`, `custom_status_id` on status rows).
- [x] **TR-Pro** P1 `/api/v2` list endpoint pagination (`limit`/`offset`, response envelope) on high-traffic list routes (cases, runs, tests, results). (`get_cases`, `get_runs`, `get_tests`, `get_results*`, default limit 250, contract tests.)
- [x] **TR-Core** P1 Token scopes and expiration enforcement. (`scopes` + `expiresInDays` on create; `GET .../tokens/scopes`; automation routes enforce `automation:write` and expiry; Tokens UI for scopes/expiration.)
- [x] **TR-Core** P1 Clearer token creation UX. (Scope presets, expiry guidance, validation feedback, and one-time copyable token secret summary.)
- [x] **TR-Pro** P1 Automation mapping UI, mapping health, upload retry queues, and row-level failure guidance. (Mapping table with unmapped/mapped filters and PATCH mapping; summary health metrics; retry queue list; upload detail row guidance and bulk upload failure preview.)
- [x] **TR-Pro** P2 CI examples and compatibility examples. ([CI_AND_COMPATIBILITY_EXAMPLES.md](./CI_AND_COMPATIBILITY_EXAMPLES.md) covers curl, GitHub Actions, GitLab CI, Jenkins automation uploads, CI metadata, common `/api/v2` read/write flows, status mapping, and troubleshooting.)
- [x] **TR-Pro** P2 Expanded `/api/v2`: projects, suites, sections, milestones, plans, configurations, fields, templates, users, roles, `get_reports`, `run_report`, attachments, labels, groups, shared steps. (`GET /api/v2` supported list covers the expanded surface with empty deferred list; contract tests cover catalog reads, read-only labels/groups/shared steps, case/result attachments, saved-report CSV `run_report`, suite/section/run writes, and high-traffic list pagination.)
- [x] **TR-Ent** P2 `get_case_statuses`, datasets, variables, BDD endpoints, cross-project reports. (`/api/v2/get_case_statuses`; compatibility-only empty `get_datasets`/`get_variables`; BDD scenario aliases plus result scenario read; authenticated cross-project `get_reports`; supported index, API docs, and contract tests.)
- [x] **TR-Pro** P2 API rate-limit behavior documentation (Cloud parity). ([API_SPEC.md](./API_SPEC.md#api-rate-limits): documentation-only baseline, Cloud 180/300 req/min reference, parity gap table, CI guidance; no app-level `429` enforcement.)

---

## Import And Export

- [x] **TR-Core** Case CSV import dry-run/commit API and job history.
- [x] **TR-Core** Case CSV export, run result CSV export, report CSV export jobs, and import/export UI (includes `refs` column, References import aliases, empty refs cells, refs on result explorer and results CSV exports).
- [x] **TR-Core** Case and result custom values in relevant imports/exports.
- [x] **TR-Core** P1 Mapping-driven import/export UX and richer validation guidance. (column mapping UI with auto-suggest and per-project local save; import profile + suggest-mapping APIs; `columnMapping` on import; validation table with row/field/code; import template download; commit gated on successful dry run.)
- [x] **TR-Pro** P1 XML/JSON import/export. (Case JSON/XML import dry-run/commit endpoints, JSON/XML case exports, job history entries, and format selection/guidance in import/export UI.)
- [x] **TR-Pro** P1 Mapping wizard and large async file lifecycle. (4-step CSV import wizard with file upload; async CSV import/export job APIs with poll + download; job tables with 2s polling; ~48KB async threshold.)
- [x] **TR-Pro** P2 TestRail-native export shapes beyond current CSV baselines. (Compatibility-only JSON exports for cases and run results with TestRail-style collection metadata, case `custom_preconds`/`custom_steps_separated`, result `status_id`/`created_on`, export job records, API docs, and focused integration coverage.)

---

## Activity, Notifications, Audit, And Webhooks

- [x] **Clone+** Activity event persistence, writer helper, project activity API/UI.
- [x] **Clone+** Notification inbox, preferences, unread count, and basic targeting.
- [x] **TR-Ent** Audit log query UI with server-side filters and pagination (Enterprise audit depth still partial).
- [x] **TR-Pro** Webhook subscriptions, signed delivery, DB-backed worker, backoff, manual test-send ([Webhooks](https://support.testrail.com/hc/en-us/articles/7169038183572)).
- [x] **TR-Pro** P1 Global (admin) webhooks in addition to per-project webhooks.
- [x] **Clone+** Broad activity coverage for case, run, suite, section, milestone, plan, configuration, requirement, settings, import/export, and report export mutations.
- [x] **Clone+** Drilldown links for milestone, plan, suite, section, requirement, and payload-driven sources.
- [x] **TR-Core** P0 Broader activity event coverage for remaining assignment, defect, and reporting mutations (assignment helpers with `notifyUserId`; bulk `resultIds`; TestRail/automation paths; plan assignment; defect assignee activity; `report.schedule_run_requested`.)
- [x] **TR-Core** P0 Email and digest delivery jobs (`EmailOutbox`, console/SMTP transport, workers, `digestEnabled` on preferences).
- [x] **TR-Core** P1 Email outbox admin UI (project settings: list, retry, digest preview).
- [x] **TR-Core** P1 Mention routing for result comments (`@email`, `@email-local-part`, `@name`) with notification preferences and email outbox.
- [x] **TR-Pro** P1 Webhook auto-disable after consecutive delivery failures (`disabledAt`, re-enable in UI).
- [x] **TR-Pro** P1 Richer webhook and audit filters (webhook `disabledAt`/failure counter; audit actor email, exact match, changes contains).
- [x] **TR-Pro** P1 Disable-on-failure policy and delivery diagnostics UI. (Project threshold via `webhook-delivery-policy`; delivery diagnostics with filters, expandable HTTP/error/body/payload.)
- [x] **TR-Ent** P1 Audit CSV export and retention prune baseline.
- [x] **TR-Ent** P1 Full audit event coverage and admin-level cross-project audit. (v1: `scope=all` query/export/UI toggle plus assignment, defect, saved report, and scheduled report mutation audit rows; future work can add stricter global admin role boundaries.)

---

## Clone Engineering (Not TestRail Parity)

Internal quality and UI architecture; prioritize after TR-Core P0/P1 gaps unless blocking delivery.

- [x] Shared loading/error/empty states baseline.
- [x] Initial query invalidation and polling policy.
- [x] TestRail-like compact result entry dialog from run status badge.
- [x] P1 Shared `StatusBadge`, `FilterBar`, `PageHeader` in `apps/web/src/shared/ui/` (migrated: run filters, reports, My Tests).
- [x] P1 Shared `Button`, `IconButton`, `DataTable`, `Panel`, `Drawer`, and `Toast`. (`shared/ui` primitives; migrated Webhooks, Members, Login, ConfirmDialog, ErrorState, AttachmentPreviewDrawer.)
- [ ] P1 Dense, scannable table-oriented screens for large lists.
- [ ] P1 Centralized query keys per feature.
- [x] P1 UI/UX review pass (analysis: [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md); implementation waves: [UX_BACKLOG.md](./UX_BACKLOG.md); execution queue: [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) for TR-Core/API items only).

---

## Convenience And Productivity

Secondary UX depth; many items mirror TestRail but are tracked here to keep domain sections focused on data and workflow parity. Promote items to P1 in domain sections when they block daily use.

### Navigation, Search, And Deep Links

- [x] P1 Global search across cases, runs, milestones, plans, and defects. (`GET /api/projects/:id/search`; shell search with `C`/`R`/`M`/`P` ID shortcuts.)
- [x] P1 Jump-to by entity ID (`C123`, `R45`, `M12`) from command palette. (`ProjectCommandPalette` ⌘K/Ctrl+K; `C`/`R`/`M`/`P`/`#` tokens; case opens workbench QPane.)
- [x] P1 Recently viewed cases, runs, and milestones. (per-user/project `localStorage`; recorded on case/run/milestone views; shown in `ProjectCommandPalette`.)
- [x] P1 Pinned/favorite projects (and optional suites) in project switcher. (`user-pins` localStorage; `ProjectSwitcher` pinned section + default suite select; `ProjectCard` star toggle.)
- [x] P1 Copy entity link / ID to clipboard. (`EntityCopyActions`: copy display ID + absolute URL on case/run/milestone detail, repository rows, run list.)
- [x] P1 Open in new tab from context menu. (`EntityContextMenuProvider`; right-click on case/run/milestone detail, repository rows, run list.)
- [x] P1 Deep links preserve list filters, sort, pagination, and selected row. (`listViewDeepLink`; `focusCaseId`/`highlightRunId` in URL; copy/share keeps list context; run `testId` deep link wins over auto-select.)
- [x] P2 Cross-project search. (`GET /api/search`; `CrossProjectGlobalSearch` on project dashboard shell; results grouped by project then entity type.)

### Keyboard, Selection, And List Ergonomics

- [x] P1 Keyboard shortcuts and `?` help overlay on run detail (global palette deferred).
- [x] P1 Shift/Ctrl range multi-select on case and run tables. (shared `rangeMultiSelect`; Shift range + Ctrl/Cmd toggle on `CaseRow` and `TestInstanceTable` checkboxes)
- [x] P1 Remember last filter, sort, and column set per page per user. (baseline: case repository persists last section/filter/display/grouping/column state per user/project/suite and restores it when no explicit URL view state is present; URL deep links still win.)
- [x] P1 Column width and visibility persistence. (baseline: case repository column preferences now store visibility and px widths together per user/project/suite; legacy visibility-only preferences still load.)
- [x] P1 Inline quick-edit for safe fields. (baseline: case repository rows support inline title rename plus safe Type/Priority select edits using existing case update validation and version checks.)
- [x] P1 Hover preview for case title, steps, last result. (baseline: case repository rows show a hover preview with title, preconditions, first steps, expected result, and latest execution result loaded through narrow detail/history queries.)
- [x] P2 Density toggle (compact vs comfortable). (case repository + run execution toolbars; per-user/project localStorage)

### Case And Run Shortcuts

- [x] P1 Quick-add case inline in section tree. (per-section + button and Add case menu; inline title form; `createCase` without leaving tree)
- [x] P1 Duplicate case with options (steps, fields, attachments). (`POST /api/cases/:caseId/duplicate`; includeSteps/Fields/Attachments; DuplicateCaseDialog on case detail)
- [x] P1 Print-friendly case view and multi-case print. (single-case `/cases/:id/print`; multi-case `POST/GET .../cases/print` + repository Print selected; composite print sections + HTML page breaks)
- [x] **TR-Core** P1 Print-friendly run, plan, and milestone views. (detail + list Print links open in new tab; run status breakdown table; plan entry linked-run columns; plan/milestone print API tests)
- [x] **TR-Core** P1 Print-friendly report pages. (`GET .../reports/print?reportType=`, template report Print view + HTML download; Print view on ReportExportActions for fixed templates)
- [x] P1 Collapsed section tree state per suite. (`sectionTreeCollapse` localStorage per project+suite; `SectionTreePane` restore on suite switch)
- [x] P1 Select all in section / select visible filter matches. (case list: Select all in section + matching filter via paged fetch; run table: page checkbox + Select all N matching filters across pages; bulk uses full lookup)
- [x] P1 Next/previous test, jump to failed/blocked (run detail toolbar + shortcuts; see [UX_BACKLOG.md](./UX_BACKLOG.md) Wave UX-2).
- [x] P1 Clickable status counts in run summary/sidebar (see [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md) §5).
- [x] P1 Assign to me / clear assignee quick actions. (test table + selected-test sidebar + bulk/run actions panel; `TestAssigneeQuickActions`; PATCH run/test assignee)
- [x] P1 Duplicate run for regression cycles. (`POST /api/runs/:runId/duplicate`; composition + assignee/schedule/env options; DuplicateRunDialog on run detail)
- [x] P2 Compare two runs side-by-side (relates to Comparison for Cases report). (`/runs/compare` + run detail/list shortcuts; reuses `results-case-comparison` API; status badges)

### Reporting And Collaboration Shortcuts

- [x] P1 Export current filtered view; report filter presets. (ReportToolbar: preset picker, Save view, Export CSV/queue with `exportQuery`; URL sync on filtered report pages; results explorer report route; server export filters for run/plan/milestone summaries)
- [x] P1 Copy chart/table summary to clipboard. (ReportSummaryStrip Copy summary; ReportLinesSummaryPanel; ReportTablePanel tableSummaryLines on distribution tables)
- [x] P1 @mention autocomplete; comment templates; rich text comments. (CommentComposer: @mention picker, per-project templates in localStorage, markdown preview; wired to result/run/test comments and execution threads; CommentMarkdown on display)
- [x] P1 Mark all read; inbox filters; snooze/mute categories. (Inbox type/unread tabs, show snoozed, snooze 1h/1d/1w API+UI; mute categories in preferences; mark all read)
- [x] P1 Push defect prefilled from case + comment; recent defects picker. (`buildResultTraceback` + case fields in push-fields; server enrich from test case; `GET .../defects/recent`; `RecentDefectSuggestions` on PushDefectDialog + DefectKeyInput)
- [x] P1 User default landing page, suite, and saved view. (`UserProjectPreference`; `GET/PATCH .../workspace-preferences`; `ProjectLandingPage` redirect; default suite + saved view on cases; settings panel)
- [x] P2 Theme preference (light/dark). (`ThemeProvider` + localStorage; light/dark/system; shell + global dark utilities; header + settings Appearance)

### API Convenience

- [x] P1 API docs panel with copyable curl examples. (`/projects/:id/settings/api-docs`; `GET /api/v2` index; grouped curl snippets with Copy; automation bulk/run examples)
- [x] P1 Postman/OpenAPI export for implemented `/api/v2` endpoints. (`GET /api/v2/openapi.json`, `postman-collection.json`; index `exports` links; ApiDocs download buttons)
- [x] P2 Webhook event catalog with sample payloads. (Settings → Webhooks: searchable catalog, copyable sample JSON and headers via `GET .../webhook-event-catalog`.)
