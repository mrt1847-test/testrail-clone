# UI/UX Usability Realignment

Last updated: 2026-09-18

## 1. Purpose

This document resets the UI/UX evaluation standard for the product.

Previous reviews focused too heavily on whether TestRail-like features existed. That produced many individually valid controls, panels, filters, dialogs, and management functions, but it did not produce a UI that feels calm, consistent, or immediately understandable.

The new standard is:

> A feature is not successful because it is visible. It is successful when the user can recognize when to use it, complete the primary task without distraction, and predict how similar screens behave.

This document is the controlling usability backlog for the Test Cases and Run Execution routes. Feature parity checklists remain useful for capability tracking, but they do not override this document's hierarchy, consistency, or task-completion requirements.

Follow-up review: [UI/UX simplicity review, 2026-09-18](./UI_UX_SIMPLICITY_REVIEW_2026-09-18.md). This review adds planned UI-022–UI-029 work only; it does not implement changes, advance the current batch, or claim that historical screenshots are newly reproduced checks.

## 2. Executive verdict

### Result recording

Results can be recorded, but the experience is not yet equivalent to TestRail's fast and reliable execution flow.

- Status counts, filters, a result composer, history, defects, steps, and bulk APIs exist.
- `Pass & Next` did not move to the next test during the walkthrough.
- Filtering the list could leave the detail pane showing a test that was no longer visible.
- Selecting multiple rows did not reveal an action near the selection; bulk result entry remained below the workbench in a collapsed `Run actions` section.
- Inline Failed and Blocked changes were committed immediately without guiding the user to add evidence, a comment, or a defect.
- Evidence attachments are handled after a result exists, in History, instead of as part of the result submission flow.

Verdict: **capable, but not yet fast, safe, or continuous enough for daily execution work.**

### Test case management

The section tree, case list, preview, saved views, metadata editing, and version history provide a good functional base. The main usability problems are presentation and repetition.

- At 1280 px width with the preview open, the measured case-title button width was about 50 px even though the row was about 478 px wide. Type, priority, and utility controls displaced the primary identifier: the case title.
- Adding a case opens the full authoring form and places Create/Cancel after all fields. There is no TestRail-style quick outline flow for entering several titles with Enter.
- The empty repository exposes multiple versions of the same command: `Add Test Case`, `Add Case`, and `Add case`.
- View configuration, repository utilities, content actions, metadata, and daily actions receive similar visual weight.

Verdict: **the information model is understandable, but the workbench is visually noisy and inefficient for repeated authoring.**

## 3. Core diagnosis

### 3.1 Feature parity was mistaken for usability parity

The product contains many TestRail nouns and capabilities, but too many are exposed at once. TestRail's strength is not simply the number of actions it supports. Its strength is that the same workbench grammar is repeated:

1. Stable project and suite context.
2. One dominant list or table.
3. One selected-item detail surface.
4. A small set of primary actions.
5. Secondary utilities in menus, dialogs, or contextual toolbars.

The current app often presents all five layers simultaneously as separate bordered panels, buttons, dropdowns, and collapsible sections.

### 3.2 Visual priority is too flat

Primary, secondary, contextual, and administrative actions frequently look equally important.

Examples:

- `Run Test`, Reports, Defects, Shared Steps, Print, Export, Import, and Copy/Move Cases all appear in the case repository header area.
- Columns, Filter, Sort, Display Deleted, Edit, density, search, saved views, and Add Case compete in the next toolbar.
- The run page exposes report, defect, identity, subscription, export, print, schedule, discussion, composition, assignment, duplicate, compare, rerun, close, and result actions across one long page.

The issue is not that these functions exist. The issue is that their placement asks the user to parse the whole product before performing today's task.

### 3.3 Shared UI exists but does not govern the product

The repository already contains shared primitives such as `Button`, `Panel`, `PageHeader`, `FilterBar`, `DataTable`, `Drawer`, `ConfirmDialog`, `StatusBadge`, and `DensityToggle`.

A rough static scan of `apps/web/src/features/**/*.tsx` found:

| Pattern | Count |
| --- | ---: |
| Feature TSX files | 200 |
| Raw HTML `<button>` elements | 381 |
| Uppercase `<Button>` component uses | 11 |
| Raw HTML `<table>` elements | 49 |
| `<DataTable>` uses | 2 |
| Files with hand-built `fixed inset-0` overlays | 16 |
| Files using shared `<Drawer>` | 2 |
| Files using shared `<PageHeader>` | 4 |

These numbers are not a quality score and some specialized controls should remain custom. They do show that shared primitives are optional helpers rather than an enforced product grammar.

