# Documentation Alignment

This document defines which docs are canonical and where future updates should go.

## Canonical Documents

- Product specification entry point: [PRODUCT_SPEC.md](./PRODUCT_SPEC.md)
- Current execution roadmap: [ROADMAP.md](./ROADMAP.md)
- Domain terms and invariants: [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)
- API contracts, paths, request/response rules: [API_SPEC.md](./API_SPEC.md)
- Database schema and persistence policy: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- Screen requirements, routes, UX states: [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md)
- Route hierarchy and navigation rules: [ROUTE_MAP.md](./ROUTE_MAP.md)
- Component ownership and implementation status: [COMPONENT_MAP.md](./COMPONENT_MAP.md)
- Frontend architecture and data-flow rules: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- Implementation task breakdown: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
- TestRail parity gap checklist: [TESTRail_GAP_ANALYSIS.md](./TESTRail_GAP_ANALYSIS.md)
- Core workflow completion plan: [CORE_FEATURE_COMPLETION_PLAN.md](./CORE_FEATURE_COMPLETION_PLAN.md)

## Spec vs Roadmap Boundary

Put product requirements in spec documents:

- Domain concepts and invariants go in `DOMAIN_MODEL.md`.
- API endpoint lists and request/response contracts go in `API_SPEC.md`.
- Storage structure, indexes, and consistency policy go in `DATABASE_SCHEMA.md`.
- Screen-level actions, required APIs, loading/empty/error states go in `SCREEN_INVENTORY.md`.
- Overall product capability expectations go in `PRODUCT_SPEC.md`.
- TestRail parity gaps and missing feature categories go in `TESTRail_GAP_ANALYSIS.md`.
- Near-term implementation planning for main workflows and UI/UX integration goes in `CORE_FEATURE_COMPLETION_PLAN.md`.

Put delivery order in roadmap documents:

- Current phases, progress, and next implementation priorities go in `ROADMAP.md`.
- File-level implementation details can stay in `IMPLEMENTATION_PLAN.md`, but they must not redefine product behavior.

If a roadmap item conflicts with a spec, update the spec first and then adjust the roadmap.

## Canonical Domain Boundaries

- `TestCase`: authored source specification.
- `TestCaseVersion`: immutable case history.
- `TestRun`: execution container.
- `TestInstance`: run-scoped executable snapshot.
- `TestResult`: append-only execution history.

## API Path Convention

- Project-scoped endpoints prefer `/api/projects/:projectId/*`.
- Run creation: `POST /api/projects/:projectId/runs`.
- Run detail: `/api/projects/:projectId/runs/:runId`.
- Result registration/query: `/api/runs/:runId/results*`, `/api/tests/:testId/results`.
- Token and settings APIs prefer project scope: `/api/projects/:projectId/tokens`, `/api/projects/:projectId/settings/*`.
- Compatibility endpoints may live under `/api/v2`, but should reuse the same service layer.

## Naming Convention

- API examples prefer camelCase: `pageSize`, `caseId`, `testId`.
- Compatibility aliases such as `page_size`, `case_id`, `test_id` may be supported, but should be documented as aliases.

## Schema Baseline

- Audit fields: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`.
- `test_instances` snapshots are immutable after run creation.
- `test_results` are append-only.
- Authored records use optimistic locking where concurrent edits are possible.
- Attachments store metadata in PostgreSQL and binary content in object storage.
- Use `docs/DATABASE_SCHEMA.md` directly for schema content.
