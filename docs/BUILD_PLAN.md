# Build Plan

Last aligned: 2026-05-16  
**Current wave:** — (Wave 5 done; pick next from [NEXT_ACTIONS.md](./NEXT_ACTIONS.md))  
**Status:** Wave 5 done (2026-05-16)

How to use this document:

1. Pick the **Current wave** below.
2. Complete **Steps** in order (schema → API → UI → tests).
3. One wave is typically **1–2 PRs**; update [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) and [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) when done.
4. Mark the wave **Status: done** with date in this file.

Related docs: [ROADMAP.md](./ROADMAP.md) (direction), [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) (`[x]` / `[ ]`), [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) (next queue), [DOC_MAINTENANCE.md](./DOC_MAINTENANCE.md) (PR doc rules).

---

## Wave dependency

| Wave | Name | Prerequisites |
|------|------|----------------|
| 1 | Run composition parity | — |
| 2 | Attachment history semantics | — (parallel with 1) |
| 3 | Report scheduling | SavedReport, ExportJob (done) |
| 4 | Collaboration polish | EmailOutbox (done) |
| 5 | `/api/v2` expansion | done |

---

## Wave 1 — Run composition parity

**Status:** done (2026-05-16)

### Checklist links

- [x] **TR-Core** P0 Dynamic filter runs ([FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) § Run Composition)
- [x] **TR-Core** P0 Include-all live sync
- [ ] **TR-Core** P1 Filter selection modes (v1 subset: create-time filter + manual sync; full set/add/remove deferred)

### Goal

Open runs with `include_all_live` or `dynamic_filter` composition stay in sync when cases are added, restored, or no longer match the filter; users can create runs with these modes and trigger manual sync from run detail.

### Prerequisites

- Existing run create with `includeAll`, section scopes, `TestRun.metadata` Json column.

### Steps

1. **Types** — `compositionMode`: `static` | `include_all_live` | `dynamic_filter`; `filterDefinition` (priority, section roots, state); store in `TestRun.metadata`. Files: `apps/server/src/modules/runs/runComposition.ts`.
2. **Invariants** — Extend `assertRunCreationInput` for dynamic filter (no static `caseIds` at create when mode is dynamic_filter). File: `apps/server/src/domain/invariants.ts`.
3. **Create run** — Schema + service persist metadata; evaluate initial instance set for dynamic filter. Files: `runs.schema.ts`, `runs.service.ts`, `runs.prisma.repository.ts`, `runs.types.ts`.
4. **Filter evaluation** — `evaluateCaseFilter(prisma, projectId, suiteId, filter, exclusions)`. File: `runCompositionFilter.ts`.
5. **Sync service** — `RunCompositionSyncService.syncRun(runId)` and `syncSuite(projectId, suiteId)`; add/remove instances (remove only when no results). File: `runCompositionSync.service.ts`.
6. **Case hooks** — After case create / restore / archive in suite, call `syncSuite` (prisma mode only). File: `cases.routes.ts`, `app.ts` wiring.
7. **API** — `POST /api/projects/:projectId/runs/:runId/sync-composition`; run GET includes `composition` summary; activity `run.composition_synced`. File: `runs.routes.ts`.
8. **UI PR1** — `RunCreatePage`: composition mode + filter fields; pass to create API. File: `RunCreatePage.tsx`, `runApi.ts`.
9. **UI PR2** — `RunCompositionPanel`: show mode, “Sync now”, last sync summary. File: `RunCompositionPanel.tsx`, `RunDetailPage.tsx`.
10. **Tests** — `apps/server/src/__tests__/run-composition.test.ts`: include-all live adds case; dynamic filter removes non-matching without results; closed run no-op.

### Key files

- `apps/server/src/modules/runs/runComposition.ts`
- `apps/server/src/modules/runs/runCompositionFilter.ts`
- `apps/server/src/modules/runs/runCompositionSync.service.ts`
- `apps/server/src/modules/runs/runs.schema.ts`
- `apps/server/src/modules/runs/runs.service.ts`
- `apps/server/src/modules/runs/runs.routes.ts`
- `apps/server/src/modules/cases/cases.routes.ts`
- `apps/web/src/features/runs/components/RunCreatePage.tsx`
- `apps/web/src/features/runs/components/RunCompositionPanel.tsx`
- `apps/web/src/features/runs/api/runApi.ts`