Consequences:

- Button sizes, radius, borders, shadows, disabled states, and loading labels vary by feature.
- Dialog and drawer structure is repeatedly implemented.
- Tables differ in header density, selection behavior, empty states, scrolling, and responsive behavior.
- Route headers and panels use different spacing and hierarchy.
- Fixing visual noise requires editing many feature components instead of changing one system component.

### 3.4 Density is being spent on chrome instead of work

The problem is not simply that the UI is dense or sparse. It is dense in the wrong places.

- Project header, project tabs, breadcrumbs, page header, utility buttons, and status banner consume a large part of the initial viewport.
- At 1280 x 720, the run table began around 545 px from the document top during the walkthrough.
- The execution workbench then divides the remaining width among status navigation, section navigation, the table, and the result pane.
- In the case repository, metadata columns remain visible while the title becomes unreadable.

Operational density should mean more visible tests and cases, not more simultaneous controls.

## 4. Product hierarchy rules

Every action must be assigned to exactly one level.

| Level | Meaning | Display rule |
| --- | --- | --- |
| Primary | The reason the user opened the route | Always visible; one dominant action or workflow |
| Secondary | Frequently used to support the primary task | Compact toolbar or adjacent control |
| Contextual | Only valid after selecting a row, result, or section | Appears only when that context exists |
| Utility | Import, export, print, reports, subscription, layout settings | Overflow or clearly separated utility menu |
| Administrative | Configuration and destructive maintenance | Settings or explicit management dialog |

Additional rules:

- A route should have at most one visually dominant CTA.
- Do not show disabled actions when the user has not yet created the context that enables them, unless the disabled state teaches an essential workflow.
- Do not place the same action in three locations on one viewport.
- Do not preserve a column at the cost of hiding the entity title.
- Do not add another bordered panel when a divider, tab, row, or menu is sufficient.
- Do not add a new route-level feature until the action hierarchy states where it belongs.

## 5. Required surface reduction

### 5.1 Test Cases

Always visible:

- Suite and selected section context.
- Section tree.
- Search and active filter count.
- Case titles and identifiers.
- One `Add Case` action.
- `Run Test` as the primary transition from design to execution.

Compact secondary controls:

- Filter.
- Group/sort.
- Selected saved view.

Contextual only:

- Edit, copy, move, archive, delete, and bulk metadata updates.
- These belong in a row menu or a sticky selection action bar.

Move into `View` or utility menus:

- Columns.
- Density.
- Display mode.
- Display deleted.
- Section-tree side preference.
- Reports, Defects, Shared Steps, Print, Export, Import, and repository Copy/Move.

Default collapsed or help-only:

- Suite description editing.
- Forecast when no estimates exist.
- Full keyboard shortcut legend.

### 5.2 Run Execution

Always visible:

- Run name and open/closed state.
- Status counts.
- Test table with title, status, and assignee.
- Selected test context and result entry.
- `Pass & Next`.

Compact secondary controls:

- Search/filter.
- Next failed, blocked, and untested.
- Section scope.
- Close run with restrained emphasis.

Contextual only:

- Bulk status and assignment after row selection.
- Defect and attachment actions after a relevant result/status exists.
- Result correction actions after history exists.

Move into utility or overflow menus:

- Columns, group, sort, and density.
- Reports, subscription, export, print, duplicate, compare, rerun, and composition maintenance.
- Schedule and discussions unless currently active or containing warnings/unread activity.

## 6. Common component direction

Do not solve the inconsistency by adding another parallel component set. Consolidate around a small required system.

### Required shared components

| Component | Responsibility |
| --- | --- |
| `WorkbenchPage` | Compact title/context row, primary action, optional utility menu |
| `WorkbenchToolbar` | Search, filter count, view menu, contextual slot |
| `OverflowMenu` | Secondary and utility actions with grouping and destructive separation |
| `SelectionActionBar` | Sticky selected-count and valid bulk actions |
| `SplitPane` | Responsive list/detail sizing, collapse rules, persisted width |
| `DataTable` / `DataGrid` | Selection, density, sticky header, empty/loading/error states, title priority |
| `Button` / `IconButton` | Shared variants, sizes, loading, disabled, danger semantics |
| `FormField` | Label, hint, error, required state for input/select/textarea |
| `Dialog` / `Drawer` | Shared header, body, sticky footer, focus and close behavior |
| `SaveFeedback` | Saving, saved, failed, retry, and optional undo behavior |

### Enforcement

