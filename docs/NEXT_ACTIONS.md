# Next Actions

Last aligned: 2026-09-18

Goal: reduce UI clutter and make the core Test Cases and Run Execution workflows immediately understandable. Product direction and outcome gates live in [USABILITY_REALIGNMENT_2026-09-18.md](./USABILITY_REALIGNMENT_2026-09-18.md). Progress for this program is tracked by flipping exactly one `UI-*` line in that document from `[ ]` to `[x]`.

`FEATURE_CHECKLIST.md` continues to track capability parity. It is not the completion source for this usability realignment.

## Loop

1. Implement only the unchecked `UI-*` line named in **Current batch**.
2. Include the code, focused interaction checks, and required screenshots in the same batch.
3. When it ships, flip only that exact line to `[x]` and add a short evidence note.
4. Move the first still-unchecked item from **Next batch candidates** into **Current batch**.
5. If implementation reveals a larger problem, record it under the relevant `UX-*` outcome without silently expanding the current batch.

---

## Current batch

**Program:** TestRail-style usability realignment

**Checklist line (exact line done when this is `[x]`):**

- [ ] **UI-006 P1 — Simplify the full case editor and make its actions persistent.**

### Scope (only what closes the line above)

- Use shared field patterns so labels, required-state messaging, help text, and validation are visually consistent across case templates.
- Keep Create/Save and Cancel visible in a sticky editor footer while the form scrolls.
- Place required-field and validation messages next to the affected content instead of relying on a toast alone.
- Require a clear discard decision before closing an editor with unsaved changes.
- Preserve the active section and list context after a successful create or save.

### Acceptance

- The primary Create/Save action remains visible at the top and bottom of every supported editor scroll position.
- Submitting invalid content focuses the first invalid field and exposes an inline accessible error message.
- Cancel or close with dirty fields presents an explicit Keep editing / Discard decision; clean editors close directly.
- Successful create and save return to the same selected section without resetting repository filters or scroll context.
- Keyboard users can reach the sticky actions and complete or cancel the editor without pointer input.

### Out of scope for this batch

- Additional section-row wording and movement changes (`UI-007`).
- Quick outline authoring already completed in `UI-005`.
- Header, toolbar, case-row hierarchy, and responsive detail behavior already completed in `UI-001` through `UI-004`.
- Run Execution changes or styling routes outside Test Cases.

---

## Next batch candidates

Pick only unchecked lines from below when replacing **Current batch**. The order is deliberate: finish the Test Cases hierarchy before expanding the shared pattern to other routes.

| Suggested order | Checklist line |
|-----------------|----------------|
| 1 | `UI-007 P1 — Clarify section-row actions and relationships.` |
| 2 | `UI-008 P0 — Compress the Run Execution header into one workbench header.` |
| 3 | `UI-009 P0 — Show a sticky selection action bar next to selected tests.` |

---

## Deferred capability batches

The previous cross-project reports and SSO batches remain in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md). Resume them after the usability program or when the product owner explicitly reprioritizes them; do not interleave them with the current one-PR UI sequence.