### Done when

- Checklist P0 dynamic filter + include-all live marked `[x]`.
- Filter selection modes `[x]` or noted as v1 (manual sync + create-time filter only).
- Server tests pass; web `tsc` passes.

### Doc updates

- [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) § Run Composition
- [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) — advance to Wave 2
- [API_SPEC.md](./API_SPEC.md) — sync-composition endpoint, create run body fields

---

## Wave 2 — Attachment history semantics

**Status:** done (2026-05-16)

### Checklist links

- [x] **TR-Core** P2 Historical attachment download semantics for version snapshots

### Goal

Users can download attachments as they existed on a specific case version from the version timeline.

### Prerequisites

- `TestCaseVersion.attachmentSnapshots` populated on version write.

### Steps

1. Fix snapshot shape type (`attachmentId`, `fileName`, `contentType`, `storageKey`).
2. `GET /api/cases/:caseId/versions/:versionNo/attachments/:attachmentId/download`.
3. Version UI: snapshot list + Download vs current attachments.
4. Server test: restore version does not break historical download.

### Key files

- `apps/server/src/modules/cases/cases.routes.ts`
- `apps/web/src/features/cases/components/ExpandableCaseDetail.tsx`
- `apps/server/src/modules/projects/projects.prisma.repository.ts`

### Done when

- Checklist historical attachment line `[x]`.

### Doc updates

- FEATURE_CHECKLIST, NEXT_ACTIONS, API_SPEC

---

## Wave 3 — Report scheduling

**Status:** done (2026-05-16)

### Checklist links

- [x] **TR-Core** P1 Scheduled reports and email recipients
- [ ] (optional 3b) On-demand HTML/PDF `run_report`

### Goal

Users schedule saved report CSV exports and receive email with download link; all report pages support Save view.

### Prerequisites

- SavedReport, ExportJob, EmailOutbox (done).

### Steps

1. `ScheduledReport` model + migration.
2. Scheduler worker → ExportJob → EmailOutbox.
3. CRUD API + “Run now”.
4. ReportOperationsPage Schedules tab.
5. Save view on remaining report pages.
6. Activity events for schedule run / email sent.

### Key files

- `apps/server/prisma/schema.prisma`
- `apps/server/src/modules/reports/scheduledReports.routes.ts`
- `apps/web/src/features/projects/components/reports/ReportOperationsPage.tsx`
- `apps/web/src/features/projects/components/reports/Report*.tsx`

### Done when

- Scheduled + email checklist `[x]`.

### Doc updates

- FEATURE_CHECKLIST § Reporting, NEXT_ACTIONS, API_SPEC

---

## Wave 4 — Collaboration polish

**Status:** done

### Checklist links

- [x] Email outbox admin UI (NEXT_ACTIONS)
- [x] Assignment / subscribe email (§ Assignments)
- [x] Webhook disable-on-failure (§ Activity)

### Goal

Operators see email queue health; assignees get email; failing webhooks auto-disable with visible status.

### Steps

1. Email outbox list/retry UI in project settings.
2. `test.assigned` → email queue.
3. `TestSubscription` + subscribe UI on run rows.
4. Webhook `disabledAt` + consecutive failure counter.
5. Audit filter extensions.

### Done when

- NEXT_ACTIONS collaboration bullets cleared; matching checklist `[x]`.

---

## Wave 5 — `/api/v2` expansion

**Status:** done

### Checklist links

- [x] Document supported v2 endpoints
- [x] `get_suites`, `get_sections`, `get_milestones`, `get_plans`
- [x] `get_statuses`

### Goal

Migration clients can read suite/section/milestone/plan data and custom statuses via v2; supported surface documented.

### Steps

1. API_SPEC supported matrix.
2. Implement read endpoints in `testrail.routes.ts`.
3. Contract tests.
4. (Optional 5b) Token scopes — document deferred.

### Done when

- Checklist v2 + document lines `[x]`.

---

## Implementation rules

1. Run `npm run lint -w apps/web` and `npm run test -w apps/server` before merge.
2. Apply Prisma migrations in deploy environments after schema waves.
3. Do not edit `.cursor/plans/*` plan files; update this BUILD_PLAN wave status instead.
