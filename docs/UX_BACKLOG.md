# UI/UX Improvement Backlog (TestRail-aligned)

Last aligned: 2026-05-16  
Source analysis: [UX_GAP_ANALYSIS.md](./UX_GAP_ANALYSIS.md)

Implementation waves are **separate PRs**; update [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md) and [COMPONENT_MAP.md](./COMPONENT_MAP.md) per wave.

---

## Impact × effort matrix

|  | Low effort | High effort |
|--|------------|-------------|
| **High impact** | UX-1a Clickable run summary chips · UX-1b Elevate My Tests/Plans nav | UX-2 Status sidebar on run detail |
| **Lower impact** | UX-3 Overview drilldown links | UX-4 Shared design primitives package |

---

## Wave UX-1 — Quick wins (1 PR)

**Goal:** TR-like filtering without new layout.

- `RunSummaryBar`: clicking Passed/Failed/… sets run URL `status` and scrolls to table.
- `ProjectOverviewPage`: failure/run widgets link to `/runs?…` or filtered run detail where API allows.
- `ProjectTabs`: promote **My Tests** and **Plans** to primary row (or split More into two visible groups).

**Files:** `RunSummaryBar.tsx`, `RunDetailPage.tsx` (wire chip click), `ProjectTabs.tsx`, `ProjectOverviewPage.tsx`.

**Done when:** S3/S5 walkthrough clicks reduced; UX_GAP §5 items 3–2 closed.

**Status:** Shipped (2026-05-16).

---

## Wave UX-2 — Run execution shell (1–2 PRs)

**Goal:** Match [TestRail run execution](https://support.testrail.com/hc/en-us/articles/7077882766612-Adding-test-results) patterns.

- Add `RunStatusSidebar` (counts from `counts`, mirrors `useRunUrlState.statusFilter`).
- Toolbar: **Next failed**, **Next blocked**, **Previous/Next test** in selection order.
- Optional: persist sidebar collapsed state in `localStorage`.

**Files:** new `RunStatusSidebar.tsx`, `RunDetailPage.tsx`, `RunInstancesSection.tsx`.

**Done when:** FEATURE_CHECKLIST § "Clickable status counts" + "next/previous test" `[x]`.

**Status:** Shipped (2026-05-16).

---

## Wave UX-3 — Design primitives (1 PR)

**Goal:** Align [COMPONENT_MAP](./COMPONENT_MAP.md) planned shared UI.

- Introduce `StatusBadge`, `FilterBar`, `PageHeader` in `apps/web/src/shared/ui/`.
- Migrate `TestInstanceFilterBar`, `ReportFilterBar`, `MyTestsPage` filters incrementally.

**Done when:** Clone Engineering checklist rows for shared components `[x]` (partial migration OK).

**Status:** Shipped (2026-05-16).

---

## Wave UX-4 — Case repository IA (optional)

**Goal:** Reduce expandable-row friction for heavy editors.

- Option A: `/cases/:caseId` read-only detail + edit drawer.
- Option B: Widen expandable panel to full-width overlay on desktop.

**Status:** Shipped (2026-05-16) — Option A: `CaseDetailPage` + `CaseEditDrawer`; list rows navigate to `/projects/:projectId/cases/:caseId`; legacy `?caseId=` redirects from workspace.

---

## Deferred / needs live TestRail

- Keyboard shortcut map (`?` overlay) — **검증 필요**
- Exact TestRail 9.x pagination wrappers — out of product API scope
- Report template picker gallery — Phase 3 reporting strategy
