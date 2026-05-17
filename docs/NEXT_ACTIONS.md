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

**Section:** Keyboard, Selection, And List Ergonomics

**Checklist line (exact line done when this is `[x]`):**

- [ ] P1 Remember last filter, sort, and column set per page per user.

### Scope (only what closes the line above)

- Persist list filter, sort, and visible column preferences per user per page (localStorage baseline).

### Out of scope for this batch

- Compare two runs side-by-side — shipped.
- Column width persistence (separate checklist line).

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | Keyboard, Selection, And List Ergonomics | P1 Column width and visibility persistence |
| 2 | Reporting And Collaboration Shortcuts | P1 Export current filtered view; report filter presets |
| 3 | Reporting And Collaboration Shortcuts | P1 Copy chart/table summary to clipboard |
| 4 | Reporting And Collaboration Shortcuts | P1 @mention autocomplete; comment templates; rich text comments |