- Feature code must not introduce a raw `<button>`, route-level `<table>`, or hand-built modal without documenting why a shared component cannot satisfy the requirement.
- Shared components must support workbench density; they must not force large card layouts.
- Component variants must describe meaning (`primary`, `secondary`, `quiet`, `danger`), not one-off colors.
- Route-specific composition is allowed; route-specific control styling is not.

## 7. Task backlog

Tasks are ordered by user impact. Do not begin another feature-surface expansion on Test Cases or Run Execution until Phase 0 and Phase 1 are complete.

`UX-*` items are outcome gates. For visible UI work, use the `UI-*` delivery checklist below: one `UI-*` checkbox is one reviewable PR-sized unit, and each unit must leave a user-visible improvement on a named route. Shared components are introduced through the first route that uses them, rather than as a disconnected component-library project.

### Phase 0 — Trust and interaction continuity

- [ ] **UX-001 P0 — Unify case data used by repositories and runs.**
  - Remove the independent hard-coded in-memory run case list.
  - Creating a run from five visible cases must produce exactly those five test instances.
  - Case details, priority, title, steps, and references must resolve from the same source.
  - Add an end-to-end test covering repository → run creation → run detail.

- [ ] **UX-002 P0 — Make selected test URL state the single source of truth.**
  - Remove competing local-selection and URL-restoration effects.
  - `Pass & Next`, row click, previous/next, refresh, and browser navigation must update the same state path.
  - Five consecutive `Pass & Next` operations must advance five times with the QPane open.

- [ ] **UX-003 P0 — Synchronize filters and detail panes.**
  - When filtering removes the selected row, select the first visible row or close the pane with a clear explanation.
  - Never show detail for an entity that is not in the active result set without explicitly labeling it as outside the filter.

### Phase 1 — Reduce the visible surface and establish shared grammar

- [ ] **UX-010 P0 — Create an action-exposure inventory for every core route.**
  - Classify every visible action as primary, secondary, contextual, utility, or administrative.
  - Identify duplicate entry points and remove all but the best one.
  - Attach before/after screenshots for Test Cases and Run Execution.

- [ ] **UX-011 P0 — Implement shared workbench primitives.**
  - Add or extend `WorkbenchPage`, `WorkbenchToolbar`, `OverflowMenu`, `SelectionActionBar`, and `SplitPane`.
  - Add shared spacing, row-height, toolbar-height, pane-width, radius, border, and shadow tokens.
  - Keep the visual system restrained: square or small-radius work surfaces, minimal shadow, status-first color.

- [ ] **UX-012 P0 — Consolidate controls onto shared components.**
  - Migrate core-route buttons, fields, dialogs/drawers, feedback, and tables first.
  - Add lint or review enforcement for new raw buttons, route tables, and fixed overlays.
  - Completion target for core routes: no unexplained hand-built button, modal, drawer, or table styling.

- [ ] **UX-013 P1 — Remove card and panel nesting from core workbenches.**
  - Replace decorative cards with dividers, compact headers, tabs, or table sections.
  - Keep at most one outer work-surface boundary around the primary workbench.
  - Remove empty forecast, empty description, and inactive discussion panels from the default viewport.

### Phase 2 — Test Cases simplification

- [ ] **UX-020 P0 — Rebuild the case workspace with title-first responsive rules.**
  - Guarantee at least 240 px for the case title on desktop.
  - Hide optional metadata before truncating the title.
  - Below the wide breakpoint, switch from three fixed columns to two panes plus an overlay drawer.
  - Persist user-resized pane width within safe limits.

- [ ] **UX-021 P0 — Add TestRail-style quick outline authoring.**
  - Add a section-native title field that creates a case with Enter and keeps focus ready for the next title.
  - Preserve the full authoring form for detailed creation.
  - Give the full form a sticky Create/Cancel footer.
  - Adding five title-only cases must not require reopening the full form five times.

- [ ] **UX-022 P1 — Simplify the case toolbar.**
  - Keep search, filter, view, and one Add Case action visible.
  - Move columns, density, display mode, and deleted visibility into `View`.
  - Move import/export/print/report/defect/shared-step utilities into one grouped menu.
  - Show bulk Edit/Copy/Move/Delete only after selection.

- [ ] **UX-023 P1 — Clarify section operations.**
  - Replace ambiguous `Add` and `Add child` labels with the target relationship.
  - Show which section will receive a new case or subsection.
  - Keep drag/drop, but provide an equally understandable non-drag alternative.

### Phase 3 — Run Execution simplification

