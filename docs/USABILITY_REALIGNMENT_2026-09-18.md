# UI/UX Usability Realignment

Last updated: 2026-09-20

## Reading contract — current policy, history, and execution

**최종 목적은 TestRail처럼 심플하고 직관적인 UI/UX로 테스트케이스 관리와 실제 테스트 수행을 돕는 것이다. 주 사용자는 테스터다.** 개발자가 기능을 발견할 수 있는지보다, 케이스를 처음 보는 테스터가 무엇을 어떻게 테스트하고 어디에 결과를 남길지 바로 이해하는지가 우선이다. 이 문서는 기능 목록이 아니라 그 업무 흐름의 설계·검증 기준이다.

- Sections 1, 4–6 and 8 define the current target and acceptance policy. Section 7 defines individual delivery scopes and outcome gates. Sections 2–3 are historical diagnosis only, not instructions to restore old layouts or evidence of current defects.
- [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) is the **only** source for Current batch and execution order. IDs and Phase headings in this document are classification, not scheduling. Do not copy live queue positions into design prose.
- This policy and its state rules take precedence over incompatible older task wording, dated reviews and generic UX_GATE wording. Linked design documents supply details within the named unit's scope. An unresolved contradiction must be reported before implementation, not resolved by adding more controls or expanding the batch.
- A checked UI unit records a delivery at its evidence date, not approval of every later design requirement. Preserve that history; record supersession and outstanding validation explicitly. New policy does not silently reopen or re-certify an old checkbox.
- Read the applicable state rule, exact unit, linked design and verification tier before work. Only the Current unit may be implemented; future target states are not permission to complete later units early.

## 1. Purpose

This document resets the UI/UX evaluation standard for the product.

Previous reviews focused too heavily on whether TestRail-like features existed. That produced many individually valid controls, panels, filters, dialogs, and management functions, but it did not produce a UI that feels calm, consistent, or immediately understandable.

The new standard is:

> A feature is not successful because it is visible. It is successful when the user can recognize when to use it, complete the primary task without distraction, and predict how similar screens behave.

This document controls the Test Cases and Run Execution journeys and their supporting project, run-list, My Tests, Plan, Milestone, Report and Settings surfaces. Feature parity checklists remain useful for capability tracking, but they do not override this document's hierarchy, consistency, or task-completion requirements.

Historical reviews: [simplicity review, 2026-09-18](./UI_UX_SIMPLICITY_REVIEW_2026-09-18.md) and [completion review, 2026-09-19](./UI_UX_COMPLETION_REVIEW_2026-09-19.md). Their status statements describe their audit dates. Use the checkboxes/evidence below for delivery history and NEXT_ACTIONS for live scheduling.

The [whole-layout review](./TESTRAIL_UI_REALIGNMENT_REVIEW_2026-09-19.md) explains the origin of UI-041–048 and the removal/merge decisions. Its findings used source and historical captures at that audit date, not a fresh browser pass. It is design rationale, not a second live status register. UI-021 owns final integrated acceptance after the scheduled delivery units.

### 1.1 Product foundation — case management and actual test execution

The goal is to build a TestRail-like test management tool that helps teams manage test cases effectively and helps testers perform tests with minimal friction. Result storage, status changes, visual simplification, and shared components support that goal; none is a substitute for it.

The primary user is a tester, including someone unfamiliar with the case or the product's implementation. The tester prepares and maintains reusable instructions, executes them against the system under test, records observations/evidence and resumes work after interruptions. This tool supports that work; clicking a status or passing an automated UI test is not proof that the underlying test was performed. Reports, administration and configuration are supporting activities, not the default visual priority of the execution workspace.

When requirements compete, prioritize: correct test identity and trustworthy results → readable instructions and continuity → discoverable actions → visual economy. Simplicity means removing unnecessary decisions, repeated chrome and permanent secondary forms, **not** hiding instructions, shrinking text or eliminating essential feedback to hit a density metric.

The two primary user journeys are:

1. **Manage cases:** find cases by section → author/review preconditions, ordered steps and expected results → maintain the cases → select the cases for a run.
2. **Perform tests:** open the run → select a test → understand its preconditions → follow its steps → compare actual behavior with expected results → record the outcome and evidence → continue to the next test without losing context.

The execution workspace must first answer: **What am I testing, what do I need before starting, what actions should I take, and what counts as the expected outcome?** A tester unfamiliar with the case must be able to answer these from the selected-test detail surface, without returning to the case-management page or relying on memory.

Non-negotiable UI/UX principles:

- Keep case identity, applicable preconditions, ordered instructions and expected results readily readable in the execution detail surface. On desktop this is the side panel; responsive layouts must preserve the same reading-to-recording flow.
- Simplify secondary controls, not the instructions needed to perform the test. Do not hide essential case content under result-only tabs, generic “More fields” menus, or utilities merely to increase visible row count.
- Distinguish **case instructions / expected results** from **recorded actual results / execution history**. Step-result input is not a replacement for readable step instructions.
- Keep the selected row, case content, result target and next-test navigation consistent. After advancing, the next case's instructions must be available, not just its status controls.
- Missing or failed-to-load instructions must be distinguishable from intentionally absent/not-applicable fields. Do not silently present a result-only panel as a fully usable execution workspace. Templates without ordered steps must still expose their applicable mission, scenario or other execution guidance.
- Prioritize and review work by whether it improves these two journeys. Button count, shared-component adoption, row density and successful saves are supporting checks, not the definition of usability. Do not silently expand a scheduled batch; record any missing core-flow work explicitly.

Validation must use representative cases with meaningful preconditions, multiple ordered steps and expected results, not only titles and statuses. Demonstrate reading the instructions → performing/comparing steps → recording evidence → moving to the next case, including keyboard and narrow-screen use. Test empty/loading/error content states separately. Screenshots must show the case instructions as well as result entry; a scrolled result form alone cannot prove this journey works.

This policy governs future implementation and completion review. It does not retroactively certify historical evidence, change existing completion checkboxes, or reorder NEXT_ACTIONS by itself.

### 1.2 Reading-first execution and one shared result dialog

The selected-test panel is primarily for reading case instructions and reviewing results, not for permanently displaying a long result-entry form. Keep a compact Add result action in the panel. Both this action and the Run test list's Status menu open the **same compact modal result dialog**, with the selected status prefilled for list entry. Choosing a status, including Passed, does not itself save a result. The separately named Pass & Next quick-success action retains its explicit existing contract.

Detailed layout, field visibility, ownership, save/cancel/retry, accessibility, responsive behavior and task boundaries: [Run result dialog design, 2026-09-19](./RUN_RESULT_DIALOG_DESIGN_2026-09-19.md). The user's Add Result image is the concrete two-column form target, not implementation evidence. It applies to Run-specific test instances, not a new global status on case definitions. UI-037–039 delivered the interaction foundation; UI-051 corrects the form composition still left behind. Consult NEXT_ACTIONS for scheduling rather than inferring it here.

### 1.3 Top-of-run statistics, wider execution workspace

The target Run layout places status statistics above the workbench, not in a permanent left column. See the [Run status overview design](./RUN_STATUS_OVERVIEW_DESIGN_2026-09-19.md) and UI-040 for scope and evidence. Statistics support orientation; they must not dominate the space needed to read and execute cases.

### 1.4 One coherent, flat workbench rather than individually simplified cards

