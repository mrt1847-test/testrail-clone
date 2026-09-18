# UX Gate

This gate keeps TestRail parity work from being marked complete without visual proof.

## Required PR Checklist

Every PR that changes project-scoped UX must include this checklist:

- [ ] I identified the single primary user task and the one dominant CTA, if a CTA is needed.
- [ ] I classified visible actions as primary, secondary, contextual, utility, or administrative.
- [ ] I removed duplicate entry points and moved non-daily utilities into an overflow or contextual surface.
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

For Test Cases and Run Execution, also apply the action hierarchy and task backlog in [USABILITY_REALIGNMENT_2026-09-18.md](./USABILITY_REALIGNMENT_2026-09-18.md).

## Screenshot Capture Workflow

1. Start the app locally.
   - Web: `npm run dev:web`
   - Server: `npm run dev:server`
2. Prepare a capture folder and manifest.
   - `npm run ux:screenshots:prepare -- --projectId 1`
   - On Windows PowerShell, use `npm.cmd run ux:screenshots:prepare -- --projectId 1` if script execution policy blocks `npm`.
   - Use another project id if the seed/local database uses a different id.
3. Open each route from the generated manifest.
4. Capture both viewports:
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

- Case repository: preserve `suiteId`, `sectionId`, `panelCaseId`, `panelMode`, `display`, `groupBy`, filters, columns, and the current left/right section tree placement.
- Run detail: preserve `testId`, `sectionId`, `groupBy`, status filters, selected test panel, and status sidebar state.
- Run list, milestones, plans, reports, and My Tests: preserve filters and drilldown links across desktop and narrow captures.

## Artifact Location

Generated capture folders should use:

`docs/artifacts/ux-screenshots/YYYY-MM-DD/`

Screenshots may be committed only when needed for documentation. For ordinary PRs, attach them to the PR and keep only the manifest or checklist note in the branch.
