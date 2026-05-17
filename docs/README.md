# Documentation Index

Last aligned: 2026-05-02

This folder keeps the current product, architecture, API, and delivery documents for the TestRail-like test management app.

## Canonical Documents

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md): product capability baseline and spec entry point.
- [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md): implemented, partial, and planned feature checklist.
- [ROADMAP.md](./ROADMAP.md): current delivery status and phased roadmap.
- [NEXT_ACTIONS.md](./NEXT_ACTIONS.md): immediate implementation queue.
- [DOMAIN_MODEL.md](./DOMAIN_MODEL.md): domain terms, relationships, and invariants.
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md): Prisma/PostgreSQL persistence model and schema policy.
- [API_SPEC.md](./API_SPEC.md): REST contract, compatibility conventions, and endpoint groups.
- [CI_AND_COMPATIBILITY_EXAMPLES.md](./CI_AND_COMPATIBILITY_EXAMPLES.md): copy-paste CI upload and `/api/v2` compatibility examples.
- [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md): screen-level requirements and UX states.
- [ROUTE_MAP.md](./ROUTE_MAP.md): actual frontend route tree and route ownership.
- [COMPONENT_MAP.md](./COMPONENT_MAP.md): implemented/planned component boundaries.
- [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md): frontend structure, data flow, and query policy.
- [ARCHITECTURE.md](./ARCHITECTURE.md): high-level system architecture.
- [DOC_ALIGNMENT.md](./DOC_ALIGNMENT.md): documentation ownership rules.

## Cleanup Decisions

Removed as obsolete or duplicate:

- `IMPLEMENTATION_PLAN.md`: early phase plan with stale completed tasks and corrupted text. Current execution work now lives in [ROADMAP.md](./ROADMAP.md) and [NEXT_ACTIONS.md](./NEXT_ACTIONS.md).
- `UI_FLOW.md`: duplicated route/screen flow content and had corrupted Korean text. Route facts now live in [ROUTE_MAP.md](./ROUTE_MAP.md); screen behavior lives in [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md).
- `CORE_FEATURE_COMPLETION_PLAN.md`: merged into [NEXT_ACTIONS.md](./NEXT_ACTIONS.md).
- `TESTRail_GAP_ANALYSIS.md`: merged into the parity sections of [ROADMAP.md](./ROADMAP.md).

## Maintenance Rules

- Update specs first when product behavior changes.
- Update [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) whenever a feature is implemented, downgraded, or newly discovered as missing.
- Update [ROADMAP.md](./ROADMAP.md) when delivery status changes.
- Update [NEXT_ACTIONS.md](./NEXT_ACTIONS.md) before starting the next implementation batch.
- Keep one canonical source per topic; do not recreate phase plans that duplicate roadmap, route, or screen inventory content.
