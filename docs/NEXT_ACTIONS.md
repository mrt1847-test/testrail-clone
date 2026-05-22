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



**Section:** TR-Core



**Checklist line (exact line done when this is `[x]`):**



- [ ] P1 My Tests queue realignment.



### Scope (only what closes the line above)



- Align My Tests queue UX with TestRail baseline (assignment-focused work queue, filters, and navigation).



### Out of scope for this batch



- Milestone hub, Test Plan hub, or other TR-Core realignments (separate checklist lines).



---



## Next batch candidates



Pick only unchecked lines from below when replacing **Current batch**.



| Suggested order | Section | Checklist line |

|-----------------|---------|----------------|

| 1 | TR-Core | P1 Milestone hub realignment (MILESTONES_VIEW_PARITY). |

| 2 | TR-Core | P1 Test Plan hub realignment. |

| 3 | TR-Core | P1 Visual density pass (compact toolbars, tables, sidebars across core workflows). |
