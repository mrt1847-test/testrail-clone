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

**Section:** Results And Custom Fields

**Checklist line (exact line done when this is `[x]`):**

```text
- [ ] **TR-Core** P1 Advanced result custom field filtering semantics.
```

### Scope (only what closes the line above)

1. Extend result explorer (and related APIs) beyond exact-match custom field filters.
2. Support the product-defined operators (contains, range, empty, etc.) per field type.
3. Wire UI controls that map to server filter semantics.
4. Add focused tests for filter matrix per type.

### Out of scope for this batch

- Execution workflow discussion comments (shipped).
- Import mapping wizard (already `[x]` in checklist).

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | Test Execution And Runs | `- [ ] **TR-Core** P1 Email when tests are assigned and when others comment or add results to your tests.` |
| 2 | Assignments And To-Do | `- [ ] **TR-Core** P1 **Team to-do** view: see other members’ or whole-team to-dos for workload balancing ([Introduction](https://support.testrail.com/hc/en-us/articles/7076810203028)).` |
