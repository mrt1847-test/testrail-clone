# UX Screenshot Capture - 2026-05-23

Origin: http://localhost:5173
Project ID: 1
Run ID: 1

Follow `docs/UX_GATE.md` while capturing these routes.

| Route | Layout | Viewport | URL | File |
|-------|--------|----------|-----|------|
| overview | workbench | 1440x1000 | http://localhost:5173/projects/1 | overview-desktop.png |
| overview | workbench | 390x844 | http://localhost:5173/projects/1 | overview-narrow.png |
| cases | split-pane | 1440x1000 | http://localhost:5173/projects/1/cases | cases-desktop.png |
| cases | split-pane | 390x844 | http://localhost:5173/projects/1/cases | cases-narrow.png |
| run-list | workbench | 1440x1000 | http://localhost:5173/projects/1/runs | run-list-desktop.png |
| run-list | workbench | 390x844 | http://localhost:5173/projects/1/runs | run-list-narrow.png |
| run-detail | split-pane | 1440x1000 | http://localhost:5173/projects/1/runs/1 | run-detail-desktop.png |
| run-detail | split-pane | 390x844 | http://localhost:5173/projects/1/runs/1 | run-detail-narrow.png |
| my-tests | table | 1440x1000 | http://localhost:5173/projects/1/my-tests | my-tests-desktop.png |
| my-tests | table | 390x844 | http://localhost:5173/projects/1/my-tests | my-tests-narrow.png |
| milestones | workbench | 1440x1000 | http://localhost:5173/projects/1/milestones | milestones-desktop.png |
| milestones | workbench | 390x844 | http://localhost:5173/projects/1/milestones | milestones-narrow.png |
| plans | workbench | 1440x1000 | http://localhost:5173/projects/1/plans | plans-desktop.png |
| plans | workbench | 390x844 | http://localhost:5173/projects/1/plans | plans-narrow.png |
| reports | report-config | 1440x1000 | http://localhost:5173/projects/1/reports | reports-desktop.png |
| reports | report-config | 390x844 | http://localhost:5173/projects/1/reports | reports-narrow.png |

PR checklist:

- [ ] Desktop and narrow screenshots are captured for touched routes.
- [ ] Section tree placement is unchanged for case repository captures.
- [ ] URL state and selected panes survive navigation and viewport changes.
- [ ] Screenshot folder is linked in the PR.
