# Architecture

Last aligned: 2026-04-30

## System Overview
- This project is a web service based on:
  - Frontend: React + TypeScript
  - Backend: Node.js + TypeScript + Fastify
  - ORM/DB: Prisma + Supabase PostgreSQL
- Architecture style is **modular monolith**.
- Do not split into microservices in early/mid phases.
- Keep one API server, but separate by feature modules and layers.

## Monorepo Layout

```text
testrail-clone/
  apps/
    web/
    server/
  packages/
    shared/
    api-client/
  docs/
```

## Backend Layout

```text
apps/server/src/
  app.ts
  server.ts
  config/
  db/
    prisma.ts
  common/
    errors/
    middlewares/
    utils/
    types/
  domain/
    status.ts
    roles.ts
    permissions.ts
    invariants.ts
    testrailMapping.ts
  modules/
    auth/
    projects/
    suites/
    sections/
    cases/
    runs/
    results/
    automation/
    importExport/
    integrations/
    milestones/
    plans/
    requirements/
    reports/
    settings/
    testrail/
    tokens/
  plugins/
```

### Module Internal Layout

```text
moduleName/
  moduleName.routes.ts
  moduleName.service.ts
  moduleName.repository.ts
  moduleName.schema.ts
  moduleName.types.ts
  moduleName.test.ts
```

## Layer Responsibilities

### routes
- Handle HTTP request/response.
- Invoke request/response schema validation.
- Call service layer.
- Target rule: call service layer rather than Prisma directly.
- Current note: several newer baseline modules still call Prisma in route files; move them behind services/repositories when the workflow stabilizes.

### schemas
- Define request/response validation.
- Use Zod or Fastify schema.

### services
- Implement business logic.
- Define transaction boundaries.
- Validate domain invariants.
- Orchestrate repository calls.

### repositories
- Encapsulate Prisma DB access.
- Must not contain business policy decisions.

### domain
- Central place for:
  - status sets
  - role/permission model
  - invariant helpers
  - TestRail mapping constants

## Core Domain Boundaries
- `TestCase`: source specification only.
- `TestRun`: execution container.
- `TestInstance`: run-scoped executable unit generated from case selection.
- `TestResult`: append-only execution history for an instance.

### Mandatory Invariants
- `TestCase` must not store execution status.
- Updating `TestCase` must not mutate historical instance snapshots.
- Result writes are append-only.

## Transaction Design

### 1) createRunWithInstances
- Create `TestRun`
- Select target `TestCase` set
- Create `TestInstance` snapshots
- Execute in one `prisma.$transaction`

### 2) addResultToTestInstance
- Create `TestResult`
- Create `TestResultStep`
- Update `TestInstance.status`
- Optionally add `AuditLog`
- Execute in one `prisma.$transaction`

### 3) bulkAddResults
- Supports `atomic` option
- `atomic=true`: any failure rolls back entire batch
- `atomic=false`: save valid items and return failed items

## Frontend Architecture

```text
apps/web/src/
  App.tsx
  main.tsx
  shared/
    ui/
    api/
    hooks/
    utils/
    types/
  features/
    auth/
    projects/
    cases/
    runs/
```

### Frontend Principles
- React components focus on rendering and user interactions.
- API calls are isolated in api-client/feature API layer.
- Use TanStack Query for server state.
- Use TanStack Table for table/list views.
- Keep domain/business decisions in backend service layer.

## Shared Packages

## packages/shared
- Keep only shared constants/types:
  - `TestStatus`
  - `RunStatus`
  - `ProjectRole`
  - `ErrorCode`
  - common API types
- Do not place business logic here.

## packages/api-client
- Provide typed HTTP client for frontend.
- Centralize fetch/HTTP behavior.
- Frontend components must not call `fetch` directly.

## Security Principles
- Store API tokens as hash only (never plaintext).
- Enforce project permission checks on mutation APIs.
- Validate all request payloads via schema.
- Restrict CORS to allowed frontend origins.
- Do not commit real `.env` values.
- Frontend must not directly mutate core domain tables.
- Supabase PostgreSQL is accessed through backend server only.

## Extension Points
- automation upload adapter
- TestRail-compatible adapter
- custom fields
- webhook events
- report aggregation
- attachment storage
- Jira/GitHub integration