Follow the [whole-layout review's common screen rules and route mapping](./TESTRAIL_UI_REALIGNMENT_REVIEW_2026-09-19.md). Keep one global context bar, one project navigation layer, one flat page heading/action area and the main content. Use text, spacing and thin separators for reading surfaces; retain meaningful input/dialog/focus boundaries. Do not make every row a form or every section a card. Preserve the borderless folder tree, section blocks and explicit scope. Progressive disclosure must reduce secondary controls without hiding test instructions, current scope or primary actions. A cleaned header is not proof that its body is usable; a shared component is not proof that the whole screen is coherent.

## 2. Historical diagnosis — original executive verdict

Historical baseline only. The statements and measurements below describe the original walkthrough; use current evidence before treating any item as a remaining defect. They do not override sections 1, 4–6 or 8.

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

## 3. Historical diagnosis — original causes

Retained to explain why the program began. Counts, layouts and control inventories below are not a fresh scan and are not a new migration mandate.

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

Every action in a given screen state must have one clear role. The same action may have a different emphasis in another state; creating a case, reading it, selecting several cases and recording a result are not the same state.

| Level | Meaning | Display rule |
| --- | --- | --- |
| Primary | The reason the user opened the current work surface | Discoverable in the active state; one dominant action or workflow, not necessarily a filled button |
| Secondary | Frequently used to support the primary task | Compact toolbar or adjacent control |
| Contextual | Only valid after selecting a row, result, or section | Appears only when that context exists |
| Utility | Import, export, print, reports, subscription, layout settings | Overflow or clearly separated utility menu |
| Administrative | Configuration and destructive maintenance | Settings or explicit management dialog |

Additional rules:

- The active work surface should have at most one visually dominant CTA. With a modal/editor open, its Save/Create owns that emphasis; background actions are inactive or visually subordinate. Reading a test is a primary workflow even without a large button.
- Do not show disabled actions when the user has not yet created the context that enables them, unless the disabled state teaches an essential workflow.
- Remove redundant repetitions within the same context. Intentional entry points in different work contexts are allowed: Run-list Status and panel Add result both open the same result dialog. They must share behavior without becoming competing prominent CTAs. Quick outline and full Add Case likewise serve different authoring depth; do not delete either solely to reduce button count.
- Do not preserve a column at the cost of hiding the entity title.
- Do not add another bordered panel when a divider, tab, row, or menu is sufficient.
- Do not add a new route-level feature until the action hierarchy states where it belongs.

## 5. Required surface reduction

### 5.1 Test Cases — state-specific target

| State | Visible reading/context | Action hierarchy / disclosure |
| --- | --- | --- |
| Desktop list, no selection | Suite/section path and scope, quiet folder tree, section-owned blocks, case ID/title; compact metadata | One Add Case primary entry; search, Filter and View secondary. Quick outline is a lightweight section-native input, not another prominent CTA. |
| Rows selected | Same list plus explicit target count/scope | One contextual edit/copy/move/delete bar. Run Test is a secondary transition with an explicit included-case scope, not a second permanent primary CTA. |
| Case detail read mode | Identity → preconditions → ordered steps/expected results; metadata/history secondary | One Edit entry; copy/print/destructive utilities in the named menu. No permanent metadata edit form before instructions. |
| Case editor | Existing content, required fields and local validation | Save/Create is primary with Cancel; preserve dirty-close confirmation and section context. |
| 390px list / detail | List shows section path/scope and readable rows; selected detail can replace the list with a clear return path | Tree is reached through a named Sections control rather than forced beside the list. Filters/view settings are disclosed; return preserves scope, selection and position. |

Grouping, sorting, saved-view selection, columns, density, deleted visibility and tree-side preference belong in View; the active saved view/scope may be summarized without duplicating controls. Reports, Defects, Shared Steps, Print, Export, Import and repository-level relocation belong in named utilities. Contextual relocation uses the selection scope instead. Suite description editing, unavailable forecasts and full shortcut help are not permanent daily-work chrome.

### 5.2 Run Execution — state-specific target

| State | Visible reading/context | Action hierarchy / disclosure |
| --- | --- | --- |
| Desktop list | Run identity/open state, low top status summary, search/filter/section scope, title and full Status labels | Statistics above, never a permanent fourth column. Assignee is secondary and may move to detail/column settings before titles become cramped. Summary filters never record results. |
| Test selected | Correct test identity, preconditions, ordered instructions and expected results; results/history secondary | Add result opens the shared dialog. Explicit Pass & Next is a secondary quick-success action; assignment and next-by-status navigation are compact secondary controls. No permanent result form. |
| Result dialog open | Fixed target; left Status dropdown/Comment/attachments, right Assign To/Version/Elapsed/Defects; required fields and applicable guidance | UI-051: Add Result primary, Cancel text action, Save & Next in the primary button's small secondary menu. Ordinary list Status choices, including Passed, only prefill this same dialog. Pass & Next requires the dialog too when mandatory additional input/evidence is needed. |
| Bulk selection | Explicit selected target set/count next to the tests | Contextual bulk result/assignment actions. Do not replace or redesign their contract under a single-test dialog task. |
| 390px list / detail | Initial list has compact top summary and readable title/Status. Opening detail prioritizes full instructions with a return-to-list control | Tree/optional metadata via named disclosure. Pass & Next and other secondary commands may be in a named menu; Add result remains easy to find. Do not force table, tree and detail simultaneously into the viewport. |
| Closed Run / no write permission | Instructions, persisted results and clear read-only reason | No actionable save/pass/bulk-write controls. Preserve access to reading and appropriate navigation. |

Files and defect references can be **staged before a result exists** inside the shared dialog; only association/upload requires the successfully created result. Review, later additions and correction actions belong to existing result history. Partial success distinguishes saved result from failed attachment and does not silently advance.

Columns/group/sort/density and reports/export/print/subscription/duplicate/compare/rerun/composition maintenance use utilities. Close run is a lifecycle utility with appropriate confirmation, not a peer of Add result. Schedule/discussion are disclosed unless an active warning or unread item needs a quiet indicator.

### 5.3 Visual target and tester review before layout implementation

Text rules alone do not certify a TestRail-like result. For a unit changing layout or action hierarchy, attach a compact proposed desktop/narrow target to that unit's evidence before implementation: a wireframe or annotated mockup with reading order, pane behavior, one primary action, secondary entries and removed elements. Reuse an already approved target when applicable and cite its approval; this policy and old before/after screenshots are not themselves approval of a new mockup.

Have the project owner or designated tester review material layout changes before implementation. If no approved target exists, prepare the proposal within the Current unit, record `design review pending` and request review; do not mark the unit done, change queue order or invent approval. Wiring-only work that does not change layout can reference the established approved structure rather than request a new redesign. This documentation edit does not retroactively revoke earlier deliveries or claim their visual approval.

Compare implemented screens with the approved target using meaningful case content and section data at 1440×1000, 1280×720 and 390×844. A reference image illustrates direction; a tester must still be able to identify the case, follow its instructions, find the correct result action and continue. If the composition remains crowded despite passing row/CTA counts, it does not pass visual acceptance.

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
| `ResultEntryDialog` | One result form and lifecycle contract for panel Add result and Run-list Status entry, composed from shared controls and the shared dialog foundation; validate the UI-051 composition through UX-031/032/033/042 |

### Enforcement

- Feature code must not introduce a raw `<button>`, route-level `<table>`, or hand-built modal without documenting why a shared component cannot satisfy the requirement.
- Shared components must support workbench density; they must not force large card layouts.
- Component variants must describe meaning (`primary`, `secondary`, `quiet`, `danger`), not one-off colors.
- Route-specific composition is allowed; route-specific control styling is not.

## 7. Task backlog

Phase groups classify outcomes, not the live execution sequence. Follow NEXT_ACTIONS only. Do not use this usability program to expand feature parity; improve the existing tester journeys within the Current unit's scope.

`UX-*` items are tester-workflow specifications with outcome gates, rewritten on 2026-09-20. Their work statements define what the product must let a tester do, not a second automatic implementation queue. For visible changes, use the `UI-*` delivery checklist below: one `UI-*` checkbox is one reviewable unit. Existing delivery evidence is input to validation, not proof that the rewritten workflow is accepted. Reuse delivered behavior; propose a narrowly scoped repair only for an evidenced gap. Shared components support consistency rather than becoming a separate component-library project.

#### Outcome ownership and closure

UI-021 is the final verification owner for **all** UX gates below. The contributing units provide focused evidence, not automatic outcome completion. During UI-021, verify each gate against the integrated build, record pass/fail/blocked with dated evidence in `docs/ux-evidence/UI-021.md`, and check only the UX gates actually verified. UI-021 itself stays unchecked until every applicable gate and section 8 requirement passes. Failed checks do not authorize unrelated API refactoring: record the defect and request an explicit repair unit/queue decision. No gate may disappear merely because the UI queue is otherwise exhausted.

2026-09-20 queue decision: the user has now requested repair scheduling. UI-052–063 below are that explicit decision for the existing UI-021 findings; UI-021 is deferred until their acceptance evidence and NEXT_ACTIONS E01–E04 readiness. Their scoped existing-contract fixes are authorized when each becomes Current. Do not keep repeating the full failed gate or invent additional repairs beyond this queue. Earlier prose about a verification-only Current describes UI-021's scope, not a ban on these newly scheduled units.

| UX 결과 | 근거를 제공하는 UI 작업 | UI-021의 통합 판정 초점 |
| --- | --- | --- |
| UX-001 | UI-045/049/039/044 | 의도한 케이스 구성·실제 지침·Run별 결과 분리, J03/J04 |
| UX-002 | UI-010/030/037–039/051 | 읽는 대상/저장 대상/URL 일치, 저장 유지와 명시적 다음, J04–J06 |
| UX-003 | UI-022/023/032/038/051 | 필터·범위·접기·선택·상세의 설명 가능한 관계, J01/J05/J07 |
| UX-010 | UI-001/002/008/024/028/041/046–048/051 | 현재 업무의 진입점 발견, 의도적인 두 결과 진입점 유지, J01/J04/J07 |
| UX-011 | UI-001/008/024/042/043/044/046/051 | 화면 간 읽기/선택/편집/기록 의미와 공통 제어 일관성, J01/J04/J08 |
| UX-012 | UI-006/025/026/035/037/042/051 | 필수 입력·초안·취소·모달 포커스·부분 저장 설명, J02/J05/J06 |
| UX-013 | UI-003/023/026/033/039/040/042/044/051 | 폴더 트리·소속 블록·읽기 문서·작은 결과창의 계층, J01/J04 |
| UX-020 | UI-003/004/023/029/043/044 | 제목으로 탐색하고 상세에서 읽은 뒤 문맥 복귀, J01/J02 |
| UX-021 | UI-005/006/044/049/039 | quick outline과 실제 Text/Steps 지침 작성·영속화, J02–J04 |
| UX-022 | UI-001/002/022–024/028/043 | 섹션 범위·필터·보기의 서로 다른 의미와 대상 집합, J01/J07 |
| UX-023 | UI-007/022/023/025/026 | 부모/자식·소속·생성/이동 대상 이해, J01/J07 |
| UX-030 | UI-009/032/038 | bulk의 정확한 대상과 성공/실패별 재시도, J07 |
| UX-031 | UI-010/030/037–039/051 | 두 진입점의 동일한 작은 폼, 저장 전 무변경, 지침으로 복귀, J04/J05 |
| UX-032 | UI-012/030/032/037/038/051 | 결과/첨부/담당자 부분 성공 구분과 중복 없는 복구, J06/J07 |
| UX-033 | UI-013/030/031/037/051 | 실제 저장소의 업로드→재열기→원본 다운로드 및 이력/결함 재조회, J05/J06 |
| UX-034 | UI-008/014/033/039–042/044/051 | 상단 통계 아래 실제 지침으로 수행, 다음 지침 및 누락/실패 구분, J04/J08 |
| UX-040 | UI-015–020/034–036/041/042/046–048/050 | 프로젝트/허브/My Tests/Plan에서 남은 실행 대상으로 진입, J08 |
| UX-041 | UI-021 및 UI-022/039/044/045/049/050/051 | 실제 테스터의 작성→수행→기록→복구→재개 관찰, J01–J08 |
| UX-042 | 모든 변경 화면, 특히 UI-051; UI-021이 취합 | 참고 배치·실제 키보드·반응형·오류/권한 상태별 작업 가능성, J01–J08 |

#### Supersession register — retain history, use the current contract

| Earlier wording / delivery | Current contract / follow-up |
| --- | --- |
| UI-001 “one visible Add Case” versus UI-005 outline | One dominant creation CTA; quiet section-native outline is an intentional alternate depth, not a forbidden duplicate. |
| UI-008 “result recording dominant” and UI-014 density | Reading and performing the test is primary; recording supports it. UI-039/040/section 5 govern composition; density must not hide instructions. |
| UI-010/011/013 composer / Results-tab evidence | Preserve saving, staging and recovery; UI-037/038 govern the shared modal and all ordinary status choices. Do not restore a permanent inline form. |
| UI-037–039 dialog delivery / earlier field placement | UI-051 owns the reference-shaped form: two columns, one Status dropdown, visible right-side metadata, staged Assign To and compact footer. It supersedes hiding Version/Elapsed, excluding Assign To and three prominent footer buttons; preserve identity, required inputs and recovery. Historical checks are not visual acceptance. |
| UI-016 selection result action | UI-034/046 govern single-target navigation and Run identity; do not imply unsupported multi-run bulk recording. |
| UI-027/029 header-only improvements | UI-041/044 govern the remaining global chrome/detail body. Header evidence does not certify the whole reading surface. |
| UI-015–020 shared rollout / UI-036 Plan disclosure | UI-042 and UI-046–048 refine visual/action hierarchy, preserving the delivered feedback and contextual behavior. |

Known evidence debt: UI-031's checked delivery verified safe rejection in unsupported storage. Its evidence explicitly lacks live configured-storage upload/reopen/download and complete keyboard traversal. Keep the historical check, but carry those checks into UI-021/UX-033/UX-042; do not describe attachment usability as fully verified until they pass. Section 8 defines how to report verification debt rather than treating it as success.

UI-051 is also a historical checked delivery, not full UX acceptance: its evidence reports real attachment storage unavailable, native Tab/Shift+Tab not exercised and tester/design review pending. Carry these into UX-012/033/041/042 and UI-021. The reported case-instruction load error must be reproduced under UX-001/034 on the integrated fixture, not silently treated as a usable execution flow or assumed universal from one run. This revision neither changes delivery checks nor asserts new runtime findings.

#### Task-content audit against TestRail — disposition of all original 48 units

This is a review of **what each task asks the implementer to build**, not another principles checklist. Reference keys below link to official TestRail material in section 9. R1–R4 define the case/execution work; R5–R7 inform supporting views. The user's supplied classic TestRail screenshots remain the visual direction for top statistics, quiet section lists and the compact result dialog. Current official docs can have newer navigation: do not mix old top tabs and new side navigation into two simultaneous navigation systems. Source-derived behavior and this project's design choices are distinguished below.

The authoring, Run-selection and result-dialog official images were visually inspected during this review. Local UI-006 evidence and current CaseAuthoringForm were inspected for the authoring gap; current RunListPage already mixes runs/plans, so UI-050 must refine that existing hub, not build a duplicate one. This is not a fresh live audit of every application route. A kept task is a valid contribution, not certification that its shipped screen matches TestRail.

| Unit | Disposition | Task-content finding and concrete correction/owner |
| --- | --- | --- |
| UI-001 | Supplement | Moving commands to overflow does not define a repository. UI-043 must specify a section-grouped case table, columns and open/select behavior (R1/R2). |
| UI-002 | Keep + supplement | Search/Filter/View is appropriate; UI-043 must make section scope and selected count adjacent to the actual cases, not another toolbar stack. |
| UI-003 | Keep + supplement | Title width is useful but insufficient; UI-043 defines normal text rows and metadata placement rather than relying only on a 240px threshold. |
| UI-004 | Keep | Responsive list/detail and return context support the three-pane workflow (R2). Do not redesign solely to fit more panels. |
| UI-005 | Keep | Section-native quick outline directly matches the documented creation path (R1); it is not a substitute for full instructions. |
| UI-006 | Incomplete design coverage | Sticky Save/validation/dirty-close did not specify a usable case-writing form. UI-049 adds explicit template-specific authoring and read-back into execution (R1/R3). |
| UI-007 | Keep | Named parent/child targets support case organization; preserve text/folder hierarchy rather than management cards. |
| UI-008 | Redirect | “Result recording dominant” is not sufficient: UI-039 makes the test's readable instructions central, with recording actions at the edge (R2/R4). |
| UI-009 | Keep | Selection-local bulk results match batch execution needs (R4); retain exact target count. |
| UI-010 | Keep, qualified | Explicit Pass & Next remains; ordinary Status entries use the dialog under UI-038. No inference that every pass action is instant (R4). |
| UI-011 | Superseded presentation | Keep form fields/lifecycle; UI-037 owns the compact popup. Inline Results-tab form is no longer the layout target. |
| UI-012 | Keep as reliability | Local feedback/retry protects results, but is not evidence of a TestRail-like screen composition. |
| UI-013 | Keep as reliability | Staging evidence belongs to recording; verify file content as well as displayed filename under UI-021. |
| UI-014 | Supplement | Six rows cannot prove execution usability. UI-039 must show meaningful steps/expected results beside those rows. |
| UI-015 | Incomplete design coverage | One Add Run and overflow did not define an execution landing page. UI-050 adds status-bearing active/completed run/plan rows and direct resume (R5/R7). |
| UI-016 | Redirect | My Tests must answer “what is assigned to me and where do I resume?”, not simply reuse table controls. UI-046 owns this. |
| UI-017 | Keep, verify role | Milestone remains a release grouping with linked runs/progress, not a generic create/list demo. UI-021 tests opening a populated milestone into its work; absent behavior is reported, not hidden by component compliance. |
| UI-018 | Incomplete design coverage | A cleaner Plan header is not a useful plan. UI-047 must show contained executable runs/configurations before entry-management controls (R5). |
| UI-019 | Keep, verify role | Reports are a secondary analysis workflow. UI-035/021 retain populated filter/export checks; no new report builder or core execution dashboard is implied. |
| UI-020 | Keep as support | Settings accessibility/save feedback are necessary administration, not evidence that the tester's main journey is finished. |
| UI-021 | Rewrite acceptance emphasis | Compare actual repository/authoring/run-selection/execution/result screens with R1–R7 and perform a continuous tester scenario; checklist arithmetic is insufficient. |
| UI-022 | Keep | Direct/subtree/all scope answers which cases are included; this is independent of visual density and must stay explicit. |
| UI-023 | Keep | Section-owned blocks are the right reading structure; preserve quiet headers, ownership and no duplicate cases. |
| UI-024 | Keep | Grouping/spacing/columns are separate view choices; do not restore an always-visible control for each option. |
| UI-025 | Keep as reliability | Correct move/copy modal behavior protects case organization; not a separate visual redesign. |
| UI-026 | Keep as reliability | Folder-tree keyboard semantics support the existing visual direction; do not add more row chrome. |
| UI-027 | Superseded coverage | Header-height reduction was partial. UI-041 supplies global compaction; UI-043 still owns the repository composition beneath it. |
| UI-028 | Keep | One contextual selection bar and one dominant empty-state action; section-native outline remains an intentional alternate path. |
| UI-029 | Incomplete design coverage | Header-only cleanup missed the detail body. UI-044 specifies the actual case-reading document, not merely fewer icons. |
| UI-030 | Keep as reliability | Result/test ownership is essential and survives every popup/layout change. |
| UI-031 | Keep with debt | Safe storage rejection is necessary but not a completed evidence workflow; UI-021 verifies real byte roundtrip. |
| UI-032 | Keep as reliability | Bulk target consistency is essential and separate from single-result visual treatment. |
| UI-033 | Keep + supplement | Full title/Status labels are retained; UI-039/040 determine the whole execution surface, not row count alone. |
| UI-034 | Keep | Distinguishing the same case in different runs is a tester requirement; UI-046 supplies the complete queue view. |
| UI-035 | Keep | Named report menus and populated outputs fix a specific ambiguity; do not make reporting a permanent peer of test execution. |
| UI-036 | Supplement | Hiding empty configuration controls is useful; UI-047 must make real generated runs easy to identify and open. |
| UI-037 | Keep foundation + correct form | The shared dialog exists, but UI-038's captured form and current ResultEntryPanel retain large status tiles. UI-051 applies the user's actual two-column reference; modal existence/width is insufficient (R4). |
| UI-038 | Make concrete | Specify the Status control as a compact labeled dropdown in the existing row, not a button grid or a new Status column. |
| UI-039 | Rewrite target | Define identity/metadata/preconditions/action–expected steps/history/actions and list-to-detail selection, including an interrupted test (R2–R4). |
| UI-040 | Keep | Top chart/legend/pass-rate matches the supplied Run reference; retain a real progress overview rather than stripping charts to achieve minimalism (R7). |
| UI-041 | Keep + targeted follow-up | Keep compact navigation/focus improvements. UI-050 gives Runs and Plans one execution-area entry; no new global navigation rewrite. |
| UI-042 | Keep as visual foundation | Removing borders is only groundwork; UI-043/044/047/048/050 must define content composition and meaningful progress. |
| UI-043 | Rewrite target | Specify repository rows, section headers, column order, quick outline and detail entry; do not stop at removing selects. |
| UI-044 | Rewrite target | Specify a readable case document and template-specific content, not just moving metadata edit into a menu (R3). |
| UI-045 | Correct direction | Do not present fixed-all as TestRail's default all-inclusion behavior. Use explicit all/selected/dynamic choices and truthful automatic-inclusion semantics (R6). |
| UI-046 | Rewrite target | Queue rows show Run identity, case, current status and assignee context; the default journey opens the exact assigned test to read and execute. |
| UI-047 | Rewrite target | Plan first displays its existing executable runs grouped by entry/configuration, with progress and open links; configuration/generation is a distinct management mode (R5). |
| UI-048 | Correct minimalism | Keep a concise project progress summary and actionable run links; do not treat useful progress charts as clutter merely because they are not buttons (R7). |

Two uncovered deliverables are added below: **UI-049 case instruction authoring** and **UI-050 Runs & Results landing/navigation**. They close gaps in UI-006 and UI-015/041, respectively, instead of adding more generic “simplify” tickets. Existing checked units remain dated deliveries. Neither source review nor this table asserts new runtime completion.

### UX 작업 재정의 — 2026-09-20

아래 19개 항목은 기존 UX 본문을 대체한다. ID는 기존 UI 작업·증거와의 연결을 위해 유지하지만, 내용은 **테스터가 해야 할 일을 자연스럽게 끝내도록 만드는 작업 명세**로 다시 작성했다. 컴포넌트 존재, 버튼 수, API 성공, 스크린샷 개수만으로 체크하지 않는다. TestRail의 모든 기능이나 옛 색상을 복제하는 것이 아니라 사용자가 제시한 폴더 트리·섹션별 목록·지침 패널·작은 결과 입력창의 일관된 업무 구조를 따른다.

각 항목의 ‘작업’은 목표 동작이고 이미 구현돼 있으면 재구현하지 않고 실제 흐름으로 검증한다. 미충족이면 재현 절차·기대 동작·영향 파일/화면·실패 증거를 기록하고 하나의 검증 가능한 수정 단위로 제안한다. **UI-021 자체는 검증 단위**이므로 그 안에서 발견한 결함을 일괄 구현하는 권한이 아니다. 현재 편성된 UI-052–063 수정은 각 단위가 NEXT_ACTIONS의 Current일 때 수행하고, UI-021은 그 뒤에 재개한다. 이 문서 개정 자체로 제품 수정이나 완료 판정을 하지 않는다.

### A. 같은 테스트를 보고 있다는 신뢰 — UX-001–003

- [ ] **UX-001 P0 — 관리한 케이스가 의도한 Run에 들어가고, 수행할 지침까지 이어진다.**
  - 테스터 목적: “작성한 이 케이스들로 이번 테스트를 진행한다.” 케이스 원본과 Run의 테스트 인스턴스를 구분하되 이름·지침을 다시 옮겨 적지 않는다.
  - 작업: Run 생성 시 All/Selected/Dynamic의 포함 규칙과 대상 수를 명시한다. Selected에서는 고른 ID만 포함하고, All/Dynamic은 이후 케이스 추가 시 포함 여부를 실제 기존 계약과 일치시킨다. 단순히 필터된 첫 페이지만 전체로 세지 않는다.
  - 작업: 케이스 번호·제목·사전조건·Action/Expected 또는 Text 지침이 실제 선택한 케이스에서 이어져야 한다. 원본 수정의 Run 반영 시점은 현재 snapshot/live 계약을 확인해 설명하며, UX 수정만으로 버전 정책을 바꾸지 않는다.
  - 검증/완료: 다른 섹션의 제목이 비슷한 케이스 중 정확히 5개를 선택해 생성하고 ID와 지침을 대조한다. All/Selected/Dynamic 각각에 케이스를 추가해 포함 규칙도 확인한다. 같은 C1을 Run A/B에 넣어 결과와 담당자가 서로 섞이지 않음을 확인한다.
  - 불합격: 지침 누락, 임의 fixture 대체, 포함 규칙과 다른 대상, Run별 결과를 케이스 전역 상태처럼 표시. 관련: UI-045/049/039/044, 시나리오 J03/J04.

- [ ] **UX-002 P0 — 케이스를 넘기거나 다시 열어도 읽는 대상과 기록 대상이 일치한다.**
  - 테스터 목적: “방금 수행한 케이스에 기록하고, 다음 케이스를 이어서 본다.”
  - 작업: 행 열기·이전/다음·URL·새로고침·뒤로가기에서 선택된 testId, 강조 행, 읽기 지침을 맞춘다. 모달은 열 때 대상을 고정해 이후 비동기 선택 변경이 저장 대상을 바꾸지 않게 한다.
  - 작업: Add Result는 저장 후 현재 테스트 유지, Save & Next와 명시적 Pass & Next만 다음으로 이동한다. 다음은 현재 정렬/필터 기준이며 마지막에서 처음으로 몰래 순환하지 않는다. 초안이 있으면 대상 변경 전에 계속 작성/폐기 선택을 제공한다.
  - 검증/완료: 서로 다른 지침의 5개 테스트에서 일반 저장·취소·Save & Next·Pass & Next·실패 재시도를 섞어 수행한다. 매번 제목/URL/요청 testId/기록을 대조하고 새로고침·뒤로가기 후에도 재확인한다.
  - 불합격: A 지침을 보며 B에 저장, 저장 실패 후 다음 이동, 일반 저장에서 자동 다음 이동, 중복 제출. 관련: UI-010/030/037–039/051, J04–J06.

- [ ] **UX-003 P0 — 범위·필터·접힌 블록이 바뀌어도 보이는 목록과 작업 대상이 설명된다.**
  - 테스터 목적: “지금 어떤 테스트들을 보고 있고 내 선택이 어디에 적용되는지 안다.”
  - 작업: 섹션 범위·검색·상태 필터 변경 후 실제 포함 대상, 선택 수, 상세를 조정한다. 범위 밖 선택은 해제하고 이유를 알리거나 명시적으로 범위를 표시한다. 숨은 선택을 설명 없이 저장 대상으로 유지하지 않는다.
  - 작업: 블록 접기는 표시만 바꾸며 조회 범위를 바꾸지 않는다. 필터 때문에 저장한 행이 사라질 때는 저장 사실과 이동 위치를 설명하고 적절한 목록 위치에 포커스를 돌린다. 모달 초안이 있는 전환은 UX-002의 보호를 따른다.
  - 검증/완료: Failed 필터의 테스트를 Passed로 기록, 선택 후 섹션/페이지 이동, 블록 접기, 범위 전환과 Back을 수행한다. 각 단계의 조회 수/선택 ID/상세/요청 대상이 일치한다.
  - 불합격: 보이지 않는 대상에 무고지 쓰기, 접기만으로 대상 변경, 목록과 다른 상세를 정상 상태처럼 표시. 관련: UI-022/023/032/038/051, J01/J05/J07.

### B. 화면을 배우지 않아도 읽히는 구성 — UX-010–013

- [ ] **UX-010 P0 — 현재 업무에 필요한 행동만 적절한 위치에서 발견한다.**
  - 테스터 목적: “찾기·읽기·편집·기록 중 지금 할 일이 무엇인지 메뉴를 전부 열지 않아도 안다.”
  - 작업: Cases 기본은 찾기/읽기와 Add Case, 선택 상태는 대상 수와 일괄 작업, 상세는 읽기와 Edit, 편집은 Save/Cancel로 구분한다. Run은 지침 읽기가 중심이고 패널 Add result와 행 Status는 같은 기록창으로 연결한다.
  - 작업: Import/Export/Print/Reports/관리 기능은 이름 있는 보조 메뉴로 옮긴다. 자주 쓰는 검색·섹션 범위·현재 필터는 숨기지 않는다. 서로 다른 맥락의 두 결과 진입점과 quick outline/full editor를 중복이라는 이유로 제거하지 않는다.
  - 검증/완료: 대표 테스터에게 “이 케이스 편집”, “이 테스트 실패 기록”, “선택한 3개 이동”을 요청하고 도움 없이 올바른 진입점을 찾는지 관찰한다. 읽기/선택/편집/모달별 실제 작업 위치를 기록한다.
  - 불합격: 모든 기능이 동등한 버튼, 핵심 동작이 불명확한 아이콘뿐, 버튼을 줄였지만 업무 발견성이 떨어짐. 관련: UI-001/002/008/024/028/041/046–048/051, J01/J04/J07.

- [ ] **UX-011 P0 — 목록·트리·상세·입력창이 화면마다 같은 사용 규칙을 가진다.**
  - 테스터 목적: “Cases에서 익힌 조작을 Runs와 My Tests에서도 예측할 수 있다.”
  - 작업: 같은 의미의 검색/Filter/View/선택/저장/취소는 공통 컴포넌트와 용어로 맞춘다. 행 제목은 상세 읽기, 체크박스는 일괄 선택, Status는 결과 기록 진입이라는 의미를 섞지 않는다.
  - 작업: 저장된 값은 읽기 텍스트로, 편집 중인 값은 입력 컨트롤로 구분한다. 경계·여백·행 높이·오류 표시도 공통 규칙으로 적용하되 읽기 영역까지 입력칸이나 카드로 만들지 않는다. 신규 컴포넌트 묶음을 만드는 것 자체는 목표가 아니다.
  - 검증/완료: Cases → Run → My Tests에서 동일 조작의 이름/위치/초점/취소 의미를 비교하고 테스트 대상을 바꾸지 않는 읽기 동작을 확인한다. 예외는 업무상 이유와 실제 동작을 기록한다.
  - 불합격: 같은 형태가 어떤 화면에서는 편집, 다른 곳에서는 즉시 저장; 공통 컴포넌트 채택만으로 합격. 관련: UI-001/008/024/042/043/044/046/051, J01/J04/J08.

- [ ] **UX-012 P0 — 폼과 대화상자는 필요한 입력·저장 여부·되돌아갈 위치를 명확히 한다.**
  - 테스터 목적: “무엇을 입력해야 하고 취소하면 무엇이 남는지 안다.”
  - 작업: 필수 필드는 label/required/error를 연결하고 입력한 값을 보존한다. 입력창은 하나의 overlay/focus 계약을 사용하고 배경은 비활성화한다. 닫기·Escape·Cancel은 같은 초안 폐기 규칙을 따르며 확인창을 여러 겹 쌓지 않는다.
  - 작업: 결과창 첫 초점은 Status, 종료 후 원래 Add result/행 Status로 복귀한다. 저장 중 중복 제출을 막고, 부분 저장 후 닫기는 이미 저장된 내용과 남은 작업을 정확히 알린다.
  - 검증/완료: 케이스 편집·이동창·결과창에서 필수 누락, 서버 오류, dirty close, 긴 제목, Tab/Shift+Tab/Escape와 포커스 복귀를 실제로 수행한다.
  - 불합격: 입력 사라짐, 배경으로 포커스 이탈, 저장된 결과까지 취소됐다는 안내, label만 있고 실조작 불가. 관련: UI-006/025/026/035/037/042/051, J02/J05/J06.

- [ ] **UX-013 P1 — 테두리와 카드 대신 내용의 계층으로 화면을 구분한다.**
  - 테스터 목적: “섹션·케이스·스텝의 상하 관계를 읽을 수 있고 장식 때문에 산만하지 않다.”
  - 작업: 섹션은 폴더 아이콘+텍스트+들여쓰기+펼침 제어의 조용한 트리로 구성한다. 선택/키보드 초점은 구분하되 섹션마다 상자를 두지 않는다. 목록은 섹션 경로 제목·간격·얇은 구분선으로 묶는다.
  - 작업: 케이스 상세는 문서처럼 사전조건/스텝/기대 결과를 읽게 하고, 결과창은 외곽 경계 하나와 의미 있는 입력 테두리만 둔다. Status는 작은 라벨/선택기이며 큰 색상 타일은 금지한다. 입력·오류·포커스 경계까지 없애는 무조건적 무테두리 정책은 아니다.
  - 검증/완료: 3단계 이상 섹션, 동일 이름의 하위 섹션, 긴 제목과 20개 케이스를 넣고 1280/390px에서 부모·자식·선택·소속을 설명할 수 있는지 확인한다.
  - 불합격: 카드 안 카드, 블록마다 반복 도구막대, 들여쓰기만 늘어나 제목이 사라짐, 축소한 빈 화면만 비교. 관련: UI-003/023/026/033/039/040/042/044/051, J01/J04.

### C. 테스트케이스를 찾고 실행 가능한 내용으로 관리 — UX-020–023

- [ ] **UX-020 P0 — 목록은 케이스를 찾는 공간, 상세는 지침을 읽는 공간으로 만든다.**
  - 테스터 목적: “제목으로 케이스를 찾고 상세를 열어도 위치를 잃지 않는다.”
  - 작업: 기본 행은 ID·읽을 수 있는 제목·Type/Priority 등 간단한 메타데이터다. 상시 select/복사 버튼/여러 편집 진입점을 제거하고 필요한 편집은 상세 Edit 또는 선택 작업으로 모은다.
  - 작업: 상세를 열면 케이스 문서가 읽히고 목록 제목도 남는다. 좁은 화면은 목록/상세를 전환하고 ‘목록으로’ 복귀 시 섹션·범위·검색·위치를 유지한다. 240px 같은 폭 수치만 맞추기 위해 의미 있는 제목을 잘라서는 안 된다.
  - 검증/완료: 길고 비슷한 제목의 케이스를 검색해 열고, 다른 케이스와 비교한 뒤 돌아온다. 1280px 상세 열린 상태와 390px 전환에서 제목과 위치를 식별할 수 있다.
  - 불합격: 행 클릭이 체크박스까지 바꿈, 상시 편집 컨트롤이 제목을 밀어냄, 상세 닫으면 검색/위치 소실. 관련: UI-003/004/023/029/043/044, J01/J02.

- [ ] **UX-021 P0 — 제목 수집과 실제 테스트 지침 작성을 모두 수월하게 한다.**
  - 테스터 목적: “케이스를 빠르게 정리한 뒤 다른 테스터도 수행할 수 있는 내용을 작성한다.”
  - 작업: 섹션 내 quick outline은 Enter로 연속 제목 입력을 지원한다. 전체 Add/Edit는 Title과 Section/Template 문맥 다음에 실제 지침을 둔다. Text는 Preconditions → Steps → Expected, Steps는 순서 있는 Action/Expected 쌍을 작성한다.
  - 작업: 적용되는 BDD/탐색형/필수 custom 입력은 보존하고 불필요한 메타데이터는 보조 영역으로 정리한다. 템플릿 변경·취소·저장 실패에서 지침을 몰래 버리지 않는다. 원본 편집과 Run 결과 기록은 별개다.
  - 검증/완료: 제목 5개를 연속 추가한 뒤 하나는 Text, 하나는 3단계 Steps로 완성한다. 순서 변경/편집/저장/재열기를 거쳐 케이스 읽기와 Run 읽기에 같은 실제 지침이 나타난다. 제목만 있는 케이스는 지침 미작성으로 구분한다.
  - 불합격: 제목 5개 생성만으로 합격, Steps 입력이 저장되지 않음, 작성자가 별도로 설명해야 실행 가능. 관련: UI-005/006/044/049/039, J02/J03/J04.

- [ ] **UX-022 P0 — 목록의 포함 범위와 보기 설정을 혼동하지 않게 한다.**
  - 테스터 목적: “선택 섹션만 보는지 하위 섹션도 보는지 예측하고 케이스를 찾는다.”
  - 작업: 경로와 범위 선택기 Selected section only / Include subsections / All sections를 목록 가까이에 둔다. 검색/Filter는 포함 대상을, View의 열·그룹·행 간격은 표현을 바꾼다는 차이를 이름과 현재 조건으로 드러낸다.
  - 작업: 기본은 섹션별 소속 블록이며 전체/하위 포함에서도 경로와 직접 소속 TC 수를 표시한다. All sections에서 트리 선택은 블록 이동이고 다른 두 범위에서는 조회 범위 변경임을 일관되게 유지한다. 빈 결과는 조건을 보여주고 해제 경로를 제공한다.
  - 검증/완료: 기존 UI-022 fixture에서 Authentication 선택 시 직접 2/하위 포함 6/전체 10, Login 직접 3/하위 포함 4를 확인한다. 다른 fixture라면 예상 ID 집합을 먼저 명시한다. 보기 밀도·블록 접기·새로고침·Back·저장된 보기에서도 포함 규칙이 유지된다.
  - 불합격: Compact가 조회 대상을 바꿈, 하위 포함에 다른 형제 섹션 혼입, 전체 수와 현재 페이지 수 혼동. 관련: UI-001/002/022–024/028/043, J01/J07.

- [ ] **UX-023 P0 — 섹션의 계층과 케이스 소속을 읽고 안전하게 정리한다.**
  - 테스터 목적: “어떤 섹션 아래에 어떤 TC가 있고 어디에 추가/이동되는지 안다.”
  - 작업: 폴더 트리의 펼침과 섹션 선택을 구분하고, 목록의 블록 경로와 트리 선택을 연결한다. 이름이 같은 Login도 Authentication/Login과 Checkout/Login으로 구분한다. 케이스는 실제 소유 섹션에 한 번만 표시한다.
  - 작업: 섹션/하위 섹션 추가·이름 변경·이동/복사는 맥락 메뉴에서 제공하되 대상 경로를 확인시킨다. 드래그만 강요하지 않고 선택 메뉴로 같은 목적을 달성하게 한다. 위험 동작의 확인은 수와 대상 관계를 명시한다.
  - 검증/완료: 3단계 트리에서 자식 생성, 같은 이름의 다른 부모로 이동, 취소, 빈 부모, 접힌 선택 블록을 조작한다. 좁은 화면에서도 경로/대상을 확인하고 되돌아온다.
  - 불합격: 부모/자식 구분 불가, 표시만 옮기고 실제 소속 불일치, 접힌 블록의 선택을 무고지 숨김. 관련: UI-007/022/023/025/026, J01/J07.

### D. 지침을 읽고 테스트를 수행하고 기록 — UX-030–034

- [ ] **UX-030 P0 — 여러 테스트에 기록할 때 적용 대상을 실수하지 않는다.**
  - 테스터 목적: “지금 선택한 테스트들에만 같은 결과/담당자를 적용한다.”
  - 작업: 체크박스 선택 후 목록 가까이에 대상 수와 결과/담당자/해제를 노출한다. 상세 열기와 bulk 선택을 분리하고 보이는 페이지/필터 전체/명시적 선택 범위를 혼용하지 않는다.
  - 작업: 실행 직전 대상 집합을 고정하고 필터·페이지·섹션 변경 시 선택 정책을 알린다. 단일 테스트 결과창의 2열 폼을 이유 없이 bulk에 복제하거나 지원되지 않는 다중 Run 저장을 추가하지 않는다.
  - 검증/완료: 여러 섹션에서 3개 선택, 범위 변경, 일부 실패/재시도를 수행하고 선택 ID와 실제 변경 ID를 비교한다. 성공 대상에 결과가 다시 추가되지 않고 실패 대상만 남는다.
  - 불합격: 행 읽기만으로 bulk 선택, 숨은 다른 Run 대상 변경, 대상 수만 맞고 ID가 다름. 관련: UI-009/032/038, J07.

- [ ] **UX-031 P0 — 지침 확인 후 두 진입점 어디서나 같은 작은 창으로 결과를 기록한다.**
  - 테스터 목적: “수행한 케이스의 결과와 필요한 근거를 짧게 입력한다.”
  - 작업: 패널 Add result와 목록의 현재 Status 드롭다운은 같은 대상 식별·검증·저장·취소를 쓰는 공통 창을 연다. Passed를 포함한 일반 상태 선택은 미리 지정일 뿐 저장하지 않는다.
  - 작업: 사용자 첨부 이미지처럼 왼쪽 Status 드롭다운/Comment/작은 첨부 영역, 오른쪽 Assign To/Version/Elapsed/Defects, 하단 Add Result/Cancel로 구성한다. Save & Next는 작은 보조 메뉴로 보존한다. 큰 상태 타일·중첩 카드·상시 도구모음을 다시 만들지 않는다.
  - 작업: 일반 저장은 현재 케이스로 복귀하고, 별도 Pass & Next는 필수 증거가 없을 때만 명시적 빠른 성공이다. 필수 값이 있으면 창에서 입력받는다. 같은 상태의 재기록도 가능하며 저장된 이력 덮어쓰기로 바꾸지 않는다.
  - 검증/완료: 두 진입점에서 같은 Failed 기록을 각각 작성/취소/저장하고 동일한 필드·검증·payload 의미를 확인한다. 상태/담당자만 바꾸고 취소하면 요청 0회, 정상 저장 후 목록·이력·통계가 일치한다. 완료된 케이스의 지침과 위치를 유지한다.
  - 불합격: 결과창 존재만으로 합격, 목록 선택 즉시 저장, 다른 testId에 기록, 짧은 입력을 위해 긴 폼을 탐색해야 함. 관련: UI-010/030/037–039/051, J04/J05.

- [ ] **UX-032 P0 — 실패해도 입력을 잃거나 같은 결과를 중복 기록하지 않는다.**
  - 테스터 목적: “무엇이 저장됐고 무엇을 다시 해야 하는지 확실히 안다.”
  - 작업: 결과 생성 실패와 결과 성공 후 첨부/담당자 변경 실패를 구분한다. 전자는 초안을 보존해 재제출, 후자는 기존 resultId/testId에 실패한 작업만 재시도한다. 전체를 ‘실패’로 롤백해 이미 저장된 결과를 숨기지 않는다.
  - 작업: 중복 클릭을 막고 모든 요청 작업 성공 전 창 닫기/다음 이동을 자동 실행하지 않는다. 부분 성공 후 닫기는 저장된 결과와 미완료 작업을 알린다. Undo는 실제 지원 범위만 표시하며 result 삭제/취소 기능을 새로 가정하지 않는다.
  - 검증/완료: 결과 POST 실패, 결과 성공+첨부 실패, 결과 성공+할당 실패, 두 부수 작업 실패, 성공 후 필터로 행이 사라지는 경우를 각각 확인한다. 입력 유지·현재 대상·결과 수·성공한 작업 재실행 없음과 피드백을 확인한다.
  - 불합격: 재시도로 결과 중복, 저장된 결과를 취소됐다고 안내, 작업 일부 실패인데 Saved만 표시, 실패 후 다음 진행. 관련: UI-012/030/032/037/038/051, J06/J07.

- [ ] **UX-033 P0 — 기록한 근거와 이력을 다시 열어 실제로 확인한다.**
  - 테스터 목적: “나와 동료가 왜 그 결과인지 댓글·결함·원본 첨부로 재확인한다.”
  - 작업: 기록 전 파일 staging/제거를 제공하고 결과 생성 후 파일별 업로드 상태를 표시한다. History/Results는 조회 중심으로 시간·작성자·상태·댓글·결함·첨부의 연결을 보여준다. Defects가 지원하는 키/링크 형식으로 저장되고 다시 읽혀야 한다.
  - 작업: 같은 상태의 추가 기록과 과거 이력을 구분하고 현재 결과를 명확히 한다. 파일명만 표시하거나 저장되지 않은 결함 문자열을 성공처럼 보여주지 않는다. Run A의 C1 근거가 Run B의 C1에 나타나지 않아야 한다.
  - 검증/완료: 설정된 실제 저장소에서 이미지와 텍스트 2개를 업로드하고 창 닫기/새로고침/이력 재열기/다운로드 후 원본 bytes 또는 hash를 비교한다. 결함·댓글·버전·경과 시간도 재조회한다. 접근 거부/업로드 실패/재시도는 별도 경로로 검증한다.
  - 불합격: mock 성공·파일명·안전한 저장 거절만으로 정상 첨부 완료 판정. 환경 미설정은 blocked이며 검증 면제가 아니다. 관련: UI-013/030/031/037/051, J05/J06.

- [ ] **UX-034 P0 — Run 화면만 보고 실제 테스트 절차를 따라갈 수 있다.**
  - 테스터 목적: “무엇을 준비하고 어떤 순서로 조작하며 무엇과 비교할지 안다.”
  - 작업: Run 통계는 화면 위쪽의 낮은 요약으로, 아래는 목록/섹션 탐색과 선택 케이스의 읽기 패널로 구성한다. 영구 왼쪽 통계 열이나 여러 헤더가 목록·지침 공간을 빼앗지 않게 한다. 통계 클릭은 필터일 뿐 결과 변경이 아니다.
  - 작업: 패널은 케이스 식별 → 짧은 메타정보 → Preconditions → 번호 있는 Action/Expected 또는 Text 절차 → 공통 Expected → 결과/이력 순서다. Add result는 짧은 작업 줄에 둔다. 결과 상태 컨트롤이나 step-result 입력을 원래 지침의 대체물로 쓰지 않는다.
  - 작업: 지침 없음/불러오는 중/조회 실패를 구분하고 BDD·탐색형의 해당 수행 지침도 보존한다. 좁은 화면에서는 목록 대신 지침에 집중하되 돌아갈 경로를 둔다. 고정 작업 줄이 마지막 스텝을 가리지 않게 한다.
  - 검증/완료: 처음 보는 케이스의 사전조건 2개·3개 Action/Expected·공통 Expected를 테스터가 읽고 테스트용 대상에서 수행/비교한다. 10개 스텝과 다음 케이스의 다른 지침, 내용 없음/실패 상태도 확인한다. Cases 관리 화면으로 돌아가야 지침을 찾는다면 실패다.
  - 불합격: 제목/상태만 있는 fixture, 결과 입력만 찍은 캡처, ‘6개 행 표시’ 때문에 지침 축소/생략. 관련: UI-008/014/033/039–042/044/051, J04/J08.

### E. 작업 시작·재개와 실제 사용자 검증 — UX-040–042

- [ ] **UX-040 P1 — 어디서 테스트를 시작하고 이어갈지 바로 찾는다.**
  - 테스터 목적: “오늘 할 Run을 찾아 들어가고 중단한 테스트를 다시 수행한다.”
  - 작업: 프로젝트에서 Cases와 실행 영역에 바로 접근한다. 기존 Runs & Results 목록은 Active/Completed와 Run/Plan을 구분하고 실제 진행 현황·이름·문맥을 읽히게 한다. 같은 기능의 별도 대시보드를 늘리지 않는다.
  - 작업: My Tests는 할당된 테스트의 Run·제목·상태를 보여주고 정확한 테스트 지침으로 연다. Plan은 구성별 실행 가능한 Run을 먼저 보여주며 생성/관리 도구는 보조 영역에 둔다. Reports/Settings가 일상 실행 동작과 같은 비중으로 경쟁하지 않게 한다.
  - 검증/완료: 활성 Run 2개·완료 Run 1개·구성별 Plan·다른 Run의 같은 케이스를 준비한다. 테스터가 남은 작업을 식별하고 정확한 대상에 들어가 읽기/기록/복귀한다. 실제 데이터 범위와 집계가 일치하고 필터를 유지한다.
  - 불합격: 헤더만 통일, 카드 숫자만 보고 실행 대상 식별 불가, My Tests에서 Run 맥락 없는 기록, 존재하지 않는 자동 재개 알고리즘 가정. 관련: UI-015–020/034–036/041/042/046–048/050, J08.

- [ ] **UX-041 P0 — 실제 테스터가 케이스 관리부터 수행·기록·재개까지 끝낸다.**
  - 테스터 목적: “도구 사용법을 계속 묻지 않고 테스트 업무를 끝낸다.”
  - 작업: 아래 J01–J08 시나리오를 같은 통합 빌드와 명시한 fixture로 연결해 수행한다. 정상 흐름만 아니라 잘못 선택하기 쉬운 상황·취소·중단·부분 실패를 포함한다. 개발자 시연/자동화 결과와 테스터 관찰을 분리한다.
  - 관찰 방법: 처음 보는 대표 테스터에게 목적만 제시한다. 클릭 위치를 미리 알려주지 말고 성공 여부, 망설인 지점, 잘못 연 화면, 도움, 되돌아감, 데이터 유실/오기록을 기록한다. 단순 클릭 수/5초 인상만으로 합격시키지 않는다.
  - 검증/완료: 중대한 대상 혼동/데이터 유실 없이 모든 필수 업무를 수행하고, 관찰된 핵심 막힘은 해결 후 관련 시나리오를 재검증한다. 테스터가 시스템-under-test 절차를 수행한 것과 도구가 결과를 저장한 것을 구분한다.
  - 불합격: Pass & Next 5회만 성공, 제목만 만든 fixture, 실제 사용자는 없는데 직관성 검증 완료. 테스터 미참여는 pending이며 UX-041과 통합 완료는 열어 둔다. 관련: UI-021 및 전체 흐름의 UI-022/039/044/045/049/050/051, J01–J08.

- [ ] **UX-042 P0 — 참고 화면의 단순함을 유지하면서 키보드·좁은 화면에서도 업무가 된다.**
  - 테스터 목적: “마우스나 넓은 화면이 아니어도 같은 내용을 읽고 안전하게 기록한다.”
  - 작업: 사용자 참고 이미지와 현재 목표 배치를 대조한다. 트리는 텍스트/폴더, 목록은 소속 블록, 상세는 지침, 결과창은 작은 2열, 통계는 상단이라는 역할을 유지한다. 현재 컴포넌트의 편의 때문에 이를 임의의 카드/버튼 격자로 바꾸지 않는다.
  - 작업: 1440×1000/1280×720/390×844의 초기 화면과 실제 작업 상태를 검증한다. 긴 한글/영문 제목·동일 이름·필수 필드·오류·권한 없는/닫힌 Run·빈 결과도 포함한다. 작은 화면에서는 필요한 영역을 전환하며 모든 패널을 가로로 강제 배치하지 않는다.
  - 검증/완료: 실제 Tab/Shift+Tab/Enter/화살표/Escape, 컨트롤 이름/현재 상태, 오류 안내와 포커스 복귀, 확대/가로 넘침/타깃 크기를 확인한다. 스크린샷은 동일 데이터/viewport로 전후를 비교하고 지침 읽기→결과창→복귀 상태를 연결한다.
  - 불합격: DOM focus 설정을 실제 Tab 검증으로 대체, 좁은 화면에서 Status/저장/다음 이동 접근 불가, 자동 검사만으로 테스터 수용 완료. 도구가 키 입력을 가로채면 blocked로 남기고 실제 브라우저/수동 검증 경로를 요청한다. 관련: 모든 변경 화면 및 UI-051, UI-021이 취합, J01–J08.

#### 통합 검증 시나리오 — UI-021이 수행할 작업

공통 데이터: 3단계 섹션과 서로 다른 부모의 같은 이름 섹션, 20개 이상의 의미 있는 케이스. 새로 작성한 Text와 Steps 케이스, 사전조건 2개/스텝 3개/각 Expected/공통 Expected, 10개 스텝, 지침 미작성 케이스를 포함한다. 활성 Run A/B에는 동일 케이스를 다른 상태로 포함하고 완료 Run과 구성별 Plan도 둔다. bulk/실패 주입은 테스트용 데이터에서만 수행한다. 정확한 ID·집계·API/실제 저장소 또는 mock 여부·빌드·역할을 실행 전에 기록한다.

| 시나리오 | 테스터에게 제시할 업무 | 관찰/대조할 결과 |
| --- | --- | --- |
| J01 찾기·소속 파악 | “Authentication 아래 Login 케이스를 찾고, 그 섹션만/하위 포함/전체에서 무엇이 달라지는지 확인하세요.” | 경로와 소속 블록, 포함 ID/수, 동일 이름 구분, 필터/보기 차이, 상세 열기와 선택 분리 |
| J02 작성·유지보수 | “5개 제목을 정리하고, 그중 Text/Steps 각 하나를 동료가 수행할 수 있게 완성한 뒤 수정하세요.” | 실제 지침 저장/재조회, 템플릿 전환·취소·오류에서 값 보존, 원래 섹션 복귀 |
| J03 실행 범위 구성 | “의도한 5개 케이스로 Run을 만들고, 이후 추가 케이스가 포함되는 모드와 안 되는 모드를 구분하세요.” | All/Selected/Dynamic 계약, 정확한 ID와 지침, 원본/Run 및 Run A/B 결과 구분 |
| J04 읽기·수행·다음 | “처음 보는 로그인 케이스를 지침대로 수행하고 결과를 남긴 뒤 다음 테스트를 진행하세요.” | 실제 Preconditions/Action/Expected 읽기, 일반 저장 유지/명시적 다음, 다른 지침 로딩, 조회 실패를 정상으로 오인하지 않음 |
| J05 두 진입점·근거 | “패널과 목록에서 각각 실패를 기록해 보세요. 한 번은 취소하고, 한 번은 댓글·결함·파일 2개·담당자를 저장해 다시 확인하세요.” | 같은 작은 폼, 취소 요청 0회, 정확한 target, 메타데이터/결함/담당자 재조회, 실제 원본 첨부 다운로드 |
| J06 실패·중단·재개 | “저장 실패를 복구하고, 첨부/담당자 일부 실패를 재시도한 뒤 업무를 중단했다가 다시 여세요.” | 실패별 상태, 초안/결과 보존, 중복 없음, 뒤로가기/새로고침/재진입 시 저장된 사실과 남은 작업 이해 |
| J07 다중 선택·정리 | “여러 섹션의 3개 TC를 이동하고, Run에서 선택한 테스트들만 일괄 기록하세요.” | 소유 섹션/대상 수/ID, 필터·페이지·블록 접기 시 선택 범위, 일부 실패 재시도, 비선택 대상 무변경 |
| J08 시작점·접근성 | “프로젝트/실행 목록/My Tests/Plan에서 남은 작업을 찾고, 키보드와 좁은 화면에서 지침 확인·기록·복귀하세요.” | 정확한 Run/test, 진행 요약, 필터/문맥 유지, Tab/닫기/초점 복귀, 배치 단순함과 필요한 내용의 접근성 |

결과 기록은 UX ID별로 **현재 동작/기대 동작 → 시나리오와 단계 → pass/fail/blocked/pending → 화면·요청·재조회 증거 → 자동 검사/실제 키보드/테스터 관찰 구분 → 남은 수정 범위**를 남긴다. 이 표의 통과도 모든 UX 항목을 자동 체크하지 않는다. 동일 증거를 재사용할 수는 있지만 각 항목의 완료 조건과 대응시킨다.

### Visible UI delivery checklist — one checkbox per work unit

Execute only the Current batch in NEXT_ACTIONS, never top-to-bottom or by numeric ID here. Each item's scope and acceptance are interpreted with sections 4–5 and 8 and the supersession register. Older checked entries retain dated intent/evidence, not a competing current design. Do not add later-unit work merely to satisfy a final-program screenshot.

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
  - Task-content qualification: delivered form controls/guardrails do not establish a complete tester authoring screen. UI-049 owns template-specific instruction entry and persistence into case/Run reading; do not treat this checkbox as covering that missing design.
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
  - Task-content qualification: UI-050 owns the execution landing view and navigation relationship between existing Run/Plan rows; this header/utility cleanup is not proof of that composition.
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

- [x] **UI-020 P1 — Apply shared controls and feedback to Settings.** ([evidence](./ux-evidence/UI-020.md): Administration overflow; FormField names; workspace/archive SaveFeedback Retry.)
  - Visible change: replace route-specific fields, buttons, dialogs, validation, and save feedback while retaining settings-appropriate form layouts.
  - Done when: every control has an accessible name and saving, success, validation, and server failure are locally understandable.
  - Maps to: `UX-012`, `UX-040`, `UX-042`.

- [ ] **UI-021 P1 — Add a cross-route visual and accessibility regression gate.**
  - Scheduling prerequisite: UI-052–063 acceptance evidence and NEXT_ACTIONS E01–E04 readiness; UI-021 remains the final verification, not the active repair batch. On an unchanged blocker, perform a readiness check only, not another full fixture/capture cycle. General Add Result staying on the current test is correct; test explicit Save & Next/Pass & Next separately. Compare aggregate counts by their real scope, not against unrelated unique-case counts.
  - Visible change: none; this protects the final tester journey and reference-based screens established by all preceding scheduled units, including UI-037–051, not only UI-001–020.
  - Evidence: capture Test Cases and Run Execution at 1440 x 1000, 1280 x 720, and 390 x 844; add keyboard and accessible-name checks for primary flows.
  - Done when: all rewritten UX-001–042 gates (19 entries) have explicit integrated verdicts, and J01–J08 demonstrate the tester's work under section 8.3. Duplicate dominant CTAs, hidden selection actions, clipped controls, horizontal page scroll and unnamed controls are failure checks, not a complete usability test. Missing instructions, ambiguous case/Run scope, unrecoverable drafts and result/evidence target mistakes also fail the gate.
  - Regression coverage: retain actual-viewport captures for Test Cases/Run with representative populated, empty, loading and failure states; include section tree plus detail pane and long/duplicate names. Check shared Run list, My Tests, Milestones, Plans, Reports and Settings for keyboard/focus and local feedback consistency. Include mounted interaction coverage for scope/selection/URL transitions and UI-030–UI-032 failure recovery; helper-only tests or a History filename are not end-to-end evidence. Every earlier batch still performs its own focused verification.
  - Whole-flow gate: follow the latest whole-layout review's verification rules; demonstrate Cases → Run creation → preconditions/steps/expected results → shared result dialog from both entries → saved evidence → next test with different instructions. Include global navigation, case read versus edit, top statistics and populated Plan/Overview/My Tests. Do not substitute cropped/scrolled result-only screenshots for initial viewport and reading-flow evidence.
  - Closure responsibility: assess every UX gate using the rewritten section 7 work specifications, ownership table and J01–J08, plus section 8 tiers. Carry UI-031/UI-051's configured-storage byte roundtrip, actual keyboard and pending tester/design review explicitly. Reproduce UI-051's instruction-load exception with the integrated fixture. Record automatic tests, real interactions, persistence and tester observations separately. Missing environment or reviewer prevents completion; do not create new APIs/storage infrastructure within this gate.
  - Reference-based exercise: compare the actual Case repository, Text/Steps authoring, case read view, Run selection form, execution pane/result dialog, Runs & Results hub and populated Plan to the concrete task targets and R1–R7 reference anchors. Start with newly authored instructions, not pre-seeded titles only; select their cases for a Run, execute/read/record/reopen evidence and resume from the hub. Reject a screen that passes component/row-count checks but still requires guessing what is editable, which Run to open or what procedure to follow. Document deliberate differences from TestRail rather than silently claiming fidelity.
  - Maps to: `UX-001`, `UX-041`, `UX-042`; final verification owner for all UX outcomes in the ownership table.

#### Simplicity follow-ups — queued by the 2026-09-19 review

Detailed evidence, design rules, and scope fixtures: [simplicity review](./UI_UX_SIMPLICITY_REVIEW_2026-09-18.md). These follow-ups supplement earlier completed slices without treating their completion as proof that all usability defects are resolved. The user's completion-review request explicitly reprioritizes them in NEXT_ACTIONS; implement only the one unit currently scheduled there, not this entire section.

- [x] **UI-022 P0 — Separate case query scope from display settings.** ([evidence](./ux-evidence/UI-022.md): Auth 2/6/10; Login 3/4; Billing excluded from subtree; compact/density unchanged.)
  - Visible change: one compact scope selector with `Selected section only`, `Include subsections`, and `All sections`; show the active section path and scope beside the list.
  - Scope: separate the query scope from display/density across UI, server, URL, last view, and saved views. Preserve explicitly documented compatibility for existing display URLs and saved views. Update summaries and empty states to match the actual scope.
  - Interaction rule: section selection filters direct/subtree scopes; in All sections it only navigates to the block. Scope changes clear out-of-scope selection with feedback and cannot leave an unexplained out-of-scope detail pane.
  - Done when: the review's fixture yields 2/6/10 TC for the three scopes with Authentication selected and 3/4 for Login direct/subtree; unrelated siblings never leak into subtree scope. Refresh, Back, shared URL, filters, and saved views reproduce the same scope. Density never changes result membership.
  - Out of scope: redesigning group blocks (UI-023), general View-menu cleanup (UI-024).
  - Maps to: `UX-003`, `UX-022`, `UX-023`, `UX-041`.

- [x] **UI-023 P1 — Make section-owned TC blocks visually explicit.** ([evidence](./ux-evidence/UI-023.md): Compact keeps path headers; Auth 1/3/4 blocks; duplicate Login distinguished by path.)
  - Visible change: section-path header, direct matching TC count, collapse chevron, then compact TC rows; separate blocks with whitespace or a single thin divider. No nested cards, per-block shadows, or repeated action toolbars.
  - Scope: reuse existing section grouping and row components; add readable ancestry and independent block collapse. Keep tree order, each TC in exactly one owning section, and parent-only headings where needed for context.
  - Interaction rule: collapsing changes visibility only; indicate selected TC hidden in collapsed blocks. Keep Expand all / Collapse all in View. Narrow screens use wrapping paths rather than unlimited indentation.
  - Done when: users can identify the owning section of each TC, including duplicate section names and three-level nesting. The review fixture shows 1/3/4 blocks for direct/subtree/all scope, with correct counts and no duplicate TC. Verify empty parents, filtered results, long names, keyboard collapse, and 1280/390px layouts.
  - Dependency: UI-022's explicit scope contract. Out of scope: per-section management feature expansion.
  - Maps to: `UX-013`, `UX-020`, `UX-023`, `UX-042`.

- [x] **UI-024 P1 — Simplify View settings and remove overlapping meanings.** ([evidence](./ux-evidence/UI-024.md): Group vs Compact rows; Section headers match; scope stays on the compact selector.)
  - Visible change: separate scope, grouping, and row spacing; eliminate duplicate `Compact` meanings and combinations that silently hide section grouping. Keep infrequent column/saved-view management behind a clear settings entry.
  - Scope: case repository View menu only; use shared menu controls and selection semantics. Preserve existing capabilities without a long permanent menu of every option.
  - Done when: a user can predict whether an option changes included TC, grouping, or spacing from its label; the checked grouping matches the rendered headers; keyboard selection and persisted settings work. Normal use requires only the compact scope selector plus Filter/View.
  - Dependency: UI-022/UI-023. Maps to: `UX-010`, `UX-011`, `UX-022`.

- [x] **UI-025 P0 — Keep section move/copy dialogs above the workspace and contain focus.** ([evidence](./ux-evidence/UI-025.md): portal z-100; Search click blocked; Escape restores Authentication actions.)
  - Evidence: the existing UI-007 move screenshot shows background Search/View controls covering the dialog's destination summary; the current component has no focus lifecycle.
  - Scope: repair the shared MoveCopyChooserDialog's stacking/placement and modal behavior, using the common dialog pattern; verify its section and case relocation consumers.
  - Done when: destination and controls are unobstructed at 1280×720 and 390×844; background controls cannot be activated; focus enters the dialog, cycles inside it, Escape cancels when allowed, and close restores the trigger. Preserve busy state and current-location move prevention. Test with tree on either side and after scrolling.
  - Out of scope: relocation API or move/copy semantics changes. Maps to: `UX-012`, `UX-042`.

- [x] **UI-026 P1 — Make the file-tree interaction match its visual promise.** ([evidence](./ux-evidence/UI-026.md): ArrowDown Login/MFA; one tree tab stop; OverflowMenu first item + Escape; create `htmlFor` matches.)
  - Scope: section tree arrow-key navigation, one tree tab entry, expand/collapse versus selection, menu focus/arrow keys/Escape return, and correct root-creation label association. Reuse shared menu behavior rather than adding another keyboard implementation.
  - Done when: keyboard-only users select a nested section, open its actions, start and cancel creation, then return to the same row; screen readers announce path/name, selected state and expanded state correctly. Focus remains visible and touch controls remain discoverable without desktop hover.
  - Out of scope: introducing more visible row actions. Maps to: `UX-012`, `UX-023`, `UX-042`.

- [x] **UI-027 P1 — Reduce repeated navigation chrome above Test Cases.** ([evidence](./ux-evidence/UI-027.md): 1280 heading y=346 −149px; 390 Authentication+C1 in view; Suite menu.)
  - Visible change: compact project/context navigation; remove always-visible default-suite configuration/help from the daily-work header and retain it in an explicit settings/context menu.
  - Scope: shared project header as consumed by Test Cases; check other project routes for regressions without redesigning their workspaces.
  - Done when: case work starts at least 80px higher than the baseline at 1280×720; project/suite context remains discoverable; at 390×844 a populated fixture exposes a section heading and at least one TC before the first scroll. No clipped controls or horizontal page scrolling.
  - Out of scope: Run Execution's content header (UI-008). Maps to: `UX-010`, `UX-013`, `UX-040`, `UX-042`.

- [x] **UI-028 P1 — Consolidate case selection actions and empty-state creation.** ([evidence](./ux-evidence/UI-028.md): one Edit bar; General empty has header Add Case only.)
  - Visible change: one contextual selection bar replaces the duplicated selected-count/edit menu and Update selected action row. Keep selection scope explicit through TC counts; secondary print/destructive commands use overflow.
  - Scope: Test Cases selection toolbar and empty state. At zero selection avoid a permanent bulk-command strip; when empty use one dominant Add Case entry point and a lightweight message that matches scope/filter state.
  - Done when: selecting TC exposes one edit path, a clear target count and clear-selection action; no hidden/out-of-scope TC are modified unexpectedly. Zero-selection and empty states have no duplicate dominant CTA. Keyboard and narrow layouts remain usable.
  - Dependency: UI-022 scope semantics. Out of scope: Run Execution selection (UI-009) and project-list empty state (recorded under UX-040). Maps to: `UX-010`, `UX-022`, `UX-042`.

- [x] **UI-029 P1 — Put case detail content ahead of its utility buttons.** ([evidence](./ux-evidence/UI-029.md): title+Edit+utilities; Close returns C1 row; 390 one header row.)
  - Visible change: detail title, main content, Edit and Close form the stable reading surface. Group ID/link copy, print and full-page navigation under a predictable utility menu.
  - Scope: CaseDetailSidePanel header in drawer and wide inline layouts; reuse shared controls and retain the existing edit/save workflow.
  - Done when: opening a TC immediately exposes title/content without scanning a utility button wall; utilities remain keyboard reachable, close returns focus to the case row, and 390px controls do not wrap into multiple competing toolbars.
  - Out of scope: changing case data or the full authoring form. Maps to: `UX-010`, `UX-012`, `UX-020`.

Additional UX-040 review note: the live empty Projects page repeats New project twice plus Add project in Quick links. Consolidate its creation entry point and empty-state container during the project-list rollout; this observation is not a newly completed task.

#### Completion-review follow-ups — one independently verifiable unit each

Evidence and confidence levels: [completion review, 2026-09-19](./UI_UX_COMPLETION_REVIEW_2026-09-19.md). Static failure paths below require regression reproduction before fixes; historical captures are not fresh browser passes.

- [x] **UI-030 P0 — Bind result recovery to the owning test and result.** ([evidence](./ux-evidence/UI-030.md): C1/C2 request IDs stay separate; Remove/Cancel drop retry; composer copy names the failed file.)
  - Visible change: distinguish result-save failure from “result saved, attachment failed”; show recovery only for the owning test/result. Separate attachment retry from submitting changed result fields, without adding a permanent toolbar.
  - Scope: RunDetailPage result-save/retry lifecycle, ResultEntryPanel staged-file removal/cancel, and result feedback models. Keep a stable operation identity across selection changes and asynchronous completion; discard/cancel must invalidate obsolete retry payloads. A failed operation for test A must never be consumed by a new submission for test B.
  - Done when: failure-injection tests cover A result created / attachment failed → B with attachment saved → return to A; request result IDs and persisted histories stay separate. Also cover one of two files failing, retry after navigation, file removal, composer cancel, edited result fields after partial success, and late completion. Retry does not recreate an already-created result or reupload an already-successful file. Partial-success feedback identifies what is saved and what still needs action; keyboard recovery works at 1280×720 and 390×844.
  - Implementation entry points: `apps/web/src/features/runs/components/RunDetailPage.tsx`, `ResultEntryPanel.tsx`, `apps/web/src/features/runs/utils/resultSaveFeedback.ts` and `resultComposerModel.ts`. Add a focused lifecycle/integration regression rather than only testing text helpers.
  - Out of scope: actual storage fallback/download changes (UI-031), bulk selection (UI-032), general layout redesign. Maps to: `UX-031`, `UX-032`, `UX-033`.

- [x] **UI-031 P0 — Make attachment success mean recoverable file content.** ([evidence](./ux-evidence/UI-031.md): memory presign 501; no History filename; Jump to next did not advance.)
  - Visible change: mark a file attached only after a real supported upload succeeds; unsupported storage is an explicit local error, not a fake 100% success or a History filename.
  - Scope: `associateResultAttachment` in `apps/web/src/features/runs/api/runApi.ts`, presign error classification in `resultComposerModel.ts`, and existing attachment routes/storage contract in `apps/server/src/modules/results/results.routes.ts`. Do not convert arbitrary 404/result-not-found errors into metadata-only success.
  - Done when: configured storage passes upload → refresh/reopen result → download with original bytes/name verified. Tests cover presign failure, upload failure, missing result, association failure and unsupported memory mode; none show success or advance to the next test as though all evidence were saved. Unsupported environments may clearly disable/reject attachment upload instead of pretending to store bytes. Retain result-only success separately.
  - Dependency: preserve UI-030 ownership/retry contract. Out of scope: adopting a new storage provider or redesigning History. Maps to: `UX-031`, `UX-033`.
  - Evidence qualification: the historical check covers the demonstrated unsupported-storage rejection, not proof that the configured-storage success condition passed. UI-021 owns the outstanding real upload/reopen/download and keyboard verification; UX-033 remains open until success and failure paths are both evidenced.

- [x] **UI-032 P0 — Keep Run bulk actions identical to the visible selection scope.** ([evidence](./ux-evidence/UI-032.md): Auth 60 grouped POST=60; Billing unchanged; named Retry after Next.)
  - Visible change: selected count and local save feedback describe exactly the tests submitted; section changes cannot silently carry unrelated selected tests into a bulk update.
  - Scope: RunDetailPage grouped/paged instance lookup, selection reset/reconciliation, select-all query scope, and `apps/web/src/features/runs/hooks/useRunBulkActions.ts`. Use one explicit target set for count and submission; never silently filter unknown selected IDs out of the request. Preserve a submitted-operation snapshot while requests are pending.
  - Done when: a fixture with at least 60 tests and two sibling sections verifies row selection, page selection, all matching selection, filters, grouping and section changes. Displayed selected count = submitted IDs = intended changed IDs; sibling/out-of-scope tests remain unchanged. Partial failure names the affected tests and retains only actionable recovery, including after navigation. Verify keyboard and narrow selection bar behavior.
  - Out of scope: Test Cases query/display work (UI-022) and single-result attachment recovery. Maps to: `UX-030`, `UX-032`.

- [x] **UI-033 P1 — Preserve readable title and status before optional execution columns.** ([evidence](./ux-evidence/UI-033.md): 1280 8 rows Untested; 390 table overflow 0; tests y=239.)
  - Visible change: use the existing responsive table/workbench patterns to keep title, full status and active selection readable; demote optional metadata before clipping essential result information. Adapt tree and detail placement without another toolbar or card layer.
  - Scope: RunDetailPage layout, RunInstancesSection, execution table columns and density styles. Preserve existing result entry and section semantics.
  - Done when: at 1280×720 with the default section grouping/tree and result pane open, at least six complete rows show readable titles and full status labels. At 390×844, title/status and primary result actions do not require horizontal scrolling; assignment remains discoverable. Verify 1440×1000 too, long labels and keyboard focus. Capture initial viewport plus detail state, not only a scrolled table; retain the missing UI-008 header baseline evidence with measured content start.
  - Out of scope: result data/API and Test Cases header (UI-027). Maps to: `UX-013`, `UX-034`, `UX-042`.

- [x] **UI-034 P1 — Make My Tests identity and selection intent explicit.** ([evidence](./ux-evidence/UI-034.md): 390 C1 rows show R1 Alpha vs R2 Beta; Open selected test opened `runs/1?testId=1` and row Add result opened `runs/2?testId=3`.)
  - Visible change: on narrow screens keep a short Run identifier/name under the case title. Make the selection action truthfully open one selected test; do not suggest bulk recording when only the first selected row is used. Prefer single selection and a clear “Open selected test” action over a new bulk workflow.
  - Scope: `apps/web/src/features/runs/components/MyTestsPage.tsx` and its queue/navigation helpers; reuse shared selection controls and existing testId links.
  - Done when: the same case assigned in two runs is distinguishable at 390px, and each row/action opens the correct run/test. Selection and filtering cannot produce an unexplained hidden target. Keyboard behavior and 1280px layout remain clear with no duplicated dominant action bar.
  - Out of scope: new multi-run bulk APIs or a new queue engine. Maps to: `UX-012`, `UX-040`, `UX-042`.

- [x] **UI-035 P1 — Give report menus distinct context and verify populated reports.** ([evidence](./ux-evidence/UI-035.md): Reports vs This report; Nightly save/reopen; CSV `q=Nightly`; print project-summary.)
  - Visible change: distinguish report navigation from actions on the current report, by clear visible/accessible names or consolidation; avoid two indistinguishable More actions controls.
  - Scope: `apps/web/src/features/projects/components/reports/ReportChrome.tsx` and its consumers. Reuse shared menu behavior; preserve existing report/export/save-view features.
  - Done when: keyboard users can identify the correct menu without trial and error. A populated fixture verifies filter → save view → reopen with the same parameters and CSV/print output reflecting the current report. Failed saves/exports give local actionable feedback. Test 1280px and 390px; empty reports show no misleading enabled output commands.
  - Out of scope: new report types, subscriptions or cross-project reporting. Maps to: `UX-012`, `UX-040`, `UX-042`.

- [x] **UI-036 P1 — Reveal Plan configuration only when an entry needs it.** ([evidence](./ux-evidence/UI-036.md): empty hub is Add entry only; matrix heading named Chrome/Firefox; save 500 showed Retry then Saved Firefox smoke.)
  - Visible change: an empty plan prioritizes one Add entry action and a short explanation. Matrix/save/generate controls appear in the selected entry's context rather than as a permanent disabled wall.
  - Scope: `apps/web/src/features/projects/components/PlanDetailPage.tsx`, using existing shared empty-state and disclosure patterns.
  - Done when: empty, populated-unselected and selected-entry states each have a clear next action; configuration controls name their owning entry. Switching/removing that entry cannot leave unexplained stale controls or save to the wrong entry. Verify focus, local busy/error feedback and 1280px/390px layouts.
  - Out of scope: configuration matrix semantics or run-generation API changes. Maps to: `UX-010`, `UX-012`, `UX-040`.

#### Shared result dialog — queued by the whole-layout review

Design and verification fixture: [RUN_RESULT_DIALOG_DESIGN_2026-09-19.md](./RUN_RESULT_DIALOG_DESIGN_2026-09-19.md). Originally documentation-only, now explicitly queued following the user's whole-layout review request. UI-011's checked evidence remains historical; its permanent Results-tab form is superseded as the target layout by this design. Existing checks do not certify the new interaction.

- [x] **UI-037 P0 — Move panel result entry into a shared compact dialog.** ([evidence](./ux-evidence/UI-037.md): pane Add result; dialog names C2/C3; 2-file recovery stayed on result 2; 390 dialog 366px.)
  - Follow-up qualification: this is the shared-dialog delivery history, not acceptance of the form's visual composition. UI-051 replaces the remaining large StatusPicker and conflicting field/footer layout using the supplied Add Result reference.
  - Visible change: replace the permanently visible result form with a compact Add result action. Open a shared centered result dialog; route existing evidence-requiring composer actions to it as well. Preserve explicit Pass & Next quick success.
  - Scope: RunDetailPage, ResultEntryPanel, RunQPanePanel, result lifecycle integration and the shared dialog foundation. Reuse input/validation/attachment behavior rather than duplicate forms. Default fields, conditional fields, dirty close and Save versus Save & Next follow the linked design.
  - Done when: the panel no longer contains the long editable form; the dialog names the target test and preserves UI-030/031 ownership and partial-success recovery. Verify field validation, cancel, keyboard/focus, two-file partial failure, A-to-B ownership, duplicate-submit prevention and 1280×720/390×844 usability. Save updates only the intended test/result; cancel before submission performs no result write, and closing after partial success does not undo an already-saved result. Attachment failure neither closes nor advances silently.
  - Dependency: preserve UI-030/031 contracts. Out of scope: all-status list integration (UI-038), case-instruction panel refinement (UI-039), new result/storage APIs or bulk redesign.
  - Maps to: `UX-031`, `UX-032`, `UX-033`, `UX-042`.

- [x] **UI-038 P0 — Route every Run-list status choice through the shared dialog.** ([evidence](./ux-evidence/UI-038.md): list Passed opens dialog; cancel posts []; C2 save testId=2; 390 Untested▾ overflow 0.)
  - Visible change: reuse the existing Status column, make it readable and keyboard-accessible, and open UI-037's dialog with the chosen status for Passed as well as Failed/Blocked/Retest. No direct-save mutation from ordinary status selection.
  - Target row: selection checkbox → case identity/title → optional metadata → compact current-status label with dropdown arrow → detail entry. Use a readable text label plus restrained status color, not one button per possible status or another status tile strip. Menu selection opens the shared dialog with the clicked test's identity; closing it returns to that row/context. At narrow widths retain title/Status before optional columns. This is the R4 result-entry pattern, not a second form embedded in every row.
  - Scope: TestInstanceTable, RunInstancesSection and RunDetailPage entry-point wiring. Same-status re-recording must work; current persisted status remains unchanged on open/cancel. Keep project status/permission/closed-run rules and bulk selection behavior intact.
  - Done when: panel and list entry use identical form, validation, lifecycle and feedback. Verify request count is zero for open/cancel, correct testId/runId for saving, same-status entries, grouped/paged/filtered rows and 390px status visibility. A case shared by two runs retains separate execution states. Accessible labels must no longer promise that Passed saves immediately.
  - Dependency: UI-037. Out of scope: case-definition status, separate save APIs/forms and bulk redesign. Link overlapping UI-033 readability evidence without marking that entire unit complete.
  - Maps to: `UX-030`, `UX-031`, `UX-042`.

- [x] **UI-039 P0 — Verify a content-first case execution panel end to end.** ([evidence](./ux-evidence/UI-039.md): C1 2 preconds/3 steps + common expected; fail save Latest below; C2 different instructions; 390 Back to tests.)
  - Target screen (R2/R3/R4): below the Run overview, section navigation, test rows and optional selected-test reading pane form one workbench. In the pane render case ID/title/current test status → one short read-only Type/Priority/Estimate/References summary → Preconditions → numbered Action / Expected pairs (side by side when readable, stacked per step when narrow). Text-template instructions and case-wide expected results render as text, not an empty structured-step table. BDD/exploratory templates render their actual guidance. Metadata is a compact summary, not editable cards or a wall above Steps.
  - Result review/action placement: below the instructions provide secondary Results & comments / History & context / Defects access using existing data. Clearly distinguish this Run's chronological records from cross-run context; do not fabricate unavailable cross-run data. A short footer has Add result, explicit Pass & Next and assignment access. Previous/next test navigation stays adjacent to test identity; it is distinct from saving. No default Results tab may replace the instructions with an input form.
  - Scope: RunCaseContextPanel, RunQPanePanel and RunDetailPage reading/selection composition; reuse existing content and history components, not new analytics/APIs. Opening a row or its detail affordance shows its instructions without leaving the Run. Checkboxes only change bulk selection. Closing detail restores the list; reopening/resuming identifies the same test. Keep UI-040 statistics and current tree-side preference.
  - Done when: a tester opens C1 from a grouped list, reads meaningful Preconditions/three Action–Expected pairs, records a failure with evidence, sees the saved record below the instructions, then advances to C2 and sees different instructions and the correct target. Also close/reopen or refresh to resume, distinguish a prior failure from current status, inspect one linked defect, and use an applicable Text/BDD/exploratory fixture. Verify 1440×1000/1280×720/390×844, long content, empty/loading/error, keyboard and footer clearance. Capture the complete workbench and readable instruction region, not just a result dialog or cropped row count.
  - Dependency: UI-037/UI-038. Out of scope: case authoring/API changes and global project navigation redesign. UI-021 must include this flow in its final integration coverage.
  - Maps to: `UX-031`, `UX-034`, `UX-041`, `UX-042`.

#### Top-of-run status overview — queued by the whole-layout review

- [x] **UI-040 P1 — Move Run status statistics above the execution workbench.** ([evidence](./ux-evidence/UI-040.md): 73% passed vs 85% recorded; tests column 501→721px; 390 C1 in view.)
  - Design: [RUN_STATUS_OVERVIEW_DESIGN_2026-09-19.md](./RUN_STATUS_OVERVIEW_DESIGN_2026-09-19.md). Delivery status is the checkbox/evidence here; scheduling is owned only by NEXT_ACTIONS.
  - Visible change: one compact chart/legend/pass-rate summary below the Run title; remove the permanent left statistics column and return its width to the test list/detail. Do not replace it with a large card wall or leave an empty grid track.
  - Scope: RunDetailPage grid/height, shared progress chart/summary and existing sidebar consumers. Move Activity/Defects to existing utility access and execution/navigation actions near the tests, retaining behavior without duplicates. Do not move or remove the section tree.
  - Data/interaction rule: aggregate the whole Run, not the current page/filter/section. Status legend clicks filter only; they never record a result. All statuses clears only the status filter. Counts, selection, URL and detail remain consistent after filtering and result saves/failures.
  - Done when: the design's 59-test fixture shows Passed 43/59 = 73%, Untested 9/59 = 15%, distinctly from 85% result-recorded. Verify empty/loading/error states, zero-count statuses, single/bulk updates, keyboard and 1440×1000/1280×720/390×844 screenshots. Measure reclaimed width with tree/detail open; preserve UI-033's six readable rows at 1280px and show the first list row in the initial 390px viewport with detail closed. No page-level horizontal overflow or lost sidebar functionality.
  - Dependencies: preserve UI-032/033 contracts; integrate with whichever UI-037–039 state exists when scheduled without implementing those units here. Out of scope: new chart library/API, result-dialog implementation and global header redesign.
  - Evidence: focused tests, web type check/build, real interaction checks and before/after screenshots in `docs/ux-evidence/UI-040.md`. Maps to: `UX-010`, `UX-013`, `UX-034`, `UX-042`.

#### Whole-layout follow-ups — one independently verifiable unit each

Design, evidence limits, remove/merge/retain decisions and mandatory shared verification rules: [TESTRAIL_UI_REALIGNMENT_REVIEW_2026-09-19.md](./TESTRAIL_UI_REALIGNMENT_REVIEW_2026-09-19.md), especially sections 3–5. These units supplement delivered work rather than erase its history. UI-037–040 own the original Run statistics/result-dialog/instruction delivery; UI-051 specifically corrects the result form without redesigning statistics or instructions.

- [x] **UI-041 P1 — Flatten global context and project navigation.** ([evidence](./ux-evidence/UI-041.md): 1280 chrome 215→88px; 390 Go to + first case in view.)
  - Task-content qualification: retain this compaction/focus work; UI-050 refines the existing Runs/Plans information architecture under one execution hub, without rebuilding global navigation.
  - Scope: ProjectLayout, ProjectHeader, ProjectTabs and existing project/global utility controls. Keep one project context, reduce repeated same-level identity and move infrequent global actions into named menus; on narrow screens use a current-location/navigation control instead of wrapping all primary tabs into several rows.
  - Done when: users can identify/switch project and Suite and reach every existing primary/secondary route by keyboard and touch; active route and archived context remain explicit. At 390px Cases exposes its title and first populated row without scrolling; compare header height before/after at 1280px. No functionality is deleted or replaced by unlabeled icons. Verify focus return, long names and direct URLs.
  - Out of scope: content-panel redesign and adding/removing routes. Dependency: UI-042's flat visual grammar; preserve UI-027's Suite disclosure and UI-026 keyboard contracts.

- [x] **UI-042 P1 — Make the shared page grammar flat and consistent.** ([evidence](./ux-evidence/UI-042.md): header/toolbar cards removed on Runs/Milestones/Plans/Reports; Add * remains the CTA.)
  - Scope: existing WorkbenchPageHeader/WorkbenchToolbar/Panel variants and their page-chrome consumers in Runs, Milestones, Plans and Reports. Establish shared heading, spacing, separators and button emphasis; remove decorative page-header cards/shadows and nested page-toolbar containers. Do not globally strip borders from all Panel consumers.
  - Done when: populated Runs, Milestones and Reports captures show the same flat title/action/filter hierarchy; Plans uses the same page chrome. One dominant CTA per default work area, no nested decorative header cards; dialogs, inputs, focus, selection and error boundaries remain distinguishable. Verify all changed consumers, light/dark where supported and the three viewports in the review.
  - Out of scope: a new component library, route-specific content/commands, global navigation (UI-041), result dialog internals. Preserve UI-035 menu context and UI-020 feedback.

- [x] **UI-043 P1 — Make case rows a reading list rather than permanent edit forms.** ([evidence](./ux-evidence/UI-043.md): 20 cases, 0 selects/copy; Type/Priority text; C15 open without checkbox; 390 wrap/return.)
  - Target screen (R1/R2 plus the user's folder-tree direction): keep the existing quiet folder tree alongside one section-grouped table. Above the table show section path + direct/subtree/all scope, then one search/Filter/View strip. Section blocks have a text path/name, direct matching count and collapse affordance; no individual card/toolbar per section. At each block end keep quiet Add Case outline access. Header Add Case opens full authoring.
  - Target row: checkbox, ID, dominant title, Type and Priority as short text, one quiet detail affordance. Keep additional saved columns available in View, not all visible by default. Remove permanent metadata selects and repeated copy icons. Opening title/detail selects a case for reading; the checkbox changes bulk selection only. Use the same selected-row treatment as Run, but no global execution Status on case definitions.
  - Scope: CaseRow, CaseListPane/toolbar composition and existing column/view controls. Preserve UI-022–028 query/block/selection behavior and the current tree-side preference; this is not a new repository or API. Explicit Edit and selection actions retain metadata editing, while utility menus retain ID/link copy.
  - Done when: with three nested sections and 20 meaningful cases, a tester identifies each case's owner, outlines five titles, filters, opens a case without changing selection, selects several cases and finds their scoped edit/move action. Show long titles and readable metadata with detail open at 1280px, and path/title/detail return at 390px; verify saved views and all three scopes. A screenshot proving only that selects disappeared is insufficient.
  - Out of scope: case data/API, new global execution status, detail body. Dependency: UI-041/UI-042.

- [x] **UI-044 P0 — Make the case detail body instruction-first and separate editing.** ([evidence](./ux-evidence/UI-044.md): C1 instruction-first + Case actions; C5 Edit/save Instructions; C6/C7 headings; Run C1 matched; 390 Back to cases.)
  - Target screen (R3): case title/ID and owning section → a compact read-only metadata summary → Preconditions → template-specific instructions and Expected → secondary references/attachments/history. Steps templates show numbered Action/Expected pairs; Text templates show prose Steps and common Expected; BDD/exploratory content keeps its own headings. Use the same instruction renderer/order as Run where applicable, but label case-definition history separately from execution results. Do not add nested cards for every field or step.
  - Scope: ExpandableCaseDetail, CaseDetailBody and panel/full-page read consumers. Remove the permanently mounted Quick edit metadata form and repeated footer Edit/copy/delete. Keep one Edit and named utilities; retain existing metadata/custom-field editing through that explicit path. Preserve the small informative Type/Priority summary rather than interpreting “instruction-first” as deleting all case context.
  - Done when: a tester reads a populated case, explains its setup/actions/expected outcome, enters Edit, changes an expected result, saves and reads the updated document without losing the section. Repeat for Text and Steps templates; preserve available BDD/exploratory guidance and attachments. Verify dirty cancel, errors, archived read-only state, long steps, keyboard and narrow return path. Compare the same fixture's case read view to its Run instructions; absence of Quick edit alone is not acceptance.
  - Out of scope: new authoring schema or Run result entry. Preserve UI-005/006 authoring and UI-029 header/focus behavior. Dependency: UI-042.

- [x] **UI-045 P1 — Simplify Run creation around name and included tests.** ([evidence](./ux-evidence/UI-045.md): All/Selected/Dynamic radios; live all vs fixed selected vs high dynamic after adding a case; chooser apply/cancel; 1280/390.)
  - Reference correction (R6): TestRail's all-cases choice includes newly added cases; its specific-selection path is distinct from dynamic filtering. The former task's fixed-all-first framing was this project's assumption, not TestRail parity. Do not expose internal `static` / `includeAll` as competing choices or silently relabel one semantic as another.
  - Target screen: one focused form with Name and Suite/context, then a radio group: All cases (automatically includes new cases), Selected cases (fixed membership), Dynamic filter (membership follows criteria). Fresh creation can use the TestRail-style all-cases default only when the existing live contract is supported; existing drafts/edited Runs retain their actual mode. Milestone/dates/environment remain optional disclosure. Creation action is below a concise target summary, not a table toolbar full of management commands.
  - Selection interaction: All shows scope/count without an always-open selection workbench; Selected shows count plus Select/Edit cases, opening the existing chooser with folder tree, case checkboxes, search/filter and selected count. Apply commits the draft selection; cancel restores it. “Select all current cases” here is fixed selection, not live all. Dynamic exposes only its criteria/preview and plainly explains future membership changes. Show exclusions when present; no hidden Include-all checkbox competing with the mode.
  - Scope: RunCreatePage/RunCompositionWorkbench and existing chooser/selection presentation, preserving current APIs/modes. Keep existing include/exclude features in their relevant scope, not as always-visible parallel trees. Lack of a backend semantic required by a label is a blocker/explicit repair decision, not permission for a deceptive label or unrelated API rewrite.
  - Done when: create all-cases, specific cases and dynamic runs; verify submitted IDs/criteria and actual composition, then add a repository case to distinguish live inclusion from fixed membership. Apply/cancel chooser changes, switch Suite without stale hidden selection, verify criteria/exclusions, optional values, failure recovery and 390px. A clean form with an incorrect membership model fails.
  - Out of scope: composition API/model changes, new wizard infrastructure or feature removal. Dependency: UI-042; preserve existing selection validation.
  - Maps to: `UX-001`, `UX-041`. Verify exact composition within this unit; a discovered data-source defect outside presentation scope requires an explicit repair decision, not silent API expansion.

- [x] **UI-046 P1 — Make My Tests a compact execution queue.** ([evidence](./ux-evidence/UI-046.md): Assigned to me queue; Search/Filter + match count; Open test to exact Run; return with filters/status; 1280/390.)
  - Target screen: a work queue, not a dashboard or a list of Add result buttons. Title names the assignment scope; rows show test ID/title, owning Run, current status and existing due/priority context where useful. Keep the current assignment/filter defaults unless the user explicitly changes them, and display active filters so completed or blocked work is not silently hidden. Search/Filter and a short visible match count suffice above the rows.
  - Primary interaction: open a row or its quiet Open test action into the exact Run/test reading panel; retain Run identity beneath the title at narrow widths. Record from the shared execution flow and return to the queue with its filters/context and updated status. Do not save from merely opening the queue row; retain UI-034's truthful single-target action instead of implying multi-run bulk execution.
  - Scope: MyTestsPage and existing navigation/filter presentation, not a new queue engine. Done when: a tester identifies their next assigned test, distinguishes the same C1 in two Runs, opens the intended one, reads/records and returns without losing context. Verify applied/cleared filters, reassignment/empty/error, keyboard and first-row visibility at 390px. Removing stacked filters alone is not completion.
  - Out of scope: multi-run bulk results, a new queue API or global FilterBar rewrite. Dependency: UI-041/UI-042.

- [x] **UI-047 P1 — Give Plan run-generation commands one clear target.** ([evidence](./ux-evidence/UI-047.md): run-first list; Chrome/Firefox Open run; one Configure Generate; fail/retry; empty/390.)
  - Target screen (R5): plan title/state and a compact existing progress summary, then entries with their actual executable Runs. Group Runs under the entry/Suite, name the configuration (e.g. Chrome / Firefox), show existing status distribution/count and an Open Run link. A tester must not first understand a generation matrix to find the Run to perform. Distinguish an ungenerated entry from an existing untested Run.
  - Management interaction: one Add entry/Add runs entry appropriate to the current model; existing entry configuration opens in its named editing context. Show selected case scope/configurations and expected Run count before generation. Keep a single target-specific Generate/Add runs action there; remove competing page/selection/row Generate controls. Show resulting Run links after success; never relabel generation as Save if it actually creates new Runs.
  - Scope: PlanDetailPage's existing entry/run data and command composition. Preserve UI-036 disclosure/ownership and current generation APIs; do not introduce a second Plan engine or fake generated rows. Retain alternate generation scopes in named contextual controls.
  - Done when: in a two-entry, Chrome/Firefox fixture, a tester can distinguish four generated Runs, see which need work and open the correct Run directly. Configure one entry, preview targets, generate once and verify only those targets; cancellation/failure creates no apparent success and retry does not misidentify duplicates. Check empty/ungenerated/generated, selection switch, keyboard and 390px. A smaller button count without navigable Run rows fails.
  - Out of scope: matrix/generation semantics and APIs. Dependency: UI-042.

- [x] **UI-048 P1 — Make project entry lead directly to cases and active runs.** ([evidence](./ux-evidence/UI-048.md): one Add project; Alpha 1 of 2 + blocked C2; Cases/Runs from overview; 1280/390.)
  - Target screen (R7-informed project design): Projects is a compact named-project list with quiet available progress/context and one creation entry for permitted users, not repeated New project cards. Inside a project, show a low progress/activity summary using existing data, then active Runs/Plans with status and open links. Cases and assigned work remain identifiable navigation entries. Milestone links provide release context; detailed activity is secondary rather than deleted.
  - Correction: useful progress charts are part of the test-management overview. Consolidate/resize them; do not strip them solely to make the page look empty. Conversely, do not turn every counter into a separate large KPI card or recreate duplicate Actions sidebars.
  - Scope: ProjectListPage/ProjectOverviewPage composition using existing summaries/links; remove inert Compact/Detail controls and redundant creation entries. Use Add only when opening creation, otherwise Open/View. Coordinate with UI-050's execution hub without a new dashboard/API.
  - Done when: with a partially tested Run, blocked work and a populated milestone, the tester can see the project's current testing state and open the relevant Run or Cases from the initial overview. Verify empty first-use, role-restricted creation, long names, keyboard and 390px. Neither “one CTA” alone nor removal of every chart is acceptance.
  - Out of scope: new analytics, personalization or new project permissions. Dependency: UI-041/UI-042. This explicitly schedules the earlier UX-040 project-list duplicate observation.

- [x] **UI-049 P0 — Author executable case instructions in a template-specific form.** ([evidence](./ux-evidence/UI-049.md): Text C1 Preconditions/Steps/Expected roundtrip into Run; Steps C2 3 Action/Expected + reorder; dirty template dialog; empty title; 1280/390/1440.)
  - Why this is missing: UI-006 defined form controls/feedback, while UI-044 only covers reading. The old UI-006 Text-template capture shows Preconditions/Expected but no Steps field, and CaseAuthoringForm conditionally injects structured steps. This is evidence of an authoring coverage gap, not a claim that every current template loses steps; reproduce with current template definitions and persistence first.
  - Reference/target (R1/R3): title first; one compact context row naming the destination Section and Template, with existing Type/Priority where supported. Then the instructional body. Text: Preconditions → prose Steps → Expected result. Steps: Preconditions → ordered editable Action/Expected pairs with Add step and quiet reorder/remove controls → applicable common Expected. Keep existing BDD/exploratory/custom template fields and requirements rather than putting all template fields on one giant form. Optional references/estimate/metadata use a compact secondary area.
  - Interaction: section-native quick outline remains the fast title-only path; full Add/Edit is for writing the procedure. Save/Create and Cancel stay stable. Changing Template with entered instructions cannot silently erase data; retain compatible draft values and explain any conversion/discard before proceeding. Existing template-required fields remain visible. Do not add AI authoring, new template types or an unrelated rich-text system merely because they appear in current TestRail releases.
  - Scope: CaseAuthoringForm and existing create/edit/step-editor/template bindings, preserving UI-005/006 safeguards and current model. Verify the persisted representation of Text Steps before promising that field; if the current contract cannot represent it, identify the exact schema/API gap and request a scoped repair rather than displaying a field that is not saved or hiding the requirement.
  - Done when: a tester creates a Text case with distinct setup/actions/expected, saves/reopens/edits it, and sees the same instructions in case reading and in a Run. Repeat with three separated steps, reordered steps, per-step Expected and common Expected; verify dirty template change, cancel, required-field/error recovery, attachments/references already supported, keyboard and 1280px/390px. A successful title-only create or a sticky footer is not sufficient. Capture the actual editable instructions and their persisted read-back.
  - Dependencies: preserve UI-006; reuse UI-044's read surface and UI-039 Run context for roundtrip verification. Out of scope: new case types, new AI features and generic editor replacement. Maps to: `UX-001`, `UX-021`, `UX-041`, `UX-042`.

- [x] **UI-050 P1 — Make the existing Runs & Results hub the execution landing page.** ([evidence](./ux-evidence/UI-050.md): mixed hub; Add Plan+Add Run; All/Runs/Plans; Alpha 1 untested vs Beta 2 untested vs Nightly completed; Plan Chrome; 1280/390.)
  - Reference/target (R5/R7, adapted to existing routes): one execution-area entry leads to the existing mixed Run/Plan list. Keep active work as the default reading area, completed work in a clearly labeled secondary group/view. Each row identifies Run versus Plan, name, available configuration/milestone/assignee context, total/untested and compact status progress using existing data. Names open the actual Run or Plan; a Plan row never records a result as if it were a test.
  - Navigation correction: RunListPage already combines runs/plans. Reuse it; do not add another dashboard. Name the primary navigation Test Runs & Results (or the agreed equivalent), make Plans a discoverable scoped view/secondary entry there instead of a competing top-level workflow. Preserve existing `/runs` and `/plans` direct URLs and mark the same execution area active for Run/Plan detail. Preserve UI-041's compact global bar and narrow navigation behavior.
  - Actions: Add Run is the ordinary creation entry; Add Plan is a named secondary creation action in the same area. A quiet mine/filter control and active conditions remain near the list. Reports/compare/rerun/export belong to the appropriate utility context, not repeated row button groups. Resume opens the exact existing Run; do not invent an “automatic next assigned test” algorithm when current data only identifies the Run.
  - Scope: existing RunListPage/RunPlanSummaryRow, RunListHeader, project tab route mapping and existing Plan-list links/filtering. Use present overview data/contracts; missing aggregates must not be invented or silently counted only from a paginated page. No new API, route deletion or second Plan implementation.
  - Done when: a fixture with two active Runs, a Plan with named configurations and one completed Run makes their identities/progress clear. Open each correct target, return with filters intact, reach Add Run and Add Plan, navigate direct Plan URLs and verify active navigation at desktop/narrow widths. Counts use their documented scope and match existing detail data. The tester can answer which Run still needs work before opening it; “one Add button” alone is not acceptance.
  - Dependencies: preserve UI-015/018/041/042 and UI-034 identity. UI-047 owns the inside of Plan detail; this unit owns getting to it. Maps to: `UX-010`, `UX-040`, `UX-041`, `UX-042`.

- [x] **UI-051 P0 — Match the supplied TestRail Add Result form, not just its modal container.** ([evidence](./ux-evidence/UI-051.md): 2-col Status dropdown; Assign To/Version/Elapsed/Defects; Add Result+Cancel+Save & Next split; cancel no write; Failed save read-back + Admin assign; attachment storage retry without duplicate; 1280/390/1440 panel+list.)
  - Reported gap: the UI-040 image belongs to the statistics work and still shows the old inline composer. More importantly, UI-038's newer dialog image and current ResultEntryDialog → ResultEntryPanel → StatusPicker retain the large status-button grid. Moving the old form inside a modal did not deliver the user's requested layout. Preserve historical checks; this is a new, unchecked correction.
  - Concrete target: use the user's `codex-clipboard-a768b9fd-7c19-4c36-9764-97818b27bb2e.png` composition. A small rectangular dialog: left approximately 2/3 contains one labeled Status dropdown, Comment and compact drop/browse attachments; right approximately 1/3 contains Assign To, Version, Elapsed, Defects in that order. No status tiles, nested field cards, repeated banners or permanently expanded editor tools. See the [revised dialog contract §3–5 and UI-051 checklist](./RUN_RESULT_DIALOG_DESIGN_2026-09-19.md).
  - Actions and fields: Add Result plus text Cancel at bottom-left; preserve Save & Next in a small secondary split menu, not a third large button. Keep the panel's explicit Pass & Next behavior. Version/Elapsed/Defects stay visible on the right for all statuses. Actual result and optional tools use progressive disclosure; required custom/template/step inputs remain visible and validated. Readable test instructions stay in the panel and are not replaced by this form.
  - Assignment safety: Assign To edits a draft for the current Run test, using existing permissions/user choices/API. Opening/selecting/canceling sends no result or assignment mutation. Submit the result before assignment; on partial success preserve the result ID, explain which operation failed and retry only failed assignment/attachments. Do not close or advance until all requested operations succeed. Missing user-selection/API support is a concrete blocker, not permission for a fake field or new backend scope.
  - Scope/files: ResultEntryDialog.tsx (footer/focus), ResultEntryPanel.tsx (shared form layout/status/field grouping), RunDetailPage.tsx (target/assignment binding), existing CommentComposer/ElapsedTimerField/DefectKeyInput and resultEntryDialogModel/resultSaveLifecycle with their regression tests. Both panel and list use this same form and lifecycle; no duplicate form/API. The linked design contains the ordered implementation and verification checklist.
  - Done when: before/after captures at 1440×1000, 1280×720 and 390×844 show the actual reference composition through both entry points. The basic Text result fits the desktop viewport without body scrolling; required/long forms may scroll without losing actions, and mobile uses one column without horizontal overflow. Verify native keyboard/dropdown/focus return, same-status entry, cancel without writes, state transitions without draft loss, real save/read-back including metadata/defects/assignee, two attachments, result failure and partial retry without duplicate results. Run relevant regression tests, web lint/build and record commands/results, UI observations and tester/design acceptance in `docs/ux-evidence/UI-051.md`. Pending required review or blocked persistence is not a pass.
  - Dependencies: preserve UI-030/031/037/038/039 and top statistics from UI-040. Out of scope: new APIs, bulk redesign, case authoring, instruction/whole-Run redesign. UI-021 includes this final form in the integrated tester journey. Primary UX outcomes: `UX-031`, `UX-032`, `UX-033`; shared/flow regressions: `UX-002`, `UX-003`, `UX-010`, `UX-011`, `UX-012`, `UX-013`, `UX-034`, `UX-041`, `UX-042`. A mapping is not a completed UX verdict.

#### UI-021에서 발견한 결함의 수정 큐 — 2026-09-20

사용자의 NEXT_ACTIONS 재편성 요청으로 아래 12개 단위를 실행 가능한 수정 작업에 추가한다. UI-021은 미완료인 채 최종 재검증으로 이동한다. 상세 순서는 NEXT_ACTIONS만 따른다. 아래 관찰은 UI-021 기록에 근거한 **재현 출발점**이며 현재 원인이 확정됐다는 뜻이 아니다.

공통 실행 규칙: 해당 fixture/실제 요청으로 먼저 재현 → 실패 회귀 추가 → 최소 수정 → 관련 회귀·타입 검사·빌드 → 실제 화면/저장 후 재조회 검증. `docs/ux-evidence/UI-XXX.md`에 명령/결과, build/fixture/role, 자동·실조작·실제 저장·mock의 구분과 한계를 남긴다. 현재 코드에서 이미 해결됐거나 관찰 기대값이 잘못된 경우에도 수용 조건 전체를 증명한 후 완료할 수 있다. 근거 없이 재구현하거나 완료 체크하지 않는다.

서버가 원인이면 명시한 기존 필드/동작의 schema→service→repository 매핑과 관련 테스트까지 좁혀 수정할 수 있다. 새 API/DB 정책/외부 서비스/광범위 리팩터링은 자동 허용하지 않는다. 기존 UI-051 배치, 지침 우선 패널, 상단 통계, 사용자 변경을 보존한다. 모든 코드 단위에 전체 통합 테스터 검토를 요구하지 않지만, 해당 변경의 필수 수용 조건을 미루고 완료할 수는 없다. 외부 준비 E01–E04와 반복 방지 규칙은 NEXT_ACTIONS를 따른다.

- [ ] **UI-052 P0 — 모바일 Run 목록 복귀와 선택 복원 충돌 수정.**
  - 근거/재현: UI-021 J08, 390px에서 testId 없는 Run이 이전 C4로 자동 열리고 Back to tests 후 다시 C4로 돌아가 목록 행 높이가 0이 됨. 현재 fixture에서도 목록→상세→목록 전환과 재렌더를 확인한다.
  - 범위/시작 파일: `apps/web/src/features/runs/components/RunDetailPage.tsx`, `utils/runSelectedTestState.ts`와 해당 테스트. URL/복원 효과/목록·상세 모드의 충돌을 수정한다.
  - 작업: 사용자가 명시적으로 목록으로 돌아온 의도를 이전 선택 자동 복원보다 우선한다. testId 없는 모바일 경로는 실제 목록을 보여주고, 명시적 testId 딥링크는 올바른 지침을 연다. 데스크톱 선택 계약은 보존한다.
  - 완료: 390px에서 Back to tests 후 대기/재렌더에도 목록이 유지되고 행·체크박스의 실제 크기/접근성이 정상이다. 행 다시 열기, URL 직접 접근, refresh, Back/Forward, 필터 변화와 1280/1440 동작을 확인한다.
  - 제외/연결: 새 pane 구조/결과 폼/통계 재설계 제외. UX-002/020/034/042, J04/J08.

- [ ] **UI-053 P0 — 결과 Defects 입력을 저장과 재조회까지 보존한다.**
  - 근거/재현: UI-021 J05에서 CART-21을 입력했지만 결과 조회 `defects: []`. 입력값의 확정(Enter/blur/token 생성), submit payload, 응답, 재조회 중 어느 지점에서 빠지는지 먼저 구분한다.
  - 범위/시작 파일: `apps/web/src/features/runs/components/DefectKeyInput.tsx`, `ResultEntryPanel.tsx`, `api/runApi.ts`; 필요 시 `apps/server/src/modules/results/results.schema.ts`, `results.service.ts`, 기존 defect-link 저장 경로. 새 결함 연동 서비스는 만들지 않는다.
  - 작업: 입력창에 보이는 유효한 키가 별도 설명 없는 숨은 확정 조작 때문에 누락되지 않게 한다. 기존 지원 형식/중복 제거/검증을 일관되게 적용하고 양쪽 결과 진입점에 같은 규칙을 쓴다.
  - 완료: 패널과 목록에서 단일/복수 키를 입력해 저장하고 창 재열기/새로고침/결과 API/이력에서 같은 키를 확인한다. 마지막 값 입력 후 바로 저장, 키 제거/취소, 허용하지 않는 형식, 결과 저장 실패 후 재시도를 검증한다. 이미 저장된 결과의 첨부 재시도가 새 결함 기록/결과를 중복 생성하지 않는다.
  - 제외/연결: 외부 이슈 생성/인증 변경 제외. UX-031/032/033, J05/J06.

- [ ] **UI-054 P0 — 케이스 References 입력을 저장과 재조회까지 보존한다.**
  - 근거/재현: UI-021 J02의 JIRA-UI021이 `refs: null`로 재조회됨. 필드 확정과 create/update payload부터 기존 정규화/저장 경로를 대조한다.
  - 범위/시작 파일: `apps/web/src/features/cases/components/ReferencesInput.tsx`, `CaseAuthoringForm.tsx`; 필요 시 `apps/server/src/modules/cases/cases.schema.ts`, `cases.service.ts`, `cases.repository.ts`, `domain/caseRefs.ts`. 기존 `__tests__/case-refs.test.ts` 및 reference integration 회귀를 사용한다.
  - 작업: 작성/편집한 참조가 저장 직전의 입력과 같은 의미로 영속화되게 한다. 사용자에게 숨겨진 확정 단계로 값이 유실되지 않게 하고 기존 구분자·유효 형식을 유지한다.
  - 완료: Text/Steps 생성과 편집에서 참조 추가/제거/복수 입력/취소를 수행하고 재열기·API·Run 읽기에서 계약에 맞는 값을 확인한다. 잘못된 입력은 로컬 오류이며 조용한 null 저장은 금지한다. 원본 수정의 Run 반영 시점은 기존 snapshot/live 정책대로 검증한다.
  - 제외/연결: 참조 시스템/버전 정책 변경 제외. UX-001/021, J02/J03.

- [ ] **UI-055 P0 — bulk 결과 후 목록·선택 상세·통계를 즉시 일치시킨다.**
  - 근거/재현: UI-021 J07의 3개 Blocked 적용 후 toast/통계만 변경되고 목록과 선택 상세는 reload 전까지 옛 상태.
  - 범위/시작 파일: `apps/web/src/features/runs/components/RunDetailPage.tsx`, `RunSelectionActionBar.tsx`, `TestInstanceTable.tsx`, `utils/runBulkSelectionScope.ts`, `api/runApi.ts`와 관련 query/mutation 경로.
  - 작업: 성공한 testId에 대해 목록·선택 상세·Latest/이력·집계의 query 갱신/캐시 적용을 정합적으로 처리한다. 일부 실패는 성공 대상과 분리하고 재시도 집합을 유지한다.
  - 완료: 3개 적용 직후 reload 없이 모든 읽기 표면이 저장값과 일치하고 비선택 대상은 불변이다. 상태 필터로 행이 사라짐, 페이지/섹션 변경, 부분 실패/재시도를 주입해 성공 대상 중복 기록이 없음을 확인한다.
  - 제외/연결: 다중 Run bulk 신설/일괄 입력창 재설계 제외. UX-003/030/032, J07.

- [ ] **UI-056 P0 — 일반 저장과 명시적 다음 이동의 의미를 정리하고 검증한다.**
  - 근거/판정 보정: UI-021이 Jump to next 선택 후 일반 저장에서 머무른 것을 실패로 적었으나, UI-051/UX-002의 **Add Result는 현재 유지**가 우선이다. 이 관찰만으로 자동 다음을 복원하지 않는다.
  - 범위/시작 파일: `apps/web/src/features/runs/components/RunDetailPage.tsx`, `ResultEntryDialog.tsx`, `utils/resultEntryDialogModel.ts`, `utils/resultSaveLifecycle.ts` 및 Jump preference를 표시하는 기존 제어.
  - 작업: Add Result/Save & Next/Pass & Next의 명시적 의도를 end-to-end 대조한다. 일반 저장을 뒤집는 모호한 Jump 설정은 실제 적용 범위를 명명하거나 해당 문맥에서 제거한다. 기존 설정의 다른 소비자를 확인하며 몰래 의미를 바꾸지 않는다.
  - 완료: 서로 다른 지침의 5개 테스트에서 일반 저장은 유지, Save & Next와 유효한 Pass & Next는 현재 필터/정렬의 다음을 연다. 필수 입력/실패/첨부·할당 부분 성공에는 이동하지 않고 마지막에서 순환하지 않는다. URL/지침/testId/포커스가 일치한다.
  - 제외/연결: 새 자동 실행 엔진 제외. UX-002/031/032/034, J04/J06. UI-021의 잘못된 기대값은 해당 증거에 명확히 정정하되 원 관찰 이력을 지우지 않는다.

- [ ] **UI-057 P0 — 부분 성공 후 첨부·담당자 복구 상태를 잃지 않는다.**
  - 근거/재현: UI-021 J06의 중복 staging으로 파일 4개 표시, 창을 닫고 다시 열면 Retry 소실. 의도적인 폐기와 동의 없는 손실, 브라우저 새로고침과 같은 세션 재열기를 구분한다.
  - 범위/시작 파일: `apps/web/src/features/runs/components/ResultEntryDialog.tsx`, `ResultEntryPanel.tsx`, `RunDetailPage.tsx`, `utils/resultSaveLifecycle.ts`, `api/resultAttachmentUpload.ts`와 관련 테스트.
  - 작업: resultId/testId별 성공/실패 작업을 분리하고 같은 세션의 재열기에는 실패 파일/할당 재시도를 보존한다. 동일 UI 이벤트가 이중 처리되어 staging이 복제되는지 확인한다. 사용자의 별도 파일 추가를 파일명만 같다는 이유로 삭제하지 않는다.
  - 완료: 결과 성공 뒤 첨부만 실패/할당만 실패/둘 다 실패, A 닫기→B 열기→A 재열기, 재시도에서 결과 수와 성공 파일 수가 늘지 않는다. 명시적 폐기 전 저장 사실과 잃는 초안을 알린다. refresh 후 File bytes 복원이 불가능하면 저장된 결과를 유지하고 파일 재선택을 명확히 안내한다; 재선택으로 결과를 새로 만들지 않는다.
  - 검증 범위: 제어된 업로드/할당 실패·성공을 사용하는 회귀와 실제 dialog 조작은 이 단위 필수다. 실제 외부 저장소 bytes 왕복은 E01/UI-021의 별도 성공 증거이며 mock을 그 증거로 주장하지 않는다.
  - 제외/연결: 새 파일 영구저장 서비스/자동 업로드 인프라 제외. UX-012/032/033, J06.

- [ ] **UI-058 P0 — All/Dynamic Run의 포함 규칙을 실제 동작과 일치시킨다.**
  - 근거/재현: UI-021 J03에서 새 C6/C7이 재열기만으로 포함되지 않고 Sync now 후 추가됨. Dynamic 갱신도 미검증, Sync가 Discussion에 가려짐. 기존 제안 7/12를 이 단위로 합친다.
  - 범위/시작 파일: `apps/web/src/features/runs/components/RunCompositionPanel.tsx`, `RunCompositionWorkbench.tsx`, `RunDetailPage.tsx`; `apps/server/src/modules/runs/runCompositionSync.service.ts`, `runComposition.ts`, 기존 run service와 `__tests__/run-composition.test.ts`.
  - 작업: UI-045의 기존 All/Dynamic/Selected 계약과 서버의 지원 갱신 시점을 확인한다. 지원된 자동 포함 연결이 누락됐다면 그 경로를 복구한다. 설명만 수동 Sync로 바꿔 자동 포함 요구를 충족했다고 하지 않는다. 자동 포함이 기존 계약상 구현 불가능하면 필요한 정확한 정책/API 변경을 별도 결정 요청한다.
  - 완료: All에는 새 케이스 포함, Dynamic high에는 새 high 포함/low 제외, Selected는 고정이라는 기존 명시 계약을 재조회로 검증한다. 목록·수·상세를 갱신하며 이미 기록된 테스트/결과는 유실되지 않는다. 유지하는 Sync 조작은 올바른 범위와 피드백을 갖고 1280/390px 및 키보드에서 가림 없이 접근된다.
  - 제외/연결: 새 스케줄러/백그라운드 인프라/정책 몰래 변경 제외. UX-001/003/040, J03/J08.

- [ ] **UI-059 P1 — 이동/복사 목적지를 전체 섹션 경로로 식별한다.**
  - 근거/재현: UI-021 J07에서 서로 다른 부모의 Login이 동일한 ‘— Login’으로 표시되고 Payment 계층도 잘못 읽힘.
  - 범위/시작 파일: `apps/web/src/features/cases/components/MoveCopyChooserDialog.tsx`와 기존 section option/path 생성 로직.
  - 작업: Checkout / Login과 Authentication / Login처럼 부모 경로를 표시하고 실제 parentId/tree 순서와 들여쓰기를 맞춘다. 선택한 목적지 요약을 저장 전에 확인하게 한다.
  - 완료: 중복 이름/3단계/긴 경로/빈 부모에서 정확한 대상 선택, 취소 무변경, 3개 이동/복사 후 실제 소속을 확인한다. 390px 경로 줄바꿈과 실제 키보드 선택/복귀를 검증한다.
  - 제외/연결: 드래그 기능/이동 서버 의미 변경 제외. UX-012/023, J01/J07.

- [ ] **UI-060 P1 — 섹션 범위와 개수 안내를 최신 목록에 맞춘다.**
  - 근거/재현: UI-021 J01/UX-003의 트리 개수·‘2 cases’ live region이 현재 0/1/5 범위와 어긋난다는 기록.
  - 범위/시작 파일: `apps/web/src/features/cases/components/SectionTreePane.tsx`, `CaseListPane.tsx`, 조회 scope/summary 연결과 캐시 갱신 경로.
  - 작업: 전체/직접/하위 포함/필터 결과/현재 페이지의 수를 혼용하지 않도록 출처와 표시 의미를 맞추고 추가/이동 후 필요한 query와 live region을 갱신한다.
  - 완료: 직접/하위/전체 전환, 검색, 케이스 추가·이동·삭제 후 예상 ID 집합과 트리/블록/안내 수가 일치한다. 블록 접기와 density는 대상 수를 바꾸지 않는다. 연속 조회의 늦은 응답이 옛 조건을 발표하지 않는다.
  - 제외/연결: 새 집계 API와 전체 트리 재설계 제외; 실제 부족한 계약은 따로 보고. UX-003/022/023, J01/J07.

- [ ] **UI-061 P1 — 긴 프로젝트 이름의 앞부분 잘림과 헤더 겹침을 수정한다.**
  - 근거/재현: UI-021에서 Extremely의 앞 ‘Ex’가 잘린 프로젝트 이름. viewport와 실제 텍스트/clip/scroll 상태를 구분해 재현한다.
  - 범위/시작 파일: `apps/web/src/shared/ui/ProjectSwitcher.tsx`와 기존 공통 헤더의 크기/overflow 규칙.
  - 작업: 긴 이름은 시작을 보존한 예측 가능한 줄임을 사용하고 전체 이름을 키보드/포인터로 접근할 수 있게 한다. 제목 때문에 인접 내비게이션/메뉴를 밀어내지 않는다.
  - 완료: 긴 한글/영문/공백 없는 이름을 1440/1280/390px에서 확인한다. 앞글자 임의 잘림, 제어 겹침, 가로 넘침이 없고 전체 이름을 확인할 수 있다.
  - 제외/연결: 글로벌 헤더 전면 교체 제외. UX-010/040/042, J08.

- [ ] **UI-062 P1 — Run 컨트롤 이름과 실제 키보드 작업 흐름을 보완한다.**
  - 근거/재현: UI-021의 전체 선택 이름 ‘on’, label 없는 Discussion textarea, 실제 Tab/Shift+Tab 미검증.
  - 범위/시작 파일: `apps/web/src/features/runs/components/TestInstanceTable.tsx`, `RunDetailPage.tsx`의 discussion 구성, 기존 결과 dialog/공통 focus 처리. 현재 사용자 여정에서 확인된 이름/초점 결함만 수정한다.
  - 작업: 전체 선택의 대상 범위를 이름에 명시하고 Discussion 입력에 의미 있는 label을 연결한다. E02 경로로 목록→상태 메뉴→결과창→저장/취소→복귀를 실제 키보드로 수행하고 발견한 초점 문제를 해당 경로 안에서 수정한다.
  - 완료: 실제 Tab/Shift+Tab/Enter/화살표/Escape로 선택·메뉴·dialog·초안 폐기·원래 트리거 복귀를 검증한다. 읽기 전용/닫힌 Run, 필수 오류, 필터로 사라진 행도 포함한다. 키 입력 가로채기로 불가능하면 DOM focus로 대체 합격하지 않고 E02 blocker를 남긴다.
  - 제외/연결: 전체 앱 접근성 재설계 제외. UX-012/042, J05/J08.

- [ ] **UI-063 P1 — Overview와 Milestone의 수·연결 문맥을 정확히 표시한다.**
  - 근거/판정 보정: UI-021의 ‘16 remaining’ 대 ‘7 cases’, Sprint 9의 0 active runs 기록. 여러 Run의 테스트 인스턴스 수는 고유 케이스 수와 다를 수 있고, Alpha가 실제 milestone에 연결됐는지 먼저 확인한다.
  - 범위/시작 파일: `apps/web/src/features/projects/components/ProjectOverviewPage.tsx`, `MilestoneDetailPage.tsx`, `utils/projectOverviewModel.ts`; 필요 시 기존 `apps/server/src/modules/runs/runsOverview.service.ts`, `domain/milestoneRollup.ts`와 관련 회귀.
  - 작업: 집계의 단위·Run 상태·필터·페이지 범위를 식별하고 실제 포함 ID로 기대값을 만든다. 잘못된 합산/갱신/label은 최소 수정한다. fixture만 잘못됐으면 정상 연결 데이터로 검증하고 제품 결함으로 꾸미지 않는다.
  - 완료: 같은 케이스를 포함한 활성 Run A/B, 완료 Run, milestone 연결/비연결 Run으로 집계를 대조한다. 상태 변경/연결 후 갱신과 집계에서 실제 Run으로 이동을 확인한다. ‘남은 테스트’와 ‘고유 케이스’를 구분하고 계획/Run 중복 합산이 없다.
  - 제외/연결: 새 분석/지표 API/임의 milestone 자동 연결 제외. UX-001/040/042, J08.

## 8. Definition of done

### 8.1 Separate delivery, verification and tester acceptance

For each new or revalidated unit, evidence must identify: build/revision and date; scope and fixture; approved visual target when required; implemented behavior; automated checks; actual UI/keyboard checks; viewport captures; tester review; limitations and the owner of any remaining integrated check. Record each check as passed, failed, blocked or not applicable with a reason. Do not equate “implemented” or “unsupported storage safely rejected” with “normal user flow verified.” Mocks may verify recovery logic but must be labeled and cannot prove real file storage or human comprehension.

Only check a new UI delivery when its in-scope acceptance checks pass. A future-unit target explicitly excluded from this unit is not an in-scope blocker; name its owner instead of implementing it early. Required checks blocked by environment or pending design review remain blocked. Historical checked entries stay preserved with qualifications; this document revision changes no delivery checkbox.

### 8.2 Verification tiers and scope boundaries

| Tier | Owner and required proof | What it must not imply |
| --- | --- | --- |
| Unit acceptance | Current UI unit: its changed states, relevant tests/build, keyboard and before/after captures; section 5 visual review for layout changes | No requirement to implement later units to produce their final screenshot. |
| Regression protection | Current UI unit: touched shared consumers and established identity/selection/save/recovery contracts | Preserving an old contract does not re-certify every old feature or add unrelated fixes. |
| Integrated usability | UI-021: completed target composition, all UX gates, realistic tester rehearsal and outstanding evidence debt | A single component test, screenshot or checkbox count cannot certify the final user journey. |

For UI-037, show the dialog, panel entry, actual save/cancel/recovery and existing quick-pass behavior; preserve existing instructions but do not require UI-039's final reading layout. UI-038 adds every ordinary list Status entry and exact target/no-write-on-cancel verification. UI-039 owns the final instruction-first layout and reading→recording→next demonstration. UI-040 tests the top statistics against the panel version present in its batch, without requiring later dialog work.

UI-051 revalidates the form itself against the supplied Add Result image, including its two-column default, single Status dropdown, staged assignment and compact footer. UI-037–040 screenshots cannot satisfy UI-051. Preserve their surrounding execution layout and test only relevant shared regressions; no unrelated Run redesign is required.

For UI-041–050, capture touched states at the review's three viewport sizes and check the relevant role in the final layout. UI-042 proves shared chrome on its named routes, not the future UI-046 My Tests queue; UI-041 proves navigation compaction, UI-050 the execution-area information architecture. UI-044 owns case reading; UI-049 owns authoring and its persisted instruction roundtrip. Other per-route first-row criteria belong to the named route unit and then UI-021. Do not impose all future route outcomes on each shared-component batch.

### 8.3 Final product acceptance — 업무 완수 기준

UI-021은 §7의 재작성된 UX 19개 항목과 J01–J08을 기준으로 판정한다. 공통 컴포넌트 사용, 행 수, 버튼 수, API 성공, 화면 캡처는 보조 근거이며 아래 업무를 대신하지 않는다.

- **찾고 정리한다:** 테스터가 폴더 트리의 상하 관계·섹션별 TC 소속·선택 범위를 이해하고, 읽기/편집/bulk 선택을 혼동하지 않는다. 제목·경로·현재 조건이 좁은 화면에서도 식별된다.
- **수행 가능한 내용을 만든다:** quick outline 이후 Text/Steps 지침을 작성·수정·저장·재조회하고 의도한 Run에서 읽는다. 원본/Run의 반영 정책과 All/Selected/Dynamic의 포함 규칙이 실제 동작과 일치한다.
- **실제로 수행한다:** 처음 보는 테스터가 Run 안에서 사전조건·절차·기대 결과를 읽고 테스트용 대상을 조작/비교한다. 케이스 관리로 돌아가거나 작성자의 설명을 받아야 절차를 알 수 있는 화면은 불합격이다.
- **간단하고 안전하게 기록한다:** 양쪽 결과 진입점이 참고 이미지 기준의 같은 작은 창을 사용한다. 선택/취소는 무변경, 일반 저장은 현재 유지, 명시적인 다음만 이동한다. 결과 대상·이력·목록·상단 통계가 일치한다.
- **근거를 확인하고 복구한다:** 실제 저장소의 첨부 업로드/재열기/원본 다운로드, 결함/메타데이터/담당자 재조회, 결과·첨부·할당 실패별 중복 없는 재시도를 통과한다. 저장소 부재는 blocked이며 안전한 거절로 성공 경로를 대신하지 않는다.
- **이어간다:** 프로젝트/실행 허브/My Tests/Plan에서 정확한 Run/test를 찾고, 필터·뒤로가기·새로고침·업무 중단 후 저장된 사실과 현재 대상을 혼동하지 않고 재개한다.
- **다른 조작 환경에서도 된다:** 1440×1000/1280×720/390×844 및 실제 키보드에서 같은 업무를 수행한다. 통계는 상단, 트리는 조용한 탐색, 목록은 소속 블록, 패널은 지침 읽기, 모달은 짧은 입력이라는 역할이 유지된다.

필수 증거는 한 통합 빌드에서의 **현재 동작 확인**, 자동 검사, 실제 화면/키보드 조작, 저장 후 재조회, 테스터 관찰을 분리해 기록한다. 대표 테스터에게 위치를 알려주지 않고 목적만 제시하며 망설임·잘못된 진입·도움 요청·완수 여부를 남긴다. 한 번의 관찰을 보편적인 직관성으로 일반화하지 않는다.

19개 UX 항목 모두에 판정과 근거가 있어야 한다. 적용 제외는 기능이 실제 대상 밖인 근거를 명시해야 하며 핵심 케이스 관리/수행/기록/첨부/키보드/테스터 검증을 면제할 수 없다. 실패나 환경 차단, 필수 검토 pending이 남으면 해당 UX와 UI-021을 체크하지 않는다. 새 결함은 재현 가능한 수정 단위로 제안하고 NEXT_ACTIONS의 별도 결정 없이 구현 범위를 넓히지 않는다.

## 9. Reference anchors

Reference keys for the task-content audit (reviewed 2026-09-19). These are official behavior references, not permission to copy every feature or mix UI generations. Concrete layouts above are project decisions based on these references and the user's supplied screens; limitations/deviations must be explicit in evidence.

- **R1 — [Adding test cases](https://support.testrail.com/hc/en-us/articles/14438119644692-Adding-test-cases):** full case entry and section-native quick outline are complementary authoring paths.
- **R2 — [FastTrack three-pane workflow](https://support.testrail.com/hc/en-us/articles/16959978163604-TestRail-5-1-Default):** historical 2015 design reference for navigating sections/list/selected instructions without a page switch; not a claim about today's navigation skin.
- **R3 — [Test case templates](https://support.testrail.com/hc/en-us/articles/14927678348052-Test-case-templates):** Text instructions and separated Action/Expected steps; the inspected [authoring image](https://support.testrail.com/hc/article_attachments/14928854586260) anchors field grouping. Newer AI templates are outside this program.
- **R4 — [Submitting test results](https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results):** ordinary Status and Add Result share a dialog; quick-pass and result/history review are distinct. The inspected [dialog image](https://support.testrail.com/hc/article_attachments/15881055029652) is a density/field-layout reference. The project's current field placement and draft assignment follow the UI-051 contract; the earlier assignment-excluded adaptation is superseded. Project-specific save/recovery and disclosure rules are not claims of pixel parity.
- **R5 — [Create new test plans](https://support.testrail.com/hc/en-us/articles/30765296499604-Create-new-test-plans):** plans organize executable runs and configurations within the execution area; preserve existing backend composition contracts.
- **R6 — [Creating new test runs](https://support.testrail.com/hc/en-us/articles/7076838639892-Creating-new-test-runs):** all-inclusion, specific selection and dynamic criteria have distinct membership behavior; inspected [selection image](https://support.testrail.com/hc/article_attachments/30765077100692). Do not confuse fixed-all with automatic inclusion.
- **R7 — [Charts and dashboards](https://support.testrail.com/hc/en-us/articles/7101753582996-Charts-and-dashboards):** concise testing progress is useful work context; simplification does not mean removing all charts.

- TestRail introduction and core workflow: https://support.testrail.com/hc/en-us/articles/7076810203028
- Adding test cases and quick outline: https://support.testrail.com/hc/en-us/articles/14438119644692-Adding-test-cases
- Sections and subsection management: https://support.testrail.com/hc/en-us/articles/14985199889812-Sections
- Submitting results, Pass & Next, and bulk results: https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results
- Existing parity analysis: [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md)
- Existing feature-oriented backlog: [UX_BACKLOG.md](./UX_BACKLOG.md)
- UX review gate: [UX_GATE.md](./UX_GATE.md)
