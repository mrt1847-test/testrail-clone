# TestRail UI/UX Gap Analysis - Reassessment

Last updated: 2026-05-18

This reassessment explains why the previous UX backlog did not produce a TestRail-like product, even after the listed waves were marked shipped. The previous analysis identified useful features, but it focused too much on individual interactions and too little on the full workbench shape of TestRail.

## Diagnosis

The earlier work missed three product-level constraints:

1. It treated TestRail parity as a set of components.
   Status chips, drawers, filters, and shared badges help, but they do not by themselves create the TestRail flow.

2. It allowed generic SaaS layout patterns.
   Summary cards, dashboard sections, roomy panels, and generic page chrome can make the app feel polished while moving it away from TestRail's dense operational UI.

3. It lacked a hard acceptance gate.
   A wave could be marked "shipped" when code existed, even if the route still did not behave like a TestRail workbench.

## Stronger Evaluation Rubric

Use this rubric for each core route. A screen must score at least 2 in every category before it can be called TestRail-aligned.

| Dimension | 1 - Off Target | 2 - Usable | 3 - TestRail-like |
| --- | --- | --- | --- |
| Information architecture | Work hidden behind generic nav or cards | Main route exists | Daily work is primary and context stays visible |
| Density | Large cards and sparse blocks dominate | Tables exist but compete with panels | Compact tables, sidebars, toolbars, and panes dominate |
| Workflow speed | Actions require context switching | Common actions exist | Repeated tester actions are one click from row/pane |
| Continuity | Modals/pages lose list context | Some state preserved | Tree/list/detail context persists throughout task |
| Drilldown | Summary is passive | Some links exist | Status/progress widgets become filtered work queues |
| Visual grammar | Generic SaaS | Mixed | Test-management workbench: restrained, dense, status-first |

## Official TestRail Patterns Used

The following official docs are the current parity anchors:

- Test cases are organized into sections and sub-sections, and users run tests from test runs: https://support.testrail.com/hc/en-us/articles/7076810203028
- Adding test cases starts from Test Cases / Test Suites & Cases, with quick add options in sections: https://support.testrail.com/hc/en-us/articles/14438119644692-Adding-test-cases
- Sections are hierarchical containers for organizing cases: https://support.testrail.com/hc/en-us/articles/14985199889812-Sections
- Test run creation centers on include all, specific case selection, and filters: https://support.testrail.com/hc/en-us/articles/7076838639892
- Results can be submitted through status dropdowns, Add Result, Pass & Next, bulk submission, and individual test pages: https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results
- Tests belong to runs and results capture execution history/status: https://support.testrail.com/hc/en-us/articles/7077819312404-Results
- Runs Summary reports are generated report outputs with progress/activity/status breakdowns: https://support.testrail.com/hc/en-us/articles/9444425638292-Runs-Summary-report
- Comparison for Cases reports use report configuration sections and selected test runs/cases: https://support.testrail.com/hc/en-us/articles/9171491041428-Comparison-for-Cases-Results-report

## Core Screen Gaps

### Project Shell

Current risk:

- The app can read as a project dashboard instead of a test management workspace.
- Some daily work areas are not visually promoted enough.

Target:

- Project-level navigation should make Test Cases, Test Runs & Results, Milestones, Test Plans, Reports, My Tests, and Settings obvious.
- Overview widgets must be drilldown entry points, not decorative summaries.

Severity: P1

**Concrete breakdown (project Overview HTML, line chart, 2-column summaries, sidebar Actions/Todos):** [references/testrail/PROJECT_OVERVIEW_VIEW_PARITY.md](./references/testrail/PROJECT_OVERVIEW_VIEW_PARITY.md).

### Test Case Repository

Current risk:

- Case detail/edit flows can feel like generic CRUD.
- Expanding or navigating away from the list can break repository context.

Target:

- Configurable left/right section tree, center case table, right selected case detail.
- Edit in a full-height drawer or dedicated editor while preserving section/list context.
- Bulk actions and add-case actions remain table/section-native.

Severity: P0 for UX parity

**Concrete breakdown (suites/view HTML, grouped grid, header/toolbar, sidebar tree):** [references/testrail/CASE_REPOSITORY_VIEW_PARITY.md](./references/testrail/CASE_REPOSITORY_VIEW_PARITY.md).

### Run List

Current risk:

