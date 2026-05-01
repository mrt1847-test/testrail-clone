# Product Spec

Last aligned: 2026-04-30

This is the canonical entry point for the TestRail-like product specification.
Roadmaps describe delivery order; this document and the linked spec files describe what the product must do.

## Canonical Spec Documents

- Domain model and invariants: [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)
- API contracts and endpoint behavior: [API_SPEC.md](./API_SPEC.md)
- Database schema and storage policies: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- Screen inventory and UX states: [SCREEN_INVENTORY.md](./SCREEN_INVENTORY.md)
- Route map: [ROUTE_MAP.md](./ROUTE_MAP.md)
- Component ownership map: [COMPONENT_MAP.md](./COMPONENT_MAP.md)
- Frontend architecture: [FRONTEND_ARCHITECTURE.md](./FRONTEND_ARCHITECTURE.md)
- High-level architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Roadmap and TestRail parity gaps: [ROADMAP.md](./ROADMAP.md)
- Immediate implementation queue: [NEXT_ACTIONS.md](./NEXT_ACTIONS.md)

## Product Shape

The app is a test management system, not a generic CRUD tracker. The core product flow is:

```text
Project -> Suite -> Section -> Test Case -> Test Run -> Test Instance -> Test Result history
```

The product must preserve these boundaries:

- `TestCase` is the authored source specification.
- `TestCaseVersion` preserves immutable authored history.
- `TestRun` is a time-bound execution container.
- `TestInstance` is the run-scoped executable snapshot of a case.
- `TestResult` is append-only execution evidence.

## Required TestRail-like Capabilities

### Authoring and Change Safety
- Project, suite, section, and case management.
- Case steps with stable ordering.
- Case version history.
- Optimistic locking for authored records so concurrent edits cannot silently overwrite each other.

### Execution
- Run creation from all cases or selected cases.
- Run-scoped test instances with immutable snapshots.
- Manual result entry and bulk result entry.
- Step-level result entry.
- Append-only result history.
- Run closing/reopen policy.
- Assignment and "My Tests" workflow.
- Rerun workflow from failed/blocked/retest/all subsets.

### Automation
- Project-scoped API tokens.
- Bulk automation result upload.
- Mapping by case id, automation key, and external id.
- CI metadata storage.
- Upload history, failed item visibility, and retry policy.
- TestRail-compatible API adapter baseline under `/api/v2`.

### Planning
- Milestones.
- Test plans.
- Plan entries.
- Configuration groups and values.
- Matrix-based run generation for browser/device/OS/environment combinations.

### Evidence and Integrations
- Result attachments using object storage and signed URLs.
- Normalized result-to-defect links.
- Defect integration settings for Jira/GitHub/Azure-style providers.
- Import/export jobs for cases, results, and reports.

### Reporting and Traceability
- Project overview and operational dashboards.
- Run summary and status distribution.
- Recent failures and recent results.
- Requirement records.
- Case-to-requirement links.
- Requirement coverage, coverage gaps, traceability matrix, and defect coverage reports.

### Collaboration and Administration
- Project members and roles: `owner`, `manager`, `tester`, `viewer`.
- Activity timeline.
- Notification inbox and preferences.
- Custom fields, custom statuses, and case templates.
- Audit logs and webhook events.

## Performance and Freshness Rules

- Case/run/result lists must be paginated and filterable.
- Expensive children such as steps, attachments, result history, and defect links load on detail expansion.
- Result entry updates the active test instance optimistically and revalidates only the active run context.
- Realtime events should invalidate scoped queries. They must not trigger full project reloads.
- Summary counters may be cached or materialized, but canonical detail must remain reconstructable from append-only source tables.

## Implementation Status Source

Current delivery order and progress live in [ROADMAP.md](./ROADMAP.md). If roadmap text conflicts with this product spec, update the spec first and then adjust the roadmap.

The current app is not yet a full TestRail feature clone. Use the parity sections in [ROADMAP.md](./ROADMAP.md) as the canonical checklist when deciding what remains beyond the core execution workflow.

For near-term execution, use [NEXT_ACTIONS.md](./NEXT_ACTIONS.md). It narrows the broad parity list into the main workflows: test case management, execution/result entry, reports/traceability, and UI/UX integration.
