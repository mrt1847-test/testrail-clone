# Next Actions

Last aligned: 2026-05-22

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

- [ ] **TR-Core** P0 Case repository workbench shell: left suite/section tree, center compact case table, right selected-case detail pane, with section/case/filter/page state preserved in the URL.

### Scope (only what closes the line above)

- Validate CASE_REPOSITORY_VIEW_PARITY.md Wave A against the existing case repository workbench.
- Ensure suite/section tree, compact case table, selected-case detail pane, and preserved URL state are all reachable in the primary Test Cases route.
- Close any small UI/state gaps needed for the checklist line without expanding into authoring/editor polish.

### Out of scope for this batch

- Full authoring flow redesign or dedicated editor work.
- Import/export, Shared Steps polish, or deleted-case lifecycle beyond what is already visible in the shell.

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | TestRail UI/UX Realignment | **TR-Core** P1 Project shell realignment: make Overview, Test Cases, Test Runs & Results, Milestones, Test Plans, Reports... |
| 2 | Keyboard, Selection, And List Ergonomics | P1 Remember last filter, sort, and column set per page per user. |
