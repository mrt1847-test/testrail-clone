# Next Actions

Last aligned: 2026-05-17

Goal: keep the next development batch to roughly one PR. Direction lives in [ROADMAP.md](./ROADMAP.md). Progress should be tracked by flipping exactly one line in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) from `[ ]` to `[x]`.

**`[x]` = baseline shipped, not full TestRail parity.** See [FEATURE_CHECKLIST.md — Completion depth](./FEATURE_CHECKLIST.md#completion-depth-what-x-does-not-mean) before interpreting progress counts.

## Loop

1. Implement only the unchecked checklist line named in **Current batch**.
2. When it ships, flip only that line to `[x]` and add a short parenthetical note.
3. Do not add new checklist lines for polish inside an already completed area.
4. Pick the next unchecked line from **Next batch candidates** and replace **Current batch** with it.

---

## Current batch

**Section:** TestRail UI/UX Realignment

**Checklist line (exact line done when this is `[x]`):**

- [ ] **TR-Core** P0 Run execution workbench shell: persistent status count sidebar/rail, compact test table, and selected-test detail/result pane visible together without losing context.

### Scope (only what closes the line above)

- Implement the `[ RunSectionTree | TestInstanceTable | QPane ]` 3-pane layout in `RunDetailPage.tsx` (Wave A from RUN_EXECUTION_VIEW_PARITY.md).
- Add `RunSectionTree` component to filter by `groupId` / section.
- Sync `testId`, `sectionId`, and `groupBy` state in the URL.

### Out of scope for this batch

- Pass & Next, inline status dropdowns, and keyboard shortcuts (these belong to the execution speed checklist line / Wave B).
- Cross-run history and defects tabs in QPane (Wave E).

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | TestRail UI/UX Realignment | **TR-Core** P0 Run execution speed actions: row status dropdown, Add Result, Pass & Next, next failed/blocked/untested... |
| 2 | TestRail UI/UX Realignment | **TR-Core** P0 Case repository workbench shell: left suite/section tree, center compact case table, right selected-case detail pane... |
| 3 | TestRail UI/UX Realignment | **TR-Core** P1 Project shell realignment: make Overview, Test Cases, Test Runs & Results, Milestones, Test Plans, Reports... |
| 4 | Keyboard, Selection, And List Ergonomics | P1 Remember last filter, sort, and column set per page per user. |