- [ ] **UX-030 P0 — Place bulk actions next to selected tests.**
  - Show a sticky `SelectionActionBar` immediately after one or more rows are selected.
  - Include selected count, result status, assignment, clear selection, and overflow.
  - Remove bulk result entry from the distant collapsed `Run actions` dependency.

- [ ] **UX-031 P0 — Separate quick-pass from evidence-requiring statuses.**
  - Keep `Pass & Next` as the explicit one-click path.
  - Failed, Blocked, and Retest from a row must open the result composer with that status selected.
  - Make comment, defect, actual result, and attachment easy to complete without leaving the selected test.

- [ ] **UX-032 P1 — Add result-save feedback and recovery.**
  - Display per-row or per-pane Saving, Saved, and Failed states.
  - Roll back optimistic status on error.
  - Add retry and, where safe, short-lived Undo.

- [ ] **UX-033 P1 — Move evidence attachment into result entry.**
  - Allow files to be staged while composing a result.
  - Save or associate them as part of the successful result flow.
  - Keep History for review and later additions, not as the only upload path.

- [ ] **UX-034 P1 — Compress the execution page chrome.**
  - Merge redundant title, assignment, state, and utility rows.
  - Keep the workbench and its toolbar sticky within the viewport.
  - At 1280 x 720, show at least six compact test rows while the result pane is open.

### Phase 4 — Product-wide consistency and validation

- [ ] **UX-040 P1 — Migrate remaining daily-work routes to the shared grammar.**
  - Run list, My Tests, milestones, plans, and reports follow the same header, toolbar, table, feedback, and overflow patterns.
  - Settings may use forms, but must use the same field, button, dialog, and feedback components.

- [ ] **UX-041 P1 — Add task-based usability acceptance tests.**
  - Add five cases using quick outline.
  - Edit a case in a nested section without losing context.
  - Create a run from selected cases and verify exact composition.
  - Record five results using `Pass & Next`.
  - Filter failures, open one, attach evidence, and create a defect link.
  - Select several tests and submit one bulk result without scrolling away from the table.

- [ ] **UX-042 P1 — Strengthen visual and accessibility gates.**
  - Capture 1440 x 1000, 1280 x 720, and 390 x 844 screenshots.
  - Verify every form control has an accessible name.
  - Verify focus order, keyboard operation, error announcements, and minimum target size.
  - Reject screenshots where secondary controls dominate the primary work surface.

### Visible UI delivery checklist — one checkbox per work unit

Execute these items from top to bottom unless a dependency or production defect requires reprioritization. Each item includes its visible target and a completion signal so that UI work cannot be closed by internal refactoring alone.

#### Test Cases workspace

- [x] **UI-001 P0 — Simplify the Test Cases page header and action hierarchy.** ([before/after evidence](./ux-evidence/UI-001.md), completed 2026-09-18)
  - Visible change: show one dominant `Add Case` action; move import, export, print, report, shared-step, and other utilities into one grouped overflow menu.
  - Component slice: introduce or reuse `WorkbenchPage`, `WorkbenchToolbar`, and `OverflowMenu` only to the extent needed by this route.
  - Done when: there is one visible Add Case entry point, no secondary action visually competes with it, and before/after captures exist at 1440 x 1000 and 1280 x 720.
  - Maps to: `UX-010`, `UX-011`, `UX-022`.

- [x] **UI-002 P0 — Reduce the Test Cases toolbar to search, filter, view, and context.** ([before/after evidence](./ux-evidence/UI-002.md), completed 2026-09-18)
  - Visible change: keep search, active filter count, `View`, and the contextual action slot in the toolbar; place columns, density, display mode, and deleted visibility inside `View`.
  - Interaction rule: bulk Edit, Copy, Move, and Delete are hidden until rows are selected.
  - Done when: the zero-selection toolbar contains no bulk action and all moved commands remain keyboard reachable.
  - Maps to: `UX-010`, `UX-022`.

- [x] **UI-003 P0 — Make the case list title-first and remove nested cards.** ([before/after evidence](./ux-evidence/UI-003.md), completed 2026-09-18)
  - Visible change: guarantee the title column at least 240 px on desktop, demote optional metadata before title truncation, and replace decorative inner cards with dividers or compact sections.
  - Interaction rule: row selection, section navigation, and detail opening must remain unchanged.
  - Done when: titles remain readable with the detail pane open at 1280 px and there is at most one outer work-surface boundary.
  - Maps to: `UX-013`, `UX-020`.

