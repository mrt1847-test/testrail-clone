# Implementation Plan (Phase-based)

## Delivery Strategy
- Build in strict phases.
- Keep tasks small and testable.
- Prioritize data model correctness over UI breadth.
- Frontend baseline: React + TypeScript (+ Tailwind CSS/shadcn/ui, TanStack Query, TanStack Table, Recharts as UI choices).
- Backend baseline: Node.js + TypeScript + Fastify + Prisma + Supabase PostgreSQL.
- Test framework baseline: Vitest.
- Architecture baseline: modular monolith (single API server, feature modules + layered separation).

## Monorepo Target Structure
- `apps/web`
- `apps/server`
- `packages/shared`
- `packages/api-client`
- `docs`

## Backend Target Structure
- `apps/server/src/app.ts`
- `apps/server/src/server.ts`
- `apps/server/src/config/*`
- `apps/server/src/db/prisma.ts`
- `apps/server/src/common/{errors,middlewares,utils,types}/*`
- `apps/server/src/domain/{status,roles,permissions,invariants,testrailMapping}.ts`
- `apps/server/src/modules/{projects,suites,sections,cases,runs,results,automation,reports,tokens,attachments,users}/*`
- `apps/server/src/plugins/*`

## Module File Convention
- `moduleName.routes.ts`
- `moduleName.service.ts`
- `moduleName.repository.ts`
- `moduleName.schema.ts`
- `moduleName.types.ts`
- `moduleName.test.ts`

## Phase 0: Project Foundation

## Task 0.1 - Initialize monorepo skeleton
- Files:
  - `package.json`
  - `apps/web/*`
  - `apps/server/*`
  - `packages/shared/*`
  - `packages/api-client/*`
- Implementation:
  - Create React(TypeScript) frontend entrypoint.
  - Create Node.js(TypeScript) Fastify API server with health endpoint.
  - Add monorepo package boundaries for shared types and typed API client.
- Verification:
  - Run app and confirm `GET /api/health` returns ok.

## Task 0.2 - Add core config and DB wiring
- Files:
  - `apps/server/src/config/*`
  - `apps/server/src/db/prisma.ts`
  - `apps/server/src/plugins/*`
  - `.env.example`
- Implementation:
  - Add environment config for DB URL and app metadata.
  - Configure Prisma datasource for PostgreSQL/Supabase.
  - Configure Fastify app bootstrap and plugin boundaries.
- Verification:
  - Build server and verify config loader initializes without runtime errors.

## Task 0.3 - Add migration scaffolding
- Files:
  - `apps/server/prisma/schema.prisma`
  - `apps/server/prisma/migrations/*`
- Implementation:
  - Wire Prisma schema and migration baseline.
- Verification:
  - `prisma migrate dev` runs successfully (when DB URL is configured).

## Phase 1: Core Domain & Database

## Task 1.1 - Define base model and common fields
- Files:
  - `apps/server/prisma/schema.prisma`
- Implementation:
  - Define shared columns for timestamps, soft delete, and audit metadata.
- Verification:
  - Generated SQL includes expected shared columns where applied.

## Task 1.2 - Implement core entities
- Files:
  - `apps/server/prisma/schema.prisma`
  - `apps/server/src/domain/status.ts`
  - `apps/server/src/domain/roles.ts`
  - `apps/server/src/domain/permissions.ts`
  - `apps/server/src/domain/invariants.ts`
  - `apps/server/src/domain/testrailMapping.ts`
- Implementation:
  - Add tables for users/projects/members/suites/sections/cases/case steps.
  - Add run/instance/result/result step entities with strict separation.
  - Add status enum and TestRail-compatible mapping helper.
- Verification:
  - All FKs and unique constraints compile in metadata.
  - `test_cases` has no status field.

## Task 1.3 - Implement domain services (core execution flow)
- Files:
  - `apps/server/src/modules/runs/runs.service.ts`
  - `apps/server/src/modules/results/results.service.ts`
  - `apps/server/src/modules/reports/reports.service.ts`
  - `apps/server/src/modules/*/*.repository.ts`
- Implementation:
  - Implement `runService.createRunWithInstances()`.
  - Implement `resultService.addResultToTestInstance()`.
  - Implement `resultService.addResultForCaseInRun()`.
  - Implement `resultService.bulkAddResults()`.
  - Implement run summary calculation utility.
- Verification:
  - Run creation path creates run + instances correctly.
  - Result insertion updates `test_instances.status` and preserves history.
  - Bulk path supports both atomic and partial-failure flow.

## Task 1.4 - Create initial migration
- Files:
  - `apps/server/prisma/migrations/*`
- Implementation:
  - Create enum type and all required tables.
  - Add key indexes and unique constraints.
- Verification:
  - Migration applies cleanly to empty DB.
  - Downgrade drops objects in safe order.

## Task 1.5 - Seed baseline data
- Files:
  - `apps/server/prisma/seed.ts`
- Implementation:
  - Insert sample user/project/suite/sections/cases/run/instances/results.
  - Include both passed and failed sample results.
- Verification:
  - Seed completes without FK or uniqueness errors.
  - Result insertion updates instance latest status.

## Task 1.6 - Add minimal tests and quality checks
- Files:
  - `apps/server/src/modules/runs/runs.test.ts`
  - `apps/server/src/modules/results/results.test.ts`
  - `apps/server/src/modules/reports/reports.test.ts`
  - `apps/server/src/common/middlewares/*`
- Implementation:
  - Add health endpoint smoke test (Fastify).
  - Add sanity check for status mapping utility.
  - Add service-level tests for run/result flow.
- Verification:
  - `vitest` passes locally.

## Prisma Transaction Rules
- `runService.createRunWithInstances()` must run in one Prisma transaction:
  - create `test_runs`
  - create all `test_instances`
