# Roadmap

Last aligned: 2026-05-16 (TestRail parity alignment)

This file defines product direction, phase priorities, and strategy. Update it only when direction, stage, or strategy changes.

It should stay concise. Detailed status lives in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md), and immediate work lives in [NEXT_ACTIONS.md](./NEXT_ACTIONS.md).

## Product Direction

Build a TestRail-like QA management product around the daily workflow:

1. Maintain test case repositories.
2. Compose runs from suites, sections, milestones, plans, and selected cases.
3. Execute tests quickly with result history, evidence, defects, and timing.
4. Review release risk through dashboards, reports, traceability, milestones, and plans.
5. Notify people and integrations from workflow events.
6. Expand compatibility, migration, and administration after the core workflow is dependable.

## TestRail Alignment Strategy

We align to [TestRail Support Center](https://support.testrail.com/hc/en-us/) behavior and vocabulary, but we do not copy every screen or Enterprise-only feature by default.

| Lens | Meaning |
|------|---------|
| **Core parity** | Daily workflow from TestRail Introduction: cases, runs, results, milestones, plans, assignments, dashboard progress, basic integrations. |
| **Documented gaps** | Official TestRail features we have not matched yet (dynamic run filters, project types, References model, report template engine, email subscriptions). Tracked in checklist **TestRail Parity Gaps**. |
| **Clone extensions** | Capabilities that improve the product but are not TestRail equivalents (in-app inbox, first-class Requirement entities, richer webhook worker). Tagged **Clone+** in the checklist. |
| **Enterprise later** | SSO, MFA, case approval workflow, datasets/variables, cross-project report API, `get_case_statuses` — scheduled after core parity is dependable. |

Reporting direction: move from a **small set of fixed analysis pages** toward **saved report definitions** that can produce HTML/PDF/CSV and optional email delivery, while keeping current pages as first-class report types where they already answer release-review questions.

Traceability direction: keep the internal **Requirement** module, and add explicit **References / external issue** parity (View URLs, issue picker, reference-based coverage reports) so migration from TestRail Jira workflows stays credible.

Run composition direction: close the gap on **dynamic filters** and **include-all live sync** before investing in advanced administration; these are core TestRail run behaviors, not optional polish.

## Current Phase

### Phase A: Core Workflow Completion

Goal: make case management, run execution, and result review usable end to end from the UI, and close the highest-impact TestRail core gaps.

Priorities:
- Keep run execution screens fast, compact, and TestRail-like (baseline below).
- Close **run composition parity**: dynamic filters, include-all behavior, run schedule fields, composition change indicators.
- Make project and milestone dashboards useful for daily review.
- Finish high-value case repository productivity gaps (sections, attachments, References field UX).
- Strengthen report drilldowns; begin **saved report / export history** foundation.
- Expand activity/notification coverage; deliver **email** for assignment and result events (not only in-app inbox).

### UI baseline (TestRail-like)

Product-wide UX direction for core QA workflows (gap detail: [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md); implementation waves: [UX_BACKLOG.md](./UX_BACKLOG.md)):

- Project dashboards: operational summary and execution graphs; drilldowns from widgets where useful.
- Milestones visible in primary navigation; milestone detail shows rollup and linked runs.
- Execution lists compact and scannable; results from status/row actions, not extra table columns.
- Reports: shared header, filter bar, summary strip, export, drilldown links.
- Low-frequency admin/settings out of crowded primary tabs.

Exit criteria:
- Users can create and organize cases, compose runs, execute results, and review outcomes without hidden API-only paths.
- Large run and case lists stay paginated, filterable, and scannable.
- Reports and activity links route back to source cases, runs, tests, results, defects, evidence, milestones, or plans.
- Milestone and plan summary reporting is available for release review.
- Top documented **TestRail Parity Gaps** marked P0/P1 in the checklist have owners or are in active delivery (see checklist).

## Delivery Phases

### Phase 1: Execution Core

Focus:
- Run composition: all cases, selected cases, exclusions, section subtrees, **dynamic filters**, **include-all live sync**, filter/add/remove semantics.
- Run **start/end dates**, milestone inheritance, and manual complete/close policy.
- Large-run table pagination/filtering; status sidebar filters; next-failed / assigned-to-me navigation.
- Result entry, history, close/reopen policy, defects, evidence, elapsed time, **custom result statuses**.
- TestRail-like execution UX; **untested cannot be re-applied** after first result when we adopt that policy.

### Phase 2: Case Repository Safety

Focus:
- Version history, compare, restore, and conflict handling (Clone+ depth; TestRail Enterprise also versions cases).
- Section tree ordering, move/copy semantics, saved views, bulk operations, **section compatibility** after moves.
- **Case templates**: Text, Steps, Exploratory Session, BDD/Gherkin, AI Evaluation.
- **References** field, View URLs, external issue picker; align traceability reports with reference coverage where useful.
- Attachments: previews, upload progress, historical download semantics.
- Shared steps; labels; deleted-case restore.

### Phase 3: Dashboards And Reporting

Focus:
- Project dashboard summaries, execution graphs, milestone/plan rollups.
- Fixed report pages (run summary, result explorer, traceability, coverage, defects): polish and filter/export parity.
- **Report template catalog**: saved definitions, `run_report`-style execution, HTML/PDF output, history/downloads, scheduled/email delivery.
- Map remaining TestRail built-in reports (activity, case comparison, reference/defect summaries, user workload) over time.
- Cross-project reports (Enterprise parity) after single-project template flow works.

### Phase 4: Collaboration And Integrations

Focus:
- **Email notifications** and per-test/run **subscriptions** (TestRail to-do model), plus existing in-app inbox.
- Team to-do views for leads; @mentions and comment workflow on results.
- Activity coverage, notification targeting, digest jobs, audit coverage.
- Webhook reliability (global + project scope), retry policy, disable-on-failure, delivery diagnostics.
- Defect integrations: validation, Push Defect dialog, provider-native create/sync, field mapping.

### Phase 5: Administration And Compatibility

Focus:
- **Project types**: single repository, baseline support, multi-suite rules.
- Custom fields (full TestRail type set), case statuses, roles, groups, permission matrix, project archive.
- Import/export depth and TestRail-compatible export shapes.
- Expanded `/api/v2` by migration impact; token scopes; automation mapping UI.
- Rate-limit documentation for Cloud-style deployments.

### Phase 6: Enterprise Parity (Deferred)

Focus:
- SSO (OIDC/OAuth/SAML), MFA.
- Test case review and approval workflow (`get_case_statuses`).
- Datasets, variables, and data-driven cases.
- Cross-project report API (`get_cross_project_reports` / `run_cross_project_report`).
- Deep audit export, retention, and admin policies where required for enterprise adoption.

## Priority Rules

1. Preserve the case -> run -> test instance -> result history model.
2. Prefer DB-backed, paginated, indexed workflows over client-only expansion.
3. Fix execution and review bottlenecks before advanced administration.
4. Close **TestRail Parity Gaps** marked P0/P1 before Phase 6 Enterprise features unless explicitly requested.
5. Use TestRail-like UX for core QA workflows, but avoid copying clutter; tag Clone+ extensions in the checklist.
6. Keep this file phase-level; move detailed status to [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) and immediate tasks to [NEXT_ACTIONS.md](./NEXT_ACTIONS.md).