- [x] **UI-004 P1 — Make the Test Cases split view responsive.** ([before/after evidence](./ux-evidence/UI-004.md), completed 2026-09-18)
  - Visible change: retain list plus detail on wide screens; convert the tertiary pane to an overlay drawer before the title column becomes unusable.
  - Interaction rule: persist user-resized pane width within safe minimum and maximum limits.
  - Done when: 1280 x 720 and 390 x 844 layouts have no horizontal page scroll, clipped primary action, or inaccessible close control.
  - Maps to: `UX-020`, `UX-042`.

- [x] **UI-005 P0 — Add section-native quick outline case creation.** ([before/after evidence](./ux-evidence/UI-005.md), completed 2026-09-18)
  - Visible change: place a lightweight title input in the active section; Enter creates the case and returns focus to an empty title input.
  - Interaction rule: keep the full editor available as the detailed path and show saving, saved, and failed feedback near the input.
  - Done when: a user can add five title-only cases without reopening a modal or leaving the active section.
  - Maps to: `UX-021`.

- [x] **UI-006 P1 — Simplify the full case editor and make its actions persistent.** ([before/after evidence](./ux-evidence/UI-006.md), completed 2026-09-18)
  - Visible change: use shared fields and a sticky Create/Save and Cancel footer; keep required fields and validation close to the edited content.
  - Interaction rule: closing a dirty editor requires a clear discard decision, while a successful save keeps section context.
  - Done when: the primary save action is visible at every scroll position and validation does not rely on toast-only messaging.
  - Maps to: `UX-012`, `UX-021`, `UX-042`.

- [x] **UI-007 P1 — Clarify section-row actions and relationships.** ([before/after evidence](./ux-evidence/UI-007.md), completed 2026-09-18)
  - Visible change: replace ambiguous `Add` and `Add child` labels with `Add case to this section`, `Add subsection`, or equivalent contextual wording; group infrequent actions in row overflow.
  - Interaction rule: provide a non-drag move path that states the destination before confirmation.
  - Done when: a first-time user can identify where a case or subsection will be created without trial and error.
  - Maps to: `UX-023`.

#### Run Execution workspace

- [x] **UI-008 P0 — Compress the Run Execution header into one workbench header.** ([evidence](./ux-evidence/UI-008.md): table begins ~323px at 1280×720; grouped utilities pass desktop/mobile keyboard review.)
  - Visible change: merge duplicate title, assignment, run state, and utility rows; keep result recording as the dominant workflow and move reports, export, print, duplicate, compare, and rerun into grouped utilities.
  - Component slice: reuse the workbench header and overflow patterns proven by `UI-001`.
  - Done when: the test table begins higher in the viewport and no utility control competes with result entry.
  - Maps to: `UX-010`, `UX-011`, `UX-034`.

- [x] **UI-009 P0 — Show a sticky selection action bar next to selected tests.** ([evidence](./ux-evidence/UI-009.md): bar hidden at 0 selection; 2-test bulk Pass saved in-place; keyboard overflow and 1280/390 layouts pass.)
  - Visible change: after the first row selection, show selected count, result status, assignment, clear selection, and overflow immediately above or below the table.
  - Interaction rule: hide the bar at zero selection and remove the duplicate bulk-result path from distant run actions.
  - Done when: a user can select several tests and submit one bulk result without scrolling away from the selection.
  - Maps to: `UX-030`.

- [x] **UI-010 P0 — Separate one-click Pass & Next from evidence-requiring statuses.** ([evidence](./ux-evidence/UI-010.md): 5 Pass & Next advances with QPane open; Failed/Blocked/Retest open composer uncommitted; `testId` stays consistent.)
  - Visible change: make `Pass & Next` the explicit quick action; selecting Failed, Blocked, or Retest opens the result composer with that status preselected.
  - Interaction rule: row click, previous/next, browser navigation, refresh, and Pass & Next must all use the same selected-test URL state.
  - Done when: five consecutive Pass & Next actions visibly advance five rows with the detail pane open.
  - Maps to: `UX-002`, `UX-031`.

- [x] **UI-011 P0 — Recompose result entry around evidence and completion.** ([evidence](./ux-evidence/UI-011.md): Failed+comment+JIRA-42+actual+failure.png saved from Results tab; Cancel left C1 untested.)
  - Visible change: group status, comment, actual result, defects, attachments, and Save in one focused composer tied to the selected test.
  - Interaction rule: status remains preselected when the composer was opened from a status action; Cancel returns to the unchanged test.
  - Done when: a failed result with comment, defect reference, actual result, and attachment can be recorded without visiting another panel.
  - Maps to: `UX-031`, `UX-033`.

