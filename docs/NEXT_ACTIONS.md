# Next Actions

Last aligned: 2026-05-17

Goal: keep the next development batch to roughly one PR. Direction lives in [ROADMAP.md](./ROADMAP.md). Progress should be tracked by flipping exactly one line in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) from `[ ]` to `[x]`.

## Loop

1. Implement only the unchecked checklist line named in **Current batch**.
2. When it ships, flip only that line to `[x]` and add a short parenthetical note.
3. Do not add new checklist lines for polish inside an already completed area.
4. Pick the next unchecked line from **Next batch candidates** and replace **Current batch** with it.

---

## Current batch

**Section:** Test Execution

**Checklist line (exact line done when this is `[x]`):**

Pick the next unchecked **TR-Core** P1 line under **Test Execution** in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) and paste it here when starting work.

### Scope (only what closes the line above)

Follow the checklist line text and [ROADMAP.md](./ROADMAP.md) for that feature only.

### Out of scope for this batch

- Plan-entry semantics (shipped).
- Milestone forecasts / burndown hints.

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | Test Execution | Next unchecked **TR-Core** P1 under test execution in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) |
| 2 | Milestones, Plans | **TR-Pro** P2 Milestone forecasts and burndown-style hints |
| 3 | Milestones, Plans | **TR-Core** P2 `/api/v2` compatibility for milestones, plans, and configurations |
