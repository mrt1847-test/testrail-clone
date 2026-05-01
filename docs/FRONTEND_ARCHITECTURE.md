# Frontend Architecture

Last aligned: 2026-05-02

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

`features/projects` keeps project-scoped screens, and PR6 also split broad project API surfaces into domain-focused modules (`advancedApi`, `settingsApi`, `automationApi`, `planningApi`, `importExportApi`) to reduce single-file API growth.

## Data Flow

- Components render UI and wire user events.
- Feature API modules own HTTP paths and response normalization.
- Hooks own query keys, loading/error states, invalidation, and mutation orchestration.
- Backend services own domain decisions such as permissions, run/result invariants, versioning, and bulk validation.
- Shared `apiFetch` is the fetch compatibility layer until `packages/api-client` becomes the primary typed client.

## PR6 Refactor Status

- Completed:
  - `advancedApi` responsibilities were split into narrower domain API files to improve ownership and reduce coupling.
  - Run detail execution flow was decomposed: URL state, query composition, and bulk actions moved to dedicated hooks; result entry moved into focused UI components.
  - Result entry responsibilities are now separated across elapsed timer, defect keys, custom fields, and step-result editing components.
- Remaining debt:
  - continue extracting reusable run detail presentation blocks (header, summary bar, filter bar, instance table) for daily execution at scale.
  - tighten query-key ownership and mutation invalidation boundaries around run detail/result workflows.
  - keep reducing oversized page orchestration components where feature growth is still concentrated.

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
- Run detail orchestration increasingly lives in hooks and focused components rather than a single page-level component.

## Refactor Targets

- Split oversized page components when they block feature work.
- Introduce shared `StatusBadge`, `DataTable`, `FilterBar`, and form primitives when repeated UI behavior stabilizes.
- Continue narrowing remaining broad project API surfaces and converge on domain-first API ownership.
