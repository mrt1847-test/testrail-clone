# TestRail UI/UX Realignment Backlog

Last updated: 2026-05-18

This backlog supersedes the 2026-05-16 quick-win UX waves. Those waves improved isolated interactions, but they did not force the product back into TestRail's core workbench shape. Future UI work should be judged against this document and [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md), not against generic SaaS dashboard polish.

## North Star

The app should feel like a dense test-management workbench:

- Left navigation and section trees define context.
- The primary surface is a compact table/list, not a card grid.
- Details open beside or over the list without losing context.
- Repeated execution actions are one click from the row or detail pane.
- Status, assignment, filters, and progress stay visible while users work.
- Reports use TestRail-like template/configuration flows, not marketing-style dashboards.

## Non-Negotiable UI Rules

- Do not add landing-page, hero, decorative, or marketing-style layouts to product screens.
- Do not use cards as the default page structure. Use tables, split panes, sidebars, toolbars, tabs, and drawers.
- Do not hide core daily work behind "More" when TestRail exposes it as a primary area.
- Do not create isolated feature widgets unless they link directly to filtered work.
- Do not mark a UX task complete without a screenshot walkthrough for desktop and narrow viewport.
- Do not ship a "TestRail-like" screen unless the acceptance checks below pass.

## Source References

Official TestRail docs used as parity anchors:

- Introduction to TestRail: https://support.testrail.com/hc/en-us/articles/7076810203028
- Adding test cases: https://support.testrail.com/hc/en-us/articles/14438119644692-Adding-test-cases
- Sections: https://support.testrail.com/hc/en-us/articles/14985199889812-Sections
- Creating new test runs: https://support.testrail.com/hc/en-us/articles/7076838639892
- Submitting test results: https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results
- Results: https://support.testrail.com/hc/en-us/articles/7077819312404-Results
- Runs Summary report: https://support.testrail.com/hc/en-us/articles/9444425638292-Runs-Summary-report
- Comparison for Cases report: https://support.testrail.com/hc/en-us/articles/9171491041428-Comparison-for-Cases-Results-report

## Phase 0 - Design Lock Before More Features

Goal: stop the app from drifting further away from TestRail.

Tasks:

- Capture current screenshots for core routes: project overview, cases, run list, run detail, my tests, milestones, plans, reports.
- Add a "TestRail parity checklist" to every UX PR description.
- Define shared density tokens: table row height, toolbar height, pane width, sidebar width, badge styles.
- Audit and label each product screen as `workbench`, `table`, `split-pane`, `wizard`, `report-config`, or `settings`.
- Flag screens that are currently card/dashboard-heavy and need rework.

Done when:

- [ ] `docs/SCREEN_INVENTORY.md` includes screenshot notes for the core routes.
- [ ] Each route has a target layout type.
- [ ] New UX work cannot be marked done without acceptance checks.

## Phase 1 - Global App Shell And Navigation

Problem: the current app can look like a generic SaaS portal instead of a TestRail project workspace.

Tasks:

- Rework project navigation so daily areas are primary: Overview, Test Cases, Test Runs & Results, Milestones, Test Plans, Reports, My Tests, Settings.
- Keep project context visible on all project routes.
- Replace broad card-like page sections with compact page headers, toolbar rows, tab rows, and content panes.
- Make breadcrumbs and back-links consistent for nested routes.
- Add "recent run" and "assigned to me" shortcuts only if they route directly to filtered work.

Done when:

- [ ] My Tests and Test Plans are not buried in a generic overflow menu on desktop.
- [ ] Every project page has the same shell rhythm: header, tabs/toolbar, work surface.
- [ ] No core page starts with decorative summary cards unless each item is a filter/drilldown.

## Phase 2 - Test Case Repository Workbench

Problem: TestRail's case repository is a section-driven editing workbench; our UI still risks feeling like a generic CRUD page.

Target shape:

- Left: suite/section tree with add/rename/reorder affordances.
- Center: compact case table grouped or filtered by section.
- Right: selected case detail/preview pane.
- Edit: full-height drawer or dedicated edit route, preserving section/table context.

Tasks:

- Replace any oversized case cards or row expansion-heavy editing with a stable 3-pane layout.
- Keep Add Case available at the selected section and at section bottoms where appropriate.
- Make bulk actions table-native: select, move, copy, archive, delete, assign, set priority/type.
- Put case metadata in a right-side summary area; steps and expected results should remain readable.
- Add route state for selected section, selected case, filters, and page.

Done when:

- [ ] Selecting a section updates the table without losing the tree.
- [ ] Selecting a case opens detail without leaving the repository context.
- [ ] Editing a case gives enough width for steps, custom fields, attachments, and history.
- [ ] The center table shows all cases in the suite grouped by section (not just one section at a time).
- [ ] Bulk operation feedback stays near the table.

## Phase 3 - Run List And Run Creation

Problem: TestRail run creation is about choosing the right cases quickly, not filling a generic form.

Target shape:

- Run list: dense table with progress bar, status counts, milestone/plan/assignee columns.
- Run create/edit: wizard-like composition area with include all, select specific cases, dynamic filter, add/set/remove semantics.
- Case picker: section tree + case table, mirroring the case repository.