- [x] **UI-012 P1 — Add local save, failure, retry, and undo feedback to results.** ([evidence](./ux-evidence/UI-012.md): Failed+Retry kept C1 evidence and rolled back Untested; Saved+Undo on the affected row/pane; Pass & Next left Saved on C2 after advancing.)
  - Visible change: show Saving, Saved, and Failed next to the affected row or result pane rather than only in a global toast.
  - Interaction rule: failed optimistic updates roll back; Retry preserves entered evidence; safe updates expose a short-lived Undo.
  - Done when: users can tell which result failed and recover without re-entering its content.
  - Maps to: `UX-032`.

- [x] **UI-013 P1 — Stage attachments inside the result composer.** ([evidence](./ux-evidence/UI-013.md): Queued+Remove then Cancel left C1 untested; Failed attach showed Retry on the file after the result existed; Retry put failure.png on History.)
  - Visible change: show queued files, upload state, remove action, and failure state before result submission.
  - Interaction rule: associate staged files only with the successfully created result and keep History as the review/later-addition path.
  - Done when: attachment progress and ownership are unambiguous throughout save, retry, and cancel.
  - Maps to: `UX-033`.

- [x] **UI-014 P1 — Increase execution density without reducing readability.** ([evidence](./ux-evidence/UI-014.md): 1280×720 with pane open showed C1–C8 compact rows; empty Schedule/discussion stayed below the fold; selected row used Selected:/semibold title plus a slate edge.)
  - Visible change: use compact row and toolbar heights, remove empty default panels, and keep the workbench controls sticky inside the viewport.
  - Interaction rule: title, status, assignee, and active selection remain distinguishable by text and hierarchy, not color alone.
  - Done when: at least six test rows are visible at 1280 x 720 with the result pane open.
  - Maps to: `UX-013`, `UX-034`, `UX-042`.

#### Shared rollout, one route at a time

- [x] **UI-015 P1 — Apply the workbench pattern to the run list.** ([evidence](./ux-evidence/UI-015.md): one Add Run; More actions held plan/compare/reports/defects; My runs and Order by in one toolbar; sidebar CTAs removed.)
  - Visible change: one compact header, one primary create action, one toolbar, and grouped utilities.
  - Done when: route-specific button, toolbar, table, modal, and feedback styling is removed or documented as an exception.
  - Maps to: `UX-012`, `UX-040`.

- [x] **UI-016 P1 — Apply the workbench pattern to My Tests.** ([evidence](./ux-evidence/UI-016.md): workbench table/filters; More actions held team-to-do/reports; selection Add result opened Run Execution `?testId=`; no shortcut cards.)
  - Visible change: prioritize the assigned-test table, filters, and result action; demote reporting and view utilities.
  - Done when: the same action hierarchy and selection feedback used in Run Execution are reused without a parallel implementation.
  - Maps to: `UX-012`, `UX-040`.

- [x] **UI-017 P1 — Apply the workbench pattern to Milestones.** ([evidence](./ux-evidence/UI-017.md): one Add Milestone; More actions held reports; sidebar create/count/dashboard removed; drawer used named fields.)
  - Visible change: use the shared page header, toolbar, table or list density, empty state, dialog, and feedback grammar.
  - Done when: the route has one dominant create action and no unexplained route-specific control styling.
  - Maps to: `UX-012`, `UX-040`.

- [x] **UI-018 P1 — Apply the workbench pattern to Plans.** ([evidence](./ux-evidence/UI-018.md): one Add Plan; hub Add entry; More actions held defaults/reports/print; sidebar create/count/report strip removed.)
  - Visible change: simplify page-level actions and use shared selection, overflow, dialog, and save feedback patterns.
  - Done when: plan composition remains the dominant surface and administrative actions no longer occupy permanent toolbar space.
  - Maps to: `UX-012`, `UX-040`.

- [x] **UI-019 P1 — Apply the workbench pattern to Reports.** ([evidence](./ux-evidence/UI-019.md): catalog Open + one Add report; 20-link toolbar gone; export/print/save-view in overflow.)
  - Visible change: prioritize report selection and results; group export, subscription, schedule, print, and administrative utilities by context.
  - Done when: creating or opening a report does not require scanning unrelated permanent actions.
  - Maps to: `UX-012`, `UX-040`.

- [ ] **UI-020 P1 — Apply shared controls and feedback to Settings.**
  - Visible change: replace route-specific fields, buttons, dialogs, validation, and save feedback while retaining settings-appropriate form layouts.
  - Done when: every control has an accessible name and saving, success, validation, and server failure are locally understandable.
  - Maps to: `UX-012`, `UX-040`, `UX-042`.

