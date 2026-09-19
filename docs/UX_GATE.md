# UX Gate

This gate checks whether testers can manage cases and actually perform, record and resume tests in a simple TestRail-like workspace. Visual proof supports that judgment; it cannot replace the workflow.

For this usability program, [USABILITY_REALIGNMENT_2026-09-18.md](./USABILITY_REALIGNMENT_2026-09-18.md) is controlling: its tester-first policy, state-specific rules, supersession register, visual-target review and unit/regression/integration tiers take precedence. This generic checklist neither certifies usability by screenshot alone nor overrides the one-unit NEXT_ACTIONS queue.

## Required PR Checklist

Every PR that changes project-scoped UX must include this checklist:

- [ ] I identified the single primary user task and the one dominant CTA, if a CTA is needed.
- [ ] I classified visible actions as primary, secondary, contextual, utility, or administrative.
- [ ] I removed redundant same-context entry points and disclosed non-daily utilities, preserving intentional shared-dialog entries from Run-list Status and panel Add result, and quiet outline versus full authoring.
- [ ] I used shared workbench, button, field, table, dialog/drawer, and feedback components, or documented a concrete exception.
- [ ] I identified the touched target layout type: `workbench`, `table`, `split-pane`, `wizard`, `report-config`, or `settings`.
- [ ] I captured desktop and narrow screenshots for every touched core route, or explained why the route is not affected.
- [ ] I checked that project context stays visible and navigation does not fall back to a generic SaaS dashboard pattern.
- [ ] I checked dense table/list/pane layout above the fold.
- [ ] I checked that entity titles remain readable before optional metadata columns are shown.
- [ ] I checked that selecting rows reveals relevant bulk actions next to the selection.
- [ ] I checked that URL state, selected entities, filters, section tree position, and right/left pane placement are preserved where applicable.
- [ ] I checked empty, loading, and error states if this PR changes data loading or route structure.
- [ ] I linked the screenshot folder or artifact in the PR.
- [ ] I linked the reviewed visual target for material layout changes, distinguished tester review from automated/UI checks, and recorded blocked checks without calling them passed.

For Test Cases and Run Execution, also apply the action hierarchy and task backlog in [USABILITY_REALIGNMENT_2026-09-18.md](./USABILITY_REALIGNMENT_2026-09-18.md).

## Tester-workflow acceptance — rewritten 2026-09-20

Use the controlling document's 19 UX specifications and J01–J08, not the old component-migration or row-count tasks. A scoped UI unit checks its affected scenario steps and shared regressions; UI-021 consolidates the complete workflow. Do not demand every scenario from every small change or automatically pass a UX gate because a contributing UI unit is checked.

- [ ] The tester identifies section hierarchy/ownership and distinguishes selected-only, subtree and all-section scope from Filter/View. Reading a row does not select it for bulk actions.
- [ ] Newly authored Text/Steps instructions persist and are readable in the intended Run; title-only creation is not proof of executable case authoring.
- [ ] Run membership matches the chosen all/selected/dynamic contract and target IDs. Case definitions and per-Run results are not confused.
- [ ] The selected test displays applicable preconditions, actions and expected results before recording. Missing/loading/failed instructions are distinct; row count cannot compensate for absent procedure.
- [ ] Panel Add result and row Status open the same compact form. Its two-column reference layout, cancel-without-writes, ordinary save versus explicit next, and return to instruction context work.
- [ ] Result creation failure differs from attachment/assignment partial failure. Drafts and persisted results are not lost or duplicated; failed operations can be retried on the same target.
- [ ] Actual evidence files can be reopened/downloaded and compared with originals. Defects, metadata, assignee and history read-back match the saved result. Mock success or unsupported-storage rejection is not this proof.
- [ ] Bulk actions target precisely the declared set; filter/page/section changes cannot leave undisclosed write targets.
- [ ] Hub/My Tests/Plan navigation opens the intended Run/test and supports resuming with understandable state, rather than simply matching headers.
- [ ] Real keyboard, focus return, error feedback and 1440×1000/1280×720/390×844 flows are exercised. Programmatic focus and accessible names alone do not prove Tab/Shift+Tab operation.
- [ ] A representative tester receives task goals, not click instructions. Record completion, confusion, wrong turns and help needed separately from developer demonstration and automated tests. Required tester/design review missing means pending, not accepted.

For UI-021, record one verdict per UX ID: actual/expected behavior, scenario/step, pass/fail/blocked/pending, viewport/role/build, evidence, and narrowly scoped remaining repair. UI-031/UI-051 storage and keyboard debt plus UI-051's pending review and instruction-load exception must be resolved or explicitly block the applicable gates. Preserve historical delivery checks; do not manufacture acceptance or implement new repairs inside the validation-only batch.

## Screenshot Capture Workflow

1. Start the app locally.
   - Web: `npm run dev:web`
   - Server: `npm run dev:server`
2. Prepare a capture folder and manifest.
   - `npm run ux:screenshots:prepare -- --projectId 1`
   - On Windows PowerShell, use `npm.cmd run ux:screenshots:prepare -- --projectId 1` if script execution policy blocks `npm`.
   - Use another project id if the seed/local database uses a different id.
3. Open each route from the generated manifest.
4. Capture all three viewports for the changed states required by the current unit:
   - Desktop: `1440x1000`
   - Laptop: `1280x720`
   - Narrow: `390x844`
5. Save screenshots using the generated file names.
6. Paste the screenshot folder path into the PR checklist.

The capture workflow is intentionally manual-compatible. If browser automation is available, use the same route and filename manifest so artifacts remain comparable between PRs.

## Core Route Matrix

| Route key | Route pattern | Target layout | Required captures |
|-----------|---------------|---------------|-------------------|
| overview | `/projects/:projectId` | workbench | desktop, narrow |
| cases | `/projects/:projectId/cases` | split-pane | desktop, narrow |
| run-list | `/projects/:projectId/runs` | workbench | desktop, narrow |
| run-detail | `/projects/:projectId/runs/:runId` | split-pane | desktop, narrow |
| my-tests | `/projects/:projectId/my-tests` | table | desktop, narrow |
| milestones | `/projects/:projectId/milestones` | workbench | desktop, narrow |
| plans | `/projects/:projectId/plans` | workbench | desktop, narrow |
| reports | `/projects/:projectId/reports` | report-config | desktop, narrow |

## Route State Requirements

- Case repository: preserve Suite, explicit section query scope, panel selection/mode, filters, columns/grouping and tree-side preference under the current URL/view contract. Do not re-couple query membership to legacy display/density settings.
- Run detail: preserve `testId`, section/group/status filtering, selected test context and intended navigation. Preserve the meaning of old preferences where relevant, not the removed permanent statistics sidebar; the current target is top-of-run statistics.
- Run list, milestones, plans, reports, and My Tests: preserve filters and drilldown links across desktop and narrow captures.

## Artifact Location

Generated capture folders should use:

`docs/artifacts/ux-screenshots/YYYY-MM-DD/`

Screenshots may be committed only when needed for documentation. For ordinary PRs, attach them to the PR and keep only the manifest or checklist note in the branch.

For the UI-* program, use `docs/ux-evidence/UI-XXX.md` as the per-unit evidence record and link its images/artifacts. Scope captures to the current unit; UI-021 consolidates the final tester journey, UX gate verdicts and outstanding real-storage/keyboard checks. An artifact path or unsupported-storage error demonstration alone is not proof of successful result evidence storage.
