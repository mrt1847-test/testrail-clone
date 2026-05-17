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

**Section:** Evidence, Attachments

**Checklist line (exact line done when this is `[x]`):**

- [ ] **TR-Core** P1 Attachment retention and cleanup policy.

### Scope (only what closes the line above)

- Configurable retention for soft-deleted attachment metadata and storage tombstones.
- Scheduled or on-demand cleanup job with tests.

### Out of scope for this batch

- Production object storage lifecycle and authorization hardening — shipped.
- Defect integration test connection UI.

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | Reporting / UI | **TR-Core** P1 Print-friendly case view and multi-case print (checklist line 312) |
| 2 | Reporting / UI | **TR-Core** P1 Print-friendly run, plan, and milestone views (checklist line 313) |
| 3 | Reporting / UI | **TR-Core** P1 Print-friendly report pages (checklist line 314) |
| 4 | Evidence, Attachments | **TR-Pro** P1 Integration test connection and validation |