- Result write paths must run in one Prisma transaction:
  - create `test_results`
  - create `test_result_steps`
  - update `test_instances.status`
  - optionally create `audit_logs`

## Layer Enforcement Rules
- Routes call service only.
- Services own transaction boundaries and invariant checks.
- Repositories perform DB access only (no business rules).
- Domain files own status/role/permission/mapping/invariant constants and helpers.

## Phase 2 Preview (Next)
- Project/suite/section/case CRUD APIs
- Case step CRUD
- Basic filtering and pagination

## UI Delivery Tracks (Separated from Backend)

### UI Phase U0: App Shell Foundation
- Scope:
  - `AppShell`, `ProjectHeader`, `ProjectTabs`, `Breadcrumb`
  - shared states: `LoadingState`, `ErrorState`, `EmptyState`, `ConfirmDialog`
- Depends on Backend:
  - no hard dependency (mock/static 가능)
  - optional `GET /projects` for switcher context

### UI Phase U1: Entry and Project Screens
- Scope:
  - `/login`, `/projects`
  - `ProjectListPage`, `ProjectCreateDialog`, `ProjectEmptyState`
- Depends on Backend:
  - `POST /auth/login`
  - `GET /auth/me`
  - `GET /projects`
  - `POST /projects`
- Backend prerequisite phase: B2 (`projects` module ready)

### UI Phase U2: Test Case Workspace (Expandable Detail)
- Scope:
  - `/projects/:projectId/cases`
  - `CaseListPane`, `CaseListTable`, `CaseRow`, `ExpandableCaseDetail`, `SectionTreePane`
  - 단일 확장 규칙(`expandedCaseId`) + query sync(`sectionId`, `caseId`, `mode`)
- Depends on Backend:
  - `GET /projects/:projectId/sections`
  - `POST /projects/:projectId/sections`
  - `GET /projects/:projectId/cases`
  - `GET /cases/:caseId`
  - `POST /projects/:projectId/cases`
  - `PATCH /cases/:caseId`
  - `DELETE /cases/:caseId`
- Backend prerequisite phase: B2 (`sections`, `cases` module ready)

### UI Phase U3: Run List and Run Create
- Scope:
  - `/projects/:projectId/runs`
  - `/projects/:projectId/runs/new`
  - `RunListTable`, `RunCreateForm`, `RunCaseSelector`, `EnvironmentEditor`
- Depends on Backend:
  - `GET /projects/:projectId/runs`
  - `POST /projects/:projectId/runs`
  - `GET /projects/:projectId/suites`
  - `GET /projects/:projectId/cases`
  - `GET /projects/:projectId/milestones` (optional)
- Backend prerequisite phase: B3 (`runs` core create/list ready)

### UI Phase U4: Run Detail Workspace
- Scope:
  - `/projects/:projectId/runs/:runId`
  - `RunSummaryBar`, `TestInstanceTable`, `ResultEntryPanel`, `ResultHistoryList`, `StepResultEditor`
- Depends on Backend:
  - `GET /projects/:projectId/runs/:runId`
  - `GET /projects/:projectId/runs/:runId/instances`
  - `POST /runs/:runId/results`
  - `GET /instances/:instanceId/results`
  - `POST /runs/:runId/close`
- Backend prerequisite phase: B3 (`results` and run status sync ready)

### UI Phase U5: Automation Workspace
- Scope:
  - `/projects/:projectId/automation`
  - `/projects/:projectId/automation/uploads/:uploadId`
  - `AutomationDashboard`, `AutomationMappingTable`, `AutomationUploadHistory`, `BulkUploadResultDetail`
- Depends on Backend:
  - `GET /projects/:projectId/automation/mappings`
  - `GET /projects/:projectId/automation/uploads`
  - `GET /projects/:projectId/automation/uploads/:uploadId`
  - token lifecycle APIs
- Backend prerequisite phase: B4 (automation upload + token APIs ready)

### UI Phase U6: Dashboard and Reports
- Scope:
  - `/projects/:projectId`
  - `/projects/:projectId/reports`
  - summary cards + charts + recent failures tables
- Depends on Backend:
  - `GET /projects/:projectId/overview`
  - `GET /projects/:projectId/reports/status-distribution`
  - `GET /projects/:projectId/reports/failure-trend`
  - `GET /projects/:projectId/reports/automation-coverage`
  - `GET /projects/:projectId/reports/recent-failures`
- Backend prerequisite phase: B5 (`reports` aggregation endpoints ready)

### UI Phase U7: Settings and Advanced UI
- Scope:
  - `/projects/:projectId/settings`
  - `/projects/:projectId/settings/tokens`
  - `/projects/:projectId/settings/members`
- Depends on Backend:
  - settings CRUD APIs
  - token CRUD APIs
  - members CRUD APIs
- Backend prerequisite phase: B7 (`permissions`, governance features hardened)

## Backend and UI Dependency Matrix

### Backend Phase IDs
- B0: Project foundation
- B1: Core domain and database
- B2: Project/suite/section/case management APIs
- B3: Runs/instances/results APIs
- B4: Automation upload and token APIs
- B5: Dashboard/report aggregation APIs
- B6: Milestones/plans/environment matrix
- B7: Advanced governance and integrations

### UI-to-Backend Mapping
- U0 -> B0 (부분 의존)
- U1 -> B2
- U2 -> B2
- U3 -> B3
- U4 -> B3
- U5 -> B4
- U6 -> B5
- U7 -> B7

## Change Management Rules
- Before each implementation batch:
  - Share target files and expected scope.
- After each batch:
  - Share changed files and verification result.
- Keep migration and seed deterministic for team onboarding.