Tasks:

- Add progress bars and visible status count summary to run rows.
- Rework run creation into a two-column composition screen: configuration left, selected cases/filters right.
- Keep milestone, plan, assignee, dates, and environment visible without bloating the primary form.
- Make "include all" and "selected cases" behavior visually explicit.

Done when:

- [ ] A tester can tell run health from the list without opening each run.
- [ ] Run creation clearly shows which cases will be included.
- [ ] Dynamic filter behavior explains set/add/remove selection in operational terms.

## Phase 4 - Run Execution Workbench

Problem: this is the most important TestRail workflow. It must prioritize speed over decoration.

Target shape:

- Left or side: status filter counts and run navigation.
- Center: section-grouped test table with status dropdown, assignee, elapsed, defects, and latest result cues.
- Right: selected test detail/result pane with case context, history, attachments, defects, comments.
- Top toolbar: add result, pass & next, next failed/blocked/untested, bulk actions, close/reopen.

Tasks:

- Make status counts a persistent sidebar or left rail, not just a summary chip row.
- Allow result submission directly from the row status dropdown and from the detail pane.
- Add Pass & Next and next-by-status navigation.
- Keep result history and case steps visible during execution.
- Make bulk results, rerun, add/remove tests, assign, and subscribe actions table-native.
- Preserve selected test, status filter, search, assignee filter, and page in the URL.

Done when:

- [ ] A user can filter to failed tests in one click from visible counts.
- [ ] A user can submit pass/fail and move to the next relevant test without returning to the table manually.
- [ ] The selected test detail does not hide the test list.
- [ ] Navigating between tests using 'Pass & Next' keeps the QPane open and updates URL state.
- [ ] Closed runs clearly become read-only.

## Phase 5 - My Tests And Team Workload

Problem: assigned work should feel like a tester's queue, not a secondary report.

Target shape:

- My Tests: primary queue with status, due date, milestone, run, project, and quick result entry.
- Team Todo: manager view with assignee grouping and aging/due filters.

Tasks:

- Promote My Tests as a primary project/global work area.
- Add queue-style grouping: overdue, due soon, failed/retest, untested.
- Link every row into the exact run/test context.
- Support quick assignment changes where roles allow.

Done when:

- [ ] Assigned work is reachable in one click from the project shell.
- [ ] Row actions route to the execution workbench, not detached modals.

## Phase 6 - Milestones And Test Plans

Problem: TestRail treats milestones and plans as planning/execution hubs, not simple lists.

Target shape:

- Milestone detail: progress, linked runs, linked plans, dates, open risks.
- Plan detail: entries/configurations, generated runs, per-entry progress.

Tasks:

- Give milestone and plan details split-pane/table layouts.
- Make "create run under milestone/plan" a first-class action.
- Surface overdue/open/failed counts in compact summary strips.
- Keep linked run tables dense and drillable.

Done when:

- [ ] A release manager can move from milestone to failing run/test in one or two clicks.
- [ ] Plan entries show generated runs and progress without opening every entry.

## Phase 7 - Reports

Problem: current report screens can become custom dashboards. TestRail reports are template/configuration-driven.

Target shape:

- Reports landing: template list by category.
- Add report: Name/Description, Report Options, Access/Scheduling.
- Report output: generated document with summary, charts/tables, and drilldowns.

Tasks:

- Rework reports overview away from generic dashboard cards toward a template catalog.
- Add report configuration pages for priority reports instead of only static pages.
- Keep saved reports and scheduled reports close to generated reports.
- Ensure chart/table segments drill into filtered cases/runs/tests.

Done when:

- [ ] Reports start from a template/category selection.
- [ ] Report configuration feels like TestRail's report options flow.
- [ ] Output tables preserve dense, printable structure.

## Phase 8 - Visual System Correction

Problem: small styling choices accumulate into "not TestRail".

Tasks:

- Normalize density: compact rows, narrow toolbars, restrained spacing.
- Replace large rounded cards with bordered table sections and pane dividers.
- Use a restrained status-first palette. Avoid one-note purple/blue dashboard theming.
- Standardize status badges and progress bars.
- Ensure action buttons look like operational commands, not marketing CTAs.
- Prefer text links and compact icon buttons inside dense tables.

Done when:

- [ ] Core workflows fit more information above the fold than before.
- [ ] Tables, sidebars, drawers, and toolbars share a consistent visual grammar.
- [ ] No product route looks like a SaaS landing page.

## Review Gate For Every UX PR

Each PR must answer:

- Which TestRail workflow does this align with?
- Which official source or screenshot is the parity anchor?
- Does the primary surface remain a table/list/workbench?
- What got faster for a tester or test manager?
- What route state is preserved?
- What screenshots prove desktop and narrow layouts?
- What was intentionally left different from TestRail, and why?

## Immediate Next PR Recommendation

Do not start with reports or decorative polish.

Start with the case repository and run execution workbenches:

1. Case repository 3-pane layout.
2. Run execution persistent status sidebar + table + detail pane.
3. Global project navigation cleanup.

These three changes will most directly fix the "does not feel like TestRail" problem.