- [ ] **UI-021 P1 — Add a cross-route visual and accessibility regression gate.**
  - Visible change: none; this protects the hierarchy established by `UI-001` through `UI-020`.
  - Evidence: capture Test Cases and Run Execution at 1440 x 1000, 1280 x 720, and 390 x 844; add keyboard and accessible-name checks for primary flows.
  - Done when: the gate fails on duplicate dominant CTAs, hidden selected-row actions, clipped controls, horizontal page scroll, or unlabeled form controls.
  - Maps to: `UX-041`, `UX-042`.

#### Follow-up review — planned, not yet scheduled

Detailed evidence, design rules, and scope fixtures: [simplicity review](./UI_UX_SIMPLICITY_REVIEW_2026-09-18.md). These follow-ups supplement earlier completed slices without treating their completion as proof that all usability defects are resolved. Keep the current NEXT_ACTIONS batch unchanged until scheduling is explicitly reprioritized.

- [ ] **UI-022 P0 — Separate case query scope from display settings.**
  - Visible change: one compact scope selector with `Selected section only`, `Include subsections`, and `All sections`; show the active section path and scope beside the list.
  - Scope: separate the query scope from display/density across UI, server, URL, last view, and saved views. Preserve explicitly documented compatibility for existing display URLs and saved views. Update summaries and empty states to match the actual scope.
  - Interaction rule: section selection filters direct/subtree scopes; in All sections it only navigates to the block. Scope changes clear out-of-scope selection with feedback and cannot leave an unexplained out-of-scope detail pane.
  - Done when: the review's fixture yields 2/6/10 TC for the three scopes with Authentication selected and 3/4 for Login direct/subtree; unrelated siblings never leak into subtree scope. Refresh, Back, shared URL, filters, and saved views reproduce the same scope. Density never changes result membership.
  - Out of scope: redesigning group blocks (UI-023), general View-menu cleanup (UI-024).
  - Maps to: `UX-003`, `UX-022`, `UX-023`, `UX-041`.

- [ ] **UI-023 P1 — Make section-owned TC blocks visually explicit.**
  - Visible change: section-path header, direct matching TC count, collapse chevron, then compact TC rows; separate blocks with whitespace or a single thin divider. No nested cards, per-block shadows, or repeated action toolbars.
  - Scope: reuse existing section grouping and row components; add readable ancestry and independent block collapse. Keep tree order, each TC in exactly one owning section, and parent-only headings where needed for context.
  - Interaction rule: collapsing changes visibility only; indicate selected TC hidden in collapsed blocks. Keep Expand all / Collapse all in View. Narrow screens use wrapping paths rather than unlimited indentation.
  - Done when: users can identify the owning section of each TC, including duplicate section names and three-level nesting. The review fixture shows 1/3/4 blocks for direct/subtree/all scope, with correct counts and no duplicate TC. Verify empty parents, filtered results, long names, keyboard collapse, and 1280/390px layouts.
  - Dependency: UI-022's explicit scope contract. Out of scope: per-section management feature expansion.
  - Maps to: `UX-013`, `UX-020`, `UX-023`, `UX-042`.

- [ ] **UI-024 P1 — Simplify View settings and remove overlapping meanings.**
  - Visible change: separate scope, grouping, and row spacing; eliminate duplicate `Compact` meanings and combinations that silently hide section grouping. Keep infrequent column/saved-view management behind a clear settings entry.
  - Scope: case repository View menu only; use shared menu controls and selection semantics. Preserve existing capabilities without a long permanent menu of every option.
  - Done when: a user can predict whether an option changes included TC, grouping, or spacing from its label; the checked grouping matches the rendered headers; keyboard selection and persisted settings work. Normal use requires only the compact scope selector plus Filter/View.
  - Dependency: UI-022/UI-023. Maps to: `UX-010`, `UX-011`, `UX-022`.

- [ ] **UI-025 P0 — Keep section move/copy dialogs above the workspace and contain focus.**
  - Evidence: the existing UI-007 move screenshot shows background Search/View controls covering the dialog's destination summary; the current component has no focus lifecycle.
  - Scope: repair the shared MoveCopyChooserDialog's stacking/placement and modal behavior, using the common dialog pattern; verify its section and case relocation consumers.
  - Done when: destination and controls are unobstructed at 1280×720 and 390×844; background controls cannot be activated; focus enters the dialog, cycles inside it, Escape cancels when allowed, and close restores the trigger. Preserve busy state and current-location move prevention. Test with tree on either side and after scrolling.
  - Out of scope: relocation API or move/copy semantics changes. Maps to: `UX-012`, `UX-042`.

