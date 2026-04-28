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

### Phase 2 Critical Migration Task
- Replace memory repositories with Prisma repositories for:
  - projects
  - suites
  - sections
  - cases
- Keep same service interfaces and swap concrete repository binding in `buildApp()`.
- Verification:
  - CRUD data persists after server restart
  - `/api/projects/:projectId/cases` reflects DB state
  - UI project/cases screens work with DB-backed data only

## UI Delivery Tracks (Separated from Backend)

이 섹션은 구현 순서와 backend dependency만 다룬다.

- UI delivery order는 `ROADMAP.md`를 따른다.
- 화면별 required API는 `SCREEN_INVENTORY.md`를 따른다.
- endpoint 계약은 `API_SPEC.md`를 따른다.
- 컴포넌트 책임은 `COMPONENT_MAP.md`를 따른다.

### UI Phase U0: App Shell Foundation
- Scope: project shell, navigation, shared state UI
- Depends on Backend: B0, optional project context API
- Implementation tasks:
  - normalize shell layout across project routes
  - keep shared state components reusable

### UI Phase U1: Entry and Project Screens
- Scope: login, project selection, project creation, project overview entry
- Depends on Backend: B2 plus auth baseline
- Implementation tasks:
  - add auth bootstrap path
  - connect project list/create mutations
  - enforce membership-aware navigation states

### UI Phase U2: Test Case Workspace (Expandable Detail)
- Scope: section/case CRUD workspace, expandable case detail, query sync
- Depends on Backend: B2
- Implementation tasks:
  - connect DB-backed section/case queries
  - implement single-expand query state
  - connect create/update/delete mutations
  - defer bulk/import/export to UI Phase 2B

### UI Phase U3: Run List and Run Create
- Scope: run list, run creation, case selection, environment input
- Depends on Backend: B3
- Implementation tasks:
  - connect run list query
  - create run from selected cases/include-all
  - navigate to created run detail

### UI Phase U4: Run Detail Workspace
- Scope: run detail, instance selection, result entry, result history, close run
- Depends on Backend: B3
- Implementation tasks:
  - connect run/instance summary
  - add result mutation and cache invalidation
  - show selected test history
  - wire close run action

### UI Phase U5: Automation Workspace
- Scope: automation dashboard, mappings, upload history/detail, token entry
- Depends on Backend: B4
- Implementation tasks:
  - connect automation summary/mapping/upload queries
  - connect token management path
  - add retry/reprocess UX after backend support

### UI Phase U6: Dashboard and Reports
- Scope: project overview, reports dashboard, traceability/coverage expansion
- Depends on Backend: B5
- Implementation tasks:
  - connect overview widgets
  - connect report widgets independently
  - add traceability/coverage views after backend aggregations

### UI Phase U7: Settings and Advanced UI
- Scope: settings categories, tokens, members, fields/statuses/templates, integrations, notifications
- Depends on Backend: B7
- Implementation tasks:
  - connect tokens first for automation
  - add members/permissions management
  - add governance/customization settings incrementally

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
- U1 -> B2 (auth bootstrap은 B1/B0 baseline 선반영 허용)
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
