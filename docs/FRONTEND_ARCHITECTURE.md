# Frontend Architecture

Last aligned: 2026-04-30

## Overview

The frontend is a React + TypeScript Vite app using React Router and TanStack Query. Feature code lives under `apps/web/src/features`, shared UI/API helpers live under `apps/web/src/shared`, and `ProjectLayout` owns the project-scoped shell.

## Current Stack

- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- TanStack Table
- Tailwind CSS

## Current Directory Shape

```text
apps/web/src/
  App.tsx
  main.tsx
  index.css
  shared/
    api/
    ui/
  features/
    auth/
    cases/
    projects/
    runs/
```

`features/projects` currently contains several project-scoped screens that may later be split into narrower feature folders such as `automation`, `reports`, `settings`, `plans`, and `milestones`.

## Data Flow

- Components render UI and wire user events.
- Feature API modules own HTTP paths and response normalization.
- Hooks own query keys, loading/error states, invalidation, and mutation orchestration.
- Backend services own domain decisions such as permissions, run/result invariants, versioning, and bulk validation.
- Shared `apiFetch` is the fetch compatibility layer until `packages/api-client` becomes the primary typed client.

## Query Policy

- Keep query keys project-scoped when possible.
- Invalidate the narrowest affected query after mutations.
- Do not refresh the whole project after result entry.
- Fetch expensive child data on demand: case detail, result history, attachments, defects, audit logs, and report drilldowns.
- Lists that can grow large must use server-side pagination and filters.

## Route Ownership

- `App.tsx` owns the route tree.
- `ProjectLayout` owns project navigation and nested outlet rendering.
- Page components should stay thin and delegate form/table/panel work to smaller components as workflows grow.

## Case Workspace Pattern

- Case detail is inline and expandable from the case list.
- Query state keeps the selected section, expanded case, and edit mode addressable.
- Case updates use optimistic locking through `expectedVersion` or `If-Match`.
- Case custom field values are rendered from project field definitions and saved with the case payload.

## Run And Result Pattern

- Run list and result explorer use server-side filtering/pagination.
- Run detail loads run metadata, instances, selected result history, evidence, and defects as separate concerns.
- Result writes are append-only and update only the active run/test context.
- Closed runs reject result writes.

## Refactor Targets

- Split oversized page components when they block feature work.
- Introduce shared `StatusBadge`, `DataTable`, `FilterBar`, and form primitives when repeated UI behavior stabilizes.
- Move broad project-scoped API functions out of `features/projects/api/advancedApi.ts` into narrower modules over time.