- [ ] **UI-026 P1 — Make the file-tree interaction match its visual promise.**
  - Scope: section tree arrow-key navigation, one tree tab entry, expand/collapse versus selection, menu focus/arrow keys/Escape return, and correct root-creation label association. Reuse shared menu behavior rather than adding another keyboard implementation.
  - Done when: keyboard-only users select a nested section, open its actions, start and cancel creation, then return to the same row; screen readers announce path/name, selected state and expanded state correctly. Focus remains visible and touch controls remain discoverable without desktop hover.
  - Out of scope: introducing more visible row actions. Maps to: `UX-012`, `UX-023`, `UX-042`.

- [ ] **UI-027 P1 — Reduce repeated navigation chrome above Test Cases.**
  - Visible change: compact project/context navigation; remove always-visible default-suite configuration/help from the daily-work header and retain it in an explicit settings/context menu.
  - Scope: shared project header as consumed by Test Cases; check other project routes for regressions without redesigning their workspaces.
  - Done when: case work starts at least 80px higher than the baseline at 1280×720; project/suite context remains discoverable; at 390×844 a populated fixture exposes a section heading and at least one TC before the first scroll. No clipped controls or horizontal page scrolling.
  - Out of scope: Run Execution's content header (UI-008). Maps to: `UX-010`, `UX-013`, `UX-040`, `UX-042`.

- [ ] **UI-028 P1 — Consolidate case selection actions and empty-state creation.**
  - Visible change: one contextual selection bar replaces the duplicated selected-count/edit menu and Update selected action row. Keep selection scope explicit through TC counts; secondary print/destructive commands use overflow.
  - Scope: Test Cases selection toolbar and empty state. At zero selection avoid a permanent bulk-command strip; when empty use one dominant Add Case entry point and a lightweight message that matches scope/filter state.
  - Done when: selecting TC exposes one edit path, a clear target count and clear-selection action; no hidden/out-of-scope TC are modified unexpectedly. Zero-selection and empty states have no duplicate dominant CTA. Keyboard and narrow layouts remain usable.
  - Dependency: UI-022 scope semantics. Out of scope: Run Execution selection (UI-009) and project-list empty state (recorded under UX-040). Maps to: `UX-010`, `UX-022`, `UX-042`.

- [ ] **UI-029 P1 — Put case detail content ahead of its utility buttons.**
  - Visible change: detail title, main content, Edit and Close form the stable reading surface. Group ID/link copy, print and full-page navigation under a predictable utility menu.
  - Scope: CaseDetailSidePanel header in drawer and wide inline layouts; reuse shared controls and retain the existing edit/save workflow.
  - Done when: opening a TC immediately exposes title/content without scanning a utility button wall; utilities remain keyboard reachable, close returns focus to the case row, and 390px controls do not wrap into multiple competing toolbars.
  - Out of scope: changing case data or the full authoring form. Maps to: `UX-010`, `UX-012`, `UX-020`.

Additional UX-040 review note: the live empty Projects page repeats New project twice plus Add project in Quick links. Consolidate its creation entry point and empty-state container during the project-list rollout; this observation is not a newly completed task.

## 8. Definition of done

The realignment is complete only when all of the following are true:

- A first-time user can identify the primary task on Test Cases and Run Execution within five seconds.
- Test Cases and Run Execution each expose one dominant workflow and no more than one dominant CTA.
- Case titles remain readable with the detail pane open at 1280 px.
- Five cases can be outlined without reopening the full editor.
- Five results can be recorded consecutively without manually returning to the table.
- Selecting rows reveals valid bulk actions next to the selection.
- Filters, selected entity, URL, and detail pane never contradict one another.
- Core routes use the shared workbench, control, dialog, table, and feedback components.
- Desktop and narrow screenshots show the same information hierarchy even when layout changes.

## 9. Reference anchors

- TestRail introduction and core workflow: https://support.testrail.com/hc/en-us/articles/7076810203028
- Adding test cases and quick outline: https://support.testrail.com/hc/en-us/articles/14438119644692-Adding-test-cases
- Sections and subsection management: https://support.testrail.com/hc/en-us/articles/14985199889812-Sections
- Submitting results, Pass & Next, and bulk results: https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results
- Existing parity analysis: [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md)
- Existing feature-oriented backlog: [UX_BACKLOG.md](./UX_BACKLOG.md)
- UX review gate: [UX_GATE.md](./UX_GATE.md)