- Runs can look like a normal table without enough execution signal.

Target:

- Dense rows with progress bars, status counts, milestone/plan, assignee, dates, and quick drilldown.

Severity: P1

**Concrete breakdown (runs/overview HTML, Open plan+run rows, Completed grid, sidebar group/order):** [references/testrail/RUNS_OVERVIEW_VIEW_PARITY.md](./references/testrail/RUNS_OVERVIEW_VIEW_PARITY.md). Single-run execution: [references/testrail/RUN_EXECUTION_VIEW_PARITY.md](./references/testrail/RUN_EXECUTION_VIEW_PARITY.md).

### Run Creation

Current risk:

- A form-first layout can obscure the main job: selecting which cases enter the run.

Target:

- Composition-first wizard: include all, select specific cases, dynamic filters, set/add/remove semantics.
- Case picker mirrors the case repository with section tree and case table.

Severity: P1

### Run Execution

Current risk:

- This is the highest-risk area. If execution is not dense and fast, the clone will never feel like TestRail.

Target:

- Persistent status counts/sidebar.
- Compact test table.
- Selected test detail/result pane.
- Status dropdown, Add Result, Pass & Next, bulk results, next failed/blocked/untested.
- URL-preserved selection and filters.

Severity: P0 for UX parity

### My Tests

Current risk:

- Assigned work can feel like a secondary report.

Target:

- Queue-first view with due/status grouping and direct links into run execution.

Severity: P1

### Milestones And Plans

Current risk:

- They can become simple management lists rather than release planning hubs.

Target:

- Detail pages show linked runs/plans, progress, risk, dates, and direct drilldown into failing work.

Severity: P1

**Concrete breakdown (milestones/overview HTML, Open sections, progress bars, display density):** [references/testrail/MILESTONES_VIEW_PARITY.md](./references/testrail/MILESTONES_VIEW_PARITY.md).

### Reports

Current risk:

- Report pages can drift into custom dashboards.

Target:

- Template catalog, add-report configuration sections, generated outputs, saved/scheduled report management.

Severity: P2 after execution/cases are corrected

## Why The Previous Backlog Was Insufficient

| Previous item | Why it helped | Why it was not enough |
| --- | --- | --- |
| Clickable run summary chips | Added useful filtering | Did not reshape run execution around a persistent status/navigation rail |
| Promote My Tests/Plans | Improved discoverability | Did not define a full project shell hierarchy |
| Status sidebar | Correct feature direction | Needed stricter layout acceptance: sidebar + table + detail pane together |
| Shared primitives | Reduced inconsistency | Generic primitives can still produce generic SaaS UI |
| Case detail route/drawer | Better than row expansion | Still needed a repository-level 3-pane target |

## New Priority Order

1. Run execution workbench.
2. Case repository workbench.
3. Project shell/navigation.
4. Run creation/case picker.
5. Milestone/plan hubs.
6. My Tests queue.
7. Reports template/configuration flow.
8. Visual density and component consolidation.

## Acceptance Tests

Before a UX task is marked done:

- Walk through a tester adding five results in a run.
- Walk through a manager finding all failed tests in a milestone.
- Walk through a tester adding/editing a case inside a nested section.
- Walk through creating a run from selected sections/cases.
- Walk through opening assigned work from My Tests and submitting a result.

For each walkthrough, record:

- Click count.
- Whether list/tree context was preserved.
- Whether filters/selection stayed in the URL.
- Whether the primary surface was table/list/pane-based.
- Screenshot evidence.

## Explicit Anti-Goals

- Do not chase a modern dashboard aesthetic at the expense of execution speed.
- Do not use large cards as the dominant layout for cases, runs, or execution.
- Do not create isolated report-like screens for workflows that should be work queues.
- Do not call a screen TestRail-like because it has the same nouns; the interaction structure must match.

## Next Action

Start with a design/implementation PR for the run execution workbench. It should be judged by the ability to execute, filter, navigate, and review tests without losing the table/detail context.

**Concrete breakdown (HTML snapshot, region mapping, waves A–E):** [references/testrail/RUN_EXECUTION_VIEW_PARITY.md](./references/testrail/RUN_EXECUTION_VIEW_PARITY.md).
- Target action is currently queued as **Current batch** in [NEXT_ACTIONS.md](../../NEXT_ACTIONS.md).
