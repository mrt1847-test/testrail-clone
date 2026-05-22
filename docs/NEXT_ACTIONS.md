# Next Actions

Last aligned: 2026-05-23

Goal: keep the next development batch to roughly one PR. Direction lives in [ROADMAP.md](./ROADMAP.md). Progress should be tracked by flipping exactly one line in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) from `[ ]` to `[x]`.

**`[x]` = baseline shipped, not full TestRail parity.** See [FEATURE_CHECKLIST.md - Completion depth](./FEATURE_CHECKLIST.md#completion-depth-what-x-does-not-mean) before interpreting progress counts.

## Loop

1. Implement only the unchecked checklist line named in **Current batch**.
2. When it ships, flip only that line to `[x]` and add a short parenthetical note.
3. Do not add new checklist lines for polish inside an already completed area.
4. Pick the next unchecked line from **Next batch candidates** and replace **Current batch** with it.

---

## Current batch

**Section:** TR-Ent

**Checklist line (exact line done when this is `[x]`):**

- [ ] P2 Cross-project reports API and UI (`get_cross_project_reports`, user workload, execution summary).

### Scope (only what closes the line above)

- Add authenticated cross-project report API/UI coverage for `get_cross_project_reports`, user workload, and execution summary without changing existing single-project reports.

### Out of scope for this batch

- SSO/MFA/admin settings, shared steps, labels, or unrelated report-template UX changes.

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**.

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | TR-Ent | P2 SSO (OIDC, OAuth 2.0, SAML 2.0) and enforced vs mixed login. |
