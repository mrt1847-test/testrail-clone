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

No unit is scheduled. `UI-019` shipped. Do not start `UI-020` (Settings), `UI-021`, or UI-022–UI-029 until one of them is explicitly placed here.

### Out of scope until scheduled

- Shared Settings controls (`UI-020`).
- Cross-route visual/accessibility regression gate (`UI-021`).
- The deferred simplicity-review units UI-022–UI-029.

---

## Next batch candidates

No further rows were listed in this table after `UI-019`. Do not invent a next unit.

---

## Deferred capability batches

### Newly reviewed UI follow-ups — not scheduled

The user requested review and documentation only for the [simplicity re-review](./UI_UX_SIMPLICITY_REVIEW_2026-09-18.md). UI-022–UI-029 have been added as unchecked units in the controlling usability checklist. **Do not treat this review as permission to implement them now or advance Current batch.** No Current batch unit is scheduled after UI-019.

| Review priority | Planned unit |
| --- | --- |
| P0 | UI-025 — Unobstructed move/copy dialog and correct focus behavior |
| P0 | UI-022 — Selected section / include subsections / all sections scope |
| P1 | UI-023 — Section-owned TC blocks with path, count, and collapse |
| P1 | UI-024 — Simpler View settings with distinct meanings |
| P1 | UI-026 — File-tree keyboard and accessible-label behavior |
| P1 | UI-027 — Compact project navigation above Test Cases |
| P1 | UI-028 — One case-selection action bar and one empty-state CTA |
| P1 | UI-029 — Content-first case detail header |

These are review priorities, not a replacement execution queue. Schedule them explicitly before placing any one of them in Current batch.

### Deferred feature parity work

The previous cross-project reports and SSO batches remain in [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md). Resume them after the usability program or when the product owner explicitly reprioritizes them; do not interleave them with the current one-PR UI sequence.
